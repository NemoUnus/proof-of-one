// SPDX-License-Identifier: Apache-2.0
// Tests for the recovery-ballot proof π_recover (Decision Log #52, point 2).
// Uses a TEST-ONLY trusted setup: bash scripts/setup-recovery-test.sh
//
// Story: Alice is a member when poll X opens. Her phone is stolen; the thief votes in X.
// Alice recovers: her old identity is revoked, and the enclave issues a new identity whose
// revocation handle is Poseidon(14, rn_old, ρ). With the backup of her old secret, Alice
// makes a recovery ballot that replaces the thief's ballot under the old nullifier.
"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const crypto = require("crypto");
const path = require("path");
const fs = require("fs");
const snarkjs = require("snarkjs");
const { create } = require("../../tally/src/protocol");
const B = require("../src/ballot");
const R = require("../src/recovery");
const A = require("../src/attrs");
const { IncrementalTree, RevocationTree } = require("../src/trees");

const ZKEY = path.join(__dirname, "..", "setup", "recovery_test.zkey");
const VKEY = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "setup", "vkey_recovery_test.json"), "utf8"));
const POLICY = { ...A.ageRange([2026, 11, 14], { minAge: 18 }), minExpiryMonth: 24330, requiredNat: 0 };
const POLL = 3003n, CTX = 999n;
const handle = () => BigInt("0x" + crypto.randomBytes(31).toString("hex"));
const witnessFails = (input) => assert.rejects(snarkjs.wtns.calculate(input, R.WASM, { type: "mem" }));

let P, keys, ids, snapTree, revTree, alice, aliceNew, bob, bobNew, args;

test.before(async () => {
  P = await create();
  const C = P.curve, member = (o = {}) => ({ s: C.randScalar(), birthDay: A.dayNumber(1980, 5, 5), sexCode: 2, docs: [{ nat: 250, expiry: 24400 }], salt: C.randScalar(), rn: handle(), ...o });
  keys = P.dkg(3, 2);
  ids = new IncrementalTree(P.hash.H, B.DEPTH);
  revTree = new RevocationTree(P.hash.H, B.REV_DEPTH);
  alice = member(); bob = member({ birthDay: A.dayNumber(1990, 1, 1) });
  for (const m of [member(), alice, member(), bob]) m.index = ids.insert(B.memberLeaf(P, m));
  // poll X opens: its membership snapshot
  snapTree = new IncrementalTree(P.hash.H, B.DEPTH);
  for (const l of ids.leaves) snapTree.insert(l);
  // Alice recovers: old identity revoked, new identity linked through its revocation handle
  revTree.revoke(alice.rn);
  const link = R.recoveredHandle(P, alice.rn);
  aliceNew = { ...member({ birthDay: alice.birthDay }), rn: link.rn, rho: link.rho };
  aliceNew.index = ids.insert(B.memberLeaf(P, aliceNew));
  // Bob enrols a new identity of his own (random handle, no link) to try to replace Alice's ballot
  bobNew = { ...member(), rho: C.randScalar() };
  bobNew.index = ids.insert(B.memberLeaf(P, bobNew));
  args = { pollId: POLL, PK: keys.PK, policy: POLICY, ctxHash: CTX, oldMember: alice, oldIndex: alice.index, snapTree, newMember: aliceNew, newIndex: aliceNew.index, curTree: ids, revTree, choice: 2 };
});

test("the link: the new handle is below 2^252 and does not equal the old one", () => {
  assert.ok(aliceNew.rn < (1n << 252n));
  assert.notEqual(aliceNew.rn, alice.rn);
  assert.equal(P.hash.H([14n, alice.rn, aliceNew.rho]), aliceNew.rn);
});

test("Alice's recovery ballot proves and verifies, under her OLD nullifier", async () => {
  const b = R.buildRecovery(P, args);
  assert.equal(b.nf, P.nullifier(POLL, alice.s));
  const { proof, publicSignals } = await R.prove(b.input, ZKEY);
  const expected = R.publicSignals(P, { idRoot: snapTree.root, revRoot: revTree.root, idRootNow: ids.root, pollId: POLL, nf: b.nf, PK: keys.PK, policy: POLICY, ctxHash: CTX, C: b.C });
  assert.deepEqual(publicSignals, expected);
  assert.equal(await R.verify(VKEY, expected, proof), true);
  // the same proof does not verify for another poll or another current identity root
  const other = R.publicSignals(P, { idRoot: snapTree.root, revRoot: revTree.root, idRootNow: ids.root, pollId: POLL + 1n, nf: b.nf, PK: keys.PK, policy: POLICY, ctxHash: CTX, C: b.C });
  assert.equal(await R.verify(VKEY, other, proof), false);
  const stale = [...expected.slice(0, -1), snapTree.root.toString()];
  assert.equal(await R.verify(VKEY, stale, proof), false);
});

test("the thief cannot: it holds the old secret but no linked new identity", async () => {
  // with Bob's unlinked new identity (and any ρ), the link fails
  await witnessFails(R.buildRecovery(P, { ...args, newMember: bobNew, newIndex: bobNew.index }).input);
  // with Alice's new leaf but a wrong ρ
  await witnessFails({ ...R.buildRecovery(P, args).input, rho: "12345" });
  // with Alice's new leaf but not her new secret
  await witnessFails({ ...R.buildRecovery(P, args).input, sNew: bob.s.toString() });
});

test("Bob cannot replace Alice's ballot with his own linked identity", async () => {
  // Bob's own recovery would link to Bob's old handle, not Alice's: using Alice's old
  // identity requires her old secret, and her rn_old must hash to his rn_new
  const bobLink = R.recoveredHandle(P, bob.rn);
  const bobRec = { ...bobNew, rn: bobLink.rn, rho: bobLink.rho };
  const t = new IncrementalTree(P.hash.H, B.DEPTH); for (const l of ids.leaves) t.insert(l);
  bobRec.index = t.insert(B.memberLeaf(P, bobRec));
  await witnessFails(R.buildRecovery(P, { ...args, newMember: bobRec, newIndex: bobRec.index, curTree: t }).input);
});

test("a revoked new identity cannot make recovery ballots", async () => {
  const rt = new RevocationTree(P.hash.H, B.REV_DEPTH);
  rt.revoke(alice.rn); rt.revoke(aliceNew.rn);
  assert.throws(() => R.buildRecovery(P, { ...args, revTree: rt }), /revoked/);
  // a forged non-membership witness from the old tree does not match the current root
  const forged = { ...R.buildRecovery(P, args).input, revRoot: rt.root.toString() };
  await witnessFails(forged);
});

test("the old identity must be in the poll's snapshot", async () => {
  // Alice's NEW identity was not a member when X opened: it cannot pose as the old one
  await witnessFails(R.buildRecovery(P, { ...args, oldMember: { ...aliceNew }, oldIndex: aliceNew.index }).input);
});

test("eligibility of the old identity is checked as in π_vote", async () => {
  const strict = { ...POLICY, requiredNat: 124 };   // Alice's document is FRA (250)
  await witnessFails(R.buildRecovery(P, { ...args, policy: strict, docIndex: 0 }).input);
});
