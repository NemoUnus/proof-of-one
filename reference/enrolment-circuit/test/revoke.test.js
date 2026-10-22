// SPDX-License-Identifier: Apache-2.0
// Tests for the revocation update proof π_revoke (TEST-ONLY setup).
"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("path");
const fs = require("fs");
const crypto = require("crypto");
const snarkjs = require("snarkjs");
const { create } = require("../../tally/src/protocol");
const E = require("../src/enrolment");
const { RevocationTree } = require("../../ballot-circuit/src/trees");

const ZKEY = path.join(__dirname, "..", "setup", "revoke_test.zkey");
const VKEY = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "setup", "vkey_revoke_test.json"), "utf8"));
let P;
const handle = () => BigInt("0x" + crypto.randomBytes(31).toString("hex"));
const pub = (i) => [i.oldRoot, i.newRoot, i.rn, i.nextIndex];
const witnessFails = (input) => assert.rejects(snarkjs.wtns.calculate(input, E.REVOKE_WASM, { type: "mem" }));

test.before(async () => { P = await create(); });
test.after(async () => { if (globalThis.curve_bn128) await globalThis.curve_bn128.terminate(); });

test("honest revocations: proofs verify and roots match the reference tree", async () => {
  const rt = new RevocationTree(P.hash.H, 32);
  for (const rn of [handle(), handle(), 5n]) { // includes a value smaller than the others
    const { input, newRoot } = E.buildRevoke(P, rt, rn);
    const { proof } = await E.proveRevoke(input, ZKEY);
    assert.equal(await snarkjs.groth16.verify(VKEY, pub(input), proof), true);
    rt.revoke(rn);
    assert.equal(newRoot, rt.root);
  }
});

test("a handle cannot be revoked twice", async () => {
  const rt = new RevocationTree(P.hash.H, 32);
  const rn = handle();
  const first = E.buildRevoke(P, rt, rn).input;
  rt.revoke(rn);
  assert.throws(() => E.buildRevoke(P, rt, rn), /already revoked/);
  // replaying the old witness against the new root fails
  await witnessFails({ ...first, oldRoot: rt.root.toString() });
});

test("the new entry cannot overwrite an occupied slot", async () => {
  const rt = new RevocationTree(P.hash.H, 32);
  rt.revoke(handle());
  const { input } = E.buildRevoke(P, rt, handle());
  await witnessFails({ ...input, nextIndex: "1" }); // slot 1 is taken
});

test("out-of-range or zero handles are rejected", async () => {
  const rt = new RevocationTree(P.hash.H, 32);
  const { input } = E.buildRevoke(P, rt, handle());
  await witnessFails({ ...input, rn: "0" });
  await witnessFails({ ...input, rn: (1n << 252n).toString() });
});

test("a proof does not verify for a different new root", async () => {
  const rt = new RevocationTree(P.hash.H, 32);
  const { input } = E.buildRevoke(P, rt, handle());
  const { proof } = await E.proveRevoke(input, ZKEY);
  assert.equal(await snarkjs.groth16.verify(VKEY, [input.oldRoot, (BigInt(input.newRoot) + 1n).toString(), input.rn, input.nextIndex], proof), false);
});
