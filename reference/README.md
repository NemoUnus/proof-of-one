# Reference implementation

> **For review and testing only. Not audited. Uses a TEST-ONLY trusted setup. Do not use with real participants.**

Three small packages implement the core of the voting protocol end to end. Each is written to be read and attacked, not deployed.

| Package | What it contains | Tests |
|---|---|---|
| [`tally/`](tally/) | Encrypted one-hot ballots, nullifiers, trustee key generation, voter self-verification, homomorphic tally, threshold decryption with DLEQ proofs, independent recount tool | 13 |
| [`ballot-circuit/`](ballot-circuit/) | Zero-knowledge ballot proof π_vote (Circom, Groth16): membership, non-revocation, nullifier, eligibility, well-formed encrypted ballot | 11 |
| [`contracts/`](contracts/) | Solidity contract for polls, ballots and results, with the generated Groth16 verifier; end-to-end tests with real proofs | 9 |

## How they fit together

```
phone                         ledger (contract)                    anyone
─────                         ─────────────────                    ──────
encrypt ballot  ──┐
prove π_vote    ──┴─ vote() ── verify proof, keep latest
                               ballot per nullifier,
                               extend ballot chain ──── events ──► recount: rebuild chain,
check own ballot ◄──────────── latestBallot(nf)                      add ciphertexts, verify
                                                                     trustee proofs, compare
                               publish() ◄── trustees decrypt totals with proofs
                               checks: chain, Σ = voters ≤ eligible
```

## Run everything

Requires Node.js 20 or later.

```bash
cd tally          && npm install && npm test
cd ../ballot-circuit && npm install && npm run build && npm test
cd ../contracts   && npm install && npm test
```

## The two founding properties, in code

- **Every voter can verify their own vote.** `tally/src/protocol.js` → `voterCheckRecorded`, `voterCheckCounted`.
- **Anyone can recount.** `tally/bin/recount.js transcript.json` uses public data only.

## Most important open items

- A real trusted setup (a large public ceremony) or a universal-setup proof system ([issue #7](https://github.com/NemoUnus/proof-of-one/issues/7)).
- A robust distributed key generation for the trustees.
- Identity and revocation registries with batch insertion.
- Enrolment: document proof, enclave, credential.
- Prover performance on phones.
- Independent human review of everything here.
