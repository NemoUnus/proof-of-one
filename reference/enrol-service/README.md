# Pilot enrolment service (Cloudflare Worker)

The only server of the pilot that learns anything about a member's document ([design](../../docs/specs/pilot-enrolment-service-v0.1.md)). TEST ONLY: synthetic documents in the tests, TEST-ONLY keys.

| Path | |
|---|---|
| `GET /info` | OPRF public key `K`, credential key `A`, accepted signer-tree roots, verifier address, running counts of evaluations and enrolments (Decision #53), and `keySet`: the registry's key-set root and this service's key's path in it, for the phone's π_reg (Decision #61), or `null` until published |
| `POST /session {issuer}` | a session (10 minutes) with a fresh challenge, the issuing state's rule (path, `pnSrc`, `pnTag`), `today` and `currentYear` for π_doc; at most `DAILY_SESSIONS` a day |
| `POST /evaluate {session, pB, dB}` | the OPRF answers with DLEQ proofs; once per session |
| `POST /enrol {session, proof, publicSignals}` | checks that the proof is for this session, date, signer tree and rule; verifies π_doc with the contract `DocVerifier` by `eth_call`; reserves person key and document key (unique: a known document or a known person is refused); signs the credential |
| `POST /signer {dsc, suite}` | checks a document signer's certificate (base64 DER) against the CSCAs held, and adds its key's leaf to the tree of checked signers (depth 16) |
| `GET /path?leaf=…` | the tree's root and the signer's path, for π_doc |
| `GET /signers` | the tree: per leaf its suite and the SHA-256 fingerprints of DSC and CSCA; no certificates, no country names |

Files:

- `src/service.js`: the requests and checks; `src/signers.js` and `src/x509.js`: the tree of checked signers and the certificate checks. RSA signatures (PKCS #1 v1.5 and PSS) are checked with BigInt arithmetic, because the Workers runtime refuses to import RSA keys whose exponent is not 3 or 65537, and real CSCAs use others (found at the first real enrolment, 21 November 2026); ECDSA uses WebCrypto; `src/worker.js`: the entry point; `src/core.js` and `src/core.wasm`: the cryptography from [`../service-core`](../service-core) (Rust), built and committed by the workflow `enrol-service.yml`.
- `schema.sql`: the D1 tables. Per member only person key, document key, issuing state, path, time, and the encrypted backup of Decision #59 (opened only on the phone, with the member's password and a value of the person key's OPRF that only the phone obtains).
- `keys/doc_s2_vkey.json`: the verifying key of π_doc (suite 2) under the TEST-ONLY key the app uses (`prove-mem`, seed 1, reproducible); the Android workflow checks that its key gives exactly this. `keys/doc_s2_proof_example.json`: a proof of a synthetic passport.
- `scripts/gen-doc-verifier.cjs`: `../contracts/src/DocVerifier.sol` from the verifying key (snarkjs's template). `scripts/bench-core.mjs`: time per call of the core.

Tests: `test/core.test.mjs` (the core against the JavaScript references), `test/service.test.mjs` (the Worker end to end, with the reference phone code, SQLite in place of D1 and a stand-in for the chain), `test/signers.test.mjs` (signers of synthetic countries, RSA and ECDSA CSCAs; leaves and paths against the reference code), `../contracts/test/doc-verifier.test.js` (the contract with the real proof, called with the Worker's own calldata). Node 22.

`test/e2e.local.mjs` (not in CI, it needs the 179 MB TEST-ONLY key) runs the whole enrolment as the app does it, on one machine: a synthetic passport with the personal number in DG13, `/signer` and `/path`, a session, the member's secrets from the phone's native code, the fingerprints through `/evaluate` with the DLEQ proofs checked, π_doc from the native prover with the real tree path, and `/enrol` with the real `DocVerifier` on a local chain. On 21 November 2026: enrolled in 9 s, π_doc 5.5 s.

**Measured (21 November 2026, Node 22 on a server):** the core takes 3.5–4.8 ms for `/evaluate` (two answers, two DLEQ proofs, two subgroup checks), 1.2 ms for the credential signature, about 1 ms for a signer's leaf and 1.5–2.5 ms for the tree with up to 20 signers; Workers' free plan allows about 10 ms of processor time per request. Verifying π_doc costs 375,678 gas, free by `eth_call`.

**Configuration** (Settings → Variables and secrets of the Worker; nothing secret in this repository):

| Name | Kind | |
|---|---|---|
| `OPRF_KEY`, `CREDENTIAL_KEY`, `REVOCATION_KEY` | secret | 64 random bytes each, hex; made in the browser with [`testnet/web/enrol-secrets.html`](../testnet/web/enrol-secrets.html) |
| `RULES` | text | issuing states of the pilot and their rule, e.g. `{"UTO": {"path": 1, "pnSrc": 1, "pnTag": "5F10"}}` |
| `CSCA_CERTS` | text | the CSCA certificates (base64 DER, separated by commas or line breaks) that signers are checked against; from the master lists, never committed here |
| `DSC_ROOTS` | text | optional extra accepted roots, for tests; the tree's own roots are always accepted |
| `DOC_VERIFIER` | text | address of `DocVerifier` on the test network |
| `KEY_SET` | text | the registry's key set as JSON (`testnet/web/keyset.json`, made by `testnet/plan6.js`); public |
| `DB` | D1 binding | the database, with `schema.sql` applied |

No request logs. NOT reviewed outside the project.
