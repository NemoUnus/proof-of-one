// SPDX-License-Identifier: Apache-2.0
// Proof of One — revocation update proof π_revoke (reference circuit).
// Replaces the on-chain path checks of RevocationRegistry.revoke (about 4 million gas,
// docs/specs/implementation-notes-v0.1.md §2) with one proof.
//
// The revocation tree is an indexed (sorted linked-list) Merkle tree: leaf = Poseidon(value, next),
// next = 0 meaning "end of list". Inserting a new handle rn:
//   1. 0 < rn < 2^252
//   2. the low leaf (lowValue, lowNext) is in the tree at oldRoot, at lowIndex,
//      with lowValue < rn and (lowNext == 0 or rn < lowNext) — so rn is not yet in the list
//   3. r1 = root after updating the low leaf to (lowValue, rn)
//   4. the slot at nextIndex is empty under r1 (prevents overwriting)
//   5. newRoot = root after writing (rn, lowNext) at nextIndex
//
// PUBLIC INPUTS: oldRoot, newRoot, rn, nextIndex.
// The contract supplies oldRoot and nextIndex from its own state; rn is emitted publicly.
// Reference circuit for review. Not audited.

pragma circom 2.1.0;

include "../node_modules/circomlib/circuits/poseidon.circom";
include "../node_modules/circomlib/circuits/bitify.circom";
include "../node_modules/circomlib/circuits/comparators.circom";

template PathRootBits(levels) {
    signal input leaf;
    signal input bits[levels];
    signal input siblings[levels];
    signal output root;
    component h[levels];
    signal cur[levels + 1];
    signal left[levels];
    signal right[levels];
    cur[0] <== leaf;
    for (var i = 0; i < levels; i++) {
        left[i]  <== cur[i] + bits[i] * (siblings[i] - cur[i]);
        right[i] <== siblings[i] + bits[i] * (cur[i] - siblings[i]);
        h[i] = Poseidon(2);
        h[i].inputs[0] <== left[i];
        h[i].inputs[1] <== right[i];
        cur[i + 1] <== h[i].out;
    }
    root <== cur[levels];
}

template Revoke(depth) {
    signal input oldRoot;
    signal input newRoot;
    signal input rn;
    signal input nextIndex;
    signal input lowValue;
    signal input lowNext;
    signal input lowIndex;
    signal input lowSiblings[depth];
    signal input newSiblings[depth];

    // 1. range
    component rnBits = Num2Bits(252);
    rnBits.in <== rn;
    component rnZero = IsZero();
    rnZero.in <== rn;
    rnZero.out === 0;

    // 2. gap in the sorted list
    component lt1 = LessThan(252);
    lt1.in[0] <== lowValue;
    lt1.in[1] <== rn;
    lt1.out === 1;
    component nextZero = IsZero();
    nextZero.in <== lowNext;
    component lt2 = LessThan(252);
    lt2.in[0] <== rn;
    lt2.in[1] <== lowNext;
    (1 - nextZero.out) * (1 - lt2.out) === 0;

    component lowBits = Num2Bits(depth);
    lowBits.in <== lowIndex;
    component newBits = Num2Bits(depth);
    newBits.in <== nextIndex;

    component lowLeaf = Poseidon(2);
    lowLeaf.inputs[0] <== lowValue;
    lowLeaf.inputs[1] <== lowNext;
    component lowUpd = Poseidon(2);
    lowUpd.inputs[0] <== lowValue;
    lowUpd.inputs[1] <== rn;
    component newLeaf = Poseidon(2);
    newLeaf.inputs[0] <== rn;
    newLeaf.inputs[1] <== lowNext;

    component p0 = PathRootBits(depth);   // low leaf under oldRoot
    component p1 = PathRootBits(depth);   // updated low leaf → r1
    component p2 = PathRootBits(depth);   // empty slot under r1
    component p3 = PathRootBits(depth);   // new leaf → newRoot
    p0.leaf <== lowLeaf.out;
    p1.leaf <== lowUpd.out;
    p2.leaf <== 0;
    p3.leaf <== newLeaf.out;
    for (var i = 0; i < depth; i++) {
        p0.bits[i] <== lowBits.out[i];  p0.siblings[i] <== lowSiblings[i];
        p1.bits[i] <== lowBits.out[i];  p1.siblings[i] <== lowSiblings[i];
        p2.bits[i] <== newBits.out[i];  p2.siblings[i] <== newSiblings[i];
        p3.bits[i] <== newBits.out[i];  p3.siblings[i] <== newSiblings[i];
    }
    p0.root === oldRoot;
    p2.root === p1.root;
    p3.root === newRoot;
}

component main {public [oldRoot, newRoot, rn, nextIndex]} = Revoke(32);
