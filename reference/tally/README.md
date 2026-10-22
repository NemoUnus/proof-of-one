# Proof of One — reference tally implementation

> **Reference code for review and testing only. Not audited. Not constant-time. Do not use it to protect real people.**

This package is a small, readable implementation of the **ballot and tally layer** of Proof of One. It shows in running code the two properties the project treats as non-negotiable:

- **R1 — every voter can verify their own vote.** The voter keeps the encryption randomness for a limited receipt window, re-encrypts their choice and checks that it matches what the ledger recorded and counted.
- **R2 — anyone can recount the result.** From public data alone, anyone can rebuild the ballot set, add up the encrypted ballots, verify every trustee's decryption proof and recompute the totals.

Specification: [`docs/specs/ballot-and-enrolment-v0.1.md`](../../docs/specs/ballot-and-enrolment-v0.1.md) §1 and §3–6, red-team changes C5 and C8, and the result checks of [`docs/specs/contracts-v0.1.md`](../../docs/specs/contracts-v0.1.md) §7–8.

## Run it

Requires Node.js 20 or later.

```bash
npm install
npm test                                  # 13 tests, including attack cases (about 2 minutes)
node bin/demo.js 40 transcript.json       # simulate a poll and write its public transcript
node bin/recount.js transcript.json       # independent recount from the transcript only
```

Edit any number in `transcript.json`, such as a published count or a trustee's partial decryption, and run the recount again: it reports what was changed.

## What is implemented

| Component | File | Spec |
|---|---|---|
| Baby Jubjub group helpers, point validation (curve + subgroup) | `src/curve.js` | §1 |
| Domain-separated Poseidon, keccak ballot chain | `src/hash.js` | §1, contracts §7 |
| Nullifier `nf = Poseidon(TAG, pollId, s)` | `src/protocol.js` | §1 |
| Trustee key generation, t-of-n (joint Feldman) | `src/protocol.js` | §3 |
| One-hot ballot, exponential ElGamal | `src/protocol.js` | §4.1 |
| Ledger: latest ballot per nullifier, re-vote cap, distinct voters, ballot chain | `src/protocol.js` | §4.3, contracts §7 |
| Voter verification (recorded as cast, counted as recorded) | `src/protocol.js` | §5 |
| Homomorphic aggregation | `src/protocol.js` | §6.1 |
| Partial decryption with Chaum–Pedersen (DLEQ) proofs, Lagrange combination, discrete log | `src/protocol.js` | §6.2 |
| Contract result checks: chain, Σ counts = distinct voters, ≤ eligible | `src/protocol.js` | §6.3, contracts §8 |
| Independent recount and transcript format | `src/protocol.js`, `src/transcript.js`, `bin/recount.js` | §6.3 |

## What is NOT implemented — and why it matters

- **The zero-knowledge ballot proof (π_vote)** is not part of this package. Here, ballots are *assumed* well-formed and to come from eligible members. The last test shows why the proof is essential: without it, a ballot encrypting (+2, −1, 0, 0) cancels another voter's vote, and the contract check Σ counts = distinct voters cannot detect it. The proof is implemented in [`../ballot-circuit`](../ballot-circuit/), which shows that such a ballot cannot be proven.
- **Robust key generation.** Joint-Feldman key generation can let a malicious trustee bias the public key (Gennaro, Jarecki, Krawczyk and Rabin, 1999). A real deployment needs a robust distributed key generation with complaint handling. Here all trustees are simulated in one process.
- **Enrolment, membership proofs, revocation, relays and network privacy.**
- **Share deletion** after the challenge period. This is a trust assumption, not code.

## Security notes for reviewers

- Every externally supplied point is checked to be **on the curve and in the prime-order subgroup** (Baby Jubjub has cofactor 8).
- Fiat–Shamir challenges are Poseidon hashes with a domain tag and bind the poll, the option index and every point in the statement. Challenges are reduced modulo the subgroup order ℓ. The bias is negligible but noted.
- Scalars are drawn from 64 random bytes reduced modulo ℓ.
- Arithmetic uses JavaScript BigInt and circomlibjs; neither is constant-time.
- `npm audit` reports advisories in transitive dependencies of `circomlibjs`. They have not yet been assessed for this use.

## Tests

| Test | What it shows |
|---|---|
| Poseidon test vector | Hash parameters match circomlib |
| Honest poll | Decrypted totals equal the true choices; contract checks and recount pass |
| R1 recorded and counted | Every voter verifies their own last ballot |
| Replaced ballot | A voter detects that someone else's ballot replaced theirs |
| Any t of n | Any threshold subset of trustees gives the same result; fewer than t fails |
| Wrong partial decryption | The DLEQ proof fails and the recount names the trustee |
| Altered published counts | The recount detects the difference, even when the total is unchanged |
| Dropped ballot | The ballot chain no longer matches |
| Contract checks | Totals must equal distinct voters, and voters must not exceed eligible identities |
| Ledger rules | Re-vote cap and invalid-point rejection |
| Nullifiers | Stable within a poll, different across polls |
| Known limitation | Why π_vote is required |

## Authorship and review status

Written by the Proof of One AI agents Psephos and Kryptos (see [AGENTS.md](../../AGENTS.md)). Not yet reviewed by independent human experts. Review is very welcome; see [CONTRIBUTING.md](../../CONTRIBUTING.md) and [SECURITY.md](../../SECURITY.md).

Licence: Apache-2.0.
