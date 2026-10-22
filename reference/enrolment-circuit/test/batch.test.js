// SPDX-License-Identifier: Apache-2.0
// Tests for the batch insertion proof π_batch (TEST-ONLY setup).
"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("path");
const fs = require("fs");
const snarkjs = require("snarkjs");
const { create } = require("../../tally/src/protocol");
const E = require("../src/enrolment");
const { IncrementalTree } = require("../../ballot-circuit/src/trees");

const ZKEY = path.join(__dirname, "..", "setup", "batch_test.zkey");
const VKEY = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "setup", "vkey_batch_test.json"), "utf8"));
let P, H;
const rand = () => P.curve.randScalar();
const witnessFails = (input) => assert.rejects(snarkjs.wtns.calculate(input, E.BATCH_WASM, { type: "mem" }));
const pub = (i) => [i.oldRoot, i.newRoot, i.startIndex, i.leavesHash];

test.before(async () => { P = await create(); H = P.hash.H; });
test.after(async () => { if (globalThis.curve_bn128) await globalThis.curve_bn128.terminate(); });

test("honest batches: proofs verify and the new root equals the reference tree", async () => {
  const tree = new IncrementalTree(H, 32);
  for (let round = 0; round < 2; round++) {
    const leaves = [rand(), rand(), rand(), rand()];
    const { input, newRoot } = E.buildBatchInsert(P, tree, leaves);
    const { proof } = await E.proveBatch(input, ZKEY);
    assert.equal(await snarkjs.groth16.verify(VKEY, pub(input), proof), true);
    for (const l of leaves) tree.insert(l);
    assert.equal(newRoot, tree.root);
  }
});

test("existing leaves cannot be overwritten (the target subtree must be empty)", async () => {
  const tree = new IncrementalTree(H, 32);
  for (let i = 0; i < 4; i++) tree.insert(rand());
  const { input } = E.buildBatchInsert(P, tree, [rand(), rand(), rand(), rand()]);
  // claim the batch goes to index 0, where four leaves already are
  await witnessFails({ ...input, startIndex: "0" });
});

test("a batch must start at an aligned index", async () => {
  const tree = new IncrementalTree(H, 32);
  const { input } = E.buildBatchInsert(P, tree, [rand(), rand(), rand(), rand()]);
  await witnessFails({ ...input, startIndex: "2" });
});

test("the leaves are bound to the registered chain hash, including their order", async () => {
  const tree = new IncrementalTree(H, 32);
  const leaves = [rand(), rand(), rand(), rand()];
  const { input } = E.buildBatchInsert(P, tree, leaves);
  await witnessFails({ ...input, leavesHash: (BigInt(input.leavesHash) + 1n).toString() });
  // a prover who reorders the leaves produces a valid proof for a DIFFERENT chain hash,
  // which fails against the chain hash the contract recorded at registration
  const swapped = [leaves[1], leaves[0], leaves[2], leaves[3]];
  const r = E.buildBatchInsert(P, tree, swapped);
  const { proof } = await E.proveBatch(r.input, ZKEY);
  const contractHash = E.leavesHash(H, leaves).toString();
  assert.equal(await snarkjs.groth16.verify(VKEY, [r.input.oldRoot, r.input.newRoot, r.input.startIndex, contractHash], proof), false);
});
