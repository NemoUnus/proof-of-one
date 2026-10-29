# Document-validity proof π_doc — reference circuit

> **Reference code for review and testing only. Not audited. Tested with synthetic documents only. Any trusted setup made by the script here is TEST-ONLY and insecure.**

At enrolment the phone reads the passport chip and proves, without revealing the document, that its data was signed by a document signer in the public tree of checked signers, that it has not expired, and what its date of birth, sex, nationality and expiry month are. Specification: [`docs/specs/document-validity-proof-v0.1.md`](../../docs/specs/document-validity-proof-v0.1.md). Schedule activity 0.6.

Supported: TD3 passports in two signature suites, each with its own circuit:

| Suite | Hashes | Signature | Circuit |
|---|---|---|---|
| 1 | SHA-256 | RSA-2048 PKCS#1 v1.5, e = 65537 | `circuits/document.circom` |
| 2 | SHA-1 | RSA up to 3,146 bits (RSA-3072 in practice) PKCS#1 v1.5, any odd exponent below 2^17 | `circuits/document_s2.circom` |

Other suites are listed in the specification §6.

## Run it

Requires Node.js 20 or later.

```bash
npm install
npm run build        # compile suite 1 (about 1 minute)
npm run build:s2     # compile suite 2 (about 1 minute; its tests are skipped without it)
npm test             # witness tests of both suites including attacks, and the trust-list tests (about 3 minutes)
npm run setup:test   # optional: TEST-ONLY setup (slow), then npm test also makes a real proof
```

The setup script can take an existing 2^20 powers-of-tau file as its argument: `bash scripts/setup-test.sh path/to/pot20.ptau`. The proving key is several hundred megabytes and is not committed.

## Files

| File | Contents |
|---|---|
| `circuits/lib/document_core.circom` | The circuit, shared by all suites: DG1 and DG2 hashes, `eContent` digest, RSA signature, DSC tree membership, expiry, attribute outputs |
| `circuits/document.circom`, `circuits/document_s2.circom` | One main file per suite, with the suite's parameters |
| `circuits/lib/sha1.circom` | SHA-1 over padded bytes of variable length |
| `circuits/lib/rsa_pkcs1.circom` | RSA PKCS#1 v1.5 check for any digest and any exponent below 2^EBITS |
| `src/icao.js` | Synthetic ICAO 9303 documents (MRZ, DG1, DG2, LDS security object, signed attributes, RSA signature) with test CSCA and DSC certificates; the public tool that checks each DSC against the trusted CSCAs and builds the DSC tree |
| `src/document.js` | Builds the circuit input on the phone; expected outputs; witness, prove, verify |
| `test/document.test.js`, `test/document_s2.test.js` | Tests of the proof, suite 1 and suite 2 |
| `src/trustlist.js` | The trust list ([spec](../../docs/specs/trust-list-v0.1.md)): reads and checks CSCA master lists against pinned anchors, merges sources into a list of references, checks document signers |
| `bin/trust-list.js` | Builds the published trust list from master lists you downloaded yourself and prints its `listHash` |
| `test/trustlist.test.js` | Tests of the trust list; one test reads a real master list placed in `test/data/` (not committed) |

## Measured

| Item | Value |
|---|---|
| Constraints, suite 1 | **577,678** (SHA-256 about 366,000; RSA-2048 185,903; the rest about 26,000) |
| Constraints, suite 2 | **749,147** (SHA-1 about 14,200 per block; RSA-3072 with a 17-bit exponent takes most of the rest) |
| Witness generation | about 3 s (suite 1) and 6 s (suite 2) on a server core |
| Groth16 proving, suite 2 | **11.5–12.3 s on 2 server cores** (three runs; arkworks; peak memory 2.5 GB), TEST-ONLY random setup |
| Groth16 proving, suite 1 | **about 11–12 s on 2 server cores** (arkworks; peak memory 1.9 GB; verification 3–4 ms), with a TEST-ONLY random setup: see [`../prove-bench`](../prove-bench/). The snarkjs setup (`npm run setup:test`) needs a 2^20 powers-of-tau file. Phone times: schedule 0.8 |

This proof runs once per enrolment, not per vote. It is too heavy for a phone's web browser; the phone app needs a native prover.

## Tests

| Test | What it shows |
|---|---|
| Honest passport | Outputs equal the values computed from the MRZ; `C_face` binds the DG2 hash |
| Century of birth, sex code | `08` is 2008 and `27` is 1927 when enrolling in 2026; `M` gives 1 |
| Leap day | 29 February counts like the ballot proof's day numbers |
| Expiry | Valid until today is accepted; expired yesterday is rejected |
| Altered DG1 | Rejected |
| Another person's DG1 | Rejected |
| Edited LDS security object | Rejected |
| DG2 entry read as DG1 | Rejected by the DER prefix check |
| Value planted after the hashed bytes | Rejected by the length bound |
| Signature by another key | Rejected |
| Signer of an untrusted CSCA | The list tool refuses it; the proof cannot use it |
| One trusted signer's signature with another's leaf | Rejected |
| Outputs as attributes | A poll for adult nationals of the test country accepts the holder; another nationality, or the day before the 18th birthday, does not |
| Groth16 proof (needs the setup) | Verifies; changing today's date, the commitment or an output fails |
| **Suite 2** | |
| Test documents | SHA-1 hashes, sha1WithRSA signature, RSA-3072 key with e = 37817, verified by Node |
| Honest passport; exponents 3, 37817, 40001 and 65537 | Accepted by the same circuit; `C_face` binds the SHA-1 DG2 hash |
| Expiry, altered DG1, edited LDS security object, DG2 read as DG1, another key's signature, untrusted signer, key swap | Rejected, as in suite 1 |
| Another exponent claimed for the same modulus | Rejected |
| Exponent 1, an even exponent, 2^17 or more | Rejected by the circuit; refused by the list tool |
| A signer listed only under suite 1 used with the SHA-1 circuit | Rejected: suites are separated by `alg` in the leaf |

Every rejection is checked to come from a failed circuit constraint.

**Trust list tests:** a signed master list is read; an altered list, a list signed by another key, or a signer from an untrusted anchor is refused; sources merge into one list whose hash does not depend on their order; excluded and expired certificates drop out; a document signer is accepted only from a CSCA of its own country. On the real lists (German master list of 1 October 2026 and ICAO master list of 13 October 2026, each under its pinned anchor): 609 and 604 certificates, merged into 662 valid CA certificates from 129 country codes. The United Nations CSCA that anchors the ICAO list is checked to be an entry of the German list.

## Dependencies and licences

SHA-256 and the RSA arithmetic come from [`@zk-email/circuits`](https://github.com/zkemail/zk-email-verify) (MIT); `circuits/lib/rsa_pkcs1.circom` generalises its RSA check. `circuits/lib/sha1.circom` is our own, built from circomlib primitives; Rarimo's MIT-licensed SHA-1 circuit ([rarimo/passport-zk-circuits](https://github.com/rarimo/passport-zk-circuits)) was read as a reference. Poseidon, comparators and bit decomposition come from circomlib (GPL-3.0; see the licence note in the implementation notes). Test certificates are made with node-forge (BSD-3-Clause or GPL-2.0).

## Authorship and review status

Written by the Proof of One AI agents Prosopon and Kryptos (see [AGENTS.md](../../AGENTS.md)). Not yet reviewed by independent human experts.

Licence: Apache-2.0.
