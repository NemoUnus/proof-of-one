# Proof of One — re-review of app v0.17 (fixes for the v0.16 review) and of the enrolment service's RPC fallback

Reviewer: Hypatia (AI agent, Proof of One). I did not write this code. It was reviewed read-only and statically: there is no Android SDK here.
Date: 26 November 2026.

Tree reviewed: a clean checkout of the repository, diffed against the v0.16 copy reviewed earlier. Files:

- **App:** Profiles.kt, MainActivity.kt, EnrolActivity.kt, Registration.kt, FaceCheckActivity.kt, VoteActivity.kt, Ui.kt and L10n.kt (all 8 languages, for the 11 changed or new keys), AndroidManifest.xml, `res/xml/data_extraction_rules.xml`, `app/build.gradle.kts`, and the README v0.17 section.
- **Service:** `reference/enrol-service/src/service.js`, `wrangler.toml` and `test/service.test.mjs`. All 28 enrol-service tests pass (node 22). I ran them in a scratch copy, with the sibling `document-circuit` and `ballot-circuit` packages and their locked dependencies (`npm ci --ignore-scripts`). The 5 new RPC tests are among them.
- **Consent:** `docs/pilot/consent-v0.5.md` and `consent-v0.5-fa.md`.
- **CI:** `.github/workflows/android-prototype.yml`.

---

## 1. Summary verdict

**Ready after fixes.** Most v0.16 findings are fixed well. In particular:

- F1: chip data is cleared and the test tools appear only in test builds.
- F3: writes are bound to the member they were read from.
- F4: phone-to-phone transfer is excluded.
- F5: the member number is now an HMAC tag.
- F7 and F17 are fixed, and the Persian consent matches the English.

Two high items remain before the pilot:

- **N1 (High) — changing the phone's clock bypasses the new password wait.** The code decides whether the phone has restarted by comparing wall-clock times. Moving the clock forward by more than 2 minutes, and past the remaining wait, therefore switches the check to the wall clock, where the wait has already "passed". A person holding the phone can make one guess per clock change, instead of one per hour. The README claims "changing the clock does not help", which is not true.
- **N2 (High) — the pilot signing key is exposed in CI.** The key is used in the same CI job that downloads and runs unverified tools, and that job runs on a push to *any* branch. Whoever obtains this key can ship an update that installs over the pilot app, takes over its private files and its Keystore keys, and catches each member's password at the next unlock. The key protects every participant's stored secrets.

## 2. Status of the v0.16 findings

| # | v0.16 severity | Status | Note |
|---|---|---|---|
| F1 | High | **Fixed** | `clearChip()` runs in `lock()`, in `EnrolActivity.done()` and `onDestroy(isFinishing)`, and on every MainActivity page without an open member. Test tools appear only when FLAG_DEBUGGABLE is set. "Share report" is offered only on the chip page or to an open member. See N6 for a minor side effect |
| F2 | High | **Partly fixed** | Per-member throttle on disk, counted before Argon2, works across navigation, rotation and restart. **It can be bypassed by changing the clock (N1)**, and two attempts in parallel can lose a count (N5) |
| F3 | Medium | **Mostly fixed** | `write(ctx, expectedId, …)` checks the member inside the lock. `create()` runs Argon2 outside the lock and opens the new member only if `current == openedAtStart`. Registration passes the id. **Regression:** the new F6 path calls `Profiles.unlock`, which ignores `openedAtStart` (N3) |
| F4 | Medium | **Fixed** | `dataExtractionRules` (cloud and device-transfer, all domains) plus `fullBackupContent="false"`. `OtherPhone` is detected before the throttle counts a try. The `unlockOtherPhone` text gives the steps in the wrong order (N8) |
| F5 | Medium | **Fixed (with a remainder)** | HMAC-SHA256 under the Keystore key `poo-numbers`. Members saved by v0.16 keep the unkeyed hash until they are opened once; that is acceptable. See N4 for how the key is created |
| F6 | Medium | **Partly fixed** | Adding the template works only if a backup exists at the service **and** the local password equals the backup password. Otherwise there is a dead end. It also opens or closes members outside `openedAtStart` (N3) |
| F7 | Medium | **Fixed** | `unlockForgot` and `consentSummary` are corrected in all 8 languages, and consent §7.4 matches the service's `alreadyEnrolled` behaviour |
| F8 | Medium | **Fixed by disclosure** | Consent v0.5 §4 and the §10 table describe what the third-party RPC sees. The code still queries nullifiers per poll on the category list; that is acceptable now that it is disclosed |
| F9 | Medium | **Fixed** | `largeHeap="true"`. `OutOfMemoryError` is caught in unlock, migrate and `retryRestore`, with the `lowMemory` message. The enrolment thread already caught `Throwable` |
| F10 | Medium | **Partly fixed** | The fallback is sound: it fails closed and requires at least 2 agreeing fallbacks from 3 different operators. Still open: the primary endpoint alone decides, and a 502 still burns the session (N9) |
| F11 | Medium | **Fixed**, with a new CI concern | The Gradle build fails in CI without the key, and the workflow stops early if the secrets are missing. The pkcs12 file is removed only when the build succeeds (N7). See **N2** |
| F12 | Low–Med | **Partly fixed** | A 20 s check closes the member on HOME, and the consent discloses that the registration page keeps it open. **VoteActivity still shows the member's recorded answer indefinitely** when left on screen (N11) |
| F13 | Low | **Partly fixed** | Failed tries are counted per member, with a 10-minute cool-down. The count is held in memory and timed by the wall clock, so killing the app or changing the clock resets it, though the consent says "the app waits ten minutes" (N10) |
| F14 | Low | **Fixed** | Label hint and consent §7.4 and §9, in all 8 languages |
| F15 | Low | **Fixed** | A closed member can be removed after a confirmation, and `old()` now asks first. The consent discloses that anyone holding the phone can remove a member |
| F16 | Low | **Fixed** | `member.json` is renamed to `member.json.moving`, with a `withNumber` check, then overwritten and deleted, and the `.part` file is removed. One minor edge: N12 |
| F17 | Low | **Fixed** | `pendingChoice` is saved; the member is re-read after the face check; checks for lock, other member and not-loaded, with the `voteAgain` message |
| F18 | Low | **Partly fixed** | Similarity is rounded to one decimal. Consent §5 says the signer certificate is in the shared text only "for a passport that could not be read", but the code adds it whenever a chip was read (N13) |
| F19 | Low | **Partly fixed** | `IME_FLAG_NO_PERSONALIZED_LEARNING` is on all fields. Binding the key to an unlocked device is deferred (stated). The AAD is unchanged |

## 3. New findings

| # | Severity | Area | Title |
|---|---|---|---|
| N1 | **High** | Brute force | The password wait can be bypassed by setting the clock forward, because restart detection uses wall-clock time |
| N2 | **High** | Supply chain | The pilot signing key is used in the same job as unverified downloads, on a push to any branch; theft of the key means all participants' stored secrets can be taken |
| N3 | Medium | F6 / isolation | Adding the template needs a stored backup and the same password, otherwise it is a dead end. Its `unlock` closes another open member and leaves this one open |
| N4 | Low–Medium | Robustness | The HMAC key is created on first use with a race. A Keystore failure during `create` after `/enrol` (before `/backup`) locks the person out for good |
| N5 | Low | Throttle | Two unlock attempts can run at once (rotation during Argon2): the count is read and written without a lock, and Argon2's memory is needed twice |
| N6 | Low | UX | After Back from EnrolActivity the chip is cleared, but MainActivity's chip page still offers "Next"; `run()` returns silently when the chip is gone |
| N7 | Low | CI | The pkcs12 file is not removed when the build fails (no `trap`), and it is written with the default umask |
| N8 | Low | Strings | `unlockOtherPhone` says to restore first and then remove the copy; a v0.16 copy can block that restore |
| N9 | Low–Medium | Service | RPC: the session is burned on 502, the primary is trusted alone, there is no chain-id check, and duplicate URLs are not removed |
| N10 | Low | Face check | The cool-down is held in memory and timed by the wall clock |
| N11 | Low–Medium | Isolation | VoteActivity and PollsActivity have no idle lock while on screen, and the vote screen shows the recorded answer |
| N12 | Low | Migration | Retrying after a crash silently ignores the newly typed password |
| N13 | Low | Consent | The wording about the signer certificate in the shared text is narrower than what the code shares |

## 4. Details

### N1 — The password wait can be bypassed by changing the clock (High)

**Where.** Profiles.kt:182–199:

```kotlin
private fun bootWall() = System.currentTimeMillis() - android.os.SystemClock.elapsedRealtime()
...
val sameBoot = Math.abs(t.optLong("boot") - bootWall()) < 120_000L
val left = if (sameBoot) t.optLong("untilElapsed") - android.os.SystemClock.elapsedRealtime()
           else t.optLong("untilWall") - System.currentTimeMillis()
```

**Mechanism.** `bootWall()` is the wall-clock time minus the time since start. Setting the clock forward by Δ changes `bootWall()` by Δ. When Δ is more than 120 s, `sameBoot` becomes false and the wall clock is used. That clock was just moved forward by Δ, so when Δ is at least the remaining wait, `left ≤ 0` and the try is allowed. `countTry` then saves the shifted `boot`, so the next wait is again enforced on the running clock until the clock is moved forward once more.

I worked this through by hand:

1. A wrong try at wall time W sets `boot = B` and `untilWall = W + d`.
2. The attacker sets the clock to W + d + 3 min. Now `bootWall() = B + d + 3 min`, which differs from B by more than 120 s, and `untilWall − now < 0`, so a try is allowed at once.

Moving the clock back only makes the wait longer.

**Effect.** With automatic time switched off, each guess costs a trip to Settings to move the clock forward by about an hour, roughly 20 s by hand. That is about 3 guesses a minute instead of 1 an hour. An 8-character password from a common list falls within days. README v0.17 ("changing the clock does not help") and consent v0.5 §9 ("longer each time (up to an hour)") overstate the protection.

**Fix.**
- Detect a restart with `Settings.Global.getInt(contentResolver, Settings.Global.BOOT_COUNT)` (API 24+; minSdk is 26), saved in the throttle file, instead of comparing wall-clock times.
- Same boot count: use only `untilElapsed`.
- Different boot count: do not trust the wall clock. Restart the full delay for the stored `fails` on the running clock from now, by rewriting `untilElapsed` and `boot` on the first check after the restart. A restart then costs the attacker a full wait instead of saving one.
- Add a unit test with a fake clock covering: clock moved forward, clock moved back, and a restart.

### N2 — The pilot signing key is exposed in CI (High)

**Where.** `.github/workflows/android-prototype.yml`:

- `on: push` (any branch; lines 17–26).
- Earlier steps in the **same job** download and run unverified code: the circom binary from a GitHub release with no checksum (line 76), the Kotlin compiler zip with no checksum (line 130), circom-witnesscalc cloned by tag and built, several `npm ci` runs (with lockfiles), and actions pinned by tag rather than commit SHA.
- The signing step (lines 160–173) then writes the pkcs12 file and runs `gradle assembleRelease` with `POO_KEYSTORE_PASSWORD` in the environment.

**Why it matters more than usual.** An update signed with the pilot key installs over the pilot app and **inherits its uid**: its private files and its Android Keystore keys. Such an update can remove the outer layer of every member file and capture each member's password at the next unlock. Taking the key therefore means taking every participant's stored secrets on update.

Two ways in:
1. Any earlier step that is compromised can leave something behind that runs during the Gradle build in the signing step, for example `~/.gradle/init.d`, a modified build file, or a background process.
2. Anyone who can push to *any* branch (a collaborator, or a leaked token) can change the workflow on that branch to print or upload the secrets.

**Fix.**
- Build an **unsigned** APK in the build job and upload it as an artifact. Sign in a separate job that only checks out nothing, downloads that artifact, and runs `apksigner` from the SDK.
- That signing job runs under a GitHub **Environment** ("pilot-signing") whose secrets are restricted to the protected `main` branch and need a reviewer's approval.
- Pin actions by SHA, and check SHA-256 for circom and the Kotlin compiler (as is already done for the face models).
- In the signing job, write the key with `umask 077` and use `trap 'rm -f "$POO_KEYSTORE"' EXIT` (see N7).
- Publish the expected signing-certificate SHA-256 in the README, so volunteers or the coordinator can check `apksigner verify --print-certs` against it.

### N3 — The face-template path (F6) has dead ends and bypasses `openedAtStart` (Medium)

**Where.** EnrolActivity.kt `saveMember` (diff lines 311–322); the call sites are the `alreadyEnrolled` branch (≈ line 455) and `retryRestore`.

**Dead ends.**
1. The path is reached only after `Backup.open` succeeds. A v0.15 member whose backup was never stored (`noBackup`) never reaches `saveMember`, and gets "already enrolled, no backup" with no template.
2. `Profiles.unlock(here.id, password)` uses the backup password. Migration let the member choose any password ("use the same password as for your backup" is advice only). If the two differ, `unlock` returns `WrongPassword`, the code shows `memberHere` ("already on this phone, open it from the list"), and the member is no further. The local member's throttle is also counted.
3. `Opened.Wait` and `OtherPhone` are also shown as `memberHere`.

**Isolation.** `Profiles.unlock` calls `lock()` and opens `here` whatever `openedAtStart` was. An enrolment left running after Back that ends here closes whatever member is open now. When `here` already has a template, the function returns `memberHere` but leaves `here` open.

**The template itself is safe.** It comes from the current chip, and the person passed the face check against that chip just before. The service recognised the same person key, and the number matches.

**Fix.**
- Add `Profiles.addFace(ctx, id, password, face, openedAtStart)`. It derives the key and decrypts, adds `face`, and re-encrypts **without** changing `current`, except when `current == openedAtStart`. It counts the throttle like `unlock`.
- In the `alreadyEnrolled` branch, try this path *before* depending on the backup: `number` is already known from the OPRF in this session. When `withNumber(number)` finds a local member without a template, ask for **that member's** password: show "this membership is already here; enter its password to add the face check".
- Give distinct messages for wrong password, wait and other phone.
- Update `faceCheckNoTemplate` (all languages) to say which password is meant.

### N4 — HMAC key creation and saving after `/enrol` (Low–Medium)

**Where.** Profiles.kt:82–90; EnrolActivity.kt:488, where `saveMember` runs before `/backup`.

- **Race.** The `poo-numbers` key is created on first use without a lock. Two threads, for example the conversion inside `unlock` and an enrolment's `withNumber`/`create`, can both find no key and both generate one. The second replaces the first, so tags made with the first key no longer match and the duplicate check misses that member, silently. Fix: `@Synchronized` with a re-check, or create the key once at app start.
- **Permanent lockout (plausible).** v0.17 adds a Keystore operation (HMAC) inside `withNumber`/`create`, which run after the service has enrolled the person and before `/backup`. If Keystore throws there (a broken OEM Keystore, or a full disk), the credential is not saved on the phone and no backup is stored. The service will then answer `alreadyEnrolled` with `backup: null` for good, so the person cannot take part in the pilot. The ordering existed before (the AES Keystore key in `create`); v0.17 adds another way to fail.
- **Fix.**
  - Seal and store the backup first. `/backup` needs only `saved`, the password and the seed, not the local save.
  - Make `numberTag` failures non-fatal in `create` (store an empty tag and skip the duplicate check).
  - If the local save fails after a successful `/backup`, show "enrolled; restore with your password" instead of a generic error.

### N5 — Two unlock attempts at once (Low)

**Where.** `Profiles.unlock` is no longer `@Synchronized`. A rotation during Argon2 recreates MainActivity with the button enabled, while the old thread keeps running.

**Effects.** Two attempts can pass `waitSeconds` together, and `countTry` (read, add one, write through `.part` and rename) can lose an increment. Two Argon2 runs at the same time need about 2 × 64 MiB.

**Fix.** Use a per-member lock around check, count and derive, for example `synchronized(lockFor(id))`. Alternatively, disable the button while any unlock is running (a static flag).

### N6 — Chip cleared after Back from EnrolActivity (Low)

- Back from consent → `onDestroy(isFinishing)` → `clearChip()`. MainActivity resumes on the CHIP page, which still shows "Next". Tapping it opens EnrolActivity, which stops with `readFirst`. That is acceptable, but the chip page should go back to DETAILS when `DocStore.chip == null`.
- EnrolActivity.kt:373 `val chip = DocStore.chip ?: return` makes the Enrol button do nothing, with no message, if the chip was cleared while the screen stayed open. Show `readFirst` instead.
- I found no path where `clearChip` runs *during* an enrolment that still needs the chip: the enrolment thread captures `chip` when it starts, and `chipFace` is held in a field. The F6 `unlock` inside `saveMember` clears the chip, but only after everything that needs it is done.

### N7 — CI key file handling (Low)

Workflow lines 170–173: `rm -f "$POO_KEYSTORE"` runs only if Gradle succeeds, because the step runs under `bash -e`. The file is written with the default umask. Hosted runners are discarded after the job, so the risk is low, but use `umask 077` and `trap 'rm -f "$POO_KEYSTORE"' EXIT`. The `GradleException` in `build.gradle.kts` triggers only with `CI=true` and no key, and the secret check in the workflow fails earlier anyway. Both are good.

### N8 — The other-phone message gives the steps in the wrong order (Low)

`unlockOtherPhone` (all languages) says to restore with "Add a member", *then* remove the copy. A copy from v0.16 carries the unkeyed `numberHash`, which `withNumber` still matches. The restore then takes the F6 path, `unlock` returns `OtherPhone`, and the user sees `memberHere`. The copy also uses one of the 4 slots.

Fix: tell the user to *remove this copy first* (button on the same page), then restore. Also make `withNumber` skip members whose hardware key is missing.

### N9 — RPC fallback, checked against my F10 list (Low–Medium)

**What is good:**
- Three separate operators (publicnode, dRPC, Tenderly), all different from the primary.
- At least 2 answers needed; any disagreement → 502 (fail closed). One lying fallback cannot get a forged proof accepted.
- Retries of the primary are not counted as answers.
- 8 s timeout; non-JSON, HTTP errors and malformed `result` are treated as "no answer".
- Tests cover these cases, and all pass.

**Still open:**
1. **The session is still burned on 502.** service.js sets `state = 2` (the `claim`) before `verifyOnChain`, so on every RPC failure the volunteer must repeat session and evaluate, which counts against `DAILY_SESSIONS`. This is exactly what happened on 25 Nov. Fix: on a 502 from `verifyOnChain`, reset `state = 1` (`UPDATE … WHERE id = ? AND state = 2`) before re-throwing, so the phone can resend `/enrol` in the same session.
2. **The primary alone decides** when it answers. This is the documented choice, but a compromised or lying `sepolia.base.org` (or a DNS or TLS man-in-the-middle at the Worker's edge) can get a forged π_doc accepted. Cheap alternative: when the primary says `1`, require one fallback to confirm, in parallel; it costs one extra request per enrolment.
3. There is no `eth_chainId` check per endpoint. A misconfigured fallback on another chain would most likely return `0x` (refused, so safe), but please pin 84532.
4. `RPC_FALLBACKS` is not de-duplicated and not checked against `RPC_URL`: the same URL listed twice counts as two "independent" answers. Fix: `new Set`, and remove `RPC_URL` from the list.
5. The comment "one dishonest or broken endpoint cannot … refuse a genuine one on its own" is false when the primary is down: one fallback answering `0` against another answering `1` gives 502. That is fail-closed and acceptable, but please correct the comment.
6. `result` is accepted with 1–64 hex digits instead of exactly 64. This is harmless for `=== 1n`.

### N10 — Face-check cool-down (Low)

FaceCheckActivity.kt: `failed` is a static map, held in memory and timed by `System.currentTimeMillis()`. Killing the app or changing the clock resets it. That is acceptable for a deterrent, but consent v0.5 §7 says plainly "the app waits ten minutes". Either save it in the throttle file and use the running clock (with N1's fix), or reword the consent: "…waits ten minutes (while the app stays open)".

### N11 — Screens other than HOME have no idle lock (Low–Medium)

`lockWatch` runs only in MainActivity on HOME. VoteActivity shows the member's **recorded answer** (`voteRecorded`, the result card with `resultYours`), and PollsActivity shows which polls were answered. Neither closes while left on screen: they check only in `onResume`. On a shared phone, the answer stays readable past the 5 minutes the consent promises.

Fix: move the 20 s watch into a small base class (or a helper called from `onResume` and `onPause`) used by PollsActivity, VoteActivity and FaceCheckActivity, which calls `Profiles.guard` when the member has closed.

### N12 — Migration retry ignores the new password (Low)

If the app dies between `create` and deleting the `.moving` file, the retry (MainActivity.kt:351–359) finds the member through `withNumber` and skips `create`. The password and label typed in the retry are silently ignored, and the member keeps the first password. Fix: when a duplicate is found, show "already moved; open it with the password you chose the first time".

### N13 — Consent wording on the signer certificate in the shared text (Low)

Consent v0.5 §5 (and the Persian) says the shared text holds the signer certificate "for a passport that could not be read". MainActivity.kt:243 adds `dscPem` to `shareText` whenever a chip was read, and it can be shared from the chip page and, after enrolment, by the open member until registration replaces the text.

Fix: either share the PEM only when `!ready` (the passport could not be used), or change the text to "…the public certificate that signed your passport (the same for many passports of that country and period)".

## 5. Translations and consent

- **The 11 changed or new keys** (`unlockForgot`, `memberLabelHint`, `membersNote`, `unlockWait`, `faceCheckNoTemplate`, `consentSummary`, `unlockOtherPhone`, `lowMemory`, `removeClosed`, `faceAdded`, `voteAgain`) say the same thing in en, fa, ar, fr, es, de, ru and zh. The quoted button names match each language's `addMember` and `voteSend`. `consentSummary` has 7 bullets in every language, including the new forgotten-password bullet.
- **Small inaccuracy in all languages:** `membersNote` says the wait grows "after each wrong one", but the first two are free (FREE_TRIES = 2).
- **Persian consent v0.5:** every change from v0.4 (the header, §4 gallery note, §4 second limit, §5, §7.4, §7.6, §7.7, §9 both bullets, the §10 rows) has the same meaning as the English. I found no addition or omission.
- **Consent claims vs code:**
  - §9 "up to an hour": overstated until N1 is fixed.
  - §7 "the app waits ten minutes": N10.
  - §5 signer certificate: N13.
  - §9 "the membership itself can then be restored with the passport and the password": true only where a backup was stored. This was already so in v0.4; consider adding "if your backup was stored at enrolment".
  - All other new claims match the code: third-party RPC, gallery copy, the registration page keeping the member open, no phone-to-phone transfer, labels visible, anyone can remove a member, the forgotten-password consequence.

## 6. Checked and fine

- **F1:** `clearChip()` in `lock()`, which also covers switch, auto-lock, `remove` of the open member and `create`/`unlock` when they open a member; in `done()` and `onDestroy(isFinishing)`; and on MainActivity pages without an open member (DETAILS keeps the chip for "try again", which is correct). Test tools only when debuggable. `shareText` cleared on those pages.
- **Throttle basics:** counted before Argon2 and only after the `OtherPhone` check; deleted only on success and on `remove`; written atomically through `.part` and rename; per member; shown on the UNLOCK page as soon as it opens; the delay table (30 s doubling, cap 1 h) is correct.
- **`create()`:** Argon2 outside the lock, MAX checked inside it, `kpw` zeroed when not opened, tag written in meta.
- **`write(expectedId)`:** checked inside `@Synchronized`; both Registration calls pass the id they read from.
- **HMAC:** Keystore HMAC-SHA256, PURPOSE_SIGN, key not exportable; tag over the domain-separated `"PoO-number|" + number`; v0.16 hash still accepted for matching and converted on unlock (inside try/catch, so it cannot break unlock).
- **`data_extraction_rules.xml`:** excludes root, file, database, sharedpref and external for both cloud and device transfer; `fullBackupContent="false"` covers API ≤ 30.
- **VoteActivity F17 sequence:** re-check `isOpen`, then loaded state, then same member, then `member = Profiles.read()` before `cast`.
- **FaceCheckActivity:** returns RESULT_CANCELED and finishes if the member changed while the camera was open; RESULT_OK only on a pass; fails closed as before.
- **Migration:** rename first, idempotent through `.moving` in `route()`, duplicate check, best-effort overwrite, `.part` cleanup, OOM and `Throwable` caught.
- **`retryRestore`:** OOM and `Throwable` caught, with the button re-enabled.
- **Removal:** of a closed member, with confirmation; deletes `.enc`, meta, throttle and the Keystore entry.
- **Signing:** Gradle fails without the key in CI; the workflow checks the secrets first; it prints the APK's SHA-256 and signing certificate.
- **Enrol-service tests:** 28/28 pass, including the 5 RPC endpoint tests: retry primary, 2 agreeing fallbacks, forged proof refused, disagreement → 502, only 1 answer → 502.

## 7. Needs human expert review

1. **The N1 fix:** check `Settings.Global.BOOT_COUNT` behaviour on the pilot phones' OEMs, and test a clock change with automatic time on and off.
2. **The N2 CI redesign:** GitHub Environment protection, branch rules, who has push access, and whether the current key should be **rotated** before the pilot. A rotation is free now and impossible after volunteers install. Also whether any run on a non-main branch has already used the secrets (check the Actions history).
3. **Keystore HMAC availability and stability** across the volunteers' phones (N4). `setUnlockedDeviceRequired` on real phones (F19, deferred).
4. **The F6 user journey** with a real v0.15 member whose migration password differs from the backup password (N3).
5. **Whether `sepolia.base.org` should be trusted alone** for π_doc verification (N9.2): a policy decision for the organiser.

— Hypatia (AI agent, Proof of One)

---

## 8. Third check (fixes for N1–N13)

Scope: only what changed since the v0.17 review, in the same tree. Enrol-service tests: **33/33 pass** in my scratch copy.

| # | Status | What I checked |
|---|---|---|
| N1 | **Fixed** | A restart is now recognised by `Settings.Global.BOOT_COUNT`, and the wait runs only on the running clock, so the wall clock no longer plays any part and changing it gains nothing. After a restart, the full wait for the stored failures starts again (Profiles.kt `waitSeconds`). On phones without a boot count, the fallback (running clock behind the last write) can only lengthen the wait, never shorten it. Consent §9 (both languages) now says that a restart starts the wait again |
| N2 | **Fixed in the repository** | Build job, then a separate `sign` job: `needs: build`, `if: refs/heads/main`, `environment: pilot-signing`, no checkout, `umask 077` and `trap rm`, signing with `apksigner` only. Actions are pinned by SHA, and circom and the Kotlin compiler are checked by SHA-256. `build.gradle.kts` signs nothing in CI. *Human check:* the GitHub environment `pilot-signing` must have a deployment-branch rule limited to `main` (and ideally a required reviewer). The `if:` in the YAML alone can be removed by a push to another branch. Consider rotating the key before the pilot |
| N3 | **Fixed** | In the `alreadyEnrolled` branch, `withNumber` (with the number from this session) comes first, then `Profiles.addFace` with that member's own password. It needs no backup, does not change `current`, is throttled through `tryPassword`, and gives distinct messages (`addFacePw`, wait, other phone, `memberHere`). Retries go through `pendingFaceFor` |
| N4 | **Fixed** | `numberKey()` is `@Synchronized`, so the key is made once. A tag failure in `create` and `withNumber` is tolerated. `/backup` is stored **before** `saveMember`; when the save fails, the volunteer sees `notSavedHere`, which correctly says to restore with the passport and the same password |
| N5 | **Fixed** | `tryPassword` holds a lock per member around wait check, count, Argon2 and result, so unlock and `addFace` share it |
| N6 | **Fixed** | `route()` falls back from the chip page when the chip is gone; `run()` shows `readFirst` instead of returning silently |
| N7 | **Fixed** | `umask 077` and `trap 'rm -f "$KS"' EXIT` in the signing job |
| N8 | **Fixed** | `unlockOtherPhone` now says to remove the copy first (all 8 languages). `withNumber` skips members whose hardware key is missing |
| N9 | **Fixed** | Changes in `verifyOnChain` and `enrol`: (1) a "yes" from the primary now needs at least one fallback to confirm it, and any fallback that disagrees gives 502; (2) a "no" from the primary refuses; (3) with no primary, 2 fallbacks must agree; (4) fallbacks are de-duplicated and the primary is removed from their list; (5) the result must be exactly 32 bytes; (6) on a 502 the session goes back to state 1. Not done: no `eth_chainId` pin (low; a wrong chain returns `0x`, which is refused). The app does not reuse the returned session (it starts a new one), so the give-back only helps clients that resend; it is harmless |
| N10 | **Fixed by wording** | Consent §7 says "(while it stays open)", in both languages |
| N11 | **Fixed** | `Profiles.IdleWatch` (every 20 s, skipped while busy) in PollsActivity, VoteActivity and FaceCheckActivity, started in `onResume` and stopped in `onPause` |
| N12 | **Fixed** | `migratedBefore` toast with the existing label |
| N13 | **Fixed** | `dscPem` is added to `shareText` only when `!ready`, which matches consent §5 |

**New problems (high or medium): none found.**

Low observations only, no action needed for the pilot:
- IdleWatch closes the vote screen 5 minutes after the last member read even while someone is still reading or choosing, because choosing does not call `touch()`.
- If a local save fails as a duplicate after a successful `/backup`, the volunteer sees `notSavedHere`. This can happen only after a service database reset.
- The Persian versions of `addFacePw`, `notSavedHere`, `migratedBefore` and `unlockOtherPhone`, and the consent changes for N10 and §9, say the same as the English.

**Third-check verdict: ready for the pilot from the code side.** Two settings outside the repository must be confirmed first: the branch rule (and reviewer) on the `pilot-signing` environment, and a decision on rotating the key.

— Hypatia (AI agent, Proof of One)
