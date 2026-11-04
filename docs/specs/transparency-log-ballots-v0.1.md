# Ballots in transparency logs with witnesses v0.1

*Proof of One specification. Status: draft, 4 November 2026, revised after two red-team rounds (§9). Schedule item 0.17-08, following Decision Log #46 and #48. Drafted by the project's AI agents; not implemented, not audited.*

## 1. Scope

Decision #46 records large open polls in public transparency logs with independent witnesses, anchored on the Layer-2 rollup. The identity registry, sampled polls and small polls stay on the rollup.

This note specifies how a poll recorded in logs works:
- where ballots go;
- what a voter receives;
- how the final set of ballots is fixed;
- what happens when something goes wrong.

The ballot itself changes in one way only. Besides the nullifier, the encrypted one-hot ballot and the ballot proof π_vote against the poll's pollHash, it carries a **revision number** r (§4, Decision #48).

A ballot is identified by **id = H(nf, r, ciphertext)**. The proof is left out of the identifier because a Groth16 proof can be re-randomised by anyone without changing what it proves (§9, round 2, finding 6).

## 2. Parts

| Part | Who runs it | What it does |
|---|---|---|
| **Ballot logs** L₁…Lₘ | Independent organisations; at least 3 per poll | Append-only Merkle logs in the C2SP tlog-tiles format (for example built with Tessera). Each checks a ballot's proof before appending it, returns a signed receipt, and publishes checkpoints and tiles as static files |
| **Rollup inbox** L₀ | The polls contract | Accepts a single ballot directly, as today. It counts as one more log, but it is not dependable in the last day of a poll (§4.5) |
| **Witnesses** | Independent organisations, not the log operators | Cosign a log's checkpoint only if it extends the last one they cosigned (C2SP tlog-witness, tlog-cosignature). A cosignature carries the time at which it was made |
| **Mirrors** | Independent organisations; at least one per log | Copy every log's tiles. A mirror **cosigns a checkpoint only after it has fetched all the data under it**, as in C2SP tlog-mirror (v0.1.0), whose cosignature states "I also mirrored the log up until the checkpoint size". A mirror's cosignature is therefore a promise that the data exists outside the log |
| **Polls contract** | The rollup | Records the poll's parameters, the logs' commitments, the anchored checkpoints and the result |

## 3. Poll parameters

The contract records these when the poll is created, and pollHash binds them:

- **Logs:** the accepted logs (public keys and addresses). L₀ is always included.
- **Witness policy per log:** each log's witness keys and its quorum k of n, plus at least one mirror whose cosignature is required.
- **Times:** the close time T; the longest time between checkpoints, Δcp (for example 1 minute); the grace period g (for example 10 minutes); the anchoring window w (for example 24 hours).
- **Re-vote cap:** the maximum revision number R, for example 10.

**Witness policy rules:**
- **Quorum.** Two conflicting checkpoints that each carry k cosignatures out of n share at least 2k − n witnesses, and those witnesses must all have signed both. A policy that must tolerate f dishonest witnesses therefore needs **2k − n > f**. It also needs at least k witnesses online, so it tolerates n − k unavailable ones. The default is **5 of 7**, which tolerates 2 dishonest and 2 unavailable witnesses.
- **A mirror in every quorum.** A checkpoint counts as cosigned only if it also carries the cosignature of at least one of the log's mirrors. Without this, a log could publish a cosigned checkpoint and then withhold the data under it (§9, round 2, finding 1).
- **Different sets per log.** Logs draw their witnesses from a larger pool and do not all share one set. An attacker who overloads a few witnesses then cannot stall every log at once (finding 2).
- **Independence.** The witnesses belong to at least three organisations that do not share an owner, in at least three jurisdictions. None is run by a log operator or by the project ([witness operators](../research/witness-operators-v0.1.md)).
- **No changes.** Like Sigsum's named policies, a published policy never changes; a new policy gets a new name.

The poll's eligible-member snapshot and tally key are as today.

## 4. Casting a ballot

1. **Send.** The phone sends its ballot to **two** randomly chosen logs, Lᵢ and Lⱼ, over the anonymising network. Both copies have the same id, and the recount counts them once. Sending to two logs costs storage but means one failed log loses no ballot (findings 1, 7).
2. **Receipt.** Each log checks the proof against the poll's pollHash, which takes a few milliseconds and keeps spam out. It also refuses a second ballot with the same nullifier and the same r but a different id. It then returns a **receipt**: its signature over the poll, the id and the time it received the ballot, with the promise to include the ballot in a checkpoint within Δcp. This follows the idea of Certificate Transparency's signed certificate timestamp.
3. **Inclusion proof.** Within Δcp, the phone fetches an **inclusion proof** for its ballot under a cosigned checkpoint of each log (§3: quorum plus a mirror). It also checks that its own entry can be fetched from the mirror. It keeps the receipts, the id, the proofs and the checkpoints. None of these reveals the answer (Decision #45).
4. **If a log fails.** If a log refuses the ballot, does not include it within Δcp, or its mirror cannot serve the entry, the phone sends the ballot to another log. A refusal after a receipt can be proven, because the receipt is signed. The app publishes such a receipt as evidence that the log misbehaved, over the anonymising network and after a random delay, so that the publication does not reveal who published it.
5. **The rollup inbox.** A phone sends a ballot to the rollup inbox L₀ only if every listed log fails. The rollup's sequencer can delay a transaction by up to about a day before forced inclusion takes effect, so L₀ cannot rescue a ballot in the last day of the poll. The app says so.
6. **Closing time for ballots.** Logs and L₀ stop accepting ballots at T − Δcp.

**Re-votes (Decision #48).** A member may send a new ballot until T − Δcp, and only the last counts.
- **Revision number.** Each new ballot carries a higher revision number r, with 1 ≤ r ≤ R. The ballot proof binds r, so only the member can choose it.
- **Which ballot counts.** For each nullifier, the ballot with the **highest r** counts. If two different ballots have the same r, the smaller id wins. Only the member's own device can make ballots for its nullifier, so a tie can only come from that device.
- **Keeping r right across devices.** Before each re-vote, the app reads the highest r already recorded for its nullifier. It downloads whole ranges of tiles from a mirror rather than asking for its nullifier, so the lookup does not reveal it. The current r is part of the identity's backup. If a collision is found, the app warns the member at once (finding 5).
- **Out-of-range ballots.** The recount ignores ballots with r outside 1..R.
- **Trade-off.** Someone who controls a member's phone can force the highest revision R. The member can then no longer replace that ballot. This was accepted as Decision #48.

## 5. Closing the poll and fixing the final set

1. **Daily anchors.** While the poll is open, anyone may submit a log's latest cosigned checkpoint to the polls contract. For each day, the contract keeps the **largest** checkpoint that is consistent with the previous anchor (finding 9).
2. **The log's own commitment before T.** Between T − Δcp and T, each log posts its final (size, root) to the contract, signed with its own key. The contract accepts it only with a consistency proof from the latest daily anchor; a consistency proof is about log₂ n hashes. This fixes the set of the log's ballots before T, whether or not witnesses are reachable at that moment (finding 2).
3. **Cosigning the commitment.** Until T + g, witnesses and the mirror cosign the committed root. The **close checkpoint** of the log is the committed root with a quorum and a mirror cosignature. Ballots inside it count.
4. **A log that commits nothing, or whose commitment is not cosigned.** The contract then uses, within the anchoring window w, the **largest** cosigned checkpoint whose quorum time is at or before T, consistent with the latest daily anchor.
   - Anyone may submit such a checkpoint, including a voter's phone that holds one. A larger consistent checkpoint replaces a smaller one, so a smaller tree cannot be anchored to leave ballots out.
   - The quorum time is the k-th smallest of the quorum's cosignature times. If at most f witnesses are dishonest, at least k − f honest witnesses cosigned the tree before T, so no ballot added after T can get in.
   - Cosignatures dated later than the time at which they are checked are rejected.
   - The phone first reads what the contract has anchored and submits only if its own checkpoint is larger. It submits through a relayer over the anonymising network, so that no funded address is linked to a ballot (finding 8).
5. **Equivocation.** A commitment or checkpoint that is not consistent with an earlier cosigned checkpoint proves that the log misbehaved. The mirror's cosignature guarantees that the tile data needed for the proof exists.
   - The app checks its own checkpoints against the anchored ones and publishes such a proof automatically.
   - The log is then marked failed and the poll is flagged. The ballots in the earlier cosigned checkpoint still count, because its data is at the mirror.
6. **The final set.** For each nullifier, the final set holds the ballot with the highest r, and on a tie the smaller id, among:
   - the ballots in all close checkpoints;
   - the ballots in the rollup inbox before T − Δcp.

   Duplicate copies (same id) count once. Ballots with an invalid proof or an out-of-range r are ignored. Honest logs never append one, but a dishonest log might. The rule is public and deterministic, so every verifier computes the same set.

## 6. Tally and verification

- **Tally.** Trustees, or anyone, compute the encrypted totals over the final set. The trustees decrypt the totals with proofs, as today. The result, the close checkpoints and a hash of the final set are recorded on the rollup.
- **R2 (recount).** The recount tool:
  - downloads every log from the logs or the mirrors;
  - checks the tiles against the close checkpoints;
  - checks every proof and applies the rule of §5.6;
  - adds the ciphertexts and checks the trustees' proofs.

  It is the same tool as today, reading logs instead of contract events.
- **R1 (own ballot).** After the close, the app checks three things:
  - its ballot's id is inside a close checkpoint, shown with an inclusion proof, and the checkpoints it held are consistent with the anchored ones;
  - no ballot with a higher r exists for its nullifier;
  - it shows the recorded answer during the receipt window (Decision #45).
- **What the contract no longer checks.** For polls on the rollup, the contract keeps the encrypted totals itself and checks the published result ([on-chain tally verification](on-chain-tally-verification-v0.1.md)). With ballots off-chain it cannot. Until the aggregation proof exists, the totals' correctness rests on the recount (R2): the result's challenge period is used for public recounts, and a mismatch is published with the evidence. Once ballots are aggregated by a validity proof ([ballot aggregation](ballot-aggregation-v0.1.md)), that proof can show that the totals are the sum of the final set, and can also check the cosignatures.

## 7. On-chain cost of anchoring

Witness and mirror cosignatures are Ed25519 signatures, and the EVM has no built-in check for them. Written in Solidity, one check may cost on the order of a million gas. A checkpoint with a quorum of 5 and a mirror would then cost about 6 million gas, which is still only cents at today's Layer-2 prices, and an equivocation proof about twice that. These figures must be measured.

Two cheaper options:
- **Store, check later.** The contract stores the checkpoint and its cosignatures and checks only the log's own commitment and the consistency proofs. Everyone checks the cosignatures at recount, and a bad one is challenged.
- **Check in the aggregation proof.**

The log's own commitment (§5.2) needs one signature check, which could use a key type the EVM checks cheaply.

## 8. Comparison with a poll on the rollup

| Property | Rollup poll | Log poll |
|---|---|---|
| Append-only and one view | The chain | Merkle logs with a quorum of witnesses (2k − n > f) and a mirror; each log's root committed on the rollup before the close |
| Censorship | Sequencer delay of up to about a day; forced inclusion | Ballots go to two logs; signed receipts; other logs; the rollup inbox until the last day |
| Which re-vote counts | Ledger order | Revision number bound in the proof (Decision #48) |
| Rules enforced at entry | By the contract | By each log; at recount by everyone |
| Encrypted totals checked on-chain | Yes | Not until aggregation proofs exist |
| Data availability | The rollup's history | A mirror cosigns only after copying the data |
| Cost for 100 million ballots | About 600,000 dollars or more, and beyond the capacity of one rollup | Server and storage costs, doubled by sending ballots to two logs; a few dollars of anchoring per log |

## 9. Red-team reviews

### Round 1 (4 November 2026)

| # | Severity | Finding | Change |
|---|---|---|---|
| F1 | Critical | Ordering re-votes by "witnessed time" let a log decide which ballot counts | Ordering by revision number (Decision #48) |
| F2 | Critical | k of n does not prevent split views with fewer than k dishonest witnesses | Rule 2k − n > f; default 5 of 7; equivocation proofs |
| F3 | High | The first submitter could anchor a smaller tree | Largest consistent checkpoint kept; daily anchors |
| F4 | High | A disappearing log took its ballots with it | Data from mirrors (strengthened in round 2) |
| F5–F9 | Medium/Low | Rollup inbox timing; re-vote cap across logs; on-chain cost; refusal near the close; receipt privacy | Revision numbers; logs refuse repeated (nf, r); §7; logs close at T − Δcp; receipts published anonymously |

### Round 2 (4 November 2026, a fresh reviewer)

The reviewer confirmed that ordering by revision number, the 2k − n > f rule, the quorum-time cut-off and the replacement rule work. New findings:

| # | Severity | Finding | Change |
|---|---|---|---|
| 1 | Critical | A log could anchor a checkpoint and then withhold the data, losing every ballot sent to it alone | A mirror that has copied the data must cosign (§3); ballots go to two logs (§4.1); phones check the mirror |
| 2 | High | Overloading a few shared witnesses near the close could keep late ballots out | Each log commits its root on the rollup before T (§5.2); separate witness sets per log |
| 3 | High | The close anchor was not tied to the daily anchors | Consistency proof from the latest daily anchor (§5.2, §5.4) |
| 4 | High | Ed25519 cost understated; equivocation between trees of different sizes needs tile data | §7; the mirror cosignature guarantees the data |
| 5 | Medium | A member on a new phone could reuse a lower r and lose a re-vote | App reads the highest r privately before re-voting; r in the backup |
| 6 | Medium | Re-randomised Groth16 proofs change a ballot's hash | Ballot id = H(nf, r, ciphertext) (§1) |
| 7 | Medium | The rollup inbox cannot rescue a ballot in the last day | L₀ closes at T − Δcp; stated as unreliable in the last day; two logs throughout |
| 8 | Medium | Millions of phones submitting checkpoints at the close, from funded addresses | Submit only if larger; through a relayer over the anonymising network |
| 9 | Low | A stale daily anchor could take the day's slot | Largest consistent checkpoint per day |
| 10 | Low | A dishonest log could accept ballots after T − Δcp | Limited by the root committed before T |

**Still open:**
- who runs the logs, mirrors and witnesses;
- network metadata seen by each log;
- measured gas for cosignature checks;
- a test with real witnesses (0.17-11).

## Sources

- C2SP specifications tlog-tiles, tlog-checkpoint, tlog-cosignature, tlog-witness and tlog-mirror (v0.1.0): https://c2sp.org ; tlog-cosignature v1.0.0: https://github.com/C2SP/C2SP/blob/tlog-cosignature/v1.0.0/tlog-cosignature.md
- Tessera v1.0, transparency.dev, 22 September 2025: https://blog.transparency.dev/tessera-v1-0-is-here
- "Can I get a witness network?", transparency.dev, 7 November 2024: https://blog.transparency.dev/can-i-get-a-witness-network
- Witness Network: https://witness-network.org/
- Named policies for Sigsum, Glasklar Teknik, 4 February 2026: https://www.glasklarteknik.se/post/named-policies-for-sigsum/
- Certificate Transparency, RFC 6962 (signed certificate timestamps, maximum merge delay).
