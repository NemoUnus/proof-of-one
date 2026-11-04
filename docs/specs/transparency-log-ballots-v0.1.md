# Ballots in transparency logs with witnesses v0.1

*Proof of One specification. Status: draft, 4 November 2026, revised after a first red-team review (§9). Schedule item 0.17-08, following Decision Log #46. Drafted by the project's AI agents; not implemented, not audited.*

## 1. Scope

Decision #46 records large open polls in public transparency logs with independent witnesses, anchored on the Layer-2 rollup. The identity registry, sampled polls and small polls stay on the rollup.

This note specifies how a poll recorded in logs works:
- where ballots go;
- what a voter receives;
- how the final set of ballots is fixed;
- what happens when something goes wrong.

The ballot itself changes in one way only. Besides the nullifier, the encrypted one-hot ballot and the ballot proof π_vote against the poll's pollHash, it carries a **revision number** r (§4).

## 2. Parts

| Part | Who runs it | What it does |
|---|---|---|
| **Ballot logs** L₁…Lₘ | Independent organisations; at least 3 per poll | Append-only Merkle logs in the C2SP tlog-tiles format (for example built with Tessera). Each checks a ballot's proof before appending it, returns a signed receipt, and publishes checkpoints and tiles as static files |
| **Rollup inbox** L₀ | The polls contract | Accepts a single ballot directly, as today. It counts as one more log, and it is the path of last resort |
| **Witnesses** W₁…Wₙ | Independent organisations, not the log operators | Cosign a log's checkpoint only if it extends the last one they cosigned (C2SP tlog-witness, tlog-cosignature). A cosignature carries the time at which it was made: "as of this time, this is the largest consistent tree I have seen" |
| **Mirrors** | Anyone; at least one independent mirror per log | Copy every log's tiles and cosigned checkpoints continuously, so the data outlives a log that disappears. The data checks itself against the cosigned checkpoints, so a mirror needs no trust |
| **Polls contract** | The rollup | Records the poll's parameters, its logs and witness policy, the anchored checkpoints and the result |

## 3. Poll parameters

The contract records these when the poll is created, and pollHash binds them:

- **Logs:** the accepted logs (public keys and addresses). L₀ is always included.
- **Witness policy:** the witness keys and the quorum k of n.
- **Times:** the close time T; the longest time between checkpoints, Δcp (for example 1 minute); the grace period g (for example 10 minutes); and the anchoring window w (for example 24 hours).
- **Re-vote cap:** the maximum revision number R, for example 10.

**Witness policy rules:**
- **Quorum.** Two conflicting checkpoints that each carry k cosignatures out of n share at least 2k − n witnesses, and those witnesses must all have signed both. A policy that must tolerate f dishonest witnesses therefore needs **2k − n > f**. It also needs at least k witnesses online, so it tolerates n − k unavailable ones. The default is **5 of 7**, which tolerates 2 dishonest and 2 unavailable witnesses.
- **Independence.** The witnesses belong to at least three organisations that do not share an owner, in at least three jurisdictions. None is run by a log operator or by the project ([witness operators](../research/witness-operators-v0.1.md)).
- **No changes.** Like Sigsum's named policies, a published policy never changes; a new policy gets a new name.

The poll's eligible-member snapshot and tally key are as today.

## 4. Casting a ballot

1. **Send.** The phone builds the ballot and sends it to a randomly chosen log Lᵢ over the anonymising network.
2. **Receipt.** Lᵢ checks the proof against the poll's pollHash, which takes a few milliseconds and keeps spam out. It also checks that this nullifier has not already used revision r in this log. It then returns a **receipt**: its signature over the poll, the ballot hash and the time it received the ballot, with the promise to include the ballot in a checkpoint within Δcp. This follows the idea of Certificate Transparency's signed certificate timestamp.
3. **Inclusion proof.** Within Δcp, the phone fetches an **inclusion proof** for its ballot under a checkpoint of Lᵢ that carries a quorum of the poll's witness cosignatures. It keeps the receipt, the ballot hash, the proof and that checkpoint. None of these reveals the answer (Decision #45).
4. **If the log fails.** If Lᵢ refuses the ballot or does not include it within Δcp, the phone sends it to another log. A refusal after a receipt can be proven, because the receipt is signed. The app publishes such a receipt as evidence that the log misbehaved, over the anonymising network and after a random delay, so that the publication does not reveal who published it. If every listed log fails, the phone sends the ballot to the rollup inbox L₀.
5. **Near the close.** Logs stop accepting ballots at T − Δcp, so that every accepted ballot can be in a checkpoint cosigned before T. In the last minutes before that, the app sends the ballot to two logs.

**Re-votes.** A member may send a new ballot until the close, and only the last one counts.
- **Order by revision number.** Each new ballot from the same member carries a higher revision number r, with 1 ≤ r ≤ R. The ballot proof binds r, so only the member can choose it.
- **Which ballot counts.** For each nullifier, the ballot with the **highest r** counts. If two different ballots have the same r, the smaller ballot hash wins. Only the member's own device can make ballots for their nullifier, so a tie can only come from that device.
- **Why not time.** Ballots for one nullifier may sit in different logs, and the time at which a log asks witnesses to cosign is set by the log. Ordering by time would let a log decide which of a member's answers counts (§9, F1).
- **Logs and recount.** Logs refuse a second ballot with the same nullifier and the same r. The recount ignores ballots with r outside 1..R.

**Trade-off (accepted, Decision Log #48).** With ordering by r, someone who controls a member's phone can force the highest revision R. The member can then no longer replace that ballot. With ordering by time, the member could have voted again later. Decision #45 already gives checking one's own answer priority over preventing coercion, and coercion with the phone in hand is already a known limit (whitepaper §17). The founder accepted it on 4 November 2026.

## 5. Closing the poll and fixing the final set

1. **Ballots that count.** For each log, the **close checkpoint** Cᵢ is the largest checkpoint whose quorum time is at or before T. The quorum time is the k-th smallest of the quorum's cosignature times, so it is never earlier than the time given by some honest witness. A ballot counts only if it is included in Cᵢ. Cosignatures dated later than the time at which they are checked are rejected.
2. **Daily anchors.** While the poll is open, anyone may anchor a log's latest quorum-cosigned checkpoint on the rollup once a day (Decision #46). This fixes the log's history early and costs little.
3. **Anchoring the close.** Between T + g and T + g + w, anyone may submit a log's close checkpoint with its cosignatures to the polls contract.
   - The contract keeps the **largest** submitted checkpoint whose quorum time is at or before T. A larger one replaces a smaller one only if it is consistent with it, which is shown with a consistency proof.
   - Any voter's phone that holds a larger checkpoint containing its ballot can submit it.
   - So the first submitter cannot anchor a smaller tree and leave ballots out.
4. **Completeness.** The log also publishes a checkpoint with quorum cosignatures dated at or after T + g. Witnesses that cosigned it had seen no larger tree for that log by then. If this checkpoint is larger than Cᵢ, the extra entries arrived after T and do not count.
5. **Equivocation.** Two quorum-cosigned checkpoints of one log that are not consistent prove that the log and at least 2k − n witnesses misbehaved.
   - Anyone may submit such a pair to the contract. The app does so automatically if its own checkpoint is not consistent with the anchored one.
   - The log is then marked failed, the poll is flagged, and the evidence is published with the result.
6. **A log that disappears.** A log's ballots still count if its close checkpoint (from anyone: a mirror, a witness or a voter's phone) and the matching tiles (from a mirror) are available. The log counts as **failed** only if no quorum-cosigned close checkpoint and no matching data exist anywhere. Then the result reports how many receipts from that log were published. Ballots sent to two logs near the close (§4.5) survive this.
7. **The final set.** For each nullifier, the final set holds the ballot with the highest r among:
   - the ballots in all anchored close checkpoints;
   - the rollup inbox before T.

   Ballots with an invalid proof or an out-of-range r are ignored. Honest logs never append one, but a dishonest log might. The rule is public and deterministic, so every verifier computes the same set.

## 6. Tally and verification

- **Tally.** Trustees, or anyone, compute the encrypted totals over the final set. The trustees decrypt the totals with proofs, as today. The result, the anchored checkpoints and a hash of the final set are recorded on the rollup.
- **R2 (recount).** The recount tool:
  - downloads every anchored log from the logs or the mirrors;
  - checks the tiles against the anchored checkpoints;
  - checks every proof and applies the rule of §5.7;
  - adds the ciphertexts and checks the trustees' proofs.

  It is the same tool as today, reading logs instead of contract events.
- **R1 (own ballot).** After the close, the app checks three things:
  - its ballot is inside an anchored close checkpoint, shown with an inclusion proof and a consistency proof from its own checkpoint;
  - no ballot with a higher r exists for its nullifier;
  - it shows the recorded answer during the receipt window (Decision #45).
- **What the contract no longer checks.** For polls on the rollup, the contract keeps the encrypted totals itself and checks the published result ([on-chain tally verification](on-chain-tally-verification-v0.1.md)). With ballots off-chain it cannot. Until the aggregation proof exists, the totals' correctness rests on the recount (R2): the result's challenge period is used for public recounts, and a mismatch is published with the evidence. Once ballots are aggregated by a validity proof ([ballot aggregation](ballot-aggregation-v0.1.md)), that proof can show that the anchored totals are the sum of the final set, and can also check the witness cosignatures.

## 7. On-chain cost of anchoring

Witness cosignatures are Ed25519 signatures. The EVM has no built-in check for them, so each one costs on the order of a few hundred thousand gas in a contract. With a quorum of 5:
- one anchored checkpoint costs very roughly one to two million gas, about 2 to 5 cents at today's Layer-2 prices;
- adding the daily anchors and the close for 3 to 5 logs, a poll's anchoring costs under a dollar, whatever the number of ballots.

This is to be measured. Alternatives are a contract that only stores the checkpoint and its cosignatures while the recount checks them, or checking them inside the aggregation proof.

## 8. Comparison with a poll on the rollup

| Property | Rollup poll | Log poll |
|---|---|---|
| Append-only and one view | The chain | Merkle logs with a quorum of witnesses (2k − n > f), anchored on the rollup daily and at the close |
| Censorship | Sequencer delay of up to about a day; forced inclusion | Any log can refuse; other logs, signed receipts and the rollup inbox are the fallbacks |
| Which re-vote counts | Ledger order | Revision number bound in the proof |
| Rules enforced at entry | By the contract | By each log; at recount by everyone |
| Encrypted totals checked on-chain | Yes | Not until aggregation proofs exist |
| Data availability | The rollup's history | Logs and mirrors; the data checks itself |
| Cost for 100 million ballots | About 600,000 dollars or more, and beyond the capacity of one rollup | Server and storage costs; under a dollar of anchoring |

## 9. Red-team review (first round, 4 November 2026)

A second agent reviewed the first draft. Its findings and the changes made:

| # | Severity | Finding | Change |
|---|---|---|---|
| F1 | Critical | Ordering re-votes by "witnessed time" let a log decide which ballot counts, by delaying its request for cosignatures. Different recounters could also see different times | Re-votes are ordered by the revision number in the proof (§4); time is used only for the cut-off at T |
| F2 | Critical | k of n does not prevent split views with fewer than k dishonest witnesses; two quorums share only 2k − n witnesses | Rule 2k − n > f; default 5 of 7; equivocation proofs submitted to the contract (§3, §5.5) |
| F3 | High | The contract cannot know "the latest checkpoint", and the first submitter could anchor a smaller tree | Anchoring window in which a larger consistent checkpoint replaces a smaller one; completeness checkpoint dated after T + g; daily anchors (§5) |
| F4 | High | A disappearing log took its ballots with it, although its data checks itself | Ballots count if the close checkpoint and tiles exist anywhere (§5.6) |
| F5 | Medium | The rollup inbox has no witnessed time | Solved by ordering by revision number |
| F6 | Medium | The re-vote cap was not enforced across logs | Revision numbers bounded by R in the proof; logs refuse a repeated revision (§4) |
| F7 | Medium | On-chain cost of checking cosignatures was understated | §7 |
| F8 | Low | A refusal just before the close left no time to send elsewhere | Logs close at T − Δcp; the app sends to two logs near the close (§4.5) |
| F9 | Low | Published receipts could reveal who published them | Published over the anonymising network after a random delay (§4.4) |

**Still open:**
- Who runs the logs and witnesses. With 5 of 7, the project needs seven independent witnesses, and today's witness network is young ([witness operators](../research/witness-operators-v0.1.md)).
- Network metadata seen by each log.
- A second review round (the coercion trade-off of §4 was accepted as Decision #48).

## Sources

- C2SP specifications tlog-tiles, tlog-checkpoint, tlog-cosignature, tlog-witness: https://c2sp.org ; tlog-cosignature v1.0.0: https://github.com/C2SP/C2SP/blob/tlog-cosignature/v1.0.0/tlog-cosignature.md
- Tessera v1.0, transparency.dev, 22 September 2025: https://blog.transparency.dev/tessera-v1-0-is-here
- "Can I get a witness network?", transparency.dev, 7 November 2024: https://blog.transparency.dev/can-i-get-a-witness-network
- Witness Network: https://witness-network.org/
- Named policies for Sigsum, Glasklar Teknik, 4 February 2026: https://www.glasklarteknik.se/post/named-policies-for-sigsum/
- Certificate Transparency, RFC 6962 (signed certificate timestamps, maximum merge delay).
