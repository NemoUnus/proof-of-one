# Recursive aggregation: first measurements

> **Prototype for measurement only. Not audited. No proofs are generated here.**

Decision Log #29, step 2, is a prototype of recursive ballot aggregation using a proof system with a universal setup. This folder holds the first measurable part. It contains the ballot proof written in Noir for the UltraHonk proof system, and an aggregator circuit that verifies ballot proofs inside one proof. Each is measured by its size in gates. See [`../../docs/specs/ballot-aggregation-v0.1.md`](../../docs/specs/ballot-aggregation-v0.1.md) §9 for what the numbers mean.

## What is here

| Circuit | What it is | Checked |
|---|---|---|
| [`ballot_compatible`](circuits/ballot_compatible/src/main.nr) | The same statement as the Circom ballot proof, with the **same** hash (Poseidon, circomlib parameters) and curve (Baby Jubjub). It works with the existing tally, contracts and enrolment. | Runs on the same valid ballot as the [phone benchmark](../phone-bench/) and rejects a two-hot ballot, a wrong nullifier, another region and a changed poll hash (`npm run check`) |
| [`ballot_native`](circuits/ballot_native/src/main.nr) | The same statement with the hash (Poseidon2) and curve (Grumpkin) that UltraHonk supports natively. Using it would change the cryptography of the whole protocol. | Size only |
| [`aggregate_2`](circuits/aggregate_2/src/main.nr) | Verifies N ballot proofs (UltraHonk, zero-knowledge variant) of one poll and outputs one hash over all their public inputs | Size only, for N = 1, 2, 4 |

## Results (UltraHonk gates)

| Circuit | Gates | Padded size |
|---|---|---|
| Ballot proof, compatible | **146,686** | 2^18 |
| Ballot proof, native | **20,031** | 2^15 |
| Aggregator, 1 proof | 704,745 | 2^20 |
| Aggregator, 2 proofs | **1,471,871** | 2^21 |
| Aggregator, 4 proofs | 3,006,122 | 2^22 |

For comparison, the Circom ballot proof has 32,535 constraints. Gates and constraints are counted differently, so compare them only roughly.

**What follows:**

1. Verifying one ballot proof inside another costs about **750,000 gates**, whatever the size of the ballot proof. A 2-to-1 aggregation tree therefore costs about 1.5 million gates per ballot in total, on servers, not on phones.
2. The **compatible** ballot proof is about 7 times larger than the native one, because Poseidon and Baby Jubjub are not native to this proof system. The Elliptic-curve code here is a plain double-and-add without optimisation, so part of the gap may close.
3. **Not measured:** proving time, proof size and on-chain verification gas. Proving needs the public parameters of the Aztec Ignition ceremony, which could not be downloaded in the environment where this was built. Anyone with normal internet access can complete the measurement with these files (see below and [issue #9](https://github.com/NemoUnus/proof-of-one/issues/9)).

## How to reproduce

```bash
npm install
npm run libs      # fetches the two Noir libraries at the exact commits used
npm run check     # compatible circuit on the benchmark ballot, plus forged variants
npm run size ballot_compatible
npm run size ballot_native
npm run size aggregate_2
```

Versions: `@noir-lang/noir_wasm` and `@noir-lang/noir_js` 1.0.0-rc.6, `@aztec/bb.js` 5.2.1, Node.js 20 or later. Counting gates needs no public parameters. Proving does: `@aztec/bb.js` downloads them on first use and refuses any parameters that do not match the public ceremony, which is the right behaviour.

## Next steps (help wanted)

- Generate real proofs with these circuits. Measure proving time on a server for the aggregator, and on phones for the two ballot circuits.
- Measure the gas of the Solidity verifier for the final aggregated proof.
- Optimise the Baby Jubjub arithmetic in `ballot_compatible` (fixed-base windows, as circomlib does).

Written by Psephos and Ostrakon (AI agents). Licence: Apache-2.0.
