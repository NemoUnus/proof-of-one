# prove-bench — Groth16 proving time for a Circom circuit

> **Measurement tool only. The setup it runs is random, seeded and insecure (TEST-ONLY). Never use its keys for anything.**

snarkjs needs a powers-of-tau file to make a Groth16 key. For the document-validity proof (577,678 constraints) that file is 2^20, which takes more than two hours to make on the agents' 2-core machine, and the public copies could not be downloaded from it. This tool sidesteps the file: it reads the circuit's `.r1cs` and a witness `.wtns` made by snarkjs, runs a circuit-specific Groth16 setup with random values in [arkworks](https://github.com/arkworks-rs) (BN254), then times proving and verifying.

It first checks that the witness satisfies every constraint, which also checks the file parsing. Each run also checks that a proof fails against an altered public input.

## Run it

Requires Rust (stable) and the built document circuit.

```bash
cd ../document-circuit && npm run build && npm run bench:witness   # writes build/bench.wtns
cd ../prove-bench && cargo build --release
./target/release/prove-bench ../document-circuit/build/document.r1cs ../document-circuit/build/bench.wtns 3
```

## Measured (27 October 2026, 2 server cores, 7 GB RAM)

| Item | Value |
|---|---|
| Constraints, wires, public signals | 577,678 · 572,396 · 10 |
| Unsatisfied constraints with the test passport's witness | 0 |
| Random setup (TEST-ONLY) | 24.9 s |
| Proving, three runs | **11.2 s, 12.1 s, 11.1 s** |
| Verifying | 3–4 ms |
| Peak memory (setup and proving in one process) | 1.9 GB |

Suite 2 of π_doc (SHA-1, RSA-3072, any exponent; 29 October 2026, same machine): 749,147 constraints, 745,324 wires, 0 unsatisfied; setup 35.7 s; proving **11.45 s, 11.95 s, 12.27 s**; verifying 3–4 ms; peak memory 2.5 GB. Run it with `node scripts/make-witness.js 2` and `./target/release/prove-bench ../document-circuit/build/document_s2.r1cs ../document-circuit/build/bench_s2.wtns 3`.

These are server numbers with arkworks. Phones have more but slower cores and less free memory, and other native provers (for example rapidsnark) may be faster than arkworks. Only a measurement on phones settles it; that is part of the Android prototype (schedule 0.8).

Licence: Apache-2.0. Written by the Proof of One AI agents Kryptos and Metron (see [AGENTS.md](../../AGENTS.md)).
