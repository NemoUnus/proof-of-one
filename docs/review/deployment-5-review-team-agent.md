*Review by a separate agent of the team that did not write the code, given the [review brief](deployment-5-review-brief.md) on 24 November 2026; kept as received. What was done about each finding: [outcome](deployment-5-review-outcome.md).*

# Independent review: Proof of One deployment 5 (Decisions #62, #63)

Repository checked: a local clone at commit `516c381`. I read the code and checked circuit constraints. I ran no new tests.

**Verdict: do not run the pilot poll as it is.** The contract and circuits mostly do what claims 1–3 say. But claims 4 and 7 fail in the app as written. A dishonest relay can read any answer sent through it. Even an honest relay can cause two different answers to be published with the same randomness. There is also a contract regression that can block a result from ever being published.

---

## Findings, ranked by severity

### A. Breaks ballot secrecy

**A1. The relay chooses the tally key the phone encrypts to, so it can decrypt any ballot (confirmed).**
- **Where:** `VoteActivity.kt:218-220` takes `PK`, `openTime`, `policy` and `ctxHash` from the relay's `/state`. `VoteActivity.kt:242` checks only `pub[1]` (nf) and `pub[2]` (idRoot). The proof's `pollHash` (`pub[0]`) is never compared with the chain. `relay/src/index.js:162-170` is the only source of these values, and the phone has no other channel.
- **Scenario:**
  1. The relay returns `PK = sk_R·G` for a key it holds.
  2. The phone builds a valid proof against that key. It verifies on the phone and is POSTed to the relay.
  3. For each option j, the relay computes `B_j − sk_R·A_j ∈ {O, G}` and reads the answer.
  4. It then answers "rejected" (the proof fails on chain), or answers 202 and fakes the confirmation (see C1).
- **Who learns what:** the relay sees `nf` and the phone's IP. In the pilot the relay operator also runs enrolment and sees the registration IP 1–10 minutes after enrolment (`Registration.kt` header). So it can link the answer to the person.
- **Fix:** the phone must get the poll's values from the chain, not from the relay. Either call `getPoll` / `pollHashAt` / `contextHash` itself over one or more public RPCs, or ship a signed poll manifest. Then check that the proof's `pub[0]` equals `pollHashAt(pollId, revRoot)` before sending. In the meantime, at least pin `PK` and `ctxHash` per poll in the app.

**A2. Same revision with different choices gives the same `r`, so a published pair reveals both answers (confirmed; this is the brief's Q1, and there are more ways to trigger it).**
- **Where:**
  - `ballot.js:37-44` and `ballot.rs:128-135`: `r_j = H(15, s, pollId, revision, j)`. The choice is not an input.
  - `VoteActivity.kt:205` and `:224`: `revision = count`, where `count` is the relay's report of the on-chain count.
- **The leak:** two ballots with the same `r` give `A_j = A'_j` and `B_j − B'_j = (v_j − v'_j)·G`. That shows both one-hot vectors exactly: +G at the new option and −G at the old one.
- **Triggers I verified in the code:**
  - **Honest relay, slow block.** The confirm loop gives up after 80 s (`:271`) and re-enables Send (`:280`). The user picks another answer. The fresh `/state` still shows `count = n`, so the phone uses `revision = n` again. The relay's `estimateGas` passes because state has not changed, so both transactions are broadcast. The second one reverts on chain (`BadPrevious`, `ProofOfOnePolls.sol:552`), but its calldata is public.
  - **Two phones with the same identity** (Decision #59). This is the brief's case.
  - **A ballot mined but reverted** (for example `InvalidProof` once `REVOCATION_GRACE` has passed after a revocation, `:467`), then a retry with a different answer.
  - **A dishonest relay that under-reports `count`.** Say the chain holds revisions 0…m and the relay reports `count = k ≤ m`. The phone reuses revision k. Comparing with the on-chain revision-k ballot (a public `Ballot` event) reveals both that answer and the new one. This needs no luck at all.
- **Fix:**
  1. Put the choice into the derivation: `r_j = H(15, s, pollId, revision, choice, j)`. Then equal `r` implies equal plaintext, which gives an identical ciphertext and leaks only equality. `recorded_answer` already tries every choice, so the search becomes 4·(cap+1) candidates, which is cheap.
  2. Keep a local per-poll counter of the highest revision attempted, and never reuse a (revision, choice) pair after a send attempt. Use `max(chainCount, local+1)`.
  3. With both changes, a lying count can at most show that the new answer equals an earlier one.
  - Binding `revision` into the proof and contract would not stop the relay case, because the relay is the source of `count`. The choice-binding is the important part. Storing a fresh random value encrypted for the member also works, but it adds state that a restored phone must recover.

**A3. Anyone who gets `s` now learns the member's whole answer history, including closed polls (design consequence; confirmed).**
- **Why:** with deterministic `r`, `recorded_answer` (`ballot.rs:256-275`) works for anyone holding `s`, for every poll ever held.
- **What changed:** before #62, getting `s` exposed the member's `nf` values, not their answers.
- **Exposure:** phone theft or malware, or offline cracking of the backup held by the operator. The backup uses Argon2id with 64 MiB and 3 passes (`Backup.kt:3,24`), so this depends on password strength.
- **Claim 5 is literally true but should be restated:** "the holder of `s`, forever". This is inherent to principle 2 without a server-side erasable secret. Document it in the threat model and consider telling members.

**A4. The idRoot a ballot uses can single out a newly registered voter (confirmed mechanism; how much it matters depends on traffic).**
- The app always proves against the newest root (`VoteActivity.kt:213-219`).
- A member who registers and votes within minutes will often use `R_N`, the root created by their own registration. That ballot cannot come from leaves N+1 onward. More usefully, it was proved inside the window `[rootTime(R_N), rootTime(R_{N+1}))`.
- In a quiet pilot, "registration N, then a ballot on `R_N` two minutes later" points strongly at leaf N. The registration transaction's timing (sent by the relay) can then link leaf N to an enrolment.
- **A dishonest relay can also shrink the set:** it can serve a real older root `R_k`. `identity_path` (`ballot.rs:88-94`) accepts any prefix, so the on-chain anonymity set becomes k.
- **Fix:** prove against the newest root that is at least about 30 minutes old and contains the member's leaf. Fall back to the newest root only when the leaf is newer than that. This still meets principle 1's 30-minute target. The phone should also check that the root is current or recent against the chain.

### B. Breaks counting or one-person-one-answer

**B1. The relay controls the option labels, so it can make members vote for the wrong option (confirmed).**
- **Where:** `VoteActivity.kt:135-143,148`. The question and options come from the relay's `text`, and nothing checks them against `metadataHash` (I grepped the Android sources: `metadataHash` is never read).
- **Scenario:** the relay swaps the labels of options 0 and 1. Every ballot sent through it is counted for the opposite option. The proofs are valid, and members see their "recorded answer" under the swapped label, so it looks correct to them.
- **Fix:** compute keccak over the canonical poll-text JSON on the phone and compare it with the on-chain `metadataHash`, obtained as in A1.

**B2. Publication can be blocked for good by revocations after voting (confirmed; a regression in this deployment).**
- **Where:** `ProofOfOnePolls.sol:631-632`: `eligibleNow = identity.leafCount() − revocation.revokedCount()` when the result is published.
- **Why it happens:** ballots from identities revoked later stay counted in `distinctVoters`, but their revocation lowers `eligibleNow`.
- **Scenario:** a pilot with 5 members, all of whom vote. One is then revoked (fraud, or a theft recovery whose new identity has not registered yet, or never registers). Now `distinctVoters = 5 > 4`, so `TooManyVoters` is raised. If nobody new registers before `resultDeadline`, `markWithheld` is the only outcome.
- **What changed:** before #62, the bound was the creation-time `p.eligible`, which later revocations did not change.
- **Fix:** use `identity.leafCount() − revokedCountAtCreation`, or simply `identity.leafCount()` (every leaf ever registered), as the bound for open polls.

**B3. `notBefore` double-vote window around revocation (suspicion; depends on the enrolment service).**
- **What the circuit enforces:** the signed `notBefore` (`registration.circom:118-126`) and `notBefore ≤ openTime` (`ballot.circom:210-213`, `recovery.circom:122-125`).
- **The gap:** the old identity keeps working until its revocation, plus `REVOCATION_GRACE` (`ProofOfOnePolls.sol:123,467`).
- **Scenario:** a poll opens between the re-issue time T and `rootSince(old revocation) + 10 min`. Both the old identity (whoever holds the phone, or the member if they find it) and the new one can answer it, under different nullifiers.
- **Fix:** the service sets `notBefore ≥ time the old revocation is mined + REVOCATION_GRACE`, and issues only after that revocation is on chain.
- **Pilot status:** the pilot never re-issues (`enrol-service/src/service.js:185` always signs `notBefore = 0`), so this is not live yet.

**C1. The relay can censor a ballot and still show "recorded" (confirmed).**
- **Where:** `VoteActivity.kt:259-273`. The read-back uses the relay's `/state`.
- **Scenario:** the relay drops the transaction, waits, then reports `count = count+1` with the keccak of the ciphertext it received. `recorded_answer` opens it, and the phone shows `voteDone`: "recorded on the ledger and read back". The relay does hold the ciphertext.
- **Lying about history:** it can also report an older real `(count, hash)` so that the phone shows a stale "recorded answer".
- **Fix:** check the transaction receipt and the `ballots(pollId, nf)` slot through an independent RPC.

### C. Denial of service

- **C2. A lying relay can register an exclusion or lock members out.**
  - `Registration.kt:92-97` saves `registered` after a relay `409 alreadyRegistered`, or after a 202 with no receipt. The phone never checks on chain, so the relay can quietly keep a member out of the tree. Even an honest 202 whose transaction later fails leaves the phone stuck.
  - A fake `ballotHash` or `count` makes `show()` disable all options (`VoteActivity.kt:177-180`).
  - A fake `PK`, root or `now` gives a wrong "closed", "not open" or "not eligible" message.
  - **Fix:** check registry membership (`getLeaves`, or the `Registered` event) on chain.
- **C3. O(n²) hashing on the phone.** When the given root matches no prefix, `identity_path` rebuilds the full tree for every prefix length (`ballot.rs:88-94`, and `levels()` runs twice per try). A relay that sends a bogus root can hang the phone. Even when honest, every load and send downloads and rehashes all leaves.
- **C4. `/state` amplification.** It is unauthenticated, and each call makes `leafCount/500 + revokedCount/500 + ~10` RPC calls (`index.js:151-152`). That is an easy way to exhaust the relay's RPC quota at scale.
- **C5. `openTime` is not checked against block time.** `createPoll` (`ProofOfOnePolls.sol:245-248`) accepts any `openTime`.
  - If `openTime ≥ 2^40`, `LessEqThan(40)` (`ballot.circom:210`) wraps and becomes unsatisfiable, so no one can answer the poll. That is creator self-harm only.
  - Backdating `openTime` silently excludes every re-issued identity issued since then, which goes against principle 3.
  - **Fix:** require `block.timestamp ≤ openTime < 2^40` (or `openTime ≥ block.timestamp − small slack`).

### D. Minor

- **D1. Recovery ballots break principle 2.** `recovery.js:38` still uses `P.encryptBallot` (random `r`). After a recovery ballot, `recorded_answer` returns null, and the app shows "foreign" and locks the screen. The app also ignores `ballot.recovered`.
- **D2. Stale comments.** `ballot.rs:78-79` and `:95` describe "the identity tree as it was when the poll opened", which is no longer how it works.
- **D3. Only the first poll is shown.** `VoteActivity.kt:118` always takes the first poll id.
- **D4. Batch mixing.** `voteBatch` cannot mix proofs made under the current and the grace `pollHash` (`:437`), so a whole batch fails across a revocation. This only affects relay efficiency.
- **D5. Roots cannot be retired.** Every root is accepted forever (`Registries.sol:93`). If an enclave key is ever compromised, forged leaves can only be removed by revoking their `rn`, which the attacker chose and the operator may not know. This was mostly true before too, but there is now no per-poll snapshot to reason about. Consider a key-epoch rule for roots.

---

## Answers to the brief's 8 questions

**1. Same revision, two phones.** Serious: it fully reveals both answers under that `nf`. It is also reachable with one phone and an honest relay (the 80-second time-out and retry), and with certainty through a relay that lies about `count` (A2).
- Binding `revision` into the proof and contract alone is not enough, because `count` comes from the relay.
- **Recommended fix:** derive `r` from the choice as well (`H(15, s, pollId, revision, choice, j)`), and add a local "never reuse an attempted revision" counter. Recovery stays receipt-free by scanning (revision ≤ cap+1) × 4 choices.
- Mixing in a fresh random value stored encrypted also works, but it needs extra recoverable state.

**2. `/state` trusted for content.** Much worse than denial of service:
- the relay can read answers through a substituted `PK` (A1);
- it can misdirect votes by swapping labels (B1);
- it can force `r` reuse by under-reporting `count` (A2);
- it can hide censorship behind a fake confirmation (C1);
- it can shrink the anonymity set with an old root (A4);
- it can keep members out of registration (C2).

Checking the rebuilt roots only shows that the relay's answer is consistent with itself, not that it matches the chain. The phone needs an independent view of the chain for `getPoll`, `pollHashAt`, `isHistoricalRoot`, the revocation root, `ballots()` and `metadataHash`.

**3. Historical roots and timing.** Yes, the root used is informative. Cryptographically the anonymity set is "leaves < N", which is fine when N is large. In practice, a ballot on the root created by the member's own registration, sent minutes later, singles out new members (A4). Use the newest root that is at least about 30 minutes old and contains the member's leaf. That keeps principle 1 and makes the root shared by everyone registered by then. Never accept a root the relay picks without checking it against the chain.

**4. `notBefore` bypass.**
- `vote`: no bypass. `notBefore` is in the leaf and signed (`registration.circom:118-137`), `openTime` is bound by `pollHash` (`ProofOfOnePolls.sol:284`, `ballot.circom:286-302`), and the check is at `ballot.circom:210-213`.
- `voteBatch`: no bypass. It uses the same verification key (I checked that the IC/vk constants of `BallotBatchVerifier.sol` and `Groth16Verifier.sol` are identical) and binds each `idRoots[i]` (`BallotBatchVerifier.sol:117-119`).
- `recoveryVote`: checks the *old* identity's `notBefore` (`recovery.circom:122-125`). The new identity is not checked, but it can only answer under the old `nf`, so there is no extra ballot. A member who lost both phone and password has no `sOld`, so this path is closed to them.
- A root from before the re-issue: it does not contain the new leaf, so it is no use.
- The old identity before revocation: this **is** a window (B3), until revocation plus 10 minutes, if the service issues the new identity first. It is not live in the pilot (`notBefore` is always 0, `service.js:185`).
- Minor: if `notBefore` were ever ≥ 2^40, `LessEqThan(40)` would wrap. It is signed by the service, so this only needs a range check in the service.

**5. Sampled polls.** No path found.
- `vote` and `voteBatch` go through `_checkIdRoot` (`ProofOfOnePolls.sol:482-485`, called at `:345` and `:435`), which for a sampled poll requires `idRoot == p.idRoot`. That same value is the verified public input (`:351`; batch `:117`).
- `recoveryVote` checks the old identity's root the same way (`:388`). It accepts any historical `idRootNow` (`:389`), but that is the new identity, and the ballot counts under the old, sampled `nf`. That is acceptable and by design.

**6. Registry growth.** `isHistoricalRoot` is an O(1) mapping, so there is no gas growth for voting. A registration costs about 1.6M gas (32 external Poseidon calls), each registration needs a unique credential from the enrolment service, and the relay pays. So griefing is limited by enrolment, not by the contract. A revoked member's old roots are harmless, because non-revocation is proved against the *current* revocation root.

The real costs are elsewhere:
- off-chain O(n) on every `/state` call and O(n)–O(n²) on the phone (C3, C4);
- roots can never be retired after a key compromise (D5);
- the `eligibleNow` regression (B2).

**7. Bias.** Acceptable. ⌊p/ℓ⌋ = 7, and p mod ℓ = ℓ − 6.6·10^37. So almost every residue appears 8 times, and the statistical distance from uniform is about **2^−128** (computed exactly). JS (`% L`) and Rust (`from_le_bytes_mod_order`) agree.

**8. Anything else.** See A1, A3, A4, B1, B2, C1, C2, C3, C4, C5 and D1–D5. The most urgent are A1, A2, B1 and B2.

---

## What I could not check

- I ran no tests and did not deploy. All findings come from reading the code. B2, A1 and A2 are direct consequences of the lines cited, but I did not reproduce them on chain.
- Not reviewed: the enrolment service's re-issue and revocation ordering (only line 185), the batch verifier's soundness beyond input binding, `BabyJubjub.sol`, the tally circuit, `plan7.js` and `DEPLOYMENT.md`.
- I did not check that the deployed Base Sepolia contracts match this source.
- Network-level linkage (Cloudflare, IP logging) is outside the code.
