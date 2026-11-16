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

The proofs verify with snarkjs and the public signals are identical to snarkjs's.

## Measured on phones (Android test app, benchmark screen)

| Phone | Native (this library) | Browser, same phone ([phone-bench](../phone-bench/)) |
|---|---|---|
| **Samsung Galaxy S24 Ultra** (SM-S928B, Android 14), founder, 6 Nov 2026 | **0.5 s** (0.5, 0.5, 0.4); verified on the phone; key loading 3.0 s once | 3.0 s (28 Oct 2026) |

On this phone the native prover is about **6 times faster** than the browser.

| Phone | Enrolment proof π_doc (577,678 constraints, TEST-ONLY random key) |
|---|---|
| **Samsung Galaxy S24 Ultra**, founder, 6 Nov 2026 | **3.0 s**, verified on the phone; reading the compressed key and matrices 34.8 s; peak memory of the whole app 1,197 MB |
| Same phone, second run with the uncompressed key kept (6 Nov 2026) | **2.8 s**, verified; reading the key and matrices **1.8 s**; peak memory of the app 1,213 MB (the peak since the app started, so it includes the first run) |

## Enrolment proof π_doc on the phone (benchmark, v0.3 of the app)

The app's second button proves π_doc (577,678 constraints) with `ArkCircuit`: a proving key made by arkworks itself (random TEST-ONLY setup with `../prove-bench`'s `prove-mem`, compressed points, 125 MB), the constraint matrices (gzip, 14 MB) and a precomputed witness of a synthetic document. All three are made by the build workflow from the repository's sources. On the server: proving 5.6 s, peak memory 0.9 GB (`doc-bench`). Decompressing the key's points takes about 30 s, so after the first use the app keeps an uncompressed copy (250 MB) and later reads it in about 1.3 s (`ArkCircuit::load_cached`). The witness on a phone, and a smaller download, are the next steps (N31).

## Enrolment proof from a real passport's data (v0.5 of the app; Decision Log #57, challenge 2)

`ArkCircuit::prove_inputs(graph, inputs)` makes π_doc (suite 2, 749,147 constraints) from circuit inputs, as the phone needs it:

1. the witness from the circuit's witness graph (`document_s2.graph`, 31 MB, made by the workflow; see [document-circuit](../document-circuit/README.md#on-the-phone-challenge-2-of-decision-log-57)), no WebAssembly;
2. a check of every constraint against that witness (`first_unsatisfied`): a witness graph only computes values, so a document the circuit rejects is reported here, before any proving, with the number of the first failing constraint;
3. the Groth16 proof and its verification.

`with_test_tree(tree_graph, inputs)` fills in the root and path of the TEST-ONLY one-signer tree when the inputs carry no `dscRoot` (graph of `../document-circuit/circuits/test/dsc_test_tree_s2.circom`). The app calls both through `NativeProver.proveDocInputs`.

Measured with `doc-prove` on a server (2 cores, TEST-ONLY random key), synthetic passports with exponents 3, 37817 and 65537 built by the app's own Kotlin input builder: **witness 0.3 s, proof 5.5–5.9 s, verified**; peak memory 1.1 GB; reading the compressed key the first time 43 s, then 2.2 s from the uncompressed copy. One altered DG1 byte is rejected by the constraint check.

## Files

- `src/lib.rs` — `Circuit::load(zkey, graph)`, `prove`, `prove_checked`, and the JNI entry point `NativeProver.prove` for the Android app.
- `src/bin/doc-bench.rs` — `doc-bench <pk_c.bin> <matrices.gz> <witness.wtns>`, the π_doc benchmark on a computer (precomputed witness, v0.3 of the app).
- `src/bin/doc-prove.rs` — `doc-prove <pk_c.bin> <matrices.gz> <document_s2.graph> <dsc_test_tree_s2.graph> <inputs.json>`: π_doc from inputs, as the app does it.
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

### iPhone (Decision Log #56)

Swift calls the prover through a C interface, [`include/poo_native_prover.h`](include/poo_native_prover.h): `poo_prove(graph, graph_len, zkey, zkey_len, inputs_json)` returns the same JSON as the Android call, and `poo_string_free` releases it. [`test/ffi_test.c`](test/ffi_test.c) proves a synthetic ballot ([`test/ballot_input_synthetic.json`](test/ballot_input_synthetic.json)) twice through this interface, checks that both proofs verify, and checks that bad input returns an error. On a Linux server (2 cores): first proof 0.86 s after loading the key in 3.3 s, second 0.92 s with the key already loaded.

```sh
cargo build --release --lib
cc -I include test/ffi_test.c -L target/release -lpoo_native_prover -o ffi_test
LD_LIBRARY_PATH=target/release ./ffi_test graphs/ballot.graph ../ballot-circuit/setup/ballot_test.zkey test/ballot_input_synthetic.json
```

GitHub Actions builds static libraries for iPhones and the iPhone simulator, packs them into an XCFramework, and runs the same test on a Mac and inside an iPhone simulator ([workflow](../../.github/workflows/ios-core.yml)). No Apple account is needed for this. First successful run (12 November 2026, run #2): both proofs verified inside the iPhone simulator; there the key loaded in 8.5 s and the proofs took 3.4 s and 8.1 s. A simulator on a shared cloud Mac is much slower and less steady than a phone, so these times say nothing about speed on a real iPhone; they show only that the core builds and proves correctly on Apple's platforms. Publishing the app is a separate question ([research note](../../docs/research/iphone-app-v0.1.md)).

## Open points

- **Enrolment proof π_doc**: proving now needs about 1.1 GB (suite 2) and the files about 220 MB (compressed key 153 MB, matrices 34 MB, witness graph 31 MB). Still too much for 2 GB phones; options in implementation note N31.
- **Test tree**: the one-signer tree is for tests only; the pilot needs the published tree of checked signers and a way for the phone to get its path.
- **Key loading** (3.9 s on the server) can be cut by storing the key in arkworks' own format at installation.
- Dependencies pinned in `Cargo.lock`; not yet reviewed (`cargo audit`).

Licence: Apache-2.0. Written by the Proof of One AI agents Psephos and Prosopon (see [AGENTS.md](../../AGENTS.md)).
