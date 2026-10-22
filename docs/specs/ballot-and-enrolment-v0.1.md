# Proof of One — Protocol Specification v0.1: Encrypted Ballots and Unlinkable Enrolment

*Author: Psephos (AI agent). Contributions: Kryptos (AI agent). Status: draft for human review. It is not audited, and nothing here is proven secure.*
*Implements decisions D1 (revised) and D2 from Threat Model v0.1.*

---

## 0. Requirements fixed by the founder

These two properties are non-negotiable. Every other design choice is subordinate to them.

- **R1 — Individual verifiability.** Every voter can check exactly what was recorded on the ledger for their own vote.
- **R2 — Universal verifiability.** Anyone can independently recompute the totals of all anonymous votes from public data, without trusting any operator.

Added by the threat model:

- **R3 — Seizure resistance.** A seized phone or an extracted identity secret must not reveal how a person voted in past polls.
- **R4 — Enrolment unlinkability.** The enrolment service must not be able to link a real person to their on-chain identity leaf.
- **R5 — Limited local history.** The phone keeps the vote record only for a limited verification window, by default 30 days after the poll closes, and then deletes it automatically.

| Property | v0.4 | This spec |
|---|---|---|
| R1 own vote verifiable | yes (plaintext) | yes (re-encryption check) |
| R2 totals recountable by anyone | yes (count plaintexts) | yes (homomorphic sum + decryption proofs) |
| R3 seizure does not reveal answers | **no** | yes, apart from participation in polls still inside their window |
| R4 enclave cannot link person ↔ leaf | not specified | yes |
| What is no longer public | — | the list of individual plaintext answers |

---

## 1. Notation and primitives

- **Group:** Baby Jubjub (twisted Edwards curve over the BN254 scalar field), with generator `G` and subgroup order `ℓ`. It is chosen because its arithmetic is native inside BN254 circuits.
- **Hash:** Poseidon (BN254 parameters). The prefix `H_tag(·)` denotes domain-separated Poseidon.
- **Exponential ElGamal** under public key `PK = x·G`: `Enc(m; r) = (A, B) = (r·G, m·G + r·PK)`. It is additively homomorphic: `Enc(m1)+Enc(m2) = Enc(m1+m2)`. Decryption yields `m·G`; `m` (a count ≤ 10⁹) is recovered by baby-step giant-step.
- **Threshold key:** `t`-of-`n` trustees run a distributed key generation (Pedersen DKG) per poll. Each trustee `i` holds a share `x_i`, and the public share `PK_i = x_i·G` is published.
- **DLEQ:** a Chaum–Pedersen proof that `log_G(PK_i) = log_A(D_i)`.
- **Identity (from v0.4):**
  - `s` is the identity secret, with identity point `P = s·G` and `idc = H(P.x, P.y)`.
  - `attrHash = H(ageBand, natCode, sexCode, expiryMonth, salt_a)`
  - `leaf = H(idc, attrHash)`
- **Nullifier (from v0.4):** `nf = H_nf(pollId, s)`.
- **Proof system:** Groth16 on BN254 for the ballot circuit (small proofs, cheap verification); PLONK/UltraHonk for the document circuit, unchanged from v0.4.

---

## 2. Unlinkable enrolment (D2)

**Goal.** The enclave checks uniqueness and attributes, then certifies them **without ever seeing the leaf**.

### 2.1 Enclave credential key
The enclave holds an EdDSA (Baby Jubjub) signing key `k_E`, and its public key `PK_E` is published in IdentityRegistry. The key lives only inside the attested enclave image and is rotated per epoch. In later phases it moves to a threshold signature across MPC operators (D6).

### 2.2 Flow
1. **On the phone:** the phone reads the document over NFC and produces the document-validity proof (v0.4). It generates `s` and computes `idc`. It picks random `salt_a` and `ρ`, then computes:
   - `cm = H_cm(idc, salt_a, ρ)`, a commitment that hides `idc`
   - `cn = H_cn(ρ)`, the credential nullifier. Its purpose: one credential can be used only once.
2. **Phone → enclave (over HPKE):** the document proof, DG2 face data, the live capture plus device attestation, and `cm`.
3. **In the enclave:**
   - Verify the document proof.
   - Run Layer-1 (OPRF document fingerprint) and Layer-2 (face) uniqueness checks.
   - Derive `attrs = (ageBand, natCode, sexCode, expiryMonth)` itself from DG1.
   - Sign `σ = Sign_kE( H_msg(attrs, cm, epoch) )` and return `(attrs, σ)`.
   - Store only what uniqueness requires (fingerprint and protected template). **The enclave never sees `idc`, `leaf`, `ρ` or `cn`.**
4. **Phone, after a random delay** (default uniform 1–72 h, on a different network session where possible): it builds a registration proof π_reg and submits `(leaf, cn, epoch, π_reg)` through a relay.
5. **IdentityRegistry:** verifies π_reg, rejects any `cn` already used, and appends `leaf` to a pending queue. Pending leaves are inserted into the Merkle tree in batches once per insertion epoch (for example every 24 h).

### 2.3 Registration circuit (π_reg)
- **Public inputs:** `leaf`, `cn`, `epoch`, `PK_E`
- **Private inputs:** `s`, `attrs`, `salt_a`, `ρ`, `σ`
- **Constraints:**
  1. `P = s·G`; `idc = H(P.x, P.y)`
  2. `attrHash = H(attrs, salt_a)`; `leaf = H(idc, attrHash)`
  3. `cm = H_cm(idc, salt_a, ρ)`; `cn = H_cn(ρ)`
  4. `EdDSA.Verify(PK_E, H_msg(attrs, cm, epoch), σ) = true`

**Why this is unlinkable.** The enclave knows `cm` but not `ρ` or `idc`. On-chain it sees only `leaf` and `cn`, and both are hash outputs of values it never learned. The proof is zero-knowledge, so it reveals neither `cm` nor `σ`. Linking would require breaking Poseidon's hiding property, or matching by timing, which the random delay and batch insertion address.

**Cost estimate (to be measured):** about 12–18k constraints, made up of EdDSA verification (~6–8k), one Baby Jubjub scalar multiplication (~3k) and about 6 Poseidon calls.

---

## 3. Poll setup

1. The poll creator submits poll parameters to PollRegistry:
   - `pollId`
   - options `k` (single choice; multi-choice is a later extension)
   - eligibility `policy` (allowed age bands and nationalities, minimum expiry)
   - `openTime` and `closeTime`
   - the snapshot `root` of IdentityRegistry at creation
   - an optional breakdown dimension `d` (for example age band) with `b` cells
   - `verifyWindow` (default 30 days)
2. Trustees run a DKG for this poll and publish `PK_poll` and every `PK_i` with proofs of knowledge. PollRegistry records them. **Using a fresh key per poll makes deleting the shares after the tally possible (§6.4).**
3. **Trustee policy (governance, not cryptography):** `n ≥ 7` and `t ≥ ⌈2n/3⌉`, with trustees in different jurisdictions and organisations. Trustees are listed publicly.

---

## 4. Casting a ballot

### 4.1 Ballot encoding
- **Without a breakdown:** the choice is a one-hot vector `v ∈ {0,1}^k` with `Σ v_j = 1`. The ballot is `C = (C_1 … C_k)`, where `C_j = Enc(v_j; r_j)`.
- **With a breakdown over `b` cells:** the ballot is a one-hot vector over `k × b` positions, where the cell index is the voter's band. The circuit proves that this band matches the attributes committed in the voter's leaf. Ballot size grows with `k·b`, so breakdowns are limited to one dimension with a small `b` (≤ 6) in v0.5.

### 4.2 Ballot circuit (π_vote)
- **Public inputs:** `root`, `pollId`, `nf`, `C`, `PK_poll`, `policyHash`, `ctxHash` (binds the proof to this submission so a relay cannot replay or front-run it)
- **Private inputs:** `s`, `attrs`, `salt_a`, Merkle path, `v`, `r`
- **Constraints:**
  1. `P = s·G`; `idc = H(P.x, P.y)`; `leaf = H(idc, H(attrs, salt_a))`
  2. `MerkleVerify(root, leaf, path)` at depth 32
  3. `nf = H_nf(pollId, s)`
  4. `attrs` satisfy the policy committed in `policyHash`
  5. For every `j`: `v_j·(v_j − 1) = 0`; and `Σ v_j = 1`
  6. For every `j`: `A_j = r_j·G` and `B_j = v_j·G + r_j·PK_poll`

**Cost estimate (to be measured):** Merkle ~8k + identity ~4k + per ciphertext ~7k (two fixed-base and one variable-base multiplication). That is roughly **40k constraints for k = 4** and roughly 80–90k for k = 10. This is within reach of phone Groth16 provers (expected seconds, not minutes). Prosopon must benchmark on low-end Android devices.

### 4.3 Submission and re-voting
- The phone submits `(pollId, nf, C, π_vote)` through a relay (ERC-4337, from v0.4), using the network protections in Threat Model D5.
- **PollAnswers:**
  - Verifies π_vote against the poll's snapshot `root`.
  - Stores `latest[pollId][nf] = H(C)` and emits `Ballot(pollId, nf, C, seq)`.
  - Appends `H(nf, H(C), seq)` to a running hash chain `ballotChain[pollId]`, so the ordered set of ballots is fixed and public.
- A later valid ballot with the same `nf` **replaces** the earlier one. **Counting rule:** for each `nf`, only the last valid ballot submitted before `closeTime` counts.

### 4.4 What the phone keeps (R5)
`record = {pollId, nf, v, r, txHash, closeTime}`

The record is kept in the encrypted app storage until `closeTime + verifyWindow` and then deleted automatically. The user can delete it earlier. No other history of answers is kept.

---

## 5. Individual verification (R1)

At any time during the window, the app does the following.

1. **Recorded as cast.** It recomputes `C' = Enc(v; r)` from the stored `v` and `r`, and checks that `H(C') = latest[pollId][nf]` on-chain, read from at least two independent RPC providers or a light client.
2. **Counted as recorded** (after the result is published):
   - Check that this ballot is the last one for `nf` in the published ballot set (via the `ballotChain`).
   - Independently recompute the aggregate and check the decryption proofs (§6).
3. The result is shown to the user as "Your vote for option X is recorded and included in the total", or as a clear warning with the transaction evidence.

**Optional — cast-as-intended audit (Benaloh challenge).** Before submitting, the user can choose "audit this ballot". The app then reveals `r` for that ballot, so the user or any third-party tool can check that the ciphertext really encrypts the displayed choice. That ballot is discarded and a fresh one is made. This lets anyone catch a dishonest app build without trusting it.

**Note on receipts.** While `r` is on the phone, it can be shown to a coercer as proof of the vote. Mitigations: re-voting, the limited window and early deletion. Real receipt-freeness (MACI-style key changes) is a requirement before any binding-vote mode.

---

## 6. Public tally (R2)

### 6.1 Aggregation (anyone)
From the `Ballot` events, take the last ballot per `nf` before `closeTime`. Check that the event set reproduces `ballotChain[pollId]`. Compute, per position `j`:
`Â_j = Σ A_j`, `B̂_j = Σ B_j` (sums of curve points)

### 6.2 Threshold decryption (trustees)
Each participating trustee `i` publishes, for every `j`:
- `D_ij = x_i·Â_j`
- a DLEQ proof that `D_ij` uses the same `x_i` as `PK_i`

Anyone combines `t` valid shares with Lagrange coefficients `λ_i`:
`M_j = B̂_j − Σ λ_i·D_ij = n_j·G`, then recovers the count `n_j` by baby-step giant-step.

### 6.3 Publication and checking
ResultsRegistry stores:
- `pollId`, the final `ballotChain` value
- the aggregates `(Â, B̂)`
- the counts `n`
- all `D_ij` and the DLEQ proofs
- `Σ n_j` = number of counted ballots

This opens a **public challenge period** (for example 7 days). Anyone can run the open-source verifier to repeat §6.1–6.2 and check `Σ n_j` against the number of distinct `nf`. If anything fails, they publish evidence and the result is flagged.

*Later version:* a tally SNARK verified on-chain (MACI-style), so even the check needs no off-chain software.

### 6.4 Share deletion (forward secrecy)
After the challenge period, trustees **delete their shares of `x`** and publish signed deletion statements. From then on, no future compromise of trustees can decrypt individual ballots stored on the ledger. *This depends on trustees being honest about deletion. It cannot be proven cryptographically. Stated as a trust assumption.*

### 6.5 Small-group protection
If the poll has a breakdown:
1. Trustees first decrypt only the per-cell totals (the sum over options in each cell).
2. Cells below the minimum size (50) are merged into a combined cell before the option counts are decrypted.
3. The merge rule is fixed in the poll parameters, so trustees cannot choose it after the fact.

---

## 7. Security properties and assumptions

| Property | Holds if |
|---|---|
| Ballot secrecy | Fewer than `t` trustees collude **and** DDH holds on Baby Jubjub |
| Seizure resistance after the window (R3) | Records deleted from the phone; trustees deleted shares; DDH |
| Integrity of the tally | Soundness of Groth16 and DLEQ; correct verifier keys; at least one honest public checker |
| One vote per identity per poll | Nullifier uniqueness; the soundness of π_vote |
| Enrolment unlinkability (R4) | Poseidon hiding; zero-knowledge of π_reg; timing protections work |
| Liveness of the result | At least `t` trustees available |

**Trusted setup.** Groth16 needs a circuit-specific ceremony. Use a public multi-party ceremony (powers of tau plus phase 2) with many independent contributors. One honest contributor is enough. Alternative: use PLONK/UltraHonk with a universal setup for π_vote too, at a higher on-chain verification cost. Decision for Kryptos and Ostrakon.

**Known limits, stated plainly:**
- A seized phone inside the window reveals that person's vote in that poll.
- Holding `s` always reveals **whether** a person took part, never how they voted after the window.
- `t` or more colluding trustees can decrypt individual ballots until they delete their shares, although they still cannot change the result.
- Cast-as-intended depends on the app, with Benaloh challenges and reproducible builds as checks.

---

## 8. Data and cost estimates (indicative)

| Item | Size |
|---|---|
| Ballot ciphertexts (k = 4) | 8 points × 64 B = 512 B |
| Groth16 proof | ~256 B |
| On-chain storage per ballot | 1 hash (32 B); ciphertexts carried in event or blob data |

To be measured: L2 gas per ballot, prover time on reference phones, and aggregation time at 10⁶ and 10⁷ ballots.

---

## Open questions
- Q1. Groth16 with a ceremony, or a universal setup, for π_vote?
- Q2. Can deletion of trustee shares be made verifiable (for example with enclave-held shares and attested deletion)?
- Q3. Multi-choice and ranked polls: encoding and proof cost.
- Q4. Should the 30-day window be configurable per poll, and what are the limits?
- Q5. Light-client verification on phones, to avoid trusting RPC providers.

## Needs human review
- The full cryptographic construction, especially the π_reg unlinkability argument and the π_vote constraints: independent cryptographers.
- Circuit implementations and constraint counts: ZK auditors.
- The trustee governance and DKG ceremony: security practitioners.
- Usability of the verification screens and Benaloh challenge: user researchers.

## Hand-off
- **To Ostrakon:** contract interfaces and storage for IdentityRegistry (credential nullifiers, pending queue, batch insertion), PollAnswers (latest-per-nullifier, ballotChain) and ResultsRegistry (challenge period); gas estimates.
- **To Argus:** red-team this spec, especially timing linkage in enrolment, relay behaviour and the trustee model.

— Psephos (AI agent, Proof of One), with Kryptos (AI agent, Proof of One)
