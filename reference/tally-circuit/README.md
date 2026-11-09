# Proof of One — tally proof π_tally (reference circuit)

> **Reference code for review and testing only. Not audited. The included trusted setup is TEST-ONLY and insecure.**

The polls contract accepts a result only with this proof. It shows that the published counts are the correct decryption of the encrypted totals the contract kept itself, so a wrong result can never become final because nobody challenged it in time (Decision Log #53; second-model review of whitepaper v1.0, finding 3).

Specification: [on-chain tally verification](../../docs/specs/on-chain-tally-verification-v0.1.md), §6.

## What the proof shows

For t trustees and K options (this circuit: t = 3, K = 4):

| # | Statement |
|---|---|
| 1 | Every partial decryption D_ij carries a valid Chaum–Pedersen proof that log_G(PK_i) = log_{A_j}(D_ij). The challenge is Poseidon(2, pollId, j, G, PK_i, A_j, D_ij, T1_ij, T2_ij), so a proof made for one poll fails for any other. |
| 2 | D_ij, T1_ij and T2_ij lie in the prime-order subgroup: each is 8 times a point the prover supplies (8·E is exactly that subgroup). |
| 3 | D_j = Σ λ_i·D_ij, with the Lagrange coefficients λ_i computed by the contract from the trustee indices. |
| 4 | B_j = D_j + count_j·G, with each count below 2^32. |

**Public inputs (38), all supplied by the contract, never by the publisher:** the poll id, the contract's running totals (A_j, B_j), the counts and D_j being published, the keys of the t trustees (checked against the commitment made at poll creation), and their λ_i.

**No secret is needed.** Anyone who has the trustees' published partial decryptions can make the proof, so a result does not depend on one particular publisher.

## Size and cost

| | |
|---|---|
| Constraints (Groth16, `--O2`) | 137,300 |
| Proving time, snarkjs, 2 server cores | 16–19 s |
| `publish` with the proof (contract tests) | 853,274 gas |

A first attempt checked every trustee proof directly in Solidity. One proof costs about 2.03 million gas, so t = 3 and K = 4 would need about 26 million. That is above the limit of about 16.8 million gas per transaction on Base (EIP-7825) and grows with the number of trustees. With π_tally the cost is fixed, whatever the number of trustees.

## Trustee proofs

The trustees must make their Chaum–Pedersen proofs with the Poseidon challenge:

```js
const P = await require("../tally/src/protocol").create({ dleq: "poseidon" });
```

The default stays `keccak`, which is what the contracts deployed in Phase 1a check (polls 1 and 2 on Base Sepolia). The next deployment uses π_tally.

## One circuit per threshold

The circuit is fixed at t = 3, and the reference contract accepts only polls with that threshold (`TALLY_T`). Other thresholds need their own circuit and verifier, in the same way as the signature suites of the document proof (Decision Log #42).

## Run it

```bash
npm install
npm run build          # circuits/tally.circom → build/
npm run setup:test     # TEST-ONLY setup: setup/tally_test.zkey, ../contracts/src/TallyVerifier.sol
npm test               # witness tests; proves and verifies if the test key exists
```

The setup needs a powers-of-tau file of size 2^18. The script makes a TEST-ONLY one, which takes more than an hour on two cores. The test key (85 MB) is not in the repository, being above GitHub's upload limit; `setup/vkey_tally_test.json` and `contracts/src/TallyVerifier.sol` belong to the key made on 8 November 2026. Running the script makes a new key and replaces both, and the tests then use it.

## Tests

| Test | Expected |
|---|---|
| Honest result (6 voters, trustees 2, 3, 4) | Satisfies the circuit; proved and verified |
| Counts with the right sum but a wrong split | Refused |
| Forged partial that still combines to a matching D (the attack from the contract tests) | Refused: the forged trustee proof fails |
| Another trustee's key, another poll id, a wrong λ | Refused |
| Poll without ballots (identity totals and partials) | Satisfies the circuit |

Licence: Apache-2.0. The generated verifier `TallyVerifier.sol` carries snarkjs's GPL-3.0 header (see implementation notes, licence of generated verifiers).
