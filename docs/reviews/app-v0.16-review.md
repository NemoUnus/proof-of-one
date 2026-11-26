# Proof of One — adversarial code review, Android app v0.16 and enrolment service

Reviewer: Hypatia (AI agent, Proof of One). I did not write this code. It was reviewed read-only and statically: there is no Android SDK here, so nothing was built or run.
Date: 26 November 2026.

Scope as reviewed:
- `android-prototype/app/src/main/java/io/github/nemounus/proofofone/reader/`: Profiles.kt, FaceCheckActivity.kt, MainActivity.kt, EnrolActivity.kt, Registration.kt, VoteActivity.kt, PollsActivity.kt, Chain.kt, Backup.kt, EnrolService.kt, FaceActivity.kt, DocProofActivity.kt (the parts about DocStore), FaceMatcher.kt (FaceStore, THRESHOLD, loadSelfie), Ui.kt (field, menu, language), and L10n.kt (security-relevant English strings only)
- `AndroidManifest.xml`, `res/xml/file_paths.xml`, `app/build.gradle.kts`
- `enrol-service/src/service.js`, `enrol-service/wrangler.toml`
- `docs-pilot/consent-v0.4.md` (the brief named `docs/pilot/`; the file is in `docs-pilot/`)

**Important scope note.** The brief describes an RPC fallback in `service.js` (`rpcAnswer`, primary RPC tried 3 times, then `RPC_FALLBACKS`, with at least 2 answers that must agree). **That code was not in the copy I was given**, which still had a single-RPC `verifyOnChain`. Finding F10 covers that older code and lists what the fallback must do.

*Note added on publication (Cai Lun): the copy given to the reviewer was an older working copy of the enrolment service. The fallback is in the repository since update 184 and is reviewed separately against the list in F10.*

---

## 1. Summary verdict

**Ready after fixes.** I found no critical issue. The core crypto design for secrets at rest is sound: two layers of AES-GCM, a hardware key per member, a random nonce per write, `allowBackup=false`, and FLAG_SECURE on every sensitive screen. The face check before a ballot fails closed inside the unmodified app.

Two high findings undermine the main promise of v0.16, that others using a shared phone cannot see or open your membership. Both must be fixed before volunteers share phones:

- **F1:** the last passport's chip photo and chip data stay in memory. Any later user can view them from the ⋮ test tools, with no password.
- **F2:** the unlock back-off is held only in the screen. Leaving and re-opening the member resets it, and so do rotating the phone, changing the language or restarting the app.

Several medium findings should also be fixed before the pilot, or at least disclosed. F3, F4, F6, F7 and F11 matter most for participant safety and for not losing memberships.

## 2. Findings table

| # | Severity | Area | Title |
|---|---|---|---|
| F1 | **High** | Member isolation / secrets | The previous passport's chip photo, chip data and chip report stay in memory and can be opened from ⋮ by anyone, with no member open |
| F2 | **High** | Brute force | The unlock back-off is held only in the activity and is reset by navigation, rotation, language change or a process restart |
| F3 | Medium | Member isolation / race | An enrolment or restore still running in the background can silently switch the open member, and can race with `Profiles.write` (plausible) |
| F4 | Medium | Secrets at rest | `allowBackup="false"` does not stop device-to-device transfer on targetSdk 31+. The transferred members cannot be opened, and the app reports "wrong password" |
| F5 | Medium | Participant safety | The member-number hash in plaintext `meta.json` is unsalted and deterministic, so anyone who can compute a person's number can confirm that person is on a seized phone |
| F6 | Medium | Availability / data loss | Members migrated from v0.15 have no face template and cannot vote. The prescribed fix (remove, then restore) can lose the membership for good |
| F7 | Medium | Misleading string | `unlockForgot` says you can enrol again and get a new membership. The service refuses (`alreadyEnrolled`) |
| F8 | Medium | Network privacy / consent | The public RPC sees the phone's IP address and the member's nullifier for every poll in a category. The consent mentions only the organiser's two services |
| F9 | Medium (plausible) | Availability | Argon2 with 64 MiB on the Java heap can run out of memory. `OutOfMemoryError` is not caught in the unlock, migrate and restore-retry threads, so the app crashes (and the back-off resets) |
| F10 | Medium | Service integrity / availability | The RPC fallback is absent. `verifyOnChain` trusts one RPC, and an RPC failure burns the session |
| F11 | Medium | Availability | A release build silently falls back to the debug key, so an update fails and volunteers who uninstall to "fix" it lose all members on the phone |
| F12 | Low–Medium | Isolation / consent | The auto-lock is lazy. The home screen keeps showing the member number, and the registration page keeps the member open indefinitely |
| F13 | Low | Face check | The 3-try limit is reset by re-entering or rotating, and there is no liveness check. The "deterrent only" wording is honest |
| F14 | Low | Participant safety | Member labels and dates are shown to anyone who opens the app, and the hint suggests "Mother" |
| F15 | Low | Availability | A member whose password is forgotten cannot be removed and keeps 1 of 4 slots. "Enrol again" in `old()` removes a member without confirmation |
| F16 | Low | Migration | The result of `member.json` `delete()` is not checked, which can lead to duplicate migration. The plaintext is not overwritten (file-based encryption mitigates this) |
| F17 | Low | Ordinary bugs | `pendingChoice` is lost when VoteActivity is recreated, and a ballot can be cast after the auto-lock using a stale member copy |
| F18 | Low | Consent accuracy | The shareable logs include face similarity scores and the document signer's certificate (PEM), but the consent says they hold "no personal data" |
| F19 | Low | Hardening | Keystore key not bound to an unlocked device; AAD does not include the member id; MRZ and label fields allow keyboard learning |

## 3. Details

### F1 — The previous passport's chip photo and data can be read by any later user (High)

- **Where.** MainActivity.kt:218–219 sets `FaceStore.chipPhoto`, `FaceStore.chipMime`, `DocStore.chip` and `DocStore.genuine`, and :217 sets `shareText` (the chip report and the document signer's PEM). Nothing ever clears them: not EnrolActivity after `done()`, not `Profiles.lock()`, not a member switch. MainActivity.kt:114–116 offers "Share report", "Face check test" and "Enrolment proof test" in ⋮ whenever these are non-null, **whether or not a member is open**, including on the MEMBERS and UNLOCK pages.
- **FaceActivity.kt:74** shows the chip photo on screen (`chipView.setImageBitmap(bm)`). DocProofActivity rebuilds the proof input from the stored DG1/DG13 data.
- **Scenario.** A parent enrols on a shared phone and hands the phone to someone else. While Android keeps the process alive, which is often hours, the next person opens the app, taps ⋮ and then "Face check test", and sees the parent's passport photo. They can also share the parent's chip report.
- **Why it matters.** This contradicts the consent ("passport data … used only on your phone", "each membership opens only with its own password") and the in-app `membersNote` ("others using this phone cannot see it").
- **Fix.**
  1. Clear `FaceStore.*`, `DocStore.*`, MainActivity `shareText` and `key` in EnrolActivity when enrolment or restore finishes (success or failure), and in `onDestroy` when it was the enrolment.
  2. Also clear them in `Profiles.lock()`, or in a new `Session.clearChip()` called from lock, switch and remove.
  3. Hide the three test tools in the pilot release build (`BuildConfig.DEBUG`), or show them only while the chip page is current.

### F2 — The unlock back-off does not hold (High)

- **Where.** MainActivity.kt:46–47: `wrongTries` and `waitUntil` are activity fields. MainActivity.kt:251 sets `wrongTries = 0` every time a member is tapped in the list. MainActivity.kt:280 is the back-off itself.
- **How it resets:**
  1. "Back to members" (:287), then tap the member again: `wrongTries = 0`. The old `waitUntil` still applies, but after it expires there are 5 more free tries, so the back-off never grows beyond 30 s.
  2. Rotation: there is no `configChanges`, so the activity is recreated.
  3. Language change: `L10n.set` calls `recreate()`.
  4. Swiping the app away, or an F9 crash: a new process.
  5. The counter is per screen, not per member.
- **Effect.** The only throttle left is Argon2's own cost, about 1 s per guess on a phone. The minimum is 8 characters with no strength check, so a common password can be guessed on the device in hours by a family member or anyone else holding the phone. This is exactly the shared-phone threat v0.16 is meant to address.
- **Fix.**
  - Store the failure count and the next allowed time **per member**: in `members/<id>.meta.json`, or better in a separate `members/<id>.throttle` written synchronously before Argon2 starts. Increment it *before* deriving (so killing the app during Argon2 still counts) and reset it only on success.
  - Grow it exponentially, for example 30 s, 1 min, 2 min … capped at 1 h.
  - Store `SystemClock.elapsedRealtime()` together with wall-clock time so a clock change does not bypass it, and after a reboot fall back to the wall clock.
  - Optionally offer to wipe the member after N failures (the membership can be restored with the passport and password).
  - State honestly in `membersNote` that a short password can be guessed.

### F3 — A background enrolment can switch the open member, and a write race is possible (Medium; plausible, high impact)

- **Where.**
  - `Profiles.create` (Profiles.kt:112–125) always calls `lock()` and opens the new member at the end.
  - EnrolActivity's enrolment and restore threads (EnrolActivity.kt:360ff, 326ff) keep running after the user presses Back, and nothing cancels them.
  - `Profiles.write` (Profiles.kt:151–156) writes to whichever member is current at the moment it takes the lock.
  - `Registration.run` checks `Profiles.current != id` (Registration.kt:117) **outside** the Profiles lock, then calls `save` → `Profiles.write`.
- **Scenario A (isolation).** Someone enrols member B. Enrolment takes a minute or more, and they press Back impatiently. Member A is then opened on the phone, perhaps by another person. When B's thread reaches `saveMember`, `create()` closes A and opens B. Whoever is looking at A's home screen now gets B's data on the next screen (B's number in `numberCard`, B's polls). A ballot would still need B's face, but B's member number is exposed and B's membership is usable up to the face check.
- **Scenario B (overwrite; low likelihood).** `create(B)` holds the Profiles lock for the whole Argon2 run (about 1–2 s) while `current` is still A. If A's `Registration.run` passes its check at :117 during that window, its `Profiles.write` blocks until `create` returns, and then runs with `current = B` and `key = B`. A's member file is then encrypted into **B's** file under B's password: B's membership on the phone is lost, and B's password now opens A's secrets.
- **Fix.**
  1. Change the signature to `Profiles.write(ctx, expectedId, member)` and check `current == expectedId` inside the `@Synchronized` block; throw if it differs.
  2. In `create()`, do not auto-open if another member was opened after the enrolment began. Pass the `current` seen at the start and compare it under the lock, or never auto-open and send the user to UNLOCK.
  3. Make EnrolActivity cancel or ignore its result when it is finished (`isFinishing`) or block Back during the "enrol" step, and keep `create()`'s Argon2 outside the lock: derive first, then take the lock only for the file swap.

### F4 — Device-to-device transfer is not excluded (Medium)

- **Where.** AndroidManifest.xml:16 sets `android:allowBackup="false"`, and targetSdk is 35. Since Android 12, `allowBackup="false"` turns off cloud backup but **not** device-to-device migration (cable or Wi-Fi transfer during phone setup). That needs `android:dataExtractionRules` with an exclude-everything `<device-transfer>` section. *High confidence; please confirm on a real phone.*
- **Effect.**
  - On a new phone, `members/*.meta.json` (labels, dates, `numberHash`) and `*.enc` arrive, and before migration so does the **plaintext legacy `member.json`**.
  - The `.enc` files cannot be opened, because the Keystore key does not move. `hwKey(id, false)` throws `IllegalStateException` (Profiles.kt:83). `Profiles.unlock` catches only `AEADBadTagException`, so the exception reaches MainActivity.kt:274, which turns it into `false`. The user is told "The password is not right" and is pushed into the back-off.
- **Fix.**
  - Add `android:dataExtractionRules="@xml/data_extraction_rules"` with `<cloud-backup><exclude domain="root"/>…</cloud-backup><device-transfer><exclude domain="root"/><exclude domain="file"/><exclude domain="database"/><exclude domain="sharedpref"/></device-transfer>`, and `android:fullBackupContent="false"` for API ≤ 30.
  - In `unlock`, separate "hardware key missing" from "wrong password". Show "this member was made on another phone: restore it with your passport", and do not count it as a failure.

### F5 — The member-number hash can link a phone to a person (Medium)

- **Where.** Profiles.kt:69–72 and :121 compute `numberHash = SHA-256("PoO-number|" + number)` with no salt or key, and store it in plaintext in `meta.json`.
- **Why it matters.** The consent itself says that "the government that issued your passport could compute the same number" (consent §5). An adversary who extracts the app's private files (forensic extraction of a seized phone) and can compute the member number for a suspect can confirm, without any password, that this person's membership is on the phone. Without this hash, they would need the password or the hardware key. The 80-bit number cannot be brute-forced, but this attack needs no brute force: it is a targeted check.
- **Fix.** Use HMAC-SHA256 with a non-exportable Keystore HMAC key per phone (`KeyProperties.KEY_ALGORITHM_HMAC_SHA256`, alias `poo-numbers`), or keep the duplicate-check value inside an AES-GCM blob encrypted under a phone-wide Keystore key. A file copied off the phone then reveals nothing; on the phone, the duplicate check works as now.

### F6 — Migrated members cannot vote, and the advised fix can lose the membership (Medium)

- **Where.**
  - MainActivity.kt:291–316 migrates legacy `member.json`, which has no `face` field.
  - FaceCheckActivity.kt:51–52 finds no template, disables the selfie button, and the only way out is Cancel. VoteActivity then refuses (`faceCheckNeeded`), so it correctly fails closed.
  - `faceCheckNoTemplate` tells the member to remove the membership and restore it.
- **Risk.** Removal deletes the file and the hardware key (Profiles.kt:164–169) at once. Restore then needs all of the following:
  - a backup actually stored by the service (v0.15 users could have had "backup NOT stored");
  - the *backup* password, which may differ from the password chosen at migration (it is not checked);
  - a service that is online.

  If any of these fails, the membership is lost for the pilot, since re-enrolment is refused (see F7).
- **Fix.** Add a flow to "add the face template": with the member open, read the passport, run the face check against the chip photo, and store the template with `Profiles.write`. Better still, add it to the migration itself, which already requires the person to be present. If the restore path stays, make `saveMember` *update* an existing member with the same number that has no template, instead of refusing ("memberHere"), and never require removal first.

### F7 — The "forgot password" text is wrong (Medium)

- **Where.** L10n.kt:1638 (`unlockForgot`): "You can enrol again with your passport; you will then get a new membership…".
- **What the code does.** In service.js:187–200, a second enrolment of the same person key returns 409 `alreadyEnrolled` with the old backup. EnrolActivity.kt:425–444 can then only restore with the *same* password. There is no path to a new membership.
- **Effect.** A volunteer who forgot the password is told they have a way out when they do not. They may remove the member (only possible while it is open) or keep failing.
- **Fix.** Correct the text in all languages: "Nobody can recover it. Without it, this membership cannot be opened on any phone during the pilot." Alternatively, define a recovery policy at the service. Update consent §7.4 to match.

### F8 — The public RPC sees the IP address and the nullifiers; the consent does not say so (Medium)

- **Where.**
  - PollsActivity.kt:95–98: for each poll in a category, the app computes the member's nullifier and calls `chain.ballot(…, nf)` on `https://sepolia.base.org` (Chain.kt:36), on every resume.
  - VoteActivity does the same per poll (`verifiedState`, `chain.ballot`), and the confirm loop asks for it repeatedly.
  - The relay is *not* sent the nullifier (`state(pollId, null)`), which is good.
- **Effect.** The third-party RPC operator learns the phone's IP address together with the set of nullifiers that belong to one member, across polls. Nullifiers are meant to be unlinkable across polls, and these queries link them. It also learns which polls the member has answered. The answers themselves stay encrypted. Chain.kt's header comment admits this, but consent §4 names only "the service that enrols members and the service that sends answers".
- **Fix.**
  - Add to consent §4 and the table in §10: "A public test-network access point (run by a third party) sees your internet address and random-looking codes your phone asks about; with them it could tell that several of these codes belong to the same phone."
  - In code, do not query nullifiers on the category list. Use the relay's bulk data and check it against the chain, or query only when a poll is opened. Consider routing the RPC calls through the relay as a plain proxy.

### F9 — Argon2 can run out of memory, and the error is not caught (Medium, plausible)

- **Where.** Profiles.kt:75–78 and Backup.kt:22–28 use BouncyCastle `Argon2BytesGenerator` with 64 MiB. It allocates about 65,536 `Block` objects (about 68 MB) on the **Java heap**. The manifest has no `android:largeHeap`.
- **Unguarded threads.** MainActivity.kt:274 (`catch (x: Exception)`), MainActivity.kt:307–312 (`catch (x: Exception)`) and EnrolActivity.kt:326–342 (no catch at all around `Backup.open` / `saveMember`) do not catch `OutOfMemoryError`. Any uncaught exception in those threads kills the process.
- **Effect.** On low-memory phones (heap growth limit 128 MB or less) the app crashes when opening a member. Every crash also resets the F2 back-off.
- **Fix.**
  - Wrap these threads in `catch (t: Throwable)` and show a clear message.
  - In `retryRestore`, also catch `Profiles.create` errors, for example "this phone already holds 4 members".
  - Add `android:largeHeap="true"`, or better, move Argon2 into the native Rust library already shipped (the `argon2` crate), off the Java heap.
  - Test on the weakest pilot phone.

### F10 — RPC fallback not present; the current `verifyOnChain` trusts one RPC and burns the session (Medium)

- **Where.** service.js:98–105 and :181–183.
- **As the code stands:**
  1. One endpoint (`RPC_URL = https://sepolia.base.org`) decides whether π_doc verifies. A lying or compromised RPC can return `1` and get a false proof accepted.
  2. The session is set to state 2 (:181) **before** the RPC call. Any RPC failure (502), or a non-JSON reply, which makes `r.json()` throw and become 500 "internal error", burns the session. The user must start again, and that counts against `DAILY_SESSIONS`.
  3. `BigInt("0x")` (call to a non-contract) throws → 500. This fails closed, which is good, but the message is unclear.
- **What the described fallback must do** (review it against this when it arrives):
  - Ask only fallbacks run by distinct operators (not two URLs of the same provider).
  - Accept only when at least 2 *independent* answers say `1` **and none says `0`**. Any disagreement means refuse with 502 (fail closed), never "first answer wins".
  - Do not count the primary's retries as separate answers.
  - Pin the chain id (`eth_chainId` = 84532) on each endpoint.
  - Validate `result` as exactly 32 bytes.
  - Handle timeouts and non-JSON replies as "no answer".
  - Do not burn the session on "no answer": claim state 2 only after a definite verify result, or roll back to state 1 on 502.

### F11 — The release build falls back to the debug key without warning (Medium)

- **Where.** build.gradle.kts:31–45. Without `POO_KEYSTORE`, the release build is signed with the debug key, and nothing fails.
- **Scenario.** A CI run without the secrets (a fork, a renamed secret, an expired token) publishes an APK under the normal artifact name. On a phone that has the pilot-signed app, the update fails with "App not installed". The natural reaction is to uninstall and reinstall, which **deletes every member on the phone** (and their Keystore keys). The memberships can be restored only where a backup exists and the password is known.
- **Fix.** Fail the release build when `CI=true` and `POO_KEYSTORE` is missing (`throw GradleException`), and print the signing certificate's SHA-256 in the artifact. Please check the actual workflow: the copy available to me predated the signing step, so I could not review it.

### F12 — The auto-lock is lazy (Low–Medium)

- **Where.** Profiles.kt:141–145: the lock happens only when someone calls `isOpen()`. MainActivity calls it in `onResume` but has no timer while it sits on HOME, so a phone left on HOME shows the member number (`numberCard`, MainActivity.kt:354–365) indefinitely.
- **Registration page.** On REG, `checkRegistration` re-runs every minute (MainActivity.kt:394). `Registration.state` → `Profiles.read()` → `touch()`, so the member never closes while that page is shown (the comment says this is intended).
- **Effect.** Consent §9 says the membership "closes by itself after five minutes without use". That is true for actions, not for what is on screen.
- **Fix.** Add a `Handler` in each activity's `onResume` that calls `isOpen()` at `lastUse + LOCK_AFTER` and re-routes. Lock in `onStop` after a short grace period. On REG, read the state without `touch()`.

### F13 — Face check limits (Low; the limitation is stated honestly)

- **Retry limit.** `tries` is an activity field (FaceCheckActivity.kt:86). Cancel and "Send" again, or a rotation, gives 3 new tries, so the limit is unlimited in practice.
- **No liveness.** A photo of the passport's photo page, or of the member, will likely pass at THRESHOLD 0.40.
- **Fail-closed paths checked and fine:** cancelled camera, missing template, model load failure, process death while the camera is open (the guard finishes the activity and `matcher` is null, so `return`). `RESULT_OK` is set only on a pass. The activity is not exported.
- **Wording.** Consent §7.7 and the FaceCheckActivity header say "discourages… cannot stop a changed version of the app". That is honest. I suggest adding "or a photo of you" to the consent.
- **Fix (optional).** Persist tries per member and poll for a cool-down.

### F14 — Labels visible without a password (Low)

- **Where.** MainActivity.kt:251 shows every label and "member since" date to anyone who opens the app. The hint (L10n `memberLabelHint`) suggests "Me, Mother".
- **Risk.** Someone who picks up the phone, or an inspection, learns which people in the household take part.
- **Fix.** Change the hint to "a nickname only you recognise, not a real name" and add one line to consent §9.

### F15 — Removal edge cases (Low)

- `removeCurrent` works only on the open member, so a member whose password is forgotten keeps one of the 4 slots for good.
- `old()` (MainActivity.kt:242) removes the open member without confirmation.
- **Fix.** Allow removing a *closed* member after a confirmation that names the label. This is no worse than uninstalling, which anyone holding the phone can do. Add confirmation to `old()`.

### F16 — Migration robustness (Low)

- MainActivity.kt:309–310 ignores the result of `f.delete()`. If it fails, or the app dies between `create` and `delete`, the next start migrates again and creates a duplicate member, because there is no `withNumber` check in migration.
- A malformed `member.json` traps the app on the MIGRATE page.
- The plaintext is unlinked, not overwritten. File-based encryption makes recovery impractical; I note this for completeness.
- **Fix:**
  - Check `withNumber` before `create`.
  - Check the result of `delete()`, and rename the file first (`member.json` → `member.json.migrated`) so a retry is idempotent.
  - Overwrite the file with zeros before deleting (best effort).
  - Also delete any `member.json.part` left by older versions (*plausible*; I could not see v0.15's write path).
  - Offer to discard a corrupt legacy file.

### F17 — VoteActivity edge cases (Low)

- `pendingChoice` (VoteActivity.kt:344) and `member` (:186) are not saved. If VoteActivity is recreated while the face check or camera is open, `onActivityResult` calls `cast(-1)` and does nothing: the user passed the face check, but no ballot is sent and no message says so.
- If the 5 minutes pass while the camera is open, `cast` still runs, because `onActivityResult` comes before `onResume` and `busy` is set. It uses the copy `member!!` (:365) taken before the lock.
- **Fix.** Save `pendingChoice` in `onSaveInstanceState`. In `onActivityResult`, call `Profiles.isOpen()` and re-read `Profiles.read()` (with an id check) instead of using the cached `member`. Show a message if `pendingChoice < 0`.

### F18 — Share texts and "no personal data" (Low)

- **Content.**
  - The VoteActivity log contains the face similarity score at each ballot (:349ff).
  - The EnrolActivity log contains the similarity score, the number of selfies, the service's enrolment count and the signer's tree position.
  - MainActivity "Share report" contains the document signer's certificate (PEM), which narrows the issuing batch and date.
  - Errors like `JSONException` messages can quote values (*plausible*).
- **Effect.** None of this is a name or number, but consent §5 says the text "contains no personal data".
- **Fix.** Round or drop similarity scores in shared text, drop the PEM from the default share, or soften the consent wording to "no name, document number, member number or photo".

### F19 — Hardening (Low)

- **Keystore key.** `hwKey` (Profiles.kt:85–87): add `.setUnlockedDeviceRequired(true)` (API 28+, guarded) so that a phone seized while locked cannot use the outer key. Consider `setIsStrongBoxBacked(true)` with a fallback.
- **AAD.** Use `"PoO-member-v1|" + id` in the inner layer for defence in depth. The outer key per member already binds the file to its id.
- **Keyboard.** MRZ, label and password fields (Ui.kt:172–178) should set `imeOptions |= EditorInfo.IME_FLAG_NO_PERSONALIZED_LEARNING` so keyboards do not learn the document number or label.
- **Password minimum.** At 8 characters with no check, consider a passphrase suggestion.

## 4. Checked and fine

- **Inner encryption.** AES-256-GCM, fresh 96-bit `SecureRandom` nonce per write, 128-bit tag, AAD set on both seal and open. No nonce reuse found. The nonce length is stored in the blob, and the open path uses it consistently.
- **Outer encryption.** A per-member Android Keystore AES-256-GCM key with the nonce generated by the Keystore (randomised encryption is enforced by default).
- **Key derivation.** Argon2id with a 16-byte random salt per member, 64 MiB, 3 passes, parallelism 1, which matches the comment and Backup.kt. The derived key is zeroed on `lock()`.
- **Wrong password.** It fails the inner tag and returns false. Timing is dominated by Argon2, and no useful timing signal was found.
- **Atomic writes.** Writes use `.enc.part` and then rename, so a crash leaves the old file intact. A missing meta file means the member is not listed.
- **Removal.** It deletes the `.enc`, the meta file and the Keystore entry, which is cryptographic erasure. This matches "Removing your membership … deletes it".
- **Face template.** It is kept only in the encrypted member file. `withoutFace` exists, and the backup is sealed from `saved` *before* `face` is added (EnrolActivity.kt:461 vs :467: `saveMember` adds `face` to its own copy `m`, and `Backup.seal` uses `saved`). No face data is sent anywhere.
- **Selfie files.** These are deleted after reading, on failure and in `onDestroy`, in FaceCheck, Enrol and FaceActivity. The FileProvider grant is per URI. `cache-path "."` is acceptable since grants are explicit.
- **FLAG_SECURE.** Set on MainActivity, EnrolActivity, FaceCheckActivity, VoteActivity, PollsActivity, FaceActivity and DocProofActivity. Exported components: only MainActivity (the launcher), and the FileProvider is not exported.
- **Logging.** No `Log.*`, `printStackTrace` or `println` in the app sources. No secrets are passed in intent extras (only pollId, category, result flag and similarity).
- **Guard coverage.** `Profiles.guard` runs in the onCreate of PollsActivity, VoteActivity and FaceCheckActivity, and in the onResume of PollsActivity and VoteActivity (the latter except while busy). MainActivity re-routes in onResume. After process death, the memory is empty, so nothing is open and the guard sends the user to the member list.
- **Registration race.** `Registration.run` compares the member id before saving. That covers the common switch case: switching calls `lock()`, so `current` is null. Only the narrow race in F3 remains.
- **Duplicate check.** `withNumber` ignores an empty number, so there are no false matches. The restore and enrol paths refuse a duplicate before `create`. MAX is enforced in `create` and EnrolActivity.
- **Face check fails closed.** In VoteActivity, a cast happens only on `RESULT_OK` from FaceCheckActivity. Cancel, back, no template, model failure and process death all give no ballot.
- **Ballot traffic.** The relay is not given the nullifier on reads (`state(pollId, null)`). The ballot carries only nf, ciphertexts and proof. No member number or face data is sent anywhere. The chosen answer is shown on the phone only and is not in the share log.
- **Chip access key.** The BAC key is cleared after a successful read (MainActivity.kt:216).
- **Release build.** Not debuggable (default). `allowBackup=false` covers cloud backup (but see F4).
- **Service.** The session is claimed atomically (`UPDATE … WHERE state = …`). There is one evaluation and one enrol attempt per session. The backup is written once (`backup IS NULL`). Input validation (`isField`, `isUint`, `isBackup` length and alphabet) is sound. Request logs are off (`observability.enabled = false`).
- **Consent claims that match the code:** the face template is encrypted with the password and is not in the backup; selfies are compared on the phone and deleted; up to four members, one password each; registration 1–10 minutes after enrolment; restore with passport and password on a new phone (when a backup was stored); statistics come from public counters.

## 5. Needs human expert review

1. **The actual RPC fallback code in service.js.** It is not in the reviewed tree (F10).
2. **Device-to-device transfer on Android 12–15** with `allowBackup=false` and no `dataExtractionRules`. Confirm on Samsung Smart Switch and on Google's transfer (F4).
3. **Argon2 memory on the weakest pilot phones.** Measure peak heap and time for BouncyCastle Argon2 at 64 MiB (F9), and decide whether to move it to native code.
4. **Face threshold.** THRESHOLD 0.40 with `w600k_mbf`: the false accept rate for relatives, and for a printed or on-screen photo of the passport photo page. Only the "deterrent" framing makes 0.40 acceptable.
5. **Camera apps.** Whether common camera apps on volunteers' phones (Samsung, Xiaomi, Huawei) also save the `ACTION_IMAGE_CAPTURE` selfie to the gallery or cloud even when `EXTRA_OUTPUT` is given. If any do, consent §10 ("Not kept") is not true for those phones.
6. **The CI signing workflow** that produces the v0.16 APK, and how the pkcs12 file is deleted after the build (F11). The workflow copy available to me predates signing.
7. **Threat model for F5 and F14** (forensic extraction of seized phones in the pilot's country): whether labels and the existence of the app should themselves be hidden.
8. **Translation parity** of the corrected `unlockForgot` text and of any consent changes (F7, F8), in `consent-v0.4-fa.md` and the in-app strings.

— Hypatia (AI agent, Proof of One)
