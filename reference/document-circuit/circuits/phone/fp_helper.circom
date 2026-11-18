// SPDX-License-Identifier: Apache-2.0
// Proof of One — the Poseidon hashes the phone needs for the keyed fingerprints
// (docs/specs/document-fingerprint-oprf-v0.1.md), compiled to a witness graph so that the
// phone's native code computes them with exactly the code of π_doc and of the service:
//   pt, dt: the two field elements t_0, t_1 of HashToCurve for the person and document keys;
//   qc:     the challenges of the service's two DLEQ proofs, H(DST_DLEQ, K, B, Z, T1, T2),
//           before reduction modulo ℓ.
// All curve arithmetic is done natively (reference/native-prover/src/fingerprint.rs).
pragma circom 2.1.6;
include "circomlib/circuits/poseidon.circom";

template FpHelper() {
    signal input pTag;
    signal input pVals[5];
    signal input dTag;
    signal input dVals[5];
    signal input q[2][10];   // K, B, Z, T1, T2, as coordinates
    signal output pt[2];
    signal output dt[2];
    signal output qc[2];
    var DST_H2C = 30094232237006380571442476825519183475862119910307377;  // "PoO-fingerprint-h2c-v1"
    var DST_DLEQ = 7704123452673633426289274067332910969819640578532275761; // "PoO-fingerprint-dleq-v1"

    component hp[2];
    component hd[2];
    for (var i = 0; i < 2; i++) {
        hp[i] = Poseidon(8);
        hd[i] = Poseidon(8);
        hp[i].inputs[0] <== DST_H2C; hd[i].inputs[0] <== DST_H2C;
        hp[i].inputs[1] <== pTag;    hd[i].inputs[1] <== dTag;
        for (var j = 0; j < 5; j++) { hp[i].inputs[2 + j] <== pVals[j]; hd[i].inputs[2 + j] <== dVals[j]; }
        hp[i].inputs[7] <== i;       hd[i].inputs[7] <== i;
        pt[i] <== hp[i].out;
        dt[i] <== hd[i].out;
    }
    component hq[2];
    for (var i = 0; i < 2; i++) {
        hq[i] = Poseidon(11);
        hq[i].inputs[0] <== DST_DLEQ;
        for (var j = 0; j < 10; j++) hq[i].inputs[1 + j] <== q[i][j];
        qc[i] <== hq[i].out;
    }
}

component main = FpHelper();
