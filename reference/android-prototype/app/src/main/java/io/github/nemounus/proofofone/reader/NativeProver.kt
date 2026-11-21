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

    /**
     * Enrolment proof π_doc from circuit inputs (challenge 2): the witness from the circuit's
     * witness graph, a check of every constraint, the proof, and its verification. Inputs
     * without `dscRoot` get the TEST-ONLY tree holding the document's own signer alone
     * (treeGraphPath). Returns {"verified", "public", "testTree", "loadMs", "witnessMs",
     * "proveMs", "peakMb"} or {"error"}.
     */
    external fun proveDocInputs(pkPath: String, matricesPath: String, graphPath: String, treeGraphPath: String, inputs: String): String

    // Keyed fingerprints (docs/specs/document-fingerprint-oprf-v0.1.md), with the Poseidon
    // helper graph fp_helper.graph. Round 1: {"pB","dB","secret"}; keep "secret" in memory.
    // With a DG13 rule: DG13 as hex and the field's tag; otherwise "" and 0.
    external fun fpPrepare(helperGraphPath: String, dg1Hex: String, currentYear: Int, path: Int, dg13Hex: String, pnTag: Int): String
    // Round 2: checks the service's DLEQ proofs; returns π_doc's fingerprint inputs.
    external fun fpComplete(helperGraphPath: String, prepare: String, serviceKey: String, answer: String): String
    // The member's secrets for a new identity, from random bytes (hex, at least 192 bytes):
    // {"s","salt","rho","idc","cm","cn"} (enrolment.js newMember). Only cm leaves the phone.
    external fun memberNew(randHex: String): String
    // Decision #59, after fpComplete: {"numberSeed","backupSeed","memberNumber"} from the
    // person key's OPRF value, which only the phone obtains.
    external fun fpMember(prep: String, answer: String): String
    // TEST ONLY: the answer of a synthetic service holding key k, until the real service exists.
    external fun fpTestService(helperGraphPath: String, k: String, pB: String, dB: String): String
}
