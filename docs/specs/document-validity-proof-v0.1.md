# Document-validity proof π_doc — specification v0.1

*Authors: Prosopon and Kryptos (AI agents), with red-team notes by Argus (AI agent). Implements the enrolment proof of whitepaper §7.4 for two signature suites (§5.1). Schedule activity 0.6. Status: implemented in [`reference/document-circuit`](../../reference/document-circuit/) and tested with synthetic documents only. Not audited.*

## 1. What it proves

At enrolment the phone reads the passport chip and proves, without revealing the document:

1. **Integrity.** The hash of DG1 (SHA-256 or SHA-1, depending on the suite) (the machine-readable zone) is the DG1 hash listed in the LDS security object (`eContent`), and the DG2 (face image) hash listed there is committed to as `C_face`.
2. **Authenticity.** The hash of `eContent` is the `messageDigest` in the signed attributes, and the signed attributes carry a valid signature by a document signer (DSC) that is in the public **tree of checked signers** (§2).
3. **Validity.** The expiry date in DG1 is on or after `today`.
4. **Attributes.** It outputs the values that the registration proof π_reg and the ballot proof π_vote use (§3).

| | Values |
|---|---|
| Public inputs | `dscRoot`, `today` (day number), `currentYear`, `cm` (the member's hiding commitment), `challenge` (fresh from the enrolment service) |
| Public outputs | `birthDay`, `sexCode`, `natCode`, `expMonth`, `C_face = Poseidon(hi, lo, r_face)`, where `lo` is the last 16 bytes of the DG2 hash and `hi` the bytes before them |
| Private inputs | DG1, `eContent`, signed attributes (each padded for its hash), three offsets, the signature, the DSC modulus and exponent and its Merkle path, `r_face` |

The enrolment service checks the proof, compares `C_face` with the photo it receives inside the enclave (whitepaper §7.6), and signs a credential over the attributes and `cm`. The proof is bound to `cm` and `challenge`, so it cannot be replayed for another commitment or another session.

## 2. Design decision: a tree of checked signers instead of the CSCA check inside the proof

A passport's signature chain has two links: the document signer (DSC) signs the chip data, and the country's signing CA (CSCA) signs the DSC certificate. π_doc proves the first link and proves that the DSC key is a leaf of a public Merkle tree. The second link is checked **outside the phone, once per signer**, by a public tool:

- **No privacy is lost.** DSC certificates are public, are published by states in the ICAO PKD and carry no personal data. A DSC signs the documents of many people over some months. The proof hides which leaf is used.
- **Anyone can recheck.** The tool takes the published CSCA list (schedule activity 0.7) and the DSC certificates, verifies each DSC, and builds the tree. Anyone can run it and compare the root, in the same spirit as the public recount (R2).
- **The phone proof stays about half the size.** Checking the CSCA signature inside the proof would add hashing of the DSC certificate (often more than 1,000 bytes) and a second RSA verification, often with a 3,072- or 4,096-bit key: hundreds of thousands of constraints more.

Leaf, where `n_i` are the 121-bit limbs of the RSA modulus:

- suite 1 (`alg = 1`: RSA-2048, PKCS#1 v1.5, SHA-256, e = 65537): `Poseidon(1, Poseidon(n_0 … n_15), n_16)`;
- suite 2 (`alg = 2`: RSA up to 3,146 bits, PKCS#1 v1.5, SHA-1, any odd exponent below 2^17): `Poseidon(2, Poseidon(n_0 … n_15), Poseidon(n_16 … n_25, e))`.

The leaf binds the suite, every limb of the modulus and, where the suite allows several exponents, the exponent. The list tool is to add a signer under a suite only when documents have been seen to use that suite's hash, so that a signer known only for SHA-256 cannot be used with the SHA-1 circuit (rule of Decision Log #42; the reference tool still takes the suite as given). Tree depth 16 (65,536 signers). States issue new document signers regularly, so the tree is rebuilt on a schedule, and the enrolment service accepts the roots of a published recent window.

## 3. Attribute encoding

| Output | Encoding | Note |
|---|---|---|
| `birthDay` | Days since 1 January 1900, as in π_vote (Decision Log #37) | Two-digit years: `YY` after the current year's `YY` means 19YY, otherwise 20YY. A holder over 100 years old would be read as a child; rare, and noted. |
| `sexCode` | `M` → 1, `F` → 2, anything else → 0 | |
| `natCode` | The three ICAO letters of the nationality packed as one number: `65536·c₁ + 256·c₂ + c₃` | No country table inside the circuit. Polls name nationalities by the same packing, for example `natCode("FRA")`. Germany's code `D<<` works the same way. |
| `expMonth` | `year · 12 + month` of the expiry date | Used for the poll rule `minExpiryMonth` |

## 4. Reading values safely

Every value is read from inside data that is hashed and signed:

- each read checks the DER bytes in front of the value: `30 25 02 01 01 04 20` for the DG1 hash entry and `30 25 02 01 02 04 20` for DG2 (with SHA-1: `30 19 … 04 14`), and the 17-byte `messageDigest` attribute header;
- each read must end within the hashed (padded) length, so a value planted in unhashed bytes, or a read that wraps around the array, is rejected;
- DG1 must start with `61 5B 5F 1F 58`, so the MRZ positions are those of a TD3 passport;
- MRZ digits must be ASCII digits, and the date arithmetic uses bit-decomposed quotients, so a prover cannot shift a date by choosing another witness.

## 5. Size and cost

Suite 1:

| Part | Constraints |
|---|---|
| SHA-256: DG1 (2 blocks), `eContent` up to 448 bytes (7 blocks), signed attributes up to 192 bytes (3 blocks) | about 366,000 (one 64-byte block measures 30,497) |
| RSA-2048 verification, e = 65537 | 185,903 (measured alone) |
| Reads, dates, Merkle path (depth 16), Poseidon | about 26,000 |
| **Total** | **577,678** |

Witness generation takes about 3 seconds on a server core. **Groth16 proving takes about 11–12 seconds on 2 server cores** (arkworks, peak memory 1.9 GB, verification 3–4 ms), measured with a TEST-ONLY random setup by [`reference/prove-bench`](../../reference/prove-bench/), because a snarkjs setup would need a 2^20 powers-of-tau file. Phone times are still to be measured (schedule 0.8). A proof of this size is too heavy for a phone's web browser. The phone app (schedule activity 1.4) needs a native prover. The proof runs **once per enrolment**, not per vote.

### 5.1 Suite 2: SHA-1 and RSA-3072 with any exponent

Passports in use still carry SHA-1 data-group hashes and sha1WithRSAEncryption signatures, and some document signers use RSA-3072 keys with public exponents other than 65537; Rarimo's circuits carry a template for RSA-3072, SHA-1 and e = 37817 ([evaluation](../research/rarimo-circuits-evaluation-v0.1.md)). Suite 2 covers these documents. Which suites matter most is to be measured on document-signer certificates collected from many documents (trust list §4).

- **One circuit for every exponent.** The exponent is a private input, bound in the leaf. A circuit per exponent would let the verifier learn the exponent from the circuit used, and an unusual exponent can point to one issuer.
- **Exponent rules.** The circuit accepts any odd exponent from 3 to 2^17 − 1 and computes `s^e mod n` by square-and-multiply over 17 bits, twice the multiplications of the fixed-exponent path. The list tool refuses other exponents.
- **SHA-1.** SHA-1 is broken for collisions, but an attacker would need a second preimage of data the state signed, not a collision of data the attacker chooses: no practical attack is known for this use. It is supported only because passports in use carry it. The circuit is written from circomlib primitives and tested against Node's SHA-1 on messages of 0 to 150 bytes.
- **What the suite reveals.** The verifier learns which circuit was used, so a member of suite 2 is known to hold a document signed with SHA-1 and RSA. The nationality is an output of the proof in any case; the suite adds at most a hint about the issuing period.

| Item | Suite 2 |
|---|---|
| SHA-1 compression | about 14,200 constraints per 64-byte block (SHA-256: 30,497) |
| **Total** | **749,147** constraints (suite 1: 577,678) |
| Witness generation | about 6 s on a server core |
| Groth16 proving | **11.5–12.3 s on 2 server cores** (three runs; arkworks, peak memory 2.5 GB, verification 3–4 ms), with a TEST-ONLY random setup. Proving time grows with the number of wires more than with constraints, so it barely differs from suite 1; phone times are to be measured |

## 6. Not covered yet

| Gap | Plan |
|---|---|
| Other signature suites: RSA-PSS, RSA-4096, RSA-3072 with SHA-256, ECDSA (P-256, P-384, brainpool), SHA-384/512 hashes, mixed hashes (data groups and signature with different hashes; the circuit already takes them as separate parameters) | One circuit per suite, chosen by the leaf's `alg`; which suites to support first follows from document-signer certificates collected from real documents (trust list §4) |
| TD1 identity cards (three MRZ lines of 30 characters) | A second DG1 layout |
| Chip cloning (Active or Chip Authentication) | The chip's AA/CA public key is unique to the chip, so it must not be revealed. Design in the enrolment service (1.2). |
| Document fingerprint (Layer 1, OPRF input) | In the enrolment service work (1.2) |
| Parsing a real SOD (CMS SignedData) | Android prototype (0.8) |

## 7. Red-team notes

| # | Attack | Result |
|---|---|---|
| V1 | Change the date of birth in DG1 | Rejected: DG1 no longer matches its signed hash |
| V2 | Use another person's DG1 with one's own signed data | Rejected |
| V3 | Replace the DG1 hash inside `eContent` | Rejected: `eContent` no longer matches the signed digest |
| V4 | Read the DG2 entry as DG1 | Rejected by the DER prefix check |
| V5 | Plant a value in unhashed bytes after the padded data | Rejected by the length bound |
| V6 | Sign with one's own key | Rejected: RSA verification fails |
| V7 | Signer whose CSCA is not trusted | The list tool refuses it; not in the tree |
| V8 | Present one trusted signer's signature with another trusted signer's leaf | Rejected |
| V9 | Expired document | Rejected; a document valid until today is accepted |
| V10 | Replay a proof for another commitment or session | `cm` and `challenge` are public inputs |
| V12 | Suite 2: claim another exponent for the same modulus | Rejected (the signature check fails; the leaf also binds the exponent) |
| V13 | Suite 2: exponent 1, an even exponent, or 2^17 or more | Rejected by the circuit itself, and refused by the list tool |
| V14 | Use a signer listed only for suite 1 (SHA-256) with the SHA-1 circuit | Rejected: the leaf carries `alg`, so the path does not reach the root |
| V11 | A state issues genuine documents to fake people | Not detectable by any document check. This is the fundamental limit (whitepaper §12.1). |

## 8. Reference implementation

- Circuit: `reference/document-circuit/circuits/lib/document_core.circom`, one main file per suite (`circuits/document.circom`, `circuits/document_s2.circom`); SHA-1 and the RSA check with any exponent in `circuits/lib/`. Moving suite 1 into the shared template left its constraint count unchanged (577,678).
- Synthetic ICAO test documents, the signer list tool and the DSC tree: `reference/document-circuit/src/icao.js`
- Phone-side input builder: `reference/document-circuit/src/document.js`
- Tests: `reference/document-circuit/test/document.test.js`, 14 tests covering V1–V10, birth-year century, leap days, the hand-over of the outputs to registration and ballots, and a full Groth16 proof with a TEST-ONLY setup; `test/document_s2.test.js`, 14 tests of suite 2 covering V1, V3, V4, V6–V9 and V12–V14 and exponents 3, 37817, 40001 and 65537.

— Prosopon and Kryptos (AI agents, Proof of One)
