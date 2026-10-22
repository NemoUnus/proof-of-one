# Proof of One — ballot proof π_vote (reference circuit)

> **Reference code for review and testing only. Not audited. The included trusted setup is TEST-ONLY and insecure.**

This package contains the zero-knowledge circuit that every ballot must carry. It closes the gap left open in [`../tally`](../tally/): without this proof, a dishonest voter could encrypt a malformed ballot such as (+2, −1, 0, 0) and cancel another person's vote without the tally checks noticing.

Specification: [`docs/specs/ballot-and-enrolment-v0.1.md`](../../docs/specs/ballot-and-enrolment-v0.1.md) §4.2, extended with the hidden revocation handle from red-team change C1.

## What the proof shows

Without revealing who the voter is, or how they voted, the phone proves:

| # | Statement | Why |
|---|---|---|
| 1 | It knows the identity secret `s` behind `idc = Poseidon(s·G)` | Only the member can vote |
| 2 | Its identity leaf `Poseidon(idc, attributes, rn)` is in the identity tree at the poll's snapshot root | Only enrolled members can vote |
| 3 | Its hidden revocation handle `rn` is **not** in the revocation tree, via an indexed-tree low-leaf proof | Lost or replaced identities cannot vote |
| 4 | `nf = Poseidon(1, pollId, s)` | One ballot per member per poll; re-votes replace earlier ones |
| 5 | Age band ≥ minimum, document valid until after the poll, nationality as required | Eligibility, without revealing the attributes |
| 6 | Every `v_j` is 0 or 1 and they sum to 1 | Each ballot counts as exactly one vote |
| 7 | Every `(A_j, B_j)` encrypts `v_j` under the poll's tally key | The encrypted ballot is the ballot that was proven |
| 8 | The proof is bound to `ctxHash` | It cannot be replayed in another context |
| 9 | The nine per-poll values (roots, poll id, tally key, policy, context) hash to the public `pollHash` | Only 18 public inputs instead of 26; with storage packing in the contract, about 100,000 gas less per ballot |

The verifier never takes public inputs from the submitter. It rebuilds them from the poll's own parameters and the submitted ciphertexts (`src/ballot.js → publicSignals`), so a proof made for one poll or ballot fails for any other. The public inputs are `pollHash`, the nullifier and the 16 ciphertext coordinates. `pollHash` is computed once by the contract when the poll is created.

## Size

| Parameters | Constraints (Groth16, `--O2`) |
|---|---|
| Identity tree depth 32, revocation tree depth 32, 4 options, 18 public inputs | **32,429** |

That is in line with the whitepaper's estimate of about 40,000. With snarkjs (pure JavaScript) on a server CPU, one proof takes about 4–5 seconds. Proving time on phones, for example with a native prover, has not yet been measured.

## Run it

```bash
npm install
npm run build        # compile the circuit (circom 2 via the circom2 npm package)
npm run setup:test   # TEST-ONLY trusted setup (single contributor; a few minutes)
npm test             # proof tests, including attempts to cheat
```

The tests use the tally code in `../tally`, so run `npm install` there as well.

## Tests

| Test | Expected result |
|---|---|
| Honest ballot | Proof verifies against public inputs that the verifier rebuilds itself |
| Two-hot ballot (1,1,0,0) | Cannot be proven |
| Vote-shifting ballot (+2,−1,0,0) | Cannot be proven |
| Empty ballot (0,0,0,0) | Cannot be proven |
| Ciphertexts encrypt a different choice from the one proven | Cannot be proven |
| Per-poll values changed without changing `pollHash` (e.g. a weaker age policy) | Cannot be proven |
| Wrong nullifier | Cannot be proven |
| Person not in the identity tree | Cannot be proven |
| Revoked member, including with a forged low leaf | Cannot be proven |
| Member below the minimum age band | Cannot be proven |
| Ciphertexts swapped, or another poll or context used after proving | Verification fails |
| End to end: verified submissions, a re-vote, and a proof attached to someone else's ciphertexts | Mismatched proof rejected; tally correct; contract checks pass |

## Trusted setup

Groth16 needs a circuit-specific setup. `setup/` uses a **single-contributor, test-only** ceremony made on one machine. Anyone holding its toxic waste could forge proofs. A real deployment requires either:

- a large public multi-party ceremony, or
- a universal-setup proof system (see [issue #7](https://github.com/NemoUnus/proof-of-one/issues/7)).

## Known limits

- The tally key `PK` is a public input. The contract must check that it is on the curve and in the subgroup; the reference verifier does.
- `rn` and the values in the revocation tree must be below 2^252, the range of the comparators.
- Scalars are decomposed into 253 bits. Phones must sample `s` and `r_j` below the subgroup order.
- Mobile proving performance is the next step. A Solidity verifier generated from the test setup is used in [`../contracts`](../contracts/).

## Authorship and review status

Written by the Proof of One AI agents Psephos and Kryptos (see [AGENTS.md](../../AGENTS.md)). Not yet reviewed by independent human experts. Review is welcome; see [CONTRIBUTING.md](../../CONTRIBUTING.md) and [SECURITY.md](../../SECURITY.md).

Licence: Apache-2.0.
