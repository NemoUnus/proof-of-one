// SPDX-License-Identifier: Apache-2.0
// Decision Log #30: one person, one identity, several verified nationalities.
// A member adds a further document to their existing identity; the enclave issues an
// updated credential and the old handle is revoked. Uses TEST-ONLY trusted setups.
"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("path");
const fs = require("fs");
const crypto = require("crypto");
const { create } = require("../../tally/src/protocol");
const E = require("../src/enrolment");
const B = require("../../ballot-circuit/src/ballot");
const A = require("../../ballot-circuit/src/attrs");

const ZKEY = path.join(__dirname, "..", "setup", "registration_test.zkey");
const VKEY = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "setup", "vkey_test.json"), "utf8"));
const BALLOT_ZKEY = path.join(__dirname, "..", "..", "ballot-circuit", "setup", "ballot_test.zkey");
const BALLOT_VKEY = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "..", "ballot-circuit", "setup", "vkey_test.json"), "utf8"));
const FIRST = { ageBand: 3, sexCode: 2, docs: [{ nat: 250, expiry: 24400 }] };
const SECOND = { nat: 124, expiry: 24500 };

let P, enclave;
const fp = () => BigInt("0x" + crypto.randomBytes(31).toString("hex"));

test.before(async () => {
  P = await create();
  await E.init();
  enclave = E.createEnclave(P, { epochs: 4 });
});
test.after(async () => { if (globalThis.curve_bn128) await globalThis.curve_bn128.terminate(); });

const newRegistry = () => E.createRegistry(P, { vkey: VKEY, keySetRoot: enclave.keySetRoot, minBatch: 1 });
async function register(reg, member, credential) {
  const { input, leaf, member: m } = E.buildRegistration(P, enclave, member, credential);
  const { proof } = await E.prove(input, ZKEY);
  await reg.register({ leaf, cn: m.cn, proof });
  return { leaf, member: m };
}

test("adding a second nationality: one identity with both, old handle revoked, same nullifier", async () => {
  const reg = newRegistry();
  const person = fp();
  const m1 = E.newMember(P, FIRST);
  const first = enclave.issue({ fingerprint: person, docId: "passport-250", attrs: FIRST, cm: m1.cm, epoch: 1 });
  const a = await register(reg, m1, first.credential);

  // The phone refreshes its commitment (same secret s), the enclave checks the new
  // passport and the face, and certifies both nationalities.
  const r = E.refreshMember(P, a.member, {});
  const added = enclave.addDocument({ fingerprint: person, docId: "passport-124", doc: SECOND, cm: r.cm, epoch: 2 });
  assert.deepEqual(A.docsOf(added.attrs).map((d) => Number(d.nat)), [250, 124]);
  assert.equal(added.revokeOld, a.member.rn, "the old identity's handle is returned for revocation");
  const b = await register(reg, { ...r, ...added.attrs }, added.credential);
  reg.revoke(added.revokeOld);
  reg.insertBatch();

  assert.notEqual(b.leaf, a.leaf);
  assert.equal(P.nullifier(77n, b.member.s), P.nullifier(77n, a.member.s), "same person, same nullifier in every poll");
  // The enclave saw only commitments; it cannot link the new leaf to the old one.
  const seen = enclave.issuedLog.flatMap((x) => [x.cm, x.rn]);
  assert.ok(!seen.includes(a.leaf) && !seen.includes(b.leaf));

  // The updated identity can vote in the regional poll of either nationality.
  const keys = P.dkg(3, 2);
  const vote = async (who, pollId, requiredNat) => {
    const policy = { minAgeBand: 2, minExpiryMonth: 24330, requiredNat };
    const idx = reg.indexOf(who.leaf);
    const bl = B.buildBallot(P, { pollId, PK: keys.PK, policy, ctxHash: 1n, member: { ...who.member, index: idx }, leafIndex: idx, idTree: reg.idTree, revTree: reg.revTree, choice: 0 });
    const { proof } = await B.prove(bl.input, BALLOT_ZKEY);
    const signals = B.publicSignals(P, { idRoot: reg.idTree.root, revRoot: reg.revTree.root, pollId, nf: bl.nf, PK: keys.PK, policy, ctxHash: 1n, C: bl.C });
    return B.verify(BALLOT_VKEY, signals, proof);
  };
  assert.equal(await vote(b, 601n, 250), true, "region of the first nationality");
  assert.equal(await vote(b, 602n, 124), true, "region of the second nationality");
  assert.throws(() => B.buildBallot(P, { pollId: 603n, PK: keys.PK, policy: { minAgeBand: 2, minExpiryMonth: 24330, requiredNat: 124 }, ctxHash: 1n,
    member: { ...a.member, index: reg.indexOf(a.leaf) }, leafIndex: reg.indexOf(a.leaf), idTree: reg.idTree, revTree: reg.revTree, choice: 0 }), /revoked|no document/,
    "the old identity is revoked");
});

test("a document can be used only once, and only by its holder", () => {
  const person = fp(), other = fp();
  enclave.issue({ fingerprint: person, docId: "doc-A", attrs: FIRST, cm: E.newMember(P, FIRST).cm });
  enclave.issue({ fingerprint: other, docId: "doc-B", attrs: FIRST, cm: E.newMember(P, FIRST).cm });
  assert.throws(() => enclave.addDocument({ fingerprint: person, docId: "doc-B", doc: SECOND, cm: 1n }), /already used/, "someone else's document");
  assert.throws(() => enclave.addDocument({ fingerprint: person, docId: "doc-C", doc: SECOND, cm: 1n, faceMatches: false }), /not this member/, "face does not match");
  assert.throws(() => enclave.issue({ fingerprint: fp(), docId: "doc-A", attrs: FIRST, cm: 1n }), /already used/, "a used document cannot start a new identity");
  assert.throws(() => enclave.addDocument({ fingerprint: fp(), docId: "doc-D", doc: SECOND, cm: 1n }), /not enrolled/);
});

test("renewal replaces the document of the same nationality; at most three documents", () => {
  const renewed = A.withDocument(FIRST, { nat: 250, expiry: 24600 });
  assert.deepEqual(A.docsOf(renewed).map((d) => [Number(d.nat), Number(d.expiry)]), [[250, 24600]]);
  let a = A.withDocument(FIRST, SECOND);
  a = A.withDocument(a, { nat: 36, expiry: 24400 });
  assert.equal(A.docsOf(a).length, 3);
  assert.throws(() => A.withDocument(a, { nat: 840, expiry: 24400 }), /at most 3/);
  assert.throws(() => A.docsOf({ ageBand: 3, sexCode: 1, docs: [{ nat: 250, expiry: 1 }, { nat: 250, expiry: 2 }] }), /one document per nationality/);
});
