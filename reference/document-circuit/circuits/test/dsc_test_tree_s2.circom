// SPDX-License-Identifier: Apache-2.0
// Proof of One — TEST ONLY: a DSC tree that holds a single signer, for suite 2.
//
// For testing π_doc on a phone with a real passport before the public trust list and its
// DSC tree are in place (Decision Log #57, challenge 2). Given the signer's key, outputs the
// root and the path of a depth-16 tree whose only leaf (index 0) is that key's leaf, with
// empty leaves 0, exactly as reference/ballot-circuit/src/trees.js builds trees and
// lib/document_core.circom (step 5) builds the leaf. Compiled to a witness graph, it lets
// the phone compute these Poseidon hashes with the same code that computes π_doc's witness.
//
// A proof made with such a tree shows nothing about whether the signer is trusted: in the
// pilot, the root must be the published root of the checked signers, and the path comes
// from the public list.
pragma circom 2.1.6;
include "circomlib/circuits/poseidon.circom";

template DscTestTree(K, ALG, depth) {
    signal input modulus[K];
    signal input exponent;
    signal output root;
    signal output siblings[depth];

    component m16 = Poseidon(16);
    for (var i = 0; i < 16; i++) m16.inputs[i] <== modulus[i];
    component mRest = Poseidon(K - 16 + 1);
    for (var i = 16; i < K; i++) mRest.inputs[i - 16] <== modulus[i];
    mRest.inputs[K - 16] <== exponent;
    component leaf = Poseidon(3);
    leaf.inputs[0] <== ALG;
    leaf.inputs[1] <== m16.out;
    leaf.inputs[2] <== mRest.out;

    // zeros[d]: the root of an empty subtree of height d; the leaf's sibling at level d.
    component z[depth];
    component up[depth];
    signal zero[depth + 1];
    signal cur[depth + 1];
    zero[0] <== 0;
    cur[0] <== leaf.out;
    for (var d = 0; d < depth; d++) {
        siblings[d] <== zero[d];
        up[d] = Poseidon(2);
        up[d].inputs[0] <== cur[d];
        up[d].inputs[1] <== zero[d];
        cur[d + 1] <== up[d].out;
        z[d] = Poseidon(2);
        z[d].inputs[0] <== zero[d];
        z[d].inputs[1] <== zero[d];
        zero[d + 1] <== z[d].out;
    }
    root <== cur[depth];
}

component main = DscTestTree(26, 2, 16);
