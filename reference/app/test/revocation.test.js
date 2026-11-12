// SPDX-License-Identifier: Apache-2.0
// The phone's revocation rebuild (web/revocation.js) must give the same trees, witnesses and
// pollHash as the reference code the ballot proofs are tested with (ballot-circuit/src).
// Usage: node test/revocation.test.js  (poseidon-lite must be resolvable; see README)
"use strict";
const assert = require("assert");
const path = require("path");
const R = require("../web/revocation.js");
const ROOT = process.env.REF_ROOT || path.join(__dirname, "..", "..");
const { create } = require(path.join(ROOT, "tally/src/protocol"));
const B = require(path.join(ROOT, "ballot-circuit/src/ballot"));
const { RevocationTree } = require(path.join(ROOT, "ballot-circuit/src/trees"));
(async () => {
  const P = await create(), H = P.hash.H;
  const ref = new RevocationTree(H, B.REV_DEPTH);
  assert.strictEqual(R.rebuild([]).root, ref.root, "empty tree");
  const handles = [], rnd = () => P.curve.randScalar() % (1n << 250n) + 1n;
  for (let n = 0; n < 6; n++) { const h = rnd(); handles.push(h); ref.revoke(h); }
  const t = R.rebuild(handles);
  assert.strictEqual(t.root, ref.root, "root after 6 revocations");
  const member = rnd(), a = t.nonMembership(member), b = ref.nonMembership(member);
  assert.deepStrictEqual([a.lowValue, a.nextValue, a.siblings, a.pathIndex.map(BigInt)], [b.lowValue, b.nextValue, b.siblings, b.pathIndex.map(BigInt)], "witness");
  assert.strictEqual(t.nonMembership(handles[2]), null, "a revoked handle has no witness");
  const input = { idRoot: rnd().toString(), pollId: "1", PK: [rnd().toString(), rnd().toString()], maxBirthDay: "20000", minBirthDay: "0", minExpiryMonth: "24330", requiredNat: "0", ctxHash: rnd().toString(), rn: member.toString() };
  const refHash = H([7n, H([BigInt(input.idRoot), ref.root, 1n, BigInt(input.PK[0]), BigInt(input.PK[1])]), H([20000n, 0n, 24330n, 0n, BigInt(input.ctxHash)])]);
  assert.strictEqual(R.pollHash(input, ref.root), refHash, "pollHash");
  const r = R.refresh(input, handles, ref.root);
  assert.strictEqual(r.input.revRoot, ref.root.toString());
  assert.deepStrictEqual(R.refresh({ ...input, rn: handles[0].toString() }, handles), { revoked: true });
  assert.throws(() => R.refresh(input, handles.slice(1), ref.root), /does not match/);
  console.log("REVOCATION REBUILD OK (6 revocations; root, witness and pollHash match the reference code)");
  if (globalThis.curve_bn128) await globalThis.curve_bn128.terminate();
})().catch((e) => { console.error(e); process.exit(1); });
