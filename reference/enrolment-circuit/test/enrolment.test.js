// SPDX-License-Identifier: Apache-2.0
// Tests for unlinkable registration (π_reg), the registry rules and revocation,
// including a cross-check that registered members can then cast a valid ballot
// proof (π_vote). Uses TEST-ONLY trusted setups.
"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("path");
const fs = require("fs");
const crypto = require("crypto");
const snarkjs = require("snarkjs");
const { create } = require("../../tally/src/protocol");
const E = require("../src/enrolment");
const B = require("../../ballot-circuit/src/ballot");
const A = require("../../ballot-circuit/src/attrs");

const ZKEY = path.join(__dirname, "..", "setup", "registration_test.zkey");
const VKEY = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "setup", "vkey_test.json"), "utf8"));
const BALLOT_ZKEY = path.join(__dirname, "..", "..", "ballot-circuit", "setup", "ballot_test.zkey");
const BALLOT_VKEY = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "..", "ballot-circuit", "setup", "vkey_test.json"), "utf8"));
const ATTRS = { birthDay: A.dayNumber(1988, 4, 12), natCode: 250, sexCode: 2, expiryMonth: 24400 };

let P, enclave;
const fp = () => BigInt("0x" + crypto.randomBytes(31).toString("hex")); // stands for a recognised person
const witnessFails = (input) => assert.rejects(snarkjs.wtns.calculate(input, E.WASM, { type: "mem" }));

test.before(async () => {
  P = await create();
  await E.init();
  enclave = E.createEnclave(P, { epochs: 4 });
});
test.after(async () => { if (globalThis.curve_bn128) await globalThis.curve_bn128.terminate(); });

async function enrol(registry, { fingerprint = fp(), attrs = ATTRS, epoch = 1, reenrol = false } = {}) {
  const m = E.newMember(P, attrs);
  const { credential, revokeOld } = enclave.issue({ fingerprint, attrs, cm: m.cm, epoch, reenrol });
  const { input, leaf, member } = E.buildRegistration(P, enclave, m, credential);
  const { proof } = await E.prove(input, ZKEY);
  await registry.register({ leaf, cn: member.cn, proof });
  return { member, leaf, proof, revokeOld, fingerprint };
}
const newRegistry = (minBatch = 3) => E.createRegistry(P, { vkey: VKEY, keySetRoot: enclave.keySetRoot, minBatch });

test("honest registration is accepted; the proof reveals only leaf, cn and the key-set root", async () => {
  const reg = newRegistry();
  const r = await enrol(reg);
  assert.equal(reg.pendingCount, 1);
  // what the enclave saw contains neither the leaf nor the credential nullifier
  const seen = enclave.issuedLog.flatMap((x) => [x.cm, x.rn]);
  assert.ok(!seen.includes(r.leaf) && !seen.includes(r.member.cn));
});

test("a credential cannot be used twice", async () => {
  const reg = newRegistry();
  const r = await enrol(reg);
  await assert.rejects(reg.register({ leaf: r.leaf, cn: r.member.cn, proof: r.proof }), /already used/);
});

test("a forged enclave signature cannot be proven", async () => {
  const m = E.newMember(P, ATTRS);
  const { credential } = enclave.issue({ fingerprint: fp(), attrs: ATTRS, cm: m.cm });
  const { input } = E.buildRegistration(P, enclave, m, { ...credential, S: credential.S + 1n });
  await witnessFails(input);
});

test("a key outside the published key set cannot be used", async () => {
  const rogue = E.createEnclave(P, { epochs: 1 }); // different keys, not in the published tree
  const m = E.newMember(P, ATTRS);
  const { credential } = rogue.issue({ fingerprint: fp(), attrs: ATTRS, cm: m.cm });
  const { input } = E.buildRegistration(P, rogue, m, credential);
  await witnessFails({ ...input, keySetRoot: enclave.keySetRoot.toString() });
});

test("attributes cannot be changed after signing (e.g. an earlier date of birth)", async () => {
  const m = E.newMember(P, ATTRS);
  const { credential } = enclave.issue({ fingerprint: fp(), attrs: ATTRS, cm: m.cm });
  const { input } = E.buildRegistration(P, enclave, { ...m, birthDay: ATTRS.birthDay - 3650 }, credential);
  await witnessFails(input);
});

test("the revocation handle cannot be swapped for another value", async () => {
  const m = E.newMember(P, ATTRS);
  const { credential } = enclave.issue({ fingerprint: fp(), attrs: ATTRS, cm: m.cm });
  const { input } = E.buildRegistration(P, enclave, m, { ...credential, rn: credential.rn + 1n });
  await witnessFails(input);
});

test("same person cannot enrol twice without the re-enrolment path", async () => {
  const f = fp();
  enclave.issue({ fingerprint: f, attrs: ATTRS, cm: E.newMember(P, ATTRS).cm });
  assert.throws(() => enclave.issue({ fingerprint: f, attrs: ATTRS, cm: E.newMember(P, ATTRS).cm }), /already enrolled/);
});

test("leaves enter the identity tree only in batches of the minimum size", async () => {
  const reg = newRegistry(3);
  await enrol(reg); await enrol(reg);
  assert.equal(reg.insertBatch(), 0, "two pending leaves are not enough");
  await enrol(reg);
  assert.equal(reg.insertBatch(), 3);
  assert.equal(reg.pendingCount, 0);
});

test("end to end: register → batch → vote; re-enrolment revokes the old identity", async () => {
  const reg = newRegistry(3);
  const alice = await enrol(reg), bob = await enrol(reg), carol = await enrol(reg);
  reg.insertBatch();
  const keys = P.dkg(3, 2);
  const policy = { ...A.ageRange([2026, 10, 23], { minAge: 18 }), minExpiryMonth: 24330, requiredNat: 0 };
  const vote = async (who, pollId) => {
    const m = { ...who.member, index: reg.indexOf(who.leaf) };
    const b = B.buildBallot(P, { pollId, PK: keys.PK, policy, ctxHash: 1n, member: m, leafIndex: m.index, idTree: reg.idTree, revTree: reg.revTree, choice: 1 });
    const { proof } = await B.prove(b.input, BALLOT_ZKEY);
    const signals = B.publicSignals(P, { idRoot: reg.idTree.root, revRoot: reg.revTree.root, pollId, nf: b.nf, PK: keys.PK, policy, ctxHash: 1n, C: b.C });
    return B.verify(BALLOT_VKEY, signals, proof);
  };
  assert.equal(await vote(alice, 501n), true, "registered member can vote");

  // Alice loses her phone and her backup: she re-enrols; the enclave returns her old handle.
  const alice2 = await enrol(reg, { fingerprint: alice.fingerprint, reenrol: true });
  assert.equal(alice2.revokeOld, alice.member.rn);
  reg.revoke(alice2.revokeOld);
  await enrol(reg); await enrol(reg); // other people's registrations fill the batch
  reg.insertBatch();

  assert.throws(() => B.buildBallot(P, { pollId: 502n, PK: keys.PK, policy, ctxHash: 1n, member: { ...alice.member, index: reg.indexOf(alice.leaf) }, leafIndex: reg.indexOf(alice.leaf), idTree: reg.idTree, revTree: reg.revTree, choice: 0 }), /revoked/, "old identity can no longer vote");
  assert.equal(await vote(alice2, 502n), true, "new identity can vote");
  assert.equal(await vote(bob, 502n), true, "others are unaffected");
  void carol;
});
