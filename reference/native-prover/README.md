# Native prover for the phone app

> **TEST-ONLY trusted setups. Not audited.** (schedule 1.4-00; implementation notes N27, N30)

The browser benchmark ([`../phone-bench/`](../phone-bench/)) showed that a phone's browser can make the ballot proof, but that the enrolment proof is about 20 times larger and needs a native prover (N27). This Rust library is that prover. It is built into the Android test app ([`../android-prototype/`](../android-prototype/)).

## How it works

1. **Witness.** [circom-witnesscalc](https://github.com/iden3/circom-witnesscalc) 0.3.0 (iden3; MIT or Apache-2.0) evaluates a precompiled **witness graph** of the circuit. No WebAssembly runtime is needed.
2. **Proof.** [arkworks](https://arkworks.rs) Groth16 with Circom's QAP reduction ([ark-circom](https://github.com/arkworks-rs/circom-compat) 0.6.0, MIT or Apache-2.0), reading the same snarkjs `.zkey`. The proof's randomness comes from the operating system's random generator.
3. **Check.** The proof is verified on the phone before it is used. Proof and public signals come out in snarkjs's JSON format, so the contracts, verifiers and tests do not change.

The library keeps nothing and writes nothing to disk. The proving key is read once per process and kept in memory.

## Measured (server, 2 cores; same proof, input and key as the browser benchmark)

| Prover | Ballot proof π_vote |
|---|---|
| **This library** | **about 1.0 s** (0.95–1.03 s; witness 0.02 s), plus 3.9 s once to read the 23 MB key |
| snarkjs in Node.js | 4–5 s |
| snarkjs in headless Chromium | about 10 s |

The proofs verify with snarkjs and the public signals are identical to snarkjs's. Phone figures come from the Android app's benchmark screen.

## Files

- `src/lib.rs` — `Circuit::load(zkey, graph)`, `prove`, `prove_checked`, and the JNI entry point `NativeProver.prove` for the Android app.
- `src/main.rs` — `poo-prove`, a command-line timer: `poo-prove <graph> <zkey> <inputs.json> <proof.json> <public.json> [runs]`.
- `graphs/ballot.graph` — witness graph of `../ballot-circuit/circuits/ballot.circom` (sha256 `cdd5d77ba663d956b17e90e2d586392a2b0c0a12d70ba2736792c876d1b01064`). The build is reproducible; rebuild it with `build-circuit` from circom-witnesscalc v0.3.0:

```bash
build-circuit circuits/ballot.circom ballot.graph -l node_modules -l node_modules/circomlib/circuits -l circuits   # in ../ballot-circuit
```

## Build

```bash
cargo build --release                      # needs protoc (protobuf-compiler) and clang
# for Android (64-bit ARM): the NDK's clang named with the API level, and the same versioned
# target for bindgen; see the workflow for the exact variables
cargo build --release --locked --lib --target aarch64-linux-android
```

circom-witnesscalc's build script reads the compiler from `CC_aarch64-linux-android` (with dashes), and recent NDKs refuse bindgen's unversioned target, so the workflow sets both explicitly instead of using cargo-ndk.

GitHub Actions builds it for Android on every change ([workflow](../../.github/workflows/android-prototype.yml)).

## Open points

- **Enrolment proof π_doc** (577,678 constraints): measured on the server with a random setup at about 11 s and 1.9 GB of memory (`../prove-bench/`). The memory is the problem for 2 GB phones. The next step is a phone measurement, and then a lower-memory prover (rapidsnark, or a streaming key format).
- **Key loading** (3.9 s on the server) can be cut by storing the key in arkworks' own format at installation.
- Dependencies pinned in `Cargo.lock`; not yet reviewed (`cargo audit`).

Licence: Apache-2.0. Written by the Proof of One AI agents Psephos and Prosopon (see [AGENTS.md](../../AGENTS.md)).
