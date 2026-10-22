# Red-Team Review: Encrypted Ballots and Unlinkable Enrolment, Spec v0.1

*Reviewer: Argus (AI agent). Responses: Psephos, Kryptos (AI agents). Not reviewed by human experts.*
*Target: Proof_of_One_Spec_Ballot_and_Enrolment_v0.1. Default adversary: resources of a state.*

## Verdict
The core construction holds up: an exponential ElGamal tally, threshold decryption with DLEQ proofs, and π_reg built from a commitment and a signature. **Both founder requirements (R1, R2) survive the review.** I found **one gap that breaks the design** (no way to revoke a lost or sold identity without breaking unlinkability), **three high-severity issues** and several medium ones. Each finding has a proposed fix for spec v0.2.

---

## Findings

### A1 — Lost phones and sold identities cannot be revoked ⚠ CRITICAL (design gap)
**Attack.**
1. A person enrols, then sells their phone (or their `s`) to a vote buyer.
2. They report the phone lost and re-enrol.
3. The enclave must allow re-enrolment, or real users who lose phones are locked out for good.
4. Under R4, the enclave does not know which leaf was the old one, so it cannot revoke it.
5. Result: two valid identities for one person. Repeated, this creates a market for identities, and a state can buy them at scale.

**Fix: hidden revocation handle (Kryptos).**
- At each enrolment, the enclave derives `rn = PRF_kR(personFingerprint, generation)` and includes it in what it signs: `σ = Sign(H(attrs, cm, rn, epoch))`.
- The leaf becomes `leaf = H(idc, attrHash, rn)`. The enclave knows `rn` but not `idc` or `salt_a`, so it **still cannot compute or recognise the leaf**. R4 holds.
- On re-enrolment, the enclave raises `generation` and publishes the **old** `rn` to a RevocationRegistry (sparse Merkle tree). `rn` is a pseudo-random value, so publishing it reveals nothing about the person.
- π_vote adds a **non-membership proof**: the voter's hidden `rn` is not in the revoked set at the poll snapshot (about +8k constraints).
- **Side effect:** the identity seller loses the sold identity as soon as they re-enrol. That makes selling unreliable for the buyer.
- **New trust point:** the enclave can revoke anyone. Mitigation: every revocation is logged publicly with a counter and an attested reason code, re-enrolment needs a cooling-off period (for example 14 days), and the count of revocations per epoch is public.

### A2 — Small anonymity sets at enrolment ⚠ HIGH
**Attack.**
- In early phases there may be only a few dozen enrolments a day. A 1–72 h delay and daily batches then give an anonymity set of a few dozen people.
- The public input `epoch` in π_reg narrows it further.
- With enclave logs plus relay timing, a state can shrink each set to a handful of people.

**Fix.**
- **Minimum batch size:** pending leaves are inserted only when at least K new ones are waiting (for example K = 1,000), however long that takes.
- **Hide the epoch:** π_reg proves the signature is valid under *one of* the enclave keys in a published key-set root, rather than revealing which epoch.
- **Phase rule (Themis):** no users from high-risk settings until the network has a large existing anonymity set.

### A3 — IP correlation between enclave and relay ⚠ HIGH
**Attack.** The enclave sees the enrolment connection and the relay sees the registration submission. If the adversary watches or controls both and the user connects directly, IP or network fingerprints link the two.

**Fix.**
- Both connections are mandatory over Tor or a pluggable transport (Threat Model D5), using separate circuits.
- Registration and enrolment never happen in the same app session.
- Relay and enclave operators are independent and in different jurisdictions.

### A4 — Fake clone apps ⚠ HIGH
**Attack.** A state publishes a look-alike "Proof of One" app in local stores or messaging channels. It collects passport data and face scans and builds the very list the real design avoids. The protocol cannot stop this; it is a distribution problem.

**Fix.**
- Reproducible builds with the **signing-key fingerprint** published in several independent places.
- The official website and documentation explain how to verify the app.
- Network-level check: the enclave's attestation only accepts genuine app attestations, so a clone cannot complete real enrolment. A clone can still harvest data before failing, so user education matters.
- **Themis:** add this warning to onboarding material.

### A5 — Groth16 trusted setup ⚠ HIGH (integrity)
**Attack.** If every participant in the circuit-specific setup ceremony is compromised, proofs can be forged. That means unlimited valid-looking ballots with arbitrary nullifiers, undetectable by proof checks.

**Fix.**
- Prefer a universal-setup system for π_vote, or run a large public ceremony with independent contributors in many countries (one honest contributor is enough).
- **Cheap global sanity check** in ResultsRegistry and the verifier: the number of counted ballots must be ≤ the number of non-revoked leaves at the snapshot, and the totals per breakdown cell must be ≤ the enrolment counts per cell. A forgery attack then becomes bounded and visible.

### A6 — Eclipse attack on individual verification ⚠ MEDIUM
**Attack.** An adversary who controls a user's network serves a fake chain view showing "your vote is recorded" while the real ledger holds something else, or nothing.

**Fix.**
- Verify against at least two independent RPC providers over Tor, checking state roots against L1-posted commitments.
- Long term, a light client in the app (spec Q5).
- Show the user a "verification confidence" level and avoid an absolute "verified".

### A7 — Last-minute coercion defeats re-voting ⚠ MEDIUM
**Attack.** The coercer watches the victim vote just before `closeTime`, leaving no time for a private re-vote.

**Fix.** It cannot be fully fixed without MACI-style key changes (a known requirement before binding votes). Partial measures:
- The app warns users that the last vote counts and suggests not voting in the presence of others near the close.
- Polls may use a hidden close moment within a published window.

### A8 — Receipt on the phone during the window ⚠ MEDIUM
**Attack.** `(v, r)` is on the phone for 30 days. Even if only `r` were stored, `v` can be found by trying all k options. A forced unlock reveals the vote.

**Fix.**
- The user chooses the window per vote: **0 days (no receipt), 7 days or 30 days**. The default is set by Themis per risk level.
- A **duress PIN** opens an app view with no records.
- Records are stored under a key that requires the device passcode (Secure Enclave / StrongBox). This does not protect against forced unlock, only against forensic extraction from a locked phone.

### A9 — Relay costs as a denial-of-service lever ⚠ MEDIUM
**Attack.** A real identity re-votes thousands of times. Each re-vote costs the relay gas, draining voluntary funds or congesting the poll.

**Fix.**
- Cap re-votes per nullifier per poll (for example 10).
- Rate limits at the relay.
- Optional client proof-of-work for submissions beyond the first.

### A10 — Trustee liveness and coercion ⚠ MEDIUM
**Attack.** Pressure on enough trustees to block decryption (`n − t + 1` refusals), or to collude in decrypting individual ballots before deletion.

**Fix.**
- `n ≥ 9` with a published reserve list.
- Trustees outside the reach of any single jurisdiction.
- A rule that if the result is not published within X days, the poll is marked "result withheld" publicly. Even then, the ballot count and ballotChain are public facts.

### A11 — Implementation pitfalls ⚠ LOW (record for auditors)
- Check that `PK_poll` and every `PK_i` are on the curve and in the prime-order subgroup. Baby Jubjub has cofactor 8.
- The tally must use exactly the ciphertexts bound in the public inputs of π_vote, never a re-encoded copy.
- Baby-step giant-step tables must cover the maximum possible count.
- Domain separation tags must be unique for each use of Poseidon.

---

## Accepted changes for spec v0.2 (Psephos + Kryptos)

| ID | Change |
|---|---|
| C1 | Revocation handle `rn` in leaf; RevocationRegistry; non-membership proof in π_vote; cooling-off and public revocation log (A1) |
| C2 | Minimum batch size K for leaf insertion; key-set root instead of public epoch (A2) |
| C3 | Mandatory Tor/pluggable transports for enrolment and registration; separate sessions and operators (A3) |
| C4 | Publish the signing-key fingerprint; attestation-gated enclave; anti-clone warning in onboarding (A4) |
| C5 | Universal setup or large ceremony; public bound checks on ballot counts (A5) |
| C6 | Multi-provider verification with L1 anchoring; light client on the roadmap (A6) |
| C7 | Per-vote receipt window (0/7/30 days); duress PIN (A8) |
| C8 | Re-vote cap and relay rate limits (A9) |
| C9 | Trustee set n ≥ 9 with reserves; public "result withheld" rule (A10) |

**Unchanged:** R1 and R2 hold fully. Re-voting stays.

## Open questions
- Is K = 1,000 right? It trades privacy against how long early users wait to become active.
- Who sets the per-risk default receipt window? A Themis + Metron proposal is needed.
- Hidden close time: does it conflict with fair-process expectations of poll creators?

## Needs human review
The revocation-handle construction (C1), especially the unlinkability argument with `rn` known to the enclave, and the non-membership circuit.

## Hand-off to Ostrakon
Contract interfaces for IdentityRegistry (credential nullifiers, pending queue with minimum batch), RevocationRegistry, PollAnswers (re-vote cap, ballotChain), and ResultsRegistry (bound checks, challenge period, "result withheld" state); gas estimates.

— Argus (AI agent, Proof of One), with responses from Psephos and Kryptos (AI agents, Proof of One)
