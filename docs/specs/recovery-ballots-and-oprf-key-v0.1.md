# Recovery ballots and the shared OPRF key v0.1

*Proof of One specification. Status: draft for review, 9 November 2026. Schedule item 1.13-04, from Decision Log #52 (point 2) and #53 (points 1 and 2). Drafted by the project's AI agents; not audited, not implemented.*

This note designs three things the founder decided after the second-model review of whitepaper v1.0:

- a way for a member who restores a backup to replace their old identity's ballots in polls that are still open (§1);
- a document-fingerprint key that no single operator holds (§2);
- a check that was missing from the fingerprint protocol of whitepaper v1.0, found while writing §2 (§3).

## 1. Recovery ballots (Decision Log #52, point 2)

### 1.1 The situation

Alice's phone is stolen while poll X is open. She recovers. Her old identity is revoked, and since update 93 open polls refuse ballots proven against the new revocation root (implementation note N33). Two problems remain:

1. Any ballot the thief cast **before** the revocation still counts.
2. Alice's **new** identity cannot vote in X, because it is not in X's membership snapshot.

Nobody can find the thief's ballot without the old secret. Each ballot carries only its nullifier nf = Poseidon(1, pollId, s), and the network cannot link it to a member; that is what keeps ballots anonymous (Decision Log #52). Alice can find the ballot only if she has a backup of her old secret s_old.

### 1.2 Design

At recovery, the enclave checks Alice's face as usual. It then writes into her **new** identity leaf a hidden field `replaces = Poseidon(14, rn_old)`, where rn_old is the revocation handle of the old identity. The field sits inside the leaf commitment like the other attributes and is never published.

A **recovery ballot** in poll X is a ballot whose proof shows, without revealing which members are involved:

| # | Statement |
|---|---|
| 1 | The prover knows s_old; the old identity's leaf is in X's membership snapshot; the published nullifier is nf_old = Poseidon(1, X, s_old). |
| 2 | The prover knows s_new; the new identity's leaf is in the **current** identity tree and is not revoked. |
| 3 | The new leaf's `replaces` field equals Poseidon(14, rn_old) of the old leaf. |
| 4 | The usual ballot statements: well-formed one-hot encryption, eligibility, binding to the poll. |

The contract treats it as a re-vote under nf_old. It subtracts whatever nf_old last recorded, including a thief's ballot, and records Alice's answer in its place. The old identity's revocation does not block this path: the new identity's non-revocation stands in for it.

### 1.3 Why it is safe

- **The thief cannot use it.** The thief holds s_old but not s_new, and s_new belongs to an identity that the enclave issued only after a face check.
- **Alice cannot vote twice.** The recovery ballot reuses nf_old, so it replaces the old identity's ballot instead of adding one. Alice's new identity cannot vote in X by any other path, because it is not in X's snapshot.
- **The thief's re-votes cannot exhaust Alice's re-votes.** A thief could use up the re-vote cap of nf_old before the revocation. Each nullifier therefore gets **one recovery ballot beyond the cap**. This needs a public flag on the ballot, which reveals that this nullifier's identity was recovered during the poll. It reveals nothing about who.
- **Without a backup, nothing changes.** Alice cannot compute nf_old, so she cannot make a recovery ballot. The thief's earlier ballot stands, as Decision Log #52 accepts.

### 1.4 Cost and changes

- Identity leaf: one more hidden field. This touches the enrolment and ballot circuits and needs a new test setup.
- A recovery-ballot circuit: two membership paths and one revocation path. About twice the size of π_vote.
- Contract: a `recoveryVote` entry with its own verifier, and a per-nullifier flag for the recovery ballot.
- App: at recovery with a backup, the phone lists the open polls in which the old identity voted and offers to replace those ballots.

This is to be implemented after the current contract work, with its own tests. Until then the whitepaper describes it as designed, not implemented.

### 1.5 Implementation choice: the link in the revocation handle (14 November 2026)

§1.2 put the link in a new hidden field of the identity leaf. That would change the leaf, the registration proof π_reg and the ballot proof π_vote for every member, and need new setups for all three. The link is placed instead in the **revocation handle** of the new identity:

    rn_new = Poseidon(14, rn_old, ρ)     with ρ random, retried until rn_new < 2^252

- The enclave already chooses rn and signs it in the credential message (red-team change C1), so a member cannot choose an rn_new that points to someone else's old identity. Members who never recovered keep a random rn.
- The leaf format, π_reg and π_vote are unchanged. Only the enclave's recovery step and the new recovery proof are new.
- rn_new looks random. Even when both handles become public, because both identities are revoked, they cannot be linked without ρ, which only the member holds.
- The recovery proof checks the link and the new identity's non-revocation (statements 2 and 3 of §1.2), and treats the old identity as in π_vote but without its non-revocation.

Reference circuit, builder and tests: `reference/ballot-circuit/circuits/recovery.circom`, `src/recovery.js`, `test/recovery.test.js` (42,170 constraints; TEST-ONLY setup). The enclave links every reissued identity this way, after a lost phone and also when a further document is added (Decision Log #30), since both revoke the identity they replace.

**Contract** (`reference/contracts/src/ProofOfOnePolls.sol`, `recoveryVote`): verifies π_recover with the poll's `pollHash` for the current revocation root (or the previous one within the grace) and the identity registry's current root; replaces the nullifier's last ballot as a re-vote does; sets `recovered[poll][nf]`, after which ordinary ballots under that nullifier are refused; allows recovery ballots up to one beyond the re-vote cap. Measured: 568,963 gas. End-to-end test on a local chain: the re-enrolled member replaces the old identity's ballot in a poll still open, and the proved result reflects it. Next: the app's recovery screen, and the next test-network deployment.

## 2. A shared fingerprint key (Decision Log #53, points 1 and 2)

### 2.1 The problem

The document fingerprint is F = H(x, k·x), where x is a point derived from fields such as name, birth date and sex, and k is the OPRF key. These fields have few combinations, so whoever holds k can compute F for every likely person and match them against stored fingerprints. The OPRF protects against outsiders and against theft of the fingerprint database. It does not protect against the key holder (review of v1.0, finding 1).

### 2.2 Design: threshold 2HashDH

The key k is shared among n independent operators with threshold t (for example 2 of 3), using Shamir sharing generated by a distributed key generation, as for the tally key ([trustee key generation](trustee-key-generation-v0.1.md)). No one ever holds k.

```
Setup:     operator i holds k_i; K_i = k_i·G and K = k·G are public on the ledger
Phone:     B = r·x                       (blinded, as before)
Operator i: Z_i = k_i·B, with a DLEQ proof that log_G K_i = log_B Z_i
Phone:     checks the t proofs;  Z = Σ λ_i·Z_i = k·B;  W = r⁻¹·Z = k·x;  F = H(x, W)
```

- **Guessing needs t operators.** One operator alone learns nothing about F, because it sees only B, and it cannot evaluate guesses alone.
- **Operators are independent organisations in different jurisdictions.** Each runs its share inside attested enclave code that answers only requests carrying a valid document proof π_doc. Each operator rate-limits evaluations and publishes its count of evaluations per day in the transparency log, so that bulk guessing would be visible.
- **The phone talks to t operators.** This adds one round trip, done in parallel.

### 2.3 No scheduled key change

Fingerprints must stay the same for years, so that a returning person is recognised. They cannot be recomputed later, because the inputs are not kept.

- **The key k is never changed on a schedule.** It is changed only if t shares are suspected to be compromised. Old and new keys then run side by side, each member moves to the new key the next time they prove their document, and the old shares are destroyed at the end (Decision Log #53).
- **The shares can be refreshed without changing k.** In proactive re-sharing, the operators jointly make new shares of the same k and destroy the old ones. A share stolen before a refresh becomes useless after it, and fingerprints stay the same. Refreshing once a year, and whenever an operator changes, gives most of the benefit of key rotation without its cost.

## 3. A missing check: the fingerprint was not verified

Whitepaper v1.0, §7.5, has the phone unblind the OPRF output and send F to the enclave. Nothing lets the enclave check that F is the fingerprint of the proven document. A modified app could send a random F, and the document-uniqueness check would never find a match. The face search would still run for every enrolment, so the attack does not bypass uniqueness altogether, but it removes the first layer.

**Fix: a small unblinding proof π_unblind.** With B, Z and F public and r, x and W private, the phone proves:

- B = r·x;
- Z = r·W;
- F = H(x, W).

π_doc already proves that B is the blinded point of the signed fields. Together the two proofs show that F belongs to the document, provided the inputs are bound as follows (added 9 November 2026, from the second-model review of whitepaper v1.1, finding 8):

- The enclave takes B from π_doc's public output, never from a separate message.
- The enclave receives the t values Z_i with their DLEQ proofs, checks each against operator i's key share K_i on the ledger, and computes Z = Σ λ_i·Z_i itself. The phone can therefore substitute neither B nor Z.
- π_unblind has public inputs (B, Z, F) and private inputs (r, x, W).
- x is formed inside π_doc from the trust-list rule, the path's domain separator (1, 2 or 3) and the signed fields. Only B leaves π_doc, so the issuer, series, rule version and path are bound through B. The circuit needs two scalar multiplications and a hash, a few thousand constraints. The same applies to the document key D (whitepaper §7.5, domain 3).

This gap was not among the 25 findings of the second-model review. It was found while designing §2, and it goes into whitepaper v1.1 and into the threat model.

## 4. Open questions

1. How many operators, and which organisations: n = 3, t = 2 is the smallest useful choice. Operators should be chosen for independence from each other and from the project.
2. Rate limits that stop bulk guessing without blocking honest enrolment peaks.
3. Whether the recovery-ballot flag should be hidden, for example by giving every ballot a dummy flag. This needs a design that keeps the cap.
4. A security proof of the threshold 2HashDH variant on Baby Jubjub, by human cryptographers, before implementation (review of v1.0, finding 25).
