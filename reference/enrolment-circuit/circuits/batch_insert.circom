// SPDX-License-Identifier: Apache-2.0
// Proof of One — batch insertion proof π_batch (reference circuit).
// Specification: docs/specs/contracts-v0.1.md §3 ("batch insertion with a proof"),
// motivated by docs/specs/implementation-notes-v0.1.md §2 (on-chain hashing costs
// about 1 million gas per leaf).
//
// STATEMENT
// A batch of exactly B = 2^k leaves is written into the EMPTY, B-aligned subtree that
// starts at `startIndex` of the depth-`depth` identity tree:
//   1. leavesHash = h_B where h_0 = 0 and h_i = Poseidon(h_{i-1}, leaf_i)
//      — the contract computes the same chain as leaves are registered, so the proof
//        cannot insert different leaves or change their order
//   2. startIndex is a multiple of B (low k bits are zero)
//   3. under oldRoot, the subtree at startIndex/B is the empty subtree (computed here,
//      not supplied by the prover, so existing leaves cannot be overwritten)
//   4. newRoot is the root after replacing that subtree with the batch's subtree
//
// PUBLIC INPUTS: oldRoot, newRoot, startIndex, leavesHash — four values, whatever B is.
// Reference circuit for review. Not audited.

pragma circom 2.1.0;

include "../node_modules/circomlib/circuits/poseidon.circom";
include "../node_modules/circomlib/circuits/bitify.circom";

template H2() {
    signal input a;
    signal input b;
    signal output out;
    component h = Poseidon(2);
    h.inputs[0] <== a;
    h.inputs[1] <== b;
    out <== h.out;
}

template PathRoot(levels) {
    signal input node;
    signal input bits[levels];
    signal input siblings[levels];
    signal output root;
    component h[levels];
    signal cur[levels + 1];
    signal left[levels];
    signal right[levels];
    cur[0] <== node;
    for (var i = 0; i < levels; i++) {
        left[i]  <== cur[i] + bits[i] * (siblings[i] - cur[i]);
        right[i] <== siblings[i] + bits[i] * (cur[i] - siblings[i]);
        h[i] = H2();
        h[i].a <== left[i];
        h[i].b <== right[i];
        cur[i + 1] <== h[i].out;
    }
    root <== cur[levels];
}

template BatchInsert(depth, k) {
    var B = 1 << k;
    signal input oldRoot;
    signal input newRoot;
    signal input startIndex;
    signal input leavesHash;
    signal input leaves[B];
    signal input siblings[depth - k];

    // 1. chain hash of the leaves, in order
    component chain[B];
    signal h[B + 1];
    h[0] <== 0;
    for (var i = 0; i < B; i++) {
        chain[i] = H2();
        chain[i].a <== h[i];
        chain[i].b <== leaves[i];
        h[i + 1] <== chain[i].out;
    }
    h[B] === leavesHash;

    // 2. alignment: startIndex < 2^depth and its low k bits are zero
    component idx = Num2Bits(depth);
    idx.in <== startIndex;
    for (var i = 0; i < k; i++) idx.out[i] === 0;

    // 3. root of the empty subtree of height k, computed in-circuit
    component z[k];
    signal zero[k + 1];
    zero[0] <== 0;
    for (var i = 0; i < k; i++) {
        z[i] = H2();
        z[i].a <== zero[i];
        z[i].b <== zero[i];
        zero[i + 1] <== z[i].out;
    }

    // subtree root of the batch
    component sub[B - 1];
    signal level[2 * B - 1];
    for (var i = 0; i < B; i++) level[i] <== leaves[i];
    var src = 0;
    var dst = B;
    var n = B;
    var c = 0;
    while (n > 1) {
        for (var i = 0; i < n / 2; i++) {
            sub[c] = H2();
            sub[c].a <== level[src + 2 * i];
            sub[c].b <== level[src + 2 * i + 1];
            level[dst + i] <== sub[c].out;
            c++;
        }
        src = dst;
        dst = dst + n / 2;
        n = n / 2;
    }

    // 3–4. same path for the old (empty) and the new subtree
    component oldPath = PathRoot(depth - k);
    component newPath = PathRoot(depth - k);
    oldPath.node <== zero[k];
    newPath.node <== level[2 * B - 2];
    for (var i = 0; i < depth - k; i++) {
        oldPath.bits[i] <== idx.out[k + i];
        newPath.bits[i] <== idx.out[k + i];
        oldPath.siblings[i] <== siblings[i];
        newPath.siblings[i] <== siblings[i];
    }
    oldPath.root === oldRoot;
    newPath.root === newRoot;
}

// Reference parameters: depth 32, batches of 4 leaves (k = 2). A deployment would use a
// much larger batch, e.g. k = 10 (1,024 leaves), matching the anonymity batch K.
component main {public [oldRoot, newRoot, startIndex, leavesHash]} = BatchInsert(32, 2);
