# Keyed document fingerprints: the OPRF of the uniqueness service

*Specification v0.1, 18 November 2026. Decision Log #43, #47 and #58; whitepaper §6.6 and §7.5. Reference code: `reference/document-circuit/src/fingerprint.js` (JavaScript) and `reference/document-circuit/circuits/lib/fingerprint.circom` (inside π_doc). Not reviewed by anyone outside the project. TEST ONLY.*

## 1. Purpose

The uniqueness service must recognise a person who enrols twice, and a document that is enrolled twice, without learning the person's data. For each enrolment it receives two fingerprints:

| Key | Computed from (signed DG1 of a TD3 passport) | Recognises |
|---|---|---|
| **Person key** `Fp`, path 1 | nationality, personal number (MRZ optional data, or a field of DG13 where the issuer's rule says so), birth day, sex | the same person, across renewals |
| **Person key** `Fp`, path 2 | nationality, MRZ name, birth day, sex | the same person, where there is no personal number (a match is only a signal: Decision #43) |
| **Document key** `Fd` | issuing state, document number | the same document |

The fields come from a small space: a plain hash could be reversed by trying every combination. Each fingerprint is therefore keyed with a secret `k` of the service, and computed by an oblivious pseudo-random function (OPRF): the service applies `k` without seeing the fields, and nobody can compute a fingerprint without the service.

## 2. Notation

- Baby Jubjub (EIP-2494) in twisted Edwards form over the BN254 scalar field `p`; `G` = Base8; `ℓ` the prime order of the subgroup it generates; cofactor 8.
- `H` = Poseidon (circomlib parameters).
- Service key: `k` in `[1, ℓ)`; public key `K = k·G`, published with the service.
- Domain constants (ASCII strings read as big-endian integers): `DST_H2C = "PoO-fingerprint-h2c-v1"`, `DST_F = "PoO-fingerprint-F-v1"`, `DST_DLEQ = "PoO-fingerprint-dleq-v1"`.

## 3. Hash to curve

`HashToCurve(tag, v₁…v₅)`:

1. `t_i = H(DST_H2C, tag, v₁, …, v₅, i)` for `i = 0, 1`.
2. `P_i = Map(t_i)`, the Elligator 2 map below.
3. `x = 8·(P₀ + P₁)` (cofactor cleared: `x` is in the prime-order subgroup). `x` = identity is rejected.

`Map(t)` on the Montgomery form `v² = u³ + A·u² + u`, `A = 168698`, with the non-square `Z = 5`:

```
u1 = −A / (1 + Z·t²)            (1 + Z·t² = 0 is rejected)
e  = 1 if g(u1) is a square, else 0, where g(u) = u³ + A·u² + u
u  = u1 if e = 1, else −u1 − A
v  = a square root of g(u), chosen so that v is odd exactly when e = 1
P  = (u / v, (u − 1) / (u + 1))    (twisted Edwards; v = 0 or u = −1 rejected)
```

For `t ≠ 0` exactly one of `g(u1)` and `g(−u1 − A)` is a square, so `e` and then `v` are fixed by `t`: the map is a function. It follows `map_to_curve_elligator2` of RFC 9380 (§6.7.1), with our own sign rule; the whole construction is a custom one for a circuit-friendly curve, **not** an RFC 9380 or RFC 9497 suite, and is to be reviewed.

The fields (`fields()` in the reference code; MRZ positions of ICAO 9303 TD3):

| Key | tag | v₁ | v₂ | v₃ | v₄ | v₅ |
|---|---|---|---|---|---|---|
| person, path 1 | 1 | nationality code | personal number (14 MRZ characters, as bytes, big-endian) | 0 | birth day | sex code |
| person, path 1, number in DG13 | 1 | nationality code | the DG13 field's value, left-aligned in 31 bytes, big-endian | its length in bytes (1–31) | birth day | sex code |
| person, path 2 | 2 | nationality code | name, characters 1–31 | name, characters 32–39 | birth day | sex code |
| document | 3 | issuing-state code | document number (9 characters) | 0 | 0 | 0 |

Codes are as in π_doc: three letters packed as `c₀·65536 + c₁·256 + c₂`; birth day as days since 1900-01-01; sex 1 (M), 2 (F), 0 (other). The characters are taken exactly as in the MRZ, fillers `<` included; normalisation rules per issuer (whitepaper §7.5, "rule.form") are later work.

## 4. Protocol

For each of the two keys:

```
Phone:    x = HashToCurve(tag, values)
          r = random, odd, 0 < r < ℓ;   B = r·x                  → service
Service:  checks B is on the curve, in the prime-order subgroup, not the identity
          Z = k·B, with a Chaum–Pedersen proof (c, s) that log_G K = log_B Z:
             t random;  T1 = t·G;  T2 = t·B
             c = H(DST_DLEQ, K, B, Z, T1, T2) mod ℓ;   s = t + c·k mod ℓ   → phone
Phone:    checks the proof: c = H(DST_DLEQ, K, B, Z, s·G − c·K, s·B − c·Z) mod ℓ
          W = r⁻¹·Z  (= k·x);   F = H(DST_F, x, W)
          proves π_doc with public inputs B and Z                    → service
Service:  checks π_doc, that B and Z are the values of this session, and
          takes the outputs personKey = Fp and documentKey = Fd
```

The DLEQ proof stops a service that would answer different people with different keys and so mark them. Both keys go through one session: round 1 carries `pB` and `dB` together with the session's challenge; round 2 carries the proof.

## 5. What π_doc proves (step 8)

`DocumentKeys` in `circuits/lib/fingerprint.circom`, for each key:

1. the values are read from the signed DG1 (the same bytes whose hash π_doc checks against the security object), and birth day, sex and nationality are those of step 7;
2. `x = HashToCurve(tag, values)`; the square roots and branch bits of the two maps are private inputs (hints), and each is checked: `v² = g(u)`, `e` a bit, the parity of `v` (strict binary decomposition) equal to `e`;
3. `r` is odd and `0 < r < ℓ` (251-bit decomposition and comparison), and `B = r·x`;
4. `W = 8·V` for a private point `V` on the curve, and `Z = r·W`;
5. output `F = H(DST_F, x, W)`.

**Why the phone cannot obtain a second fingerprint.** `x` is a function of the signed fields. `W = 8·V` lies in the prime-order subgroup, and `r` is odd and below `ℓ`, so it is invertible modulo `8ℓ`; hence `Z = r·W` has the single solution `W = r⁻¹·Z = k·x`, and `F` is fixed. Without step 4's `8·V`, a point `W + T` with `T` of order 2 would also satisfy `Z = r·W` for some `r`, and give another `F`; the tests check that this is refused.

**Path.** `path` (1 or 2) is a public input, and `issuer` (the issuing state) a public output. The service accepts only the path its rules give for that issuer, so a person cannot obtain a second person key through the other path.

**Personal number in DG13 (step 8a, 19 November 2026).** DG13 is the data group for national use; some issuers put the personal number there and not in the MRZ (Decision #43 foresaw it). Where the issuer's rule says so, π_doc also: hashes DG13 (up to 512 bytes after padding) and checks the hash against the DG13 entry of the signed security object; walks the fields of DG13 from the first, one position at a time, so that the field it takes is a whole field of the signed data and never bytes inside another one; requires exactly one field with the rule's tag, of 1 to 31 bytes; and takes that value, with its length, as the number. Public inputs `pnSrc` (0: MRZ or name path, 1: DG13) and `pnTag` (the field's tag) let the service check the issuer's rule. Bytes are taken as they are: the value's encoding is the issuer's and stays the same across renewals, so no decoding is needed. Refused in the tests: a changed DG13 byte, a tag that is absent, and fingerprint inputs made for another number.

Public signals of π_doc are now, in order: outputs `birthDay, sexCode, natCode, expMonth, cFace, personKey, documentKey, issuer`; inputs `dscRoot, today, currentYear, cm, challenge, path, pB[2], pZ[2], dB[2], dZ[2], pnSrc, pnTag`. Constraints: 880,640 (suite 1) and 913,581 (suite 2): about 14,500 for step 8 and about 150,000 for step 8a, mostly the SHA-1 of DG13.

## 6. What each party learns

- **Service:** `B` (a random point), the proof's public outputs, `Fp` and `Fd`. It never sees the fields. It learns when one person or one document comes back, which is its job.
- **Anyone without `k`:** nothing; `F` depends on `k·x`.
- **The phone:** `k·x` for its own fields only; with it the phone could recompute its own fingerprints, nothing more.
- **Compromise of `k`:** whoever holds `k` and the stored fingerprints can test guesses of a person's fields against them. Hence: `k` and the store stay inside the service, the store is deleted after the pilot (Decision #57, point 5), and in Phase 3 `k` is split between operators (threshold OPRF).

## 7. Pilot service (Decision #57)

- The service keeps `k` as a secret of its platform; `K` is published in the repository and, later, on the ledger.
- Stored per member: `Fp`, `Fd`, the path and the issuing state; nothing else. Uniqueness rules (Decision #47): a known `Fd` is the same document again, refused; a known `Fp` with a new `Fd` is a renewal or another nationality, which the pilot refuses as well, because the face comparison that must decide it (§6.6) runs only on the phone in the pilot. A member who loses a phone re-enrols through the recovery path (Decision #52).
- Limits (Decision #53, point 1): until the key is split between operators, the service answers only inside an enrolment session that carries a fresh challenge, limits the number of evaluations per session and per day, and publishes the running count of evaluations, so that a holder of the service who tried to evaluate guesses would show in the count.
- Reservation (Decision #43, point 2): `Fp` and `Fd` are reserved atomically before the credential is issued.
- **Path rule for the pilot: path 1, number in DG13.** The passports of the pilot's single issuer carry no personal number in the MRZ and have no DG11, but their DG13 holds it in one field (found by a holder on 18 November 2026: the app showed the last three digits of the ten-digit number of that field on the holder's screen only, and they matched). The rule (path 1, DG13, the field's tag) is part of the service's configuration. Where an issuer carries no number at all, path 2 (name) applies; a name-path match is then refused outright in the pilot, as the service has no face comparison (Decision #57, point 3).

## 8. Open points for review

1. The hash to curve (§3): bias of the map, the sign rule, and the exceptional cases, all left to negligible probability.
2. Completeness of circomlib's `EscalarMulAny` for points of the prime-order subgroup and odd scalars below `ℓ`.
3. Personal numbers that are not in the MRZ (DG11), and normalisation per issuer.
4. Threshold OPRF and key rotation by epoch (whitepaper §7.5).

## Test results (synthetic documents)

- Reference code: the map lands on the curve for 200 of 200 inputs (103 in the first branch); the DLEQ proof verifies and is refused for another key or another answer; the same fields give the same `F` under different `r`.
- Circuit, alone (`test/fingerprint.test.js`, 5 tests) and inside π_doc suite 2 (`test/document_s2.test.js`, 15 tests): the outputs equal the reference values; a renewal keeps `Fp` and changes `Fd`; another person, another key or the other path gives another `Fp`; refused are a flipped branch bit, the other square root, path 3, a path that does not match the hints, an answer from another key, `W + T` with `T` of order 2, an even `r`, `r + ℓ`, a birth day other than DG1's, and the fingerprint inputs of another passport.
- The fingerprint part compiles to a circom-witnesscalc witness graph, so the phone computes its witness natively.
- The phone's code (`native-prover/src/fingerprint.rs`, Rust) gives exactly the reference's inputs on test vectors for both paths, and refuses a wrong DLEQ proof and an answer under another key (`fp-check`). A full suite-2 π_doc built from the app's Kotlin input and these inputs verifies, with the reference fingerprints as outputs.
