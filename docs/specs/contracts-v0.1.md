# Proof of One — Contract Specification v0.1

*Author: Ostrakon (AI agent). Reviewed in session by Argus and Psephos (AI agents). Draft; not audited; all gas and cost figures are estimates to be measured.*
*Implements: Spec_Ballot_and_Enrolment v0.1 plus Red-Team changes C1–C9 (Decision Log #13).*

---

## 0. Principles
1. **No personal data on-chain.** Only hashes, commitments, ciphertexts, proofs and aggregate counts.
2. **Every state change emits an event** that is enough to rebuild all state off-chain.
3. **Past polls are immutable.** A poll stores the addresses of its verifiers and its roots at creation. No later upgrade can change how an existing poll is checked or counted.
4. **Assume the sequencer, relays and operators may misbehave.** Users can always submit directly, and forced inclusion through L1 is available.
5. **The contract enforces every check it can afford,** so that recounting off-chain is a confirmation, not the only defence.

## 1. Platform choice
- **An Ethereum Layer-2 rollup** with a working **forced-inclusion path to L1** and permissionless fraud or validity proofs. Its maturity stage on L2BEAT must be checked at selection time. Candidates: OP Stack and Arbitrum chains, or a ZK rollup.
- **Finding (Ostrakon + Argus): data availability is not the same as long-term availability.** Rollups post data to L1 as EIP-4844 blobs, which L1 nodes keep only for about 18 days. R2 (anyone can recount) needs the full ballot set **for years**.
  - **Fix:** each poll's ballot set is archived after close by several independent archivers (IPFS pinning, Arweave and mirrors).
  - The archive's hash is anchored in ResultsRegistry.
  - Anyone can rebuild the archive from an L2 archive node and check it against `ballotChain`.

## 2. Contracts overview

```
IdentityRegistry ── leaves, credential nullifiers, pending queue, batch insertion
RevocationRegistry ─ revoked handles (indexed Merkle tree), batch updates
EnclaveKeyRegistry ─ key-set root of enclave signing keys + attestation hashes
PollRegistry ─────── poll parameters, snapshot roots, trustee keys
PollAnswers ──────── ballots, latest-per-nullifier, ballotChain, counters
ResultsRegistry ──── tally, decryption transcript, challenge period, archive hash
Verifiers ────────── π_reg, π_vote, π_batchInsert, π_revokeBatch (immutable)
Governance ───────── timelocked multisig; can add new versions, cannot alter past polls
```

## 3. IdentityRegistry

```solidity
// Storage
bytes32 public root;                 // current Merkle root (depth 32)
uint256 public leafCount;
mapping(bytes32 => bool) public credentialUsed;   // cn
bytes32[] public pending;            // leaves awaiting batch insertion
uint256 public constant MIN_BATCH = 1000;         // K (open question)
mapping(bytes32 => bool) public historicalRoot;   // roots usable as poll snapshots

// Phone (via relay or directly)
function register(bytes32 leaf, bytes32 cn, bytes32 keySetRoot, Proof calldata pi_reg) external;
//  require(!credentialUsed[cn]);
//  require(EnclaveKeyRegistry.isValidKeySetRoot(keySetRoot));
//  require(RegVerifier.verify(pi_reg, [leaf, cn, keySetRoot]));
//  credentialUsed[cn] = true; pending.push(leaf);
//  emit Registered(leaf, cn);           // no timestamp beyond block

// Anyone (permissionless; usually an operator)
function insertBatch(uint256 count, bytes32 newRoot, Proof calldata pi_batch) external;
//  require(count >= MIN_BATCH && count <= pending.length);
//  inputHash = keccak256(root, newRoot, startIndex, pending[0..count]);
//  require(BatchVerifier.verify(pi_batch, inputHash));
//  root = newRoot; historicalRoot[newRoot] = true; leafCount += count; remove from pending
//  emit BatchInserted(startIndex, count, newRoot);
```

**Why batch insertion with a proof.** Inserting into a depth-32 Poseidon tree on-chain costs about 32 Poseidon hashes (~20k gas each), roughly 650k gas per leaf. A batch-insertion SNARK (the approach World ID uses in production) proves the root update for a whole batch at about 300–400k gas in total, plus calldata. It also fits naturally with the minimum batch K required for anonymity (C2).

**Pending-queue ordering (Argus).** Leaves are inserted in the order they arrived, so arrival order is visible. That is acceptable, because `register` already happens after the random delay, over Tor, and the leaf is unlinkable to the enclave session. Shuffling inside a batch is optional and would be proven in π_batch.

## 4. RevocationRegistry (C1)

```solidity
bytes32 public revRoot;                // indexed (sorted) Merkle tree of revoked handles rn
uint256 public revokedCount;
mapping(bytes32 => bool) public historicalRevRoot;

// Called by the enclave operator (signature from a current enclave key, checked against EnclaveKeyRegistry)
function revokeBatch(bytes32[] calldata rn, uint8[] calldata reasonCode,
                     bytes32 newRevRoot, Proof calldata pi_rev, bytes calldata enclaveSig) external;
//  emit Revoked(rn[i], reasonCode[i]) for each; revokedCount += rn.length
```

- Every revocation is public, with a reason code (for example 1 = re-enrolment after loss, 2 = document expired). The **public counters** let anyone notice unusual revocation activity, such as a sudden surge.
- **Cooling-off:** the enclave enforces it off-chain, for example 14 days between the request and the new credential. The `Revoked` event and the later enrolment are in different batches.
- π_vote proves that the voter's hidden `rn` is **not** in the tree at `revRoot` (an indexed Merkle tree non-membership proof).

## 5. EnclaveKeyRegistry

```solidity
bytes32 public keySetRoot;               // Merkle root of currently valid enclave public keys
mapping(bytes32 => bool) public validKeySetRoot;
event KeySetUpdated(bytes32 root, bytes32 attestationDocHash, bytes32 imageMeasurement);
function updateKeySet(...) external onlyGovernance;   // timelock ≥ 7 days
```

The **image measurement** published here must match a reproducible build of the open-source enclave code (C4), so anyone can check which code holds the keys.

## 6. PollRegistry

```solidity
struct Poll {
  address creator;
  bytes32 idRoot;          // IdentityRegistry snapshot (must be historicalRoot)
  bytes32 revRoot;         // RevocationRegistry snapshot
  uint256 eligibleLeaves;  // leafCount - revokedCount at snapshot (upper bound for C5 check)
  uint8   k;               // number of options
  uint8   cells;           // breakdown cells (1 = none, ≤ 6)
  bytes32 policyHash;      // eligibility policy
  bytes32 metadataHash;    // question text, options, method note (stored off-chain, e.g. IPFS)
  uint64  openTime; uint64 closeTime;
  uint16  maxRevotes;      // C8, default 10
  bytes32 tallyPK;         // encoded PK_poll
  bytes32 trusteeSetHash;  // trustee list + public shares + DKG transcript hash
  uint8   threshold;       // t
  address voteVerifier;    // fixed at creation (immutability principle)
  uint32  minCell;         // minimum cell size, default 50
}
function createPoll(Poll calldata p) external returns (uint256 pollId);
function attachTallyKey(uint256 pollId, bytes32 tallyPK, bytes32 trusteeSetHash,
                        bytes calldata trusteeSigs) external;   // t-of-n trustee signatures
```

A poll can receive ballots only after its tally key is attached. `closeTime` must be at least 48 hours after `openTime`, which leaves room for forced inclusion if the sequencer censors.

## 7. PollAnswers

```solidity
struct Slot { bytes28 ballotHash; uint32 count; }    // packed in one storage slot
mapping(uint256 => mapping(bytes32 => Slot)) public latest;   // pollId => nf => slot
mapping(uint256 => bytes32) public ballotChain;
mapping(uint256 => uint256) public distinctVoters;           // number of distinct nf
mapping(uint256 => uint256) public totalSubmissions;

function vote(uint256 pollId, bytes32 nf, Point[] calldata C, bytes32 ctxHash,
              Proof calldata pi_vote) external;
//  Poll p = PollRegistry.get(pollId);
//  require(block.timestamp in [p.openTime, p.closeTime));
//  require(C.length == 2 * p.k * p.cells);
//  require(Verifier(p.voteVerifier).verify(pi_vote,
//          [p.idRoot, p.revRoot, pollId, nf, C, p.tallyPK, p.policyHash, ctxHash]));
//  Slot s = latest[pollId][nf];
//  require(s.count < p.maxRevotes);
//  if (s.count == 0) distinctVoters[pollId]++;
//  bytes28 h = bytes28(keccak256(abi.encode(C)));
//  latest[pollId][nf] = Slot(h, s.count + 1);
//  ballotChain[pollId] = keccak256(ballotChain[pollId], nf, h, totalSubmissions[pollId]++);
//  emit Ballot(pollId, nf, C, s.count + 1);
```

- **ctxHash** binds the proof to `(chainId, contract, pollId, relayer-independent nonce)`, so a proof cannot be replayed on another chain or poll.
- **The contract enforces on-chain:** proof validity, the time window, the re-vote cap, and a count of distinct voters that cannot be manipulated.

## 8. ResultsRegistry

```solidity
enum State { None, Published, Final, Disputed, Withheld }
struct Result {
  bytes32 finalBallotChain;
  uint256[] counts;            // per option (and per merged cell)
  bytes32 transcriptHash;      // aggregates, partial decryptions D_ij, DLEQ proofs
  bytes32 archiveHash;         // hash of the archived ballot set (IPFS/Arweave CIDs listed off-chain)
  uint64  publishedAt;
  State   state;
}
uint64 constant CHALLENGE_PERIOD = 7 days;
uint64 constant WITHHOLD_DEADLINE = 14 days;   // after closeTime

function publish(uint256 pollId, Result calldata r, bytes calldata trusteeSigs) external;
//  require(block.timestamp >= p.closeTime);
//  require(r.finalBallotChain == PollAnswers.ballotChain(pollId));
//  require(sum(r.counts) == PollAnswers.distinctVoters(pollId));        // C5 / one-hot check
//  require(PollAnswers.distinctVoters(pollId) <= p.eligibleLeaves);    // C5 bound
//  verify t trustee signatures over (pollId, r)

function challenge(uint256 pollId, bytes calldata evidence) external;
//  On-chain checkable evidence → Disputed:
//   (a) a DLEQ proof in the transcript fails (verified on-chain; expensive but rare)
//   (b) the transcript's aggregate does not equal the sum of ciphertexts (fraud proof by bisection)
function finalize(uint256 pollId) external;        // after the challenge period, if not disputed
function markWithheld(uint256 pollId) external;    // anyone, if not published by the deadline (C9)
```

**Important check (Psephos).** Every valid ballot is one-hot, so `Σ counts == distinctVoters` must hold exactly. The contract enforces this. A wrong decryption or a forged aggregate will very likely break it, and if it does not, the DLEQ and aggregate challenges cover it.

## 9. Governance
- Timelocked multisig (timelock ≥ 7 days), with signers who are pseudonymous and independent. It can:
  - deploy new verifier versions;
  - update the enclave key set;
  - change default parameters for **future** polls.
- It **cannot** change any existing poll, ballot, result or root, cannot pause voting in an open poll, and cannot revoke identities. Revocation belongs only to the enclave, under public logging.
- The goal is to give up upgrade power over the core registries once the system is stable.

## 10. Cost estimates (indicative, to be measured)

| Operation | Main cost items | L2 gas (est.) |
|---|---|---|
| `register` | Groth16 verify (~230k) + 2 new slots (~44k) + event | ~300k |
| `insertBatch` (K = 1,000) | batch proof verify + calldata | ~400k total → ~0.4k per leaf + calldata |
| `vote`, k = 4, first vote | Groth16 verify with ~24 public inputs (~380k) + new slot (~22k) + chain update (~5k) + event with 512 B (~5k) | ~420k |
| `vote`, re-vote | as above but slot update (~5k) | ~400k |
| `publish` | signatures + storage | ~300k |

**Money estimate** (assumptions: L2 execution price 0.01–0.1 gwei, ETH at $2,000–4,000; data on blobs):
- **Per ballot:** roughly **$0.01–0.15**.
- **A poll with 1 million participants:** roughly **$10,000–150,000.** That is significant for a donation-funded project.

**Optimisation path:** ballot aggregation with recursive proofs. An aggregator collects many ballots and submits one proof for all of them. The cost per ballot falls by 10–100×. **The aggregator cannot censor:** users can always fall back to `vote()` directly. Planned for a later phase; it needs Psephos and Argus review.

**Public-input optimisation:** hash all public inputs into a single value inside the circuit, cutting verification gas. The trade-off is more constraints on the phone. Benchmarks are needed first.

## 11. Censorship and availability
- Several independent relays; the app can also submit directly.
- If the sequencer censors, the user submits through the rollup's L1 forced-inclusion path. A minimum 48 h poll length is set so this path is usable in time.
- Several RPC providers and archive nodes (C6). Hashes of the archives are anchored on-chain.

## Open questions
- **Q1. Who can create polls, and who pays?** Options:
  - (a) anyone, paying their own costs;
  - (b) anyone, with a deposit returned after close (anti-spam);
  - (c) curated polls sponsored by the contribution pool.

  Recommendation: (a) or (b) from the start, with (c) later. It touches the neutrality principle, so it is the founder's decision.
- Q2. Which L2? This needs a comparison of forced-inclusion delay, proof system maturity and cost.
- Q3. Is ballot aggregation worth bringing forward to Phase 1, given the cost table?

## Needs human review
All contracts (smart-contract auditors). The batch insertion circuit and the revocation non-membership circuit (ZK auditors). The challenge/fraud-proof logic (auditors with dispute-game experience). Cost figures (measurement on testnet).

— Ostrakon (AI agent, Proof of One); reviewed in session by Argus and Psephos (AI agents, Proof of One)
