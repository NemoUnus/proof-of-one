# Review brief: deployment 5 (Decisions #62 and #63)

*Prepared 24 November 2026 for independent review by another AI model and by a separate agent of the team. Repository: https://github.com/NemoUnus/proof-of-one, commit `4f2d19b` ("Deployment 5 (Decision #62) …") and the later commits on `main`. Everything here is TEST-ONLY (Groth16 test setups, Base Sepolia test network) and has had no independent human review.*

## What the project is, in three sentences

Proof of One lets anyone run a poll in which each participant is a unique person (proved from a passport chip) who can answer once, and nobody can see who answered what. A member holds a secret `s` on the phone; a leaf derived from it sits in an on-chain identity tree; for each poll the phone proves in zero knowledge that it holds a leaf of that tree, that it is not revoked, that its attributes meet the poll's policy, and that its ballot (exponential ElGamal, one ciphertext per option, encrypted to a threshold tally key) is well formed, under a per-poll nullifier `nf = H(1, pollId, s)`. Only totals are ever decrypted.

## What changed in deployment 5, and why

Two principles set by the project's founder (Decision #62):

1. **Everyone takes part in every open poll at most about 30 minutes after joining.** Before, a poll fixed the identity root when it was created, so a member who joined later could not answer it.
2. **A member who gets their identity back (password on a new phone) sees, in every open poll, the answer recorded for them and may keep or change it.**
3. **One exception:** a member who lost both phone and password receives a *new* identity, which may answer only polls opened after it was issued.

Implementation:

| Part | Change | Files |
|---|---|---|
| Identity registry | Each registration (π_reg) is inserted into the incremental Merkle tree in the same transaction (no batches, Decision #63). Every root ever held is kept (`isHistoricalRoot`, `rootTime`); leaves are readable (`getLeaves`). | `reference/contracts/src/Registries.sol` |
| Polls contract | `vote`, `recoveryVote`, `voteBatch` take the identity root as an argument; `_checkIdRoot` accepts any historical root for open polls and only the creation root for sampled polls. `openTime` is bound into `pollHash`. | `reference/contracts/src/ProofOfOnePolls.sol` |
| Ballot circuit π_vote | `idRoot` becomes a public input (19 public inputs). New private attribute `notBefore` in the leaf; constraint `notBefore ≤ openTime` (0 for a first identity, the issue time for a re-issued one). | `reference/ballot-circuit/circuits/ballot.circom`, `src/ballot.js` |
| Recovery circuit π_recover | Both identity roots public; same `notBefore`/`openTime` rule. | `reference/ballot-circuit/circuits/recovery.circom`, `src/recovery.js` |
| Registration circuit π_reg | The credential message includes `notBefore` (Poseidon of 13 inputs). | `reference/enrolment-circuit/circuits/registration.circom`, `src/enrolment.js` |
| Ballot randomness | No longer random: `r_j = Poseidon(15, s, pollId, revision, j) mod ℓ`, so a phone holding `s` can rebuild any of its ballots and find the recorded answer from the on-chain ballot hash alone. `revision` = number of ballots already recorded for `nf`. | `reference/ballot-circuit/src/ballot.js` (`ballotRandomness`), `reference/native-prover/src/ballot.rs` (`ballot_randomness`, `recorded_answer`) |
| Relay | `GET /state?poll=&nf=` returns the leaves, revoked handles, both roots, the poll's public values and text, and the ballot hash and count for `nf`; `POST /` checks `isHistoricalRoot(idRoot)` before simulating; registration gas cap raised. | `reference/relay/src/index.js`, `test/pilot.test.mjs` |
| Android app (v0.12/0.13) | Registers 1–10 minutes after enrolment; poll screen builds the ballot natively, finds the recorded answer, sends a new or changed answer, reads it back. | `reference/android-prototype/app/src/main/java/io/github/nemounus/proofofone/reader/VoteActivity.kt`, `Registration.kt` |
| Deployment | Plan of 8 transactions, the pilot's first poll. | `reference/testnet/plan7.js`, `web/plan7.json`, `DEPLOYMENT.md` |

Design note: `docs/specs/joining-open-polls-v0.2.md`. Decision log: `docs/decisions/DECISION_LOG.md` (#61–#63).

## What we claim, and would like you to try to break

1. A ballot is accepted only from a leaf that is in *some* root the registry has held, is not revoked under the poll's revocation root, and meets the poll's policy; one counted ballot per `nf`.
2. A re-issued identity (`notBefore > openTime`) cannot answer a poll opened before it was issued, in `vote`, `voteBatch` and `recoveryVote`.
3. Sampled polls still use only the root fixed at creation.
4. Deterministic randomness does not weaken ballot secrecy: no two *different* plaintexts are ever published with the same `r` for the same member and poll.
5. The recorded answer can be found only by the holder of `s`.
6. Accepting any historical root does not shrink a voter's anonymity set below "all members registered before the root used".
7. The relay cannot make a phone send a ballot that leaks its answer or counts wrongly, even if `/state` lies.

## Specific questions

1. **Same revision, two phones.** Two phones holding the same identity (allowed after a restore, Decision #59) can each build a ballot with `revision = count` at the same moment and different choices, so the same `r_j`. The contract accepts only one, but the other may be submitted and revert on chain, with its calldata public. Two ciphertexts with equal `r` and different messages reveal the difference of the messages. How serious is this, and what is the right fix (for example binding `revision` into the proof and the contract, or mixing a fresh random value into `r` and storing it encrypted for the member)?
2. **`/state` is trusted for content.** The phone rebuilds both trees from the relay's leaves and checks that they give the roots the relay returned, but it does not compare those roots with the chain, and it does not yet check the poll text against the poll's `metadataHash`. What can a dishonest relay do with that (wrong text shown, wrong eligibility message, a ballot that fails), and is anything worse than a denial of service possible?
3. **Historical roots and timing.** Does publishing which historical root a ballot used give an observer anything useful (for example, a ballot using the root created by registration number N must come from a member with index ≤ N)? Should the app always use the newest root, or round down to a root that many members share?
4. **`notBefore` bypass.** Can a member who lost both phone and password, and received a new identity, still reach an open poll by any path: `voteBatch`, `recoveryVote`, a root from before the re-issue, the old identity before its revocation is accepted?
5. **Sampled polls.** Is there any path by which a ballot in a sampled poll is checked against a root other than the creation root?
6. **Registry growth.** `isHistoricalRoot` keeps every root forever. Any risk (gas, griefing by many registrations, a revoked member's old root)?
7. **Bias.** `r_j = H(…) mod ℓ` with ℓ ≈ 2^251 and a 254-bit hash. Is the bias acceptable?
8. Anything else in the files above that looks wrong.

## How to run the tests

```bash
cd reference/ballot-circuit && npm ci && npm test        # circuits, incl. the three Decision #62 tests
cd ../enrolment-circuit && npm ci && npm test
cd ../contracts && npm ci && npm test                    # 11 tests incl. registration after a poll opened
cd ../relay && npm ci && node test/pilot.test.mjs ../testnet/web/plan7.json
cd ../native-prover && cargo run --release --bin vote-check -- ../ballot-circuit/scripts/vote-vector.json graphs/ballot.graph ../ballot-circuit/setup/ballot_test.zkey
```

## How to report

For each finding: file and line, what is wrong, a concrete scenario, how serious (breaks secrecy / breaks one-person-one-answer / breaks counting / denial of service / minor), and a suggested fix. Say plainly when something is only a suspicion.

— Hypatia (AI agent, Proof of One), with Condorcet and Cai Lun
