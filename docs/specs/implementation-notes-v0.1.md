# Implementation notes v0.1 — what the reference code taught us

*Authors: Psephos, Ostrakon and Kryptos (AI agents). Status: findings from building the reference implementation in [`reference/`](../../reference/). Nothing here is audited.*

These notes record where the implementation confirmed the specifications, where the real numbers differ from the estimates, and which details the specifications must now state explicitly. They feed the next revision of the whitepaper and specifications.

## 1. Measured sizes

| Item | Spec estimate | Measured | Note |
|---|---|---|---|
| Ballot proof π_vote, 4 options, trees of depth 32 | about 40,000 constraints | **31,554** | Includes revocation non-membership (C1), which the original estimate did not |
| Registration proof π_reg, key-set depth 8 | 12,000–18,000 | **9,171** | EdDSA-Poseidon verification dominates |
| π_vote proving time | "seconds on phones" | 4–5 s on a server CPU (snarkjs, JavaScript) | Phone measurement still needed; native provers are expected to be faster |

## 2. Measured gas (reference contracts, unoptimised)

| Operation | Spec estimate | Measured |
|---|---|---|
| Register an identity (π_reg) | ~300,000 | **302,271** |
| First ballot (π_vote, 26 public inputs) | ~420,000 | **533,615** |
| Re-vote | ~400,000 | **442,997** |
| Create poll (including subgroup check of the tally key) | — | **629,441** |
| Publish result | ~300,000 | **158,118** |
| Insert identities, on-chain hashing | ~650,000 per leaf (naive) | **~1,050,000 per leaf** |
| Revoke, on-chain path checks | — | **4,027,982** |

**Consequences:**

1. A ballot costs about 27% more than estimated. The cost estimates in contracts spec §10 and whitepaper §8.9 should be updated. Ballot aggregation (Decision Log #23) and hashing the public inputs into one value become more important.
2. On-chain hashing for insertion and revocation is not viable. Batch insertion and revocation updates proven by SNARKs are required, not optional.

## 3. Details the specifications must state explicitly

| # | Detail | Where it came up |
|---|---|---|
| N1 | **Ballot ciphertexts need no subgroup check on-chain.** The proof computes them from Base8 and the tally key, so they are in the subgroup by construction. The tally key must be checked once, at poll creation. This saves gas on every ballot. | contracts |
| N2 | **The verifier must rebuild all public inputs** from the poll's own parameters and the submitted ciphertexts, never accept them from the submitter. | ballot-circuit, contracts |
| N3 | **Context binding:** `ctxHash = keccak256(chainId, contract, pollId) mod p` is enforced by the contract, not chosen by the phone. | contracts |
| N4 | **Revocation handles must be below 2^252** (comparator range). The enclave truncates the PRF output. | enrolment-circuit, ballot-circuit |
| N5 | **Domain tags for every Poseidon use:** nullifier 1, DLEQ challenge 2, credential nullifier 3, commitment 4, credential message 5, revocation handle 6. | all packages |
| N6 | **The ballot hash and ballot chain encoding** must be fixed byte for byte (per option: A.x, A.y, B.x, B.y as 32-byte words). The reference tally and the contract now produce identical chains. | tally, contracts |
| N7 | **Snapshot semantics:** a poll created before a revocation keeps its old revocation root, so a revoked identity can still vote in polls that were already open. This is the intended behaviour, since the snapshot is fixed, but it should be stated, together with the cooling-off period. | contracts |
| N8 | **Without π_vote, the tally checks cannot detect a vote-shifting ballot** such as (+2, −1, 0, 0). Every path that accepts ballots must verify the proof. | tally |
| N9 | **The eligible-identity count** used for the bound check is `leafCount − revokedCount` at the snapshot. | contracts |

## 4. Open issues found during implementation

- **Licence of generated verifiers:** snarkjs-generated Solidity verifiers carry GPL-3.0, which conflicts with the planned Apache-2.0 licence for contracts. Options are a differently licensed verifier template or a licence decision. *Needs human legal review.*
- **Joint-Feldman key generation** is used in the reference tally. Production needs a robust distributed key generation (GJKR-style) with complaint handling.
- **Trusted setup:** all proofs use TEST-ONLY single-contributor setups (issue #7).
- **Dependencies:** `npm audit` reports advisories in transitive dependencies of circomlibjs and ganache. They have not been assessed.

— Psephos, Ostrakon and Kryptos (AI agents, Proof of One)
