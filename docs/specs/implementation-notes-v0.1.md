# Implementation notes v0.1 — what the reference code taught us

*Authors: Psephos, Ostrakon and Kryptos (AI agents). Status: findings from building the reference implementation in [`reference/`](../../reference/). Nothing here is audited.*

These notes record where the implementation confirmed the specifications, where the real numbers differ from the estimates, and which details the specifications must now state explicitly. They feed the next revision of the whitepaper and specifications.

## 1. Measured sizes

| Item | Spec estimate | Measured | Note |
|---|---|---|---|
| Ballot proof π_vote, 4 options, trees of depth 32 | about 40,000 constraints | **32,607** with up to three documents and a birth-date range (32,535 with an age band; 32,429 with one document; 31,554 before `pollHash`) | Includes revocation non-membership (C1), which the original estimate did not |
| Registration proof π_reg, key-set depth 8 | 12,000–18,000 | **9,369** with up to three documents (9,171 with one) | EdDSA-Poseidon verification dominates |
| Document-validity proof π_doc (TD3 passport, SHA-256, RSA-2048) | — | **577,678** (SHA-256 about 366,000; RSA-2048 185,903) | Once per enrolment; needs a native prover on phones ([spec](document-validity-proof-v0.1.md)) |
| Batch insertion proof π_batch, depth 32 | — | **16,227** (4 leaves); **501,947** (1,024 leaves) | Four public inputs regardless of batch size |
| Revocation update proof π_revoke, depth 32 | — | **32,521** | Four Merkle paths and two range comparisons |
| π_vote proving time | "seconds on phones" | 4–5 s on a server CPU (snarkjs, Node.js); about 10 s in a browser on 2 server cores; **3.5 s in the browser of an iPhone 14** and **3.0 s on a Samsung Galaxy S24 Ultra** (Chrome on Android), both measured by the founder | Phones: [phone benchmark](../../reference/phone-bench/); native provers are expected to be faster |
| π_doc proving time | — | **11.1–12.1 s on 2 server cores** (arkworks, TEST-ONLY random setup; peak memory 1.9 GB; verification 3–4 ms) | [prove-bench](../../reference/prove-bench/); phones still to be measured (0.8) |
| π_vote in Noir/UltraHonk (same hash and curve) | — | **146,770 gates**; with native Poseidon2/Grumpkin **20,038** | [aggregation prototype](../../reference/aggregation-prototype/); size only |
| Verifying one ballot proof inside an aggregation proof | — | **about 750,000 gates** | Server-side cost of recursive aggregation |

## 2. Measured gas (reference contracts, unoptimised)

| Operation | Spec estimate | Measured |
|---|---|---|
| Register an identity (π_reg) | ~300,000 | **302,271**; **334,589** with the batch chain hash |
| A voter's first ballot | ~420,000 | **392,084**; the poll's very first ballot **426,296** (533,615 with 26 public inputs, before `pollHash` and packed storage) |
| Re-vote | ~400,000 | **374,839** (442,997 before) |
| Groth16 verification of π_vote alone | — | **303,022** (78% of a ballot) |
| Batch of n ballots (`voteBatch`) | — | **about 349,000 + 101,000 · n**, measured for n = 1, 2, 4, 7; +34,000 for the poll's first batch |
| Create poll (subgroup check of the tally key; `pollHash`, once per poll) | — | **921,874** (874,687 before the birth-date range) |
| Publish result | ~300,000 | **158,145** |
| Insert identities, on-chain hashing | ~650,000 per leaf (naive) | **~1,050,000 per leaf** |
| Insert a batch with π_batch (any batch size) | ~400,000 per batch | **293,548 per batch** |
| Revoke, on-chain path checks | — | **4,027,982** |
| Revoke with π_revoke | — | **294,646** |

**Consequences:**

1. The first measurement put a ballot about 27% above the estimate. Binding the nine per-poll values with one `pollHash`, and packing storage, brought it below the estimate. **Batched verification is now implemented** (Decision Log #23): about 101,000 gas per ballot in large batches, 3.8 times less than a single ballot. Further steps and their limits are in [ballot-aggregation-v0.1.md](ballot-aggregation-v0.1.md).
2. On-chain hashing for insertion and revocation is not viable. **Batch insertion with π_batch is now implemented** and cuts insertion from about 1,050,000 gas per leaf to 293,548 per batch, which is under 300 gas per leaf for a batch of 1,024. **Revocation with π_revoke is also implemented**: 294,646 gas instead of 4,027,982.

## 3. Details the specifications must state explicitly

| # | Detail | Where it came up |
|---|---|---|
| N1 | **Ballot ciphertexts need no subgroup check on-chain.** The proof computes them from Base8 and the tally key, so they are in the subgroup by construction. The tally key must be checked once, at poll creation. This saves gas on every ballot. | contracts |
| N2 | **The verifier must rebuild all public inputs** from the poll's own parameters and the submitted ciphertexts, never accept them from the submitter. | ballot-circuit, contracts |
| N3 | **Context binding:** `ctxHash = keccak256(chainId, contract, pollId) mod p` is enforced by the contract, not chosen by the phone. | contracts |
| N4 | **Revocation handles must be below 2^252** (comparator range). The enclave truncates the PRF output. | enrolment-circuit, ballot-circuit |
| N5 | **Domain tags for every Poseidon use:** nullifier 1, DLEQ challenge 2, credential nullifier 3, commitment 4, credential message 5, revocation handle 6, poll hash 7. | all packages |
| N6 | **The ballot hash and ballot chain encoding** must be fixed byte for byte (per option: A.x, A.y, B.x, B.y as 32-byte words). The reference tally and the contract now produce identical chains. | tally, contracts |
| N7 | **Snapshot semantics:** a poll created before a revocation keeps its old revocation root, so a revoked identity can still vote in polls that were already open. This is the intended behaviour, since the snapshot is fixed, but it should be stated, together with the cooling-off period. | contracts |
| N8 | **Without π_vote, the tally checks cannot detect a vote-shifting ballot** such as (+2, −1, 0, 0). Every path that accepts ballots must verify the proof. | tally |
| N9 | **The eligible-identity count** used for the bound check is `leafCount − revokedCount` at the snapshot. | contracts |
| N10 | **Batch insertion binding:** the registry keeps a Poseidon chain hash of each batch as leaves are registered, and π_batch must match it. Batches are full, aligned and inserted in order; the target subtree is proven empty, with the empty-subtree root computed in the circuit. | enrolment-circuit, contracts |
| N11 | **Initial revocation root:** RevocationRegistry takes the root of the sentinel-only tree as a constructor argument instead of hashing it on-chain. Deployers and auditors must check that it equals the root of a depth-32 tree holding only Poseidon(0, 0); the tests do. | contracts |
| N12 | **pollHash:** the ballot proof takes `pollHash = Poseidon(7, Poseidon(idRoot, revRoot, pollId, PK.x, PK.y), Poseidon(minAgeBand, minExpiryMonth, requiredNat, ctxHash))` as one public input. The contract computes it once at poll creation from its own state, and the phone computes the same value. | ballot-circuit, contracts |
| N13 | **Fixed gas for precompile calls.** A failing call to a curve precompile consumes all gas forwarded to it. Forwarding all remaining gas turns an invalid point into an out-of-gas failure of the whole transaction. The batch verifier gives each call a fixed allowance. | contracts |
| N14 | **Batch weights from the complete call data.** Batch verification is sound only if the random weights are fixed after every proof and input; they are derived from keccak256 of the full call data. | contracts |
| N15 | **Several documents per identity:** eligibility uses a private one-hot document selector; an empty slot (nationality 0) can never be selected, and the selector costs about 100 constraints. Attribute order is fixed in one shared module (`attrs.js`). | ballot-circuit, enrolment-circuit |
| N16 | **Hash and curve choice decides the cost in other proof systems.** The same ballot statement is about 7 times larger in UltraHonk with Poseidon and Baby Jubjub than with that system's native Poseidon2 and Grumpkin. Any move to recursive aggregation must weigh a redesign of the primitives. | aggregation-prototype |
| N17 | **Ages as birth-date ranges.** The identity stores the date of birth as a day number; a poll's age rule is a range of birth days computed for the poll date and bound into `pollHash`. Inputs to the 32-bit comparators are below 2^32 because the enclave signs the date and the contract stores the range as `uint32`. | ballot-circuit, contracts |
| N18 | **Headroom of the test parameters.** The ballot proof (32,607 constraints plus 18 public inputs) is close to the 2^15 limit of the test powers-of-tau file. The next increase needs a 2^16 file. | ballot-circuit |
| N19 | **Robust trustee key generation.** The joint-Feldman key generation of the first reference tally let a trustee that spoke last bias the key. It is replaced by GJKR-style key generation with hiding commitments, complaints that anyone can settle from the transcript, and rebuilding of dealers that withdraw ([trustee-key-generation-v0.1](trustee-key-generation-v0.1.md)). Hash tags 9–12 are used for it. | tally |
| N20 | **Nationality and signer encodings.** Nationality codes are the three ICAO letters packed as one number (`natCode("FRA")`), so no country table is needed inside a circuit. Document signers are checked against CSCA certificates by a public tool and enter π_doc as leaves of a DSC tree, so the phone does not verify the CSCA signature. | document-circuit, ballot-circuit |
| N21 | **Trust list: references, not copies.** The published list holds fingerprints and sources, never certificates, because the ICAO PKD terms forbid republishing. Master lists are accepted only under pinned anchors whose fingerprints were checked on the issuing authority's website ([trust-list-v0.1](trust-list-v0.1.md)). | document-circuit |
| N22 | **Timing without a powers-of-tau file.** A snarkjs Groth16 key for π_doc needs a 2^20 powers-of-tau file, which the agents' machine could neither download nor make within its time limit. Proving time was therefore measured with arkworks from the same `.r1cs` and witness, after a random circuit-specific setup. The tool checks that the witness satisfies every constraint and that a proof fails against an altered public input. Its keys are TEST-ONLY. | prove-bench, document-circuit |
| N23 | **Re-voting is safe only with a check after the close.** Asked by e-mail, a voting-security researcher confirmed (28 October 2026) that letting voters re-vote and counting only the last ballot, as Belenios also does, keeps verifiability and privacy *provided* each voter checks that their last ballot is on the final bulletin board; attacks are possible otherwise (Baloglu, Bursuc, Mauw and Pang, "Election Verifiability Revisited", CSF 2021, [eprint 2020/982](https://eprint.iacr.org/2020/982)). The reference tally has this check (`voterCheckCounted`). Still to do: the app runs it automatically after the close and keeps the last ballot's hash until then; the paper's attacks are to be checked against our design. | tally, app (1.4) |

## 4. Open issues found during implementation

- **Licence of generated verifiers:** snarkjs-generated Solidity verifiers carry GPL-3.0, which conflicts with the planned Apache-2.0 licence for contracts. Options are a differently licensed verifier template or a licence decision. *Needs human legal review.*
- **Trusted setup:** all proofs use TEST-ONLY single-contributor setups (issue #7).
- **Dependencies:** `npm audit` reports advisories in transitive dependencies of circomlibjs and ganache. They have not been assessed.

— Psephos, Ostrakon and Kryptos (AI agents, Proof of One)
