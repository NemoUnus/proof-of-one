# Document-validity proof π_doc — reference circuit

> **Reference code for review and testing only. Not audited. Tested with synthetic documents only. Any trusted setup made by the script here is TEST-ONLY and insecure.**

At enrolment the phone reads the passport chip and proves, without revealing the document, that its data was signed by a document signer in the public tree of checked signers, that it has not expired, and what its date of birth, sex, nationality and expiry month are. Specification: [`docs/specs/document-validity-proof-v0.1.md`](../../docs/specs/document-validity-proof-v0.1.md). Schedule activity 0.6.

Supported in v0.1: TD3 passports, SHA-256 data-group hashes, RSA-2048 PKCS#1 v1.5 signatures with e = 65537. Other suites are listed in the specification §6.

## Run it

Requires Node.js 20 or later.

```bash
npm install
npm run build        # compile the circuit (about 1 minute)
npm test             # 13 witness tests, including attacks (about 50 s)
npm run setup:test   # optional: TEST-ONLY setup (slow), then npm test also makes a real proof
```

The setup script can take an existing 2^20 powers-of-tau file as its argument: `bash scripts/setup-test.sh path/to/pot20.ptau`. The proving key is several hundred megabytes and is not committed.

## Files

| File | Contents |
|---|---|
| `circuits/document.circom` | The circuit: DG1 and DG2 hashes, `eContent` digest, RSA signature, DSC tree membership, expiry, attribute outputs |
| `src/icao.js` | Synthetic ICAO 9303 documents (MRZ, DG1, DG2, LDS security object, signed attributes, RSA signature) with test CSCA and DSC certificates; the public tool that checks each DSC against the trusted CSCAs and builds the DSC tree |
| `src/document.js` | Builds the circuit input on the phone; expected outputs; witness, prove, verify |
| `test/document.test.js` | Tests |

## Measured

| Item | Value |
|---|---|
| Constraints | **577,678** (SHA-256 about 366,000; RSA-2048 185,903; the rest about 26,000) |
| Witness generation | about 3 s on a server core |
| Groth16 proving | not measured yet: the TEST-ONLY setup needs a 2^20 powers-of-tau file, which takes more than two hours to make on a 2-core machine. Run `npm run setup:test` on a faster machine; the last test prints the time. |

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

Every rejection is checked to come from a failed circuit constraint.

## Dependencies and licences

SHA-256 and RSA verification come from [`@zk-email/circuits`](https://github.com/zkemail/zk-email-verify) (MIT). Poseidon, comparators and bit decomposition come from circomlib (GPL-3.0; see the licence note in the implementation notes). Test certificates are made with node-forge (BSD-3-Clause or GPL-2.0).

## Authorship and review status

Written by the Proof of One AI agents Prosopon and Kryptos (see [AGENTS.md](../../AGENTS.md)). Not yet reviewed by independent human experts.

Licence: Apache-2.0.
