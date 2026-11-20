# Pilot enrolment service (Cloudflare Worker)

The only server of the pilot that learns anything about a member's document ([design](../../docs/specs/pilot-enrolment-service-v0.1.md)). TEST ONLY: synthetic documents in the tests, TEST-ONLY keys.

| Path | |
|---|---|
| `GET /info` | OPRF public key `K`, credential key `A`, accepted signer-tree roots, verifier address, running counts of evaluations and enrolments (Decision #53) |
| `POST /session {issuer}` | a session (10 minutes) with a fresh challenge, the issuing state's rule (path, `pnSrc`, `pnTag`), `today` and `currentYear` for π_doc; at most `DAILY_SESSIONS` a day |
| `POST /evaluate {session, pB, dB}` | the OPRF answers with DLEQ proofs; once per session |
| `POST /enrol {session, proof, publicSignals}` | checks that the proof is for this session, date, signer tree and rule; verifies π_doc with the contract `DocVerifier` by `eth_call`; reserves person key and document key (unique: a known document or a known person is refused); signs the credential |

Files:

- `src/service.js`: the requests and checks; `src/worker.js`: the entry point; `src/core.js` and `src/core.wasm`: the cryptography from [`../service-core`](../service-core) (Rust), built and committed by the workflow `enrol-service.yml`.
- `schema.sql`: the D1 tables. Per member only person key, document key, issuing state, path, time.
- `keys/doc_s2_vkey.json`: the verifying key of π_doc (suite 2) under the TEST-ONLY key the app uses (`prove-mem`, seed 1, reproducible); the Android workflow checks that its key gives exactly this. `keys/doc_s2_proof_example.json`: a proof of a synthetic passport.
- `scripts/gen-doc-verifier.cjs`: `../contracts/src/DocVerifier.sol` from the verifying key (snarkjs's template). `scripts/bench-core.mjs`: time per call of the core.

Tests: `test/core.test.mjs` (the core against the JavaScript references), `test/service.test.mjs` (the Worker end to end, with the reference phone code, SQLite in place of D1 and a stand-in for the chain), `../contracts/test/doc-verifier.test.js` (the contract with the real proof, called with the Worker's own calldata). Node 22.

**Measured (21 November 2026, Node 22 on a server):** the core takes 4.4–5.0 ms for `/evaluate` (two answers, two DLEQ proofs, two subgroup checks) and 2.2–2.6 ms for the credential signature; Workers' free plan allows about 10 ms of processor time per request. Verifying π_doc costs 375,678 gas, free by `eth_call`.

**Configuration** (Settings → Variables and secrets of the Worker; nothing secret in this repository):

| Name | Kind | |
|---|---|---|
| `OPRF_KEY`, `CREDENTIAL_KEY`, `REVOCATION_KEY` | secret | 64 random bytes each, hex; made in the browser with [`testnet/web/enrol-secrets.html`](../testnet/web/enrol-secrets.html) |
| `RULES` | text | issuing states of the pilot and their rule, e.g. `{"UTO": {"path": 1, "pnSrc": 1, "pnTag": "5F10"}}` |
| `DSC_ROOTS` | text | accepted roots of the tree of checked signers, comma-separated |
| `DOC_VERIFIER` | text | address of `DocVerifier` on the test network |
| `DB` | D1 binding | the database, with `schema.sql` applied |

No request logs. NOT reviewed outside the project.
