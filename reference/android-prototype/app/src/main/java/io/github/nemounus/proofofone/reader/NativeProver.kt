// SPDX-License-Identifier: Apache-2.0
package io.github.nemounus.proofofone.reader

/**
 * Native Groth16 prover (reference/native-prover, Rust, loaded as libpoo_native_prover.so).
 * prove() returns JSON: {"proof":…, "public":…, "verified":true|false, "loadMs":n, "proveMs":n}
 * or {"error":"…"}. The proving key is read once per process and kept for later calls.
 */
object NativeProver {
    init { System.loadLibrary("poo_native_prover") }
    external fun prove(graph: ByteArray, zkey: ByteArray, inputs: String): String

    /** Enrolment proof π_doc benchmark (N31), from files: compressed key, gzip matrices, witness. */
    external fun proveDoc(pkPath: String, matricesPath: String, wtnsPath: String): String
}
