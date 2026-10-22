# Ballot aggregation v0.1 — design and first measurements

*Authors: Ostrakon and Psephos (AI agents), with Kryptos on the batch-verification argument; red-team notes by Argus (AI agent). Status: design proposal plus reference code for its first step. Nothing here is audited.*

Decision Log #23 brings ballot aggregation forward to Phase 1, because participation is free and every ballot is paid from the common fund. This note sets out what aggregation can and cannot save, measured on the reference contracts rather than estimated. It recommends a path in three steps. Step 1 is implemented in [`reference/contracts`](../../reference/contracts/).

## 1. Where the gas of one ballot goes

A single ballot sent directly with `vote()` costs **390,086 gas**. The poll's very first ballot costs 424,298, because it also writes the poll's counters and ballot chain for the first time. The proof check dominates.

| Part | Gas, approximately | Share |
|---|---|---|
| Groth16 verification of π_vote (4 pairings, 18 scalar multiplications) | **303,000** (measured in isolation) | about 78% |
| Transaction base cost | 21,000 | |
| Call data: nullifier, 8 ciphertext points, proof (800 bytes) | 13,000 | |
| Latest-ballot slot for a new nullifier | 22,100 | |
| Ballot chain, counters, event with the ciphertexts, hashing | the remainder | |

Measured: total and verification. The other rows are approximate, from the EVM gas schedule.

## 2. What any aggregation must keep

| Requirement | Consequence for aggregation |
|---|---|
| **R1**, every voter can check their own vote | Each ballot's ciphertexts must stay individually visible on the ledger, not only as part of a hash. |
| **R2**, anyone can recount | The same: all ciphertexts must be public, in order. |
| **Ballot secrecy** | The aggregator must never need a voter's secret or encryption randomness. It handles finished proofs only. |
| **No censorship** | Direct submission with `vote()` always remains available. An aggregator can delay a ballot, never block it. |
| **No new trusted party for correctness** | A faulty or malicious aggregator can only waste its own gas or delay ballots. It cannot change, add or drop a recorded ballot. |
| **Same chain** | A batch is recorded exactly as if its ballots had been sent one by one, so the ballot chain, events and recount tool are unchanged. |

### The data floor

Whatever the method, each ballot's nullifier and 8 ciphertext points (544 bytes) must be published. On a Layer-2 network that is about 8,700 gas of call data, plus the network's charge for posting the data to Ethereum. Aggregation can remove the proof (256 of the 800 bytes, about 32%) and the verification work. It cannot remove the ciphertexts.

## 3. Options

| | Option | How it works | Gas per ballot (large batches) | Saving vs. a single ballot | New trust or new work |
|---|---|---|---|---|---|
| **A** | **Batched verification** (implemented) | The same Groth16 proofs, checked together with random weights: n + 3 pairings instead of 4n, and the 19 multiplications by key points paid once per batch | **about 101,000** (measured) | **3.8×** | None. Same proofs, same circuit, same setup. |
| B | Recursive aggregation, PLONK-family proof system with a universal setup | Phones prove π_vote in a recursion-friendly system. An aggregator proves "all n proofs verify" in one proof, and the contract verifies that proof and records the ciphertexts. | about 40,000–50,000 (estimate) plus about 300,000 per batch | about 8–10× | π_vote must be rewritten and phone proving re-measured. Also answers the trusted-setup question (issue #7). |
| C | Aggregation in a general zkVM | The aggregator verifies the existing Groth16 proofs inside a zkVM, for example SP1 with its BN254 precompiles (about 9.4 million cycles per Groth16 verification), and posts one wrapped proof | similar to B | about 8–10× | Keeps the circuit. Adds a large trusted computing base: the zkVM, its recursion stack and its own setup. |
| D | Ballot rollup, on top of B or C | The latest ballot per nullifier moves into a nullifier tree updated inside the aggregation proof. The contract keeps only the tree root and counters. | about 10,000–15,000 (estimate) | about 25–35× | Voters check their ballot against the tree root. Needs its own specification and review. |
| E | Optimistic batches | Ballots are posted unverified, and anyone may prove a specific invalid proof during a challenge window | about 50,000 (estimate) | about 8× | Needs watchers and a challenge game. A ballot removed late changes the chain after voters have checked it. **Not recommended.** |

**Rejected:**

- **Folding schemes (Nova family).** The folder needs the witnesses, here the voter's secret and randomness, so the aggregator would learn them.
- **SnarkPack-style aggregation of Groth16 proofs.** Its verifier needs target-group operations that have no EVM precompile, which makes on-chain verification costly.

## 4. A revised expectation

The whitepaper (v0.6, §8.9) expected aggregation to cut costs by 10 to 100 times. The measurements say:

- about **3.8× now**, with option A;
- about **8–10×** with recursive aggregation (B or C);
- about **25–35×** only if the per-nullifier storage also moves off-chain (D).

100× is not reachable through gas alone, because the ciphertexts must be published for R1 and R2. The money cost also depends on the data-posting charge, which aggregation reduces by only about a third. The next whitepaper version should state this.

## 5. Recommendation

1. **Phase 1, step 1: batched verification (A).** Implemented and tested in the reference contracts. Relays submit batches; voters can still submit directly.
2. **Step 2: prototype recursive aggregation (B)** with a universal-setup proof system, decided together with issue #7. The first task is to benchmark the rewritten π_vote on low-cost phones. If phone proving is fast enough, B also removes the need for a circuit-specific trusted-setup ceremony. If it is not, C is the fallback.
3. **Step 3: ballot rollup (D)**, after B or C, with its own specification and red-team review of how voters verify their ballot against the nullifier tree.
4. **Option E is not pursued**, because it weakens the moment at which a voter's check (R1) is final.

## 6. Option A in detail

### 6.1 The check

For each proof i with public inputs x_i, Groth16 requires e(A_i, B_i) = e(α, β) · e(X_i, γ) · e(C_i, δ), with X_i = IC_0 + Σ_j x_ij · IC_{j+1}. The batch verifier draws weights r_i and checks a single product:

```
Π_i e(−r_i·A_i, B_i) · e((Σ r_i)·α, β) · e(Σ_i r_i·X_i, γ) · e(Σ_i r_i·C_i, δ) = 1
```

Σ_i r_i·X_i is computed with scalar arithmetic first: (Σ r_i)·IC_0 + Σ_j (Σ_i r_i·x_ij)·IC_{j+1}. The 19 multiplications by key points are therefore paid once per batch. Per ballot, what remains is one pairing (34,000 gas), two scalar multiplications (12,000) and one addition.

### 6.2 Contract interface

```
voteBatch(pollId, nfs[], cts[][16], proofs[])        (anyone may call)
  require poll open; equal, non-empty lengths (at most 256)
  require BallotBatchVerifier.verifyBallots(pollHash, nfs, cts, proofs)
  for each ballot, in the given order: the same rules as vote()
    (re-vote cap, distinct-voter count, latest ballot, ballot chain, Ballot event)
  write counters and ballot chain once
```

The batch verifier is generated from the ballot circuit's verification key by `scripts/gen-batch-verifier.js`. It uses a template written for this project and is licensed Apache-2.0. It does not use the snarkjs template, so it is not affected by the GPL question in [LICENSING.md](../../LICENSING.md).

### 6.3 Security notes (Argus)

| # | Point | Handling |
|---|---|---|
| S1 | **Choice of weights.** If a submitter could pick the weights after choosing the proofs, invalid proofs could cancel out. | Weights come from keccak256 of the complete call data and an index. They are 128 bits and odd, and fixed only once every proof and input is fixed. A batch containing an invalid proof passes with probability about 2^-128 (small-exponent batch verification, Bellare–Garay–Rabin 1998). |
| S2 | **Points outside the prime-order group.** | G1 on BN254 has cofactor 1, and the precompiles reject points that are not on the curve. For G2, EIP-197 requires the pairing precompile to check that the order equals the group order. The single verifier relies on the same rule. *Reviewers should confirm this for the chosen Layer-2 network.* |
| S3 | **Inputs outside the field.** | pollHash, nullifiers and ciphertext coordinates must each be below the scalar field order; otherwise the batch is rejected. |
| S4 | **Failed precompile calls consume all gas forwarded to them.** The first version forwarded all remaining gas, so a single invalid point made the whole transaction run out of gas instead of failing cleanly. Found by the reference tests. | Each precompile call gets a fixed allowance above its price (ecMul 10,000; ecAdd 1,000; pairing 45,000 + 34,000 per pair + 10,000). See implementation note N13. |
| S5 | **All or nothing.** One invalid proof rejects the whole batch, so a malicious voter could waste a relay's gas. | Relays verify each proof off-chain before batching, which takes milliseconds. The tests show that a swapped ciphertext, a reordered proof, a proof for another poll and an invalid point each reject the batch. |
| S6 | **Ordering.** A relay chooses the order within a batch. | Order matters only between ballots with the same nullifier, which come from the same voter. A relay can delay, not alter. The direct path remains available. |
| S7 | **Batch size.** | Capped at 256 per call; at about 101,000 gas per ballot that is about 26 million gas. The cap must be set below the block gas limit of the chosen network. |
| S8 | **Relay metadata.** A relay sees when ballots arrive. | It sees nothing more than the ledger already shows. Network anonymity is provided by Tor, which is mandatory in the app (Decision #11). |

## 7. Measurements

Reference contracts, unoptimised, on an in-process EVM, with real proofs from the TEST-ONLY setup:

| Transaction | Gas | Per ballot |
|---|---|---|
| `vote`, single ballot, typical | 390,086 | 390,086 |
| `vote`, the poll's first ballot | 424,298 | 424,298 |
| `voteBatch`, 1 ballot (poll's first) | 481,983 | 481,983 |
| `voteBatch`, 2 ballots | 548,722 | 274,361 |
| `voteBatch`, 4 ballots | 750,480 | 187,620 |
| `voteBatch`, 7 ballots (poll's first) | 1,087,499 | 155,357 |

**Fit:** a batch of n ballots costs about **346,964 + 100,879 · n** gas once the poll is active, plus about 34,000 for the poll's first batch. Extrapolated from this fit, not measured:

| Batch size | Gas per ballot | Saving vs. a typical single ballot |
|---|---|---|
| 16 | about 122,600 | 3.2× |
| 64 | about 106,300 | 3.7× |
| 256 | about 102,200 | 3.8× |

## 8. Open questions

- Which recursion-friendly proof system for option B, and how fast it proves π_vote on low-cost phones. This is linked to issue #7. First sizes are in §9; proving times are still missing.
- How a voter's phone checks its ballot under option D (tree path and archive), and how the recount tool rebuilds the nullifier tree.
- Relay economics: who pays for batches, and how relays are chosen. Linked to the fund (Decisions #14 and #16).
- The batch-size cap and gas limits on the chosen Layer-2 network.

## 9. Step 2: first measurements (October 2026)

Decision Log #29 asks for a prototype of recursive aggregation with a universal-setup proof system, starting with a phone benchmark. What has been done so far:

**Phone benchmark.** A web page, [`reference/phone-bench`](../../reference/phone-bench/), makes the current ballot proof three times on the device that opens it and reports the times. On a 2-core server in a headless browser, one proof takes about 10 seconds. The first phone measurement, by the founder on an **iPhone 14 in its browser, took 3.5 seconds per proof**. So proving the current ballot proof is not a problem on recent phones, even without a native prover. Measurements on low-cost Android phones are still needed from people ([issue #9](https://github.com/NemoUnus/proof-of-one/issues/9)).

**Ballot proof in a recursion-friendly system.** [`reference/aggregation-prototype`](../../reference/aggregation-prototype/) contains the ballot proof written in Noir for UltraHonk, a proof system with a universal setup, and an aggregator circuit that verifies ballot proofs inside one proof. The compatible version accepts the same valid ballot as the Circom circuit and rejects forged variants.

| Circuit | UltraHonk gates |
|---|---|
| Ballot proof with the current hash and curve (Poseidon, Baby Jubjub) | 146,686 |
| Same statement with the proof system's native hash and curve (Poseidon2, Grumpkin) | 20,031 |
| Aggregator verifying 2 ballot proofs | 1,471,871 (about 750,000 per verified proof) |

**What this means:**

1. **Aggregation compute is large but runs on servers.** A 2-to-1 aggregation tree costs about 1.5 million gates per ballot. Relays would need substantial server capacity. Phones are not affected.
2. **The choice of hash and curve matters more than expected.** Keeping the current cryptography makes the phone's proof about 7 times larger in this system than a design built on its native primitives. Moving to Poseidon2 and Grumpkin would mean changing the ballot encryption, the tally, the contracts and the enrolment signatures. That is a major redesign and needs its own decision, review and specification. **It is not proposed yet:** first, proving times must be measured.
3. **Not yet measured:** proving times, proof sizes and the gas for verifying the final aggregated proof. Proving needs the public parameters of the Aztec Ignition ceremony, which could not be downloaded in the build environment. The circuits and scripts are published so that anyone with normal internet access can complete the measurement.

**Current path, unchanged:** Groth16 ballot proofs with batched verification (option A) remain the reference design. The decision between options B and C, and whether to redesign around native primitives, waits for the missing measurements.

— Ostrakon, Psephos, Kryptos and Argus (AI agents, Proof of One)
