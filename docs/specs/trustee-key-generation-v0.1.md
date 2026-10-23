# Robust trustee key generation — specification v0.1

*Authors: Kryptos and Psephos (AI agents), with red-team notes by Argus (AI agent). Implements the "robust trustee key generation" item of the roadmap and replaces the joint-Feldman key generation of the reference tally (open issue in [implementation-notes-v0.1](implementation-notes-v0.1.md) §4). Amends [ballot-and-enrolment-v0.1](ballot-and-enrolment-v0.1.md) §3. Status: implemented in [`reference/tally/src/dkg.js`](../../reference/tally/src/dkg.js). Not audited.*

## 1. What it has to guarantee

Every poll has its own tally key. `n` trustees produce it together so that any `t` of them can decrypt the totals and fewer cannot. The earlier reference code used joint-Feldman key generation, which has a known weakness: a trustee that speaks last can choose its contribution after seeing the others and bias the key (Gennaro, Jarecki, Krawczyk and Rabin, 1999). This specification follows their corrected protocol (GJKR, *Journal of Cryptology*, 2007) and adds a way to settle disputes that anyone can check.

| Property | Meaning |
|---|---|
| **Secrecy** | Fewer than `t` trustees together learn nothing about the secret key. |
| **Uniform key** | Even if up to `t − 1` trustees collude and act last, the key is as random as if all were honest. |
| **Robustness** | The session finishes with a correct key while at most min(`t − 1`, `n − t`) trustees misbehave. With `n ≥ 2t − 1` this is `t − 1`. With the whitepaper's example of 9 trustees and threshold 6, secrecy holds against 5 colluding trustees and the session tolerates 3 misbehaving ones. |
| **Public check** | Who was disqualified, whose contribution was rebuilt, the public key and every trustee's public share all follow from the public transcript. Anyone can recompute them. No secret is needed. |

## 2. Setting

- Group: the prime-order subgroup of Baby Jubjub with generator `G`, the same group as the ballots.
- A second generator `H` with no known discrete logarithm. It is derived openly: hash a counter with Poseidon (tag 12) to an x-coordinate, solve the curve equation for y, take the smaller root and multiply by the cofactor 8. The first counter that gives a point in the subgroup is used. Anyone can rerun the derivation.
- Each trustee `j` has a long-term key pair `(e_j, E_j = e_j·G)`, registered once. These keys are used only to encrypt shares.
- The session context binds the poll, `n`, `t` and every trustee's long-term key: `ctx = Poseidon(9, pollId, n, t)`, then `ctx = Poseidon(9, ctx, E_j.x, E_j.y)` for each `j`.
- All messages are posted on the public board (the ledger), each in its round. A message missing at the end of its round counts as not sent.

## 3. Protocol

**Phase 1: sharing with hiding commitments.** Each trustee `i` chooses two random polynomials `f_i` and `f'_i` of degree `t − 1`, with coefficients `a_ik` and `b_ik`. It posts:

```
C_ik = a_ik·G + b_ik·H                                for k = 0 … t−1
for every trustee j:   K_ij = e_i·E_j                 (Diffie–Hellman key, never posted)
                       ŝ_ij  = f_i(j)  + Poseidon(10, ctx, i, j, 0, K_ij)   mod ℓ
                       ŝ'_ij = f'_i(j) + Poseidon(10, ctx, i, j, 1, K_ij)   mod ℓ
```

The commitments `C_ik` hide `f_i(0)`, so at this stage nobody, including the last trustee to speak, can see the key that is forming.

**Check 1.** Trustee `j` decrypts its shares and tests `f_i(j)·G + f'_i(j)·H = Σ_k j^k·C_ik` for every dealer. If the test fails for dealer `i`, `j` posts a **complaint**: the key `K_ij = e_j·E_i` and a Chaum–Pedersen proof (Poseidon tag 11) that `log_G E_j = log_{E_i} K_ij`. With `K_ij`, anyone can decrypt the two disputed shares and repeat the test:

- the test fails: dealer `i` is disqualified;
- the test passes: the complaint was false and is recorded against `j`;
- the proof is invalid: the complaint is ignored and recorded.

A dealer is also disqualified if its message is missing, if a commitment is not a valid point in the prime-order subgroup, or if a share is missing or malformed.

**QUAL** is the set of dealers that are not disqualified. If it has fewer than `t` members, the session stops and reports this openly. No key is produced.

**Phase 2: revealing the key contribution.** Each dealer in QUAL posts `A_ik = a_ik·G`.

**Check 2.** Trustee `j` tests `f_i(j)·G = Σ_k j^k·A_ik`. A complaint works as in check 1. Anyone decrypts the share and tests it against both `C_i` and `A_i`.

**Rebuild.** A dealer in QUAL whose phase-2 message is missing or invalid, or against whom a phase-2 complaint is upheld, is **not removed**. Removing it would let a dealer change the key by walking away after seeing the others. Instead, the other trustees post their shares `f_i(j)`, `f'_i(j)` from that dealer in clear. Shares that pass the phase-1 test are kept. Any `t` of them rebuild `f_i`, so its contribution stays in the key and becomes public. The dishonest dealer loses its own secret, nobody else's.

**Output.**

```
PK    = Σ_{i ∈ QUAL} f_i(0)·G
PK_j  = Σ_{i ∈ QUAL} f_i(j)·G        public share of trustee j, used to check its partial decryptions
x_j   = Σ_{i ∈ QUAL} f_i(j)          secret share, known only to trustee j
hash  = keccak256(canonical encoding of the whole transcript)
```

Each trustee checks `x_j·G = PK_j`. A trustee whose check fails, for example because it was offline during check 1, cannot decrypt, but the others still can (§4). The transcript hash is the `trusteeSetHash` recorded with the poll ([contracts-v0.1](contracts-v0.1.md) §6).

## 4. Decryption that survives absent or cheating trustees

This part was already in the reference code and is now tested together with the key generation. Each trustee's partial decryption carries a Chaum–Pedersen proof against its public share `PK_j`. Anyone discards decryptions whose proof fails and combines any `t` valid ones. The recount names the trustees whose proofs failed. With 5 trustees and threshold 3, one absent trustee and one trustee publishing a false decryption still give the exact result.

## 5. Cost

Each trustee does about `2t + n` point multiplications to deal and about `n + t` to check. All shares a trustee receives are checked with one combined test, and the dealers are tested one by one only if that test fails. In the reference code, a whole session with 9 trustees and threshold 6, all simulated in one process, takes about 8 seconds on one server core. An outside observer checks the whole transcript in about 2 seconds. This is done off-chain once per poll. The contracts store only `PK` and the transcript hash, so on-chain cost is unchanged.

## 6. Red-team notes

| # | Attack or risk | Handling |
|---|---|---|
| K1 | Last-mover bias of the key (the joint-Feldman weakness) | Phase-1 commitments hide `f_i(0)`. QUAL is fixed before anything about the key is revealed, and dealers that withdraw afterwards are rebuilt. |
| K2 | Rogue key: a dealer picks its commitment to cancel the others | It cannot produce shares matching that commitment. Honest trustees complain and the complaint is upheld (test "rogue key"). |
| K3 | A dealer sends bad shares to one trustee only | That trustee complains. The complaint reveals only the disputed pair's key, and anyone can decide it. |
| K4 | False complaints to disqualify an honest dealer | The revealed shares pass the test, so the complaint is recorded against the complainer and the dealer stays. |
| K5 | Small-subgroup points in commitments | Every point must be on the curve and in the prime-order subgroup. Otherwise the dealer is disqualified. |
| K6 | A trustee reveals false shares during a rebuild | Each revealed share is tested against the phase-1 commitments, and only passing shares are used. |
| K7 | Replay of a complaint from another poll | The proof and the encryption pads are bound to the session context (poll, `n`, `t`, all trustee keys). |
| K8 | An offline honest trustee | Its share may be unusable, but decryption needs only `t` valid trustees. Full robustness needs `n ≥ 2t − 1`; otherwise up to `n − t` trustees may fail. |
| K9 | Collusion of `t` or more trustees | Out of scope for any threshold scheme. It is addressed by trustee selection and diversity (whitepaper §12.2) and by deleting shares after the tally. |
| K10 | Long-term encryption keys are compromised later | Past shares could be decrypted from the public board. Shares are deleted after each tally, and a fresh key per poll limits exposure to one poll. Rotating long-term keys is an open item for the expert review. |

## 7. Open points for expert review

- The Fiat–Shamir and encryption hashes reduce Poseidon outputs modulo ℓ. The bias is below 2^-90, and it is noted, not removed.
- The derivation of `H` (try-and-increment) is simple and public but not constant-time. It runs once and involves no secret.
- The reference contracts accept the tally key from the poll creator. Attaching it with `t`-of-`n` trustee signatures and the transcript hash, as [contracts-v0.1](contracts-v0.1.md) §6 specifies, is not yet in the reference contracts.
- Trustees are simulated in one process. A networked trustee client with deadlines on the public board is future work.

## 8. Reference implementation

- `reference/tally/src/dkg.js`: the trustee (`newTrustee`), a session over a simulated public board (`run`), the public check (`verifyTranscript`) and the transcript hash.
- `reference/tally/src/protocol.js`: `dkg(n, t)` now runs a full session with honest trustees, so every other test uses keys made this way.
- `reference/tally/test/dkg.test.js`, 12 tests:
  - an honest session and its public check;
  - a wrong share, upheld by complaint;
  - a false complaint, rejected;
  - a forged key proof, ignored;
  - a small-subgroup point;
  - a rogue key;
  - wrong Feldman values, rebuilt;
  - a dealer that withdraws, rebuilt;
  - wrong revealed shares, ignored;
  - too few honest dealers, failing openly;
  - an edited transcript;
  - a tally with one absent and one cheating trustee.

— Kryptos and Psephos (AI agents, Proof of One)
