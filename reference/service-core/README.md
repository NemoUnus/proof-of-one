# Service core (Rust → WebAssembly)

The cryptography of the pilot's enrolment service ([design](../../docs/specs/pilot-enrolment-service-v0.1.md), §4), small enough to run inside a Cloudflare Worker:

| Function | What it does |
|---|---|
| `evaluate` | the OPRF answer `Z = k·B` for both blinded points of a session, each with its DLEQ proof ([fingerprint spec](../../docs/specs/document-fingerprint-oprf-v0.1.md), §4); refuses points that are not on the curve, not in the prime-order subgroup, or the identity |
| `sign` | the member's credential, as the enclave's `issue()` in [`enrolment.js`](../enrolment-circuit/src/enrolment.js): revocation handle `rn = H(6, kR, Fp, generation) mod 2^252`, message `H(5, attributes, cm, rn, epoch)`, EdDSA-Poseidon signature that circomlib's verifier (and so π_reg) accepts |
| `public` | the public keys of the service's secrets: OPRF key `K`, credential key `A` and its leaf `H(A)` |
| `poseidon` | Poseidon with circomlib's parameters, 1 to 16 inputs |
| `tree` | root and path of the tree of checked signers, as `ballot-circuit/src/trees.js` builds it |

The functions are pure: the Worker passes fresh random bytes for every nonce. The secrets are three values of 64 random bytes each (`oprf`, `credential`, `revocation`), kept as secrets of the Worker, never in files.

Curve arithmetic uses arkworks' extended coordinates on the curve isomorphic to Baby Jubjub with `a = 1`; points enter and leave in circomlib's form. Poseidon is circomlib's, in the optimized form of circomlibjs's `poseidon_opt.js`, with its constants for 1 to 16 inputs in `src/poseidon_opt.bin` (made by `scripts/poseidon-constants.cjs` from circomlibjs 0.1.7).

**Checks.** [`../enrol-service/test/core.test.mjs`](../enrol-service/test/core.test.mjs) compares every function with the project's JavaScript references: the phone's check of the answer and its fingerprints (`document-circuit/src/fingerprint.js`), circomlibjs's EdDSA verifier, `enrolment.js`'s message and handle, circomlibjs's Poseidon for 1 to 16 inputs, the tree against `IncrementalTree`. Locally it runs on the native build (`cargo build --release`, binary `core-cli`); the workflow `enrol-service.yml` builds the WebAssembly module with Rust 1.97.0, runs the same tests on it, measures the time per call, and commits the checked `core.wasm` to `../enrol-service/src/`.

NOT constant-time. TEST ONLY: not reviewed outside the project.
