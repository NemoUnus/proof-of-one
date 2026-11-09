# On-chain tally verification v0.1

*Proof of One specification. Status: draft, 3 November 2026; §6 added 9 November 2026, replacing the challenges of §3 by a tally proof (Decision Log #53). Schedule item 0.5-11, from the second-model review of whitepaper v0.8 (§8). Drafted by the project's AI agents; not audited.*

## 1. The gap

In the reference contracts up to commit a11fa42, `publish` checked only two things:

- the published ballot chain equals the chain on the ledger;
- the counts add up to the number of distinct voters.

Everything else about the result was checked only off-chain, by anyone running the recount tool (property R2). A dishonest publisher could post counts that sum correctly but are wrong. The contract would then finalise them after the challenge period unless people outside the contract raised the alarm. The contracts specification (§ResultsRegistry) already planned on-chain challenges for this, but none were implemented.

## 2. What a result depends on

For each answer option j, ballots are exponential ElGamal ciphertexts (A, B) on Baby Jubjub. The result of a poll is derived in four steps:

1. **Aggregate.** (A_j, B_j) is the sum of the latest ballot of every nullifier.
2. **Partial decryptions.** Each of t trustees publishes D_ij = x_i·A_j and a Chaum–Pedersen (DLEQ) proof that it used the same secret as its public share PK_i.
3. **Combination.** D_j = Σ λ_i·D_ij, where λ_i are the Lagrange coefficients of the t trustees.
4. **Count.** B_j − D_j = count_j·G.

A wrong result must be wrong in at least one of these four steps. The design makes each step either checked by the contract at once, or checkable by anyone who challenges it.

| Step | How it is checked | Cost |
|---|---|---|
| 1. Aggregate | **The contract keeps the sum itself.** Every ballot is added when it is recorded. A re-vote must hand over the ballot it replaces; the contract checks its hash against the stored ballot hash and subtracts it. | Paid by every ballot (§4) |
| 4. Count | **Checked at publication.** The result includes D_j; the contract checks B_j − D_j = count_j·G against its own aggregate. | Cheap: small scalars |
| 3. Combination | **Challenge.** Anyone may show that D_j ≠ Σ λ_i·D_ij for the published partials. | Paid only by a challenger |
| 2. Partial decryption | **Challenge.** Anyone may show that one trustee's DLEQ proof fails, or that one of its points is outside the prime-order subgroup. | Paid only by a challenger |

Why not check steps 2 and 3 at publication as well? On-chain scalar multiplication on Baby Jubjub is expensive: there is no precompile for it. Checking every proof at publication costs t·k DLEQ verifications, each with four full scalar multiplications. The optimistic design costs nothing when the result is correct. When it is wrong, one transaction by anyone is enough to prove it (§4).

## 3. Contract changes (reference implementation)

**Poll creation.** The creator passes the trustees' public shares PK_i from key generation (trustee i at position i−1) and the threshold t. The contract checks that:

- there are at most 32 trustees, and 1 ≤ t ≤ n;
- every key is a point of the prime-order subgroup;
- the Lagrange combination of the first t keys equals the tally key, so that a correct decryption exists and every partial decryption can be checked against a known key.

It stores a hash of the keys and emits them in a `TrusteeKeys` event, so anyone who wants to challenge has them.

**Ballots.** `vote` and `voteBatch` add every ballot to a running sum of the 8 points (A_0..A_3, B_0..B_3). The sum is stored in affine coordinates, each offset by one so that no storage slot is ever zero; within a transaction it is updated in projective coordinates and converted back with one inversion. A re-vote passes the replaced ballot:

- `vote` takes a `prev` argument;
- `voteBatch` takes a `prevs` list for its re-votes, in batch order.

The contract checks `prev` against the stored hash of the member's latest ballot, so a wrong `prev` is rejected (`BadPrevious`). A batch reads and writes the sum once, so its cost is spread over the ballots. `aggregate(pollId)` returns the sum in affine coordinates.

**Publication.** `publish(pollId, result, partials)` must include:

- the combined decryptions D_j;
- exactly t partial decryptions, each with its DLEQ proofs, from distinct trustees in increasing index order.

The contract checks the chain, Σ counts = distinct voters, and B_j − D_j = count_j·G for every option. It stores a hash of the partials and emits them in full in the `ResultPublished` event, so they are available to anyone who wants to challenge.

**Challenges** (anyone, during the 7-day challenge period, passing the published partials):

- `challengeCombination(pollId, partials, j)` recomputes Σ λ_i·D_ij and compares it with D_j.
- `challengePartial(pollId, partials, trusteeKeys, i, j)` checks the trustee keys against the commitment, then verifies trustee i's DLEQ proof for option j against the contract's own A_j.

A successful challenge sets the poll to **Rejected** and emits `ResultRejected(reason, trustee, option)`. A failed challenge reverts (`ChallengeFailed`) and changes nothing. From Rejected, a correct result may be published again. A rejection moves the publication deadline to at least 7 days later, so that a wrong result published just before the deadline cannot leave the poll without a result. Only when the deadline passes without a valid result may anyone mark the poll Withheld.

The identity point is accepted in a partial decryption: an honest trustee produces it when A_j is the identity, for example in a poll without ballots. A partial decryption that is not on the curve is reported as a failed partial by either challenge.

**Fiat–Shamir hash.** The DLEQ challenge was a 15-input Poseidon hash, which a contract cannot compute cheaply. It is now

c = keccak256(abi.encode(2, pollId, j, G, PK_i, A_j, D_ij, T1, T2)) mod ℓ

in both the reference tally and the contract. Poseidon remains in the circuits, where it belongs.

## 4. Measured cost

Measured on the reference test chain (ganache, solc 0.8.28, optimiser on), with t = 3 of n = 5 trustees and k = 4 options:

| Operation | Before (contracts README at commit a11fa42) | Now | Change |
|---|---|---|---|
| `createPoll`, 5 trustees | 921,874 | 3,640,236 | +2.7 million once per poll: subgroup checks of the 5 trustee keys and the check that they fit the tally key (about 2.3 million), and the 16 storage slots of the running sum (about 0.4 million) |
| `vote`, a voter's first ballot | 392,084 | 511,480 | +119,000: 8 point additions, one inversion and 16 storage updates |
| `vote`, re-vote | 374,839 | 517,688 | +143,000: also checks and subtracts the replaced ballot |
| `voteBatch`, n ballots | about 349,000 + 101,000·n | about 440,000 + 124,000·n | +23,000 per ballot and +90,000 per batch; in a batch of 64, about 131,000 instead of 106,000 per ballot (+23%) |
| `publish` | 158,145 | 227,095 | +69,000: four count checks; the partials are published as call data |
| `challengeCombination` (successful) | — | 493,447 | Paid by the challenger only |
| `challengePartial` (successful) | — | 2,032,448 | Paid by the challenger only: three subgroup checks and four scalar multiplications |

A first version kept the sum in projective coordinates (24 slots) and left the first ballot of each poll to create them, so that ballot cost 970,358 gas. Storing affine coordinates with an offset of one, which keeps every slot non-zero, and converting with a single inversion per transaction (Montgomery's trick) brought the first ballot down to the price of any other. The cost of creating the slots moved to the poll creator.

The running sum is the only cost every voter pays. The challenges cost about 0.5 million gas (combination, t = 3, growing by about 160,000 per trustee, so about 5 million at the maximum of 32) and about 2 million gas (one partial), but they are needed only when a result is wrong, and one honest challenger is enough. Checking the trustee keys makes `createPoll` more expensive; the table shows it with 5 trustees. All figures are execution gas; on a rollup, the fee is dominated by data, not execution (see [cost of large polls](cost-of-large-polls-v0.1.md)).

## 5. Limits and open questions

1. **Who may publish.** The reference contract still lets anyone publish; the spec requires t-of-n trustee signatures. Until that is implemented, anyone can publish a wrong result and force a challenge and a second publication, and can repeat this to delay the result for as long as they keep paying. The checks above make sure such a result cannot become final if someone challenges it in time, and the deadline extension keeps it from forcing the poll into Withheld. They do not stop the delay. Trustee signatures, or a deposit that a rejected publisher loses, close this.
2. **Time.** A rejection moves the deadline to at least 7 days later. Whether 7 days is right is to be decided with the governance procedure (0.5-14).
3. **Challenger incentives.** No deposit or reward yet. Monitoring is expected from trustees, observers and the recount tool, which can submit a challenge automatically when it finds a mismatch.
4. **Trustee keys vs. the tally key.** The contract checks that the first t keys combine to the tally key. That every other set of t trustees also does needs the commitments of key generation ([trustee key generation](trustee-key-generation-v0.1.md)); it is not checked on-chain. If some other set does not fit, a decryption by that set fails the count check at publication; it cannot make a wrong result pass, and the first t trustees, whose keys are checked, can always decrypt.
5. **Breakdown cells.** With breakdowns (whitepaper 7.9), each cell has its own aggregate, and the cost of the running sum grows with the number of cells. This needs measuring together with the small-cell design (0.5-13).
6. **Recursive aggregation.** If ballots are later aggregated by a validity proof ([ballot aggregation](ballot-aggregation-v0.1.md)), that proof can output the aggregate directly, and the per-ballot running sum can be dropped.

## 6. Update, 9 November 2026: every result checked at publication

*Decision Log #53, from the second-model review of whitepaper v1.0 (finding 3).*

**Why.** With challenges, a wrong result became final if nobody challenged it within 7 days. Correctness depended on someone watching.

**First attempt, not adopted.** Checking every trustee's proof directly in the contract costs about 2.03 million gas per proof (§4: three subgroup checks and four scalar multiplications on Baby Jubjub in Solidity). With t = 3 trustees and k = 4 options, that is 12 proofs, about 26 million gas with the combination. This is above Base's limit of 16,777,216 gas per transaction (EIP-7825), and the cost grows with the number of trustees.

**Adopted: a tally proof π_tally** ([tally-circuit](../../reference/tally-circuit/)). The publisher proves in zero knowledge what §3 left to challenges: every Chaum–Pedersen proof (step 2), the Lagrange combination (step 3), and B_j = D_j + count_j·G (step 4), against the contract's own running sum (step 1). The contract builds the 38 public inputs itself: the poll id, its running totals, the counts and D_j, the keys of the t trustees (checked against the commitment from poll creation), and their Lagrange coefficients. No secret is needed, so anyone holding the published partial decryptions can make the proof.

| | Challenges (§3, §4) | π_tally |
|---|---|---|
| A wrong result | final unless challenged within 7 days | refused at publication |
| `publish` | 227,095 gas | 853,274 gas |
| Time to a final result | 7 days after publication | at publication |
| Proving | — | 137,300 constraints; 16–19 s with snarkjs on 2 server cores |

**Changes.**

1. The trustees' DLEQ challenge becomes Poseidon(2, pollId, j, G, PK_i, A_j, D_ij, T1_ij, T2_ij), which is cheap inside the circuit. The keccak challenge stays for the contracts deployed in Phase 1a.
2. `challengeCombination`, `challengePartial`, `finalize` and the 7-day challenge period are removed. A result that passes is final at once. Points 1–3 of §5 lapse: a wrong result can no longer force a republication or delay, and no challenger incentives are needed.
3. Subgroup membership is proven by giving each point as 8 times another point, since 8·E is exactly the prime-order subgroup. This is cheaper than multiplying by the group order, which the circuit's Montgomery scalar multiplication cannot do safely.
4. The circuit is fixed at t = 3, and the reference contract accepts only that threshold. Other thresholds need their own circuit and verifier.

**Still open.** The setup is TEST-ONLY (issue #7). The partial decryptions are no longer passed to the contract; they go into the published transcript, which anyone uses to re-make or re-check the proof. Who may publish (trustee signatures, §5.1) no longer affects correctness, only who pays.
