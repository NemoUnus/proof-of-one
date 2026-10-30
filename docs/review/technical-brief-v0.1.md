# Proof of One — technical brief for reviewers, v0.1

*For cryptographers, zero-knowledge engineers, smart-contract auditors, e-voting and biometrics researchers. About 15 minutes to read. Written by Hermes, Kryptos and Psephos (AI agents) for the founder, Nemo Unus, October 2026. Everything here was drafted by disclosed AI agents ([AGENTS.md](../../AGENTS.md)) and has **not** been reviewed by an independent human expert. That is why you are reading it.*

Proof of One is an open-source, non-commercial protocol for polls designed so that each participant holds one identity backed by a chip identity document and a matching face, the operators cannot link answers to people, every voter can verify that their ballot was recorded and counted, and anyone can recount the result. These are design goals, not verified properties. There is no token and nothing for sale. This brief states what the system claims, how it is built, what it trusts, what has been measured and what is missing, so that you can decide quickly where to attack it. The full design is in the [whitepaper v0.9](../whitepaper/Proof_of_One_Whitepaper_v0.9_EN.pdf); the [reviewer's guide](../../REVIEWING.md) lists concrete questions.

## 1. Claims

| Property | Claim | Rests on |
|---|---|---|
| Uniqueness | One person holds at most one active identity. | Document fingerprint (OPRF) and 1:N face search inside an attested enclave; revocation of the old identity on re-enrolment |
| Unlinkable registration | The enrolment service cannot tell which registry leaf belongs to which person. | Hiding commitment signed by the enclave; zero-knowledge registration proof; batching and timing protection |
| Ballot secrecy | No one learns how a member voted. | Exponential ElGamal under a threshold key; fewer than `t` of `n` trustees collude; shares deleted after the tally |
| Eligibility | Every counted ballot comes from a registered, non-revoked identity that meets the poll's rule, once per poll. | Groth16 ballot proof π_vote; nullifier per member and poll |
| Individual verifiability (R1) | Each voter can check that their ballot was recorded as cast and counted as recorded. | Voter keeps the encryption randomness for a chosen receipt window; public ballot chain |
| Universal verifiability (R2) | Anyone can recount every result from public data. | Homomorphic aggregation; trustees' Chaum–Pedersen proofs; public key-generation transcript |

**Stated limit.** An authority that issues identity documents can create genuine-looking identities. The design aims to make this costly, bounded and visible (statistics by document issuer), not impossible ([threat model](../specs/threat-model-v0.1.md) T8).

## 2. Architecture

```
member's phone ──(1) reads chip, live face──► enrolment service (attested enclave)
      │                                          │ document fingerprint, face search,
      │◄────────(2) credential on hidden cm──────┘ signs Poseidon(attrs, cm, rn, epoch)
      │
      ├──(3) register leaf with π_reg (hours later, separate session) ──► ledger (EVM L2)
      │                                                                   identity tree, revocation tree,
      ├──(4) ballot + π_vote, via relay ──────────────────────────────►  polls, ballots, results
      │                                                                        ▲
trustees ──(5) per-poll key generation; after close: partial decryptions ──────┘
anyone   ──(6) recount from public data
```

All curve operations use Baby Jubjub (prime-order subgroup, generator `G = Base8`, order ℓ). All in-circuit hashing uses Poseidon over the BN254 scalar field with a domain tag as the first input: 1 nullifier, 2 DLEQ challenge, 3 credential nullifier, 4 commitment, 5 credential message, 6 revocation handle, 7 poll hash, 8 service identifier, 9–12 trustee key generation.

## 3. Constructions

### 3.1 Identity

```
s       identity secret (Baby Jubjub scalar), kept on the phone
idc     = Poseidon(P.x, P.y),  P = s·G
attr    = Poseidon(birthDay, sexCode, nat_0, exp_0, nat_1, exp_1, nat_2, exp_2, salt)   up to 3 documents
cm      = Poseidon(4, idc, salt, ρ)          sent to the enclave
cn      = Poseidon(3, ρ)                     credential nullifier, published at registration
rn      = Poseidon(6, k_R, fingerprint, g) mod 2^252     revocation handle, chosen by the enclave
σ       = EdDSA-Poseidon signature on Poseidon(5, birthDay, sexCode, nat_0 … exp_2, cm, rn, epoch)
leaf    = Poseidon(idc, attr, rn)
```

**π_reg** (9,369 constraints) proves knowledge of `s, salt, ρ` and a signature `σ` under a key in the published enclave key set (Merkle root, depth 8), such that `leaf` and `cn` are formed as above. It reveals neither `cm` nor `σ`. The enclave knows `cm`, `rn` and the attributes, but not `idc`, `salt` or `ρ`. **Our claim, and the first thing we want attacked:** the enclave cannot link a person to `leaf` or `cn` ([issue #3](https://github.com/NemoUnus/proof-of-one/issues/3)).

Leaves are appended in batches. **π_batch** proves that a batch of 2^k leaves was written in order into the next empty aligned subtree; its public inputs are the old and new roots, the start index and a chain hash of the registered leaves that the contract keeps. **π_revoke** inserts a handle into a sorted (indexed) revocation tree by proving it lies in a gap of the list.

### 3.2 Ballot

```
nf        = Poseidon(1, pollId, s)
pollHash  = Poseidon(7, Poseidon(idRoot, revRoot, pollId, PK.x, PK.y),
                        Poseidon(maxBirthDay, minBirthDay, minExpiryMonth, requiredNat, ctxHash))
ctxHash   = keccak256(chainId, contract, pollId) mod p
C_j       = (r_j·G, v_j·G + r_j·PK),  j = 0 … k−1,  v one-hot
```

**π_vote** (Groth16, 32,607 constraints for k = 4 and trees of depth 32; public inputs: pollHash, nf, 16 ciphertext coordinates) proves:

1. `leaf(s, attributes, salt, rn)` is in the identity tree with root `idRoot`;
2. `rn` is not revoked: a low leaf `(lowValue, nextValue)` with `lowValue < rn < nextValue` (or `nextValue = 0`) is in the revocation tree with root `revRoot`;
3. `nf` is derived from `s` and `pollId`;
4. eligibility: `minBirthDay ≤ birthDay ≤ maxBirthDay` (32-bit comparators); one privately selected document (one-hot `docSel`, non-empty slot) has `exp ≥ minExpiryMonth` and, if `requiredNat ≠ 0`, `nat = requiredNat`;
5. every `v_j ∈ {0,1}`, `Σ v_j = 1`, and each `C_j` encrypts `v_j` under `PK` with `r_j`;
6. all per-poll values hash to the public `pollHash`, which the contract computed at poll creation.

The ledger keeps the latest ballot per nullifier, with a re-vote cap, and extends a keccak **ballot chain** over every accepted ballot. `voteBatch` verifies several proofs with one random linear combination: n + 3 pairings, weights `r_i = (keccak(keccak(calldata), i) >> 128) | 1`.

### 3.3 Trustee key and tally

Per poll, `n` trustees run a GJKR-style distributed key generation ([spec](../specs/trustee-key-generation-v0.1.md)): Pedersen commitments with a second generator `H` derived by hash-to-curve; shares encrypted to each trustee's long-term key with Poseidon pads; complaints that reveal the pairwise Diffie–Hellman key with a DLEQ proof, so anyone can settle them; dealers that withdraw after qualification are rebuilt from revealed shares. The output and a keccak hash of the full transcript are public.

After close, anyone adds the latest ciphertexts per option. Each trustee publishes `D = x_i·Â` with a Chaum–Pedersen proof against its public share; any `t` valid ones are combined by Lagrange interpolation, and the counts are recovered by baby-step giant-step. The contract accepts a result only if the final ballot chain matches its own, `Σ counts = distinct voters`, and `distinct voters ≤ eligible identities` at the snapshot. A 7-day challenge period follows.

## 4. What is trusted

| Component | Trusted for | If it fails |
|---|---|---|
| Enrolment enclave (TEE, attested, reproducible build) | Not linking people to commitments; correct uniqueness checks; deleting images | Uniqueness or enrolment privacy is lost; ballots and the recount remain sound |
| Face-template store | Confidentiality of templates of all members | Largest single point of harm (whitepaper §17, item 2); MPC planned for later phases |
| Country signing certificates (CSCA list) | Authenticity of documents | Documents cannot be verified, or a wrong certificate admits forged documents. See §6 |
| Trustees (fewer than `t` collude) | Ballot secrecy | Ballots of the poll can be decrypted. Integrity is unaffected |
| Groth16 setup | Soundness of all proofs | Forged ballots or registrations. **The reference code uses a single-contributor TEST-ONLY setup.** |
| Sequencer and relays | Liveness | Direct submission and forced inclusion remain |
| Camera feed | Liveness of the face capture | Relies on attestation and presentation-attack detection, not cryptography |

## 5. Measured, not estimated

| Item | Value |
|---|---|
| π_vote | 32,607 constraints; **3.5 s in the browser of an iPhone 14** (snarkjs); 4–5 s on a server CPU |
| π_reg / π_batch (4 leaves) / π_revoke | 9,369 / 16,227 / 32,521 constraints |
| Gas: ballot alone / re-vote / batch of n | 392,084 / 374,839 / about 349,000 + 101,000·n |
| Gas: register / insert batch / revoke / create poll / publish | 334,589 / 293,548 / 294,646 / 921,874 / 158,145 |
| Trustee key generation, 9 trustees, threshold 6 | about 8 s for the whole simulated session; about 2 s for an outside observer to check the transcript |
| Tests | 73: tally 25, ballot circuit 18, enrolment circuits 21, contracts 9, many of them attack cases |

Run them: [`reference/README.md`](../../reference/README.md). Node.js 20; no other setup.

## 6. Not built yet, and where we think it is weakest

**Not built:** the document-validity proof (SHA-256, RSA/ECDSA signatures and the CSCA list inside a circuit), the document fingerprint OPRF, liveness and face matching, the attested enclave, a networked trustee client, trustee signatures on `publish`, on-chain challenges during the challenge period, the relay network, the phone app. Design documents for these exist; code does not.

**Our own top concerns**, in the order we would attack them:

1. **Enrolment unlinkability** with an enclave that knows `cm` and `rn` (§3.1). Is Poseidon used as a commitment, a PRF and a random oracle in ways that are each justified?
2. **π_vote completeness.** Any missing constraint is a forged vote. The comparators assume inputs below 2^32 because the enclave signs the date and the contract stores `uint32`; is that enough?
3. **The CSCA trust list.** A field test by the founder read a real passport chip on a phone, but a commercial verifier could not build the certificate chain, although the issuing country is an ICAO PKD participant ([document coverage §4](../research/document-coverage-v0.1.md#4-other-limits)). How should an open project obtain, publish and audit the certificates it trusts? ([issue #14](https://github.com/NemoUnus/proof-of-one/issues/14))
4. **Face search at global scale.** False matches grow with the size of the database; the procedure in [face-uniqueness-at-scale](../specs/face-uniqueness-at-scale-v0.1.md) asks the person about earlier enrolment and uses birth-date blocking. Is it sound and fair?
5. **Batched verification** with weights derived from calldata chosen by the submitter. Is the Fiat–Shamir argument correct here?
6. **Trustee threshold.** With 9 trustees and threshold 6, secrecy holds against 5 colluders but more than 3 misbehaving trustees stop the tally. The founder chose this for now and asks for views ([issue #13](https://github.com/NemoUnus/proof-of-one/issues/13)).
7. **Coercion and participation privacy.** The receipt window helps the voter and also a coercer; whether a member took part in a poll is not hidden.

## 7. How to respond

Use the questions in the [reviewer's guide](../../REVIEWING.md), open an issue, or, for anything that could put future participants at risk, report privately as described in [SECURITY.md](../../SECURITY.md). Every human review is recorded in [PROVENANCE.md](../../PROVENANCE.md) under the name you choose, with the scope you reviewed.

— Hermes, Kryptos and Psephos (AI agents, Proof of One)
