// SPDX-License-Identifier: Apache-2.0
// Proof of One — shared templates for the recovery-ballot circuit (copied unchanged from
// ballot.circom, which is left as it is so that the deployed ballot verifier stays valid).
pragma circom 2.1.0;

include "../node_modules/circomlib/circuits/poseidon.circom";
include "../node_modules/circomlib/circuits/babyjub.circom";
include "../node_modules/circomlib/circuits/escalarmulfix.circom";
include "../node_modules/circomlib/circuits/escalarmulany.circom";
include "../node_modules/circomlib/circuits/bitify.circom";
include "../node_modules/circomlib/circuits/comparators.circom";

// Base8 of Baby Jubjub (EIP-2494).
function GX() { return 5299619240641551281634865583518297030282874472190772894086521144482721001553; }
function GY() { return 16950150798460657717958625567821834550301663161624707787222815936182638968203; }

// Root of a binary Poseidon Merkle tree from a leaf and its path.
// pathIndex[i] = 0 if the current node is the left child at level i, 1 if right.
template MerkleRoot(depth) {
    signal input leaf;
    signal input siblings[depth];
    signal input pathIndex[depth];
    signal output root;

    component h[depth];
    signal cur[depth + 1];
    signal left[depth];
    signal right[depth];
    cur[0] <== leaf;
    for (var i = 0; i < depth; i++) {
        pathIndex[i] * (pathIndex[i] - 1) === 0;
        // left = idx ? sibling : cur ; right = idx ? cur : sibling
        left[i]  <== cur[i] + pathIndex[i] * (siblings[i] - cur[i]);
        right[i] <== siblings[i] + pathIndex[i] * (cur[i] - siblings[i]);
        h[i] = Poseidon(2);
        h[i].inputs[0] <== left[i];
        h[i].inputs[1] <== right[i];
        cur[i + 1] <== h[i].out;
    }
    root <== cur[depth];
}

// x·G for a 253-bit scalar x (fixed base).
template MulG() {
    signal input x;
    signal output out[2];
    component bits = Num2Bits(253);
    bits.in <== x;
    component m = EscalarMulFix(253, [GX(), GY()]);
    for (var i = 0; i < 253; i++) m.e[i] <== bits.out[i];
    out[0] <== m.out[0];
    out[1] <== m.out[1];
}

// x·P for a 253-bit scalar x and a variable point P.
template MulAny() {
    signal input x;
    signal input p[2];
    signal output out[2];
    component bits = Num2Bits(253);
    bits.in <== x;
    component m = EscalarMulAny(253);
    for (var i = 0; i < 253; i++) m.e[i] <== bits.out[i];
    m.p[0] <== p[0];
    m.p[1] <== p[1];
    out[0] <== m.out[0];
    out[1] <== m.out[1];
}

