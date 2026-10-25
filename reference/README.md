# Reference implementation

> **For review and testing only. Not audited. Uses a TEST-ONLY trusted setup. Do not use with real participants.**

Four small packages implement the core of the protocol end to end, and two folders hold measurements for the next design steps. Each is written to be read and attacked, not deployed.

| Package | What it contains | Tests |
|---|---|---|
| [`tally/`](tally/) | Encrypted one-hot ballots, nullifiers, robust trustee key generation with public complaints, voter self-verification, homomorphic tally, threshold decryption with DLEQ proofs, independent recount tool | 25 |
| [`ballot-circuit/`](ballot-circuit/) | Zero-knowledge ballot proof π_vote (Circom, Groth16): membership, non-revocation, nullifier, eligibility with up to three nationalities, age range on the poll date, well-formed encrypted ballot, all per-poll values bound by one `pollHash` | 18 |
| [`enrolment-circuit/`](enrolment-circuit/) | Unlinkable registration proof π_reg, batch insertion proof π_batch and revocation proof π_revoke (Circom, Groth16), enclave credential issuance including added documents, registry rules | 21 |
| [`phone-bench/`](phone-bench/) | Web page that measures how fast a phone makes the ballot proof | — |
| [`aggregation-prototype/`](aggregation-prototype/) | Ballot proof and aggregator in Noir (UltraHonk) for size measurements of recursive aggregation | check script |
| [`contracts/`](contracts/) | Solidity identity and revocation registries, polls, ballots and results; single and batched ballot submission; full on-chain flow tested with real proofs | 9 |

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
cd ../enrolment-circuit && npm install && npm run build && npm test
cd ../contracts   && npm install && npm test
```

## The two founding properties, in code

- **Every voter can verify their own vote.** `tally/src/protocol.js` → `voterCheckRecorded`, `voterCheckCounted`.
- **Anyone can recount.** `tally/bin/recount.js transcript.json` uses public data only.

## Most important open items

- A real trusted setup (a large public ceremony) or a universal-setup proof system ([issue #7](https://github.com/NemoUnus/proof-of-one/issues/7)).
- A networked trustee client for the key generation, which is now robust but simulated in one process ([trustee key generation](../docs/specs/trustee-key-generation-v0.1.md)).
- A published, auditable list of the country signing certificates (CSCA) that enrolment trusts ([document coverage §4](../docs/research/document-coverage-v0.1.md#4-other-limits)).
- Enrolment front end: document-validity proof, liveness and face matching in an attested enclave.
- Prover performance on phones.
- Independent human review of everything here.
