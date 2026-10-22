// SPDX-License-Identifier: Apache-2.0
// Tests for the ballot proof π_vote. Uses a TEST-ONLY trusted setup (setup/).
"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const crypto = require("crypto");
const path = require("path");
const fs = require("fs");
const snarkjs = require("snarkjs");
const { create } = require("../../tally/src/protocol");
const B = require("../src/ballot");
const { IncrementalTree, RevocationTree } = require("../src/trees");
const { createVerifiedPoll } = require("../src/submit");

const ZKEY = path.join(__dirname, "..", "setup", "ballot_test.zkey");
const VKEY = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "setup", "vkey_test.json"), "utf8"));
const POLICY = { minAgeBand: 2, minExpiryMonth: 24330, requiredNat: 0 };
const POLL = 1001n, CTX = 777n;

let P, keys, idTree, revTree, members;
const handle = () => BigInt("0x" + crypto.randomBytes(31).toString("hex")); // < 2^248
const witnessFails = async (input) => {
  await assert.rejects(snarkjs.wtns.calculate(input, B.WASM, { type: "mem" }));
};

test.before(async () => {
  P = await create();
  const C = P.curve;
  keys = P.dkg(3, 2);
  idTree = new IncrementalTree(P.hash.H, B.DEPTH);
  revTree = new RevocationTree(P.hash.H, B.REV_DEPTH);
  members = [
    { s: C.randScalar(), ageBand: 4, natCode: 250, sexCode: 1, expiryMonth: 24400, salt: C.randScalar(), rn: handle() },
    { s: C.randScalar(), ageBand: 1, natCode: 250, sexCode: 2, expiryMonth: 24400, salt: C.randScalar(), rn: handle() }, // under age band
    { s: C.randScalar(), ageBand: 5, natCode: 250, sexCode: 2, expiryMonth: 24400, salt: C.randScalar(), rn: handle() }, // will be revoked
  ];
  for (const m of members) m.index = idTree.insert(B.memberLeaf(P, m));
  revTree.revoke(handle());
  revTree.revoke(members[2].rn);
});

const ballotFor = (m, choice, extra = {}) =>
  B.buildBallot(P, { pollId: POLL, PK: keys.PK, policy: POLICY, ctxHash: CTX, member: m, leafIndex: m.index, idTree, revTree, choice, ...extra });

test("honest ballot: proof verifies against public inputs rebuilt by the verifier", async () => {
  const b = ballotFor(members[0], 2);
  const { proof } = await B.prove(b.input, ZKEY);
  const signals = B.publicSignals(P, { idRoot: idTree.root, revRoot: revTree.root, pollId: POLL, nf: b.nf, PK: keys.PK, policy: POLICY, ctxHash: CTX, C: b.C });
  assert.equal(await B.verify(VKEY, signals, proof), true);
});

test("cannot prove a two-hot ballot (1,1,0,0)", async () => {
  await witnessFails({ ...ballotFor(members[0], 0).input, v: ["1", "1", "0", "0"] });
});

test("cannot prove the vote-shifting ballot (+2,−1,0,0) from the tally tests", async () => {
  // −1 is represented as p − 1 in the BN254 scalar field, which is neither 0 nor 1
  const minusOne = (P.curve.F.p - 1n).toString();
  await witnessFails({ ...ballotFor(members[0], 0).input, v: ["2", minusOne, "0", "0"] });
});

test("cannot prove an empty ballot (0,0,0,0)", async () => {
  await witnessFails({ ...ballotFor(members[0], 0).input, v: ["0", "0", "0", "0"] });
});

test("ciphertexts must encrypt the proven choice", async () => {
  const b = ballotFor(members[0], 1);
  await witnessFails({ ...b.input, v: ["1", "0", "0", "0"] });
});

test("wrong nullifier cannot be proven", async () => {
  const b = ballotFor(members[0], 1);
  await witnessFails({ ...b.input, nf: (b.nf + 1n).toString() });
});

test("member not in the identity tree cannot vote", async () => {
  const C = P.curve;
  const outsider = { ...members[0], s: C.randScalar() };
  await witnessFails(ballotFor(outsider, 0).input);
});

test("revoked member cannot vote (no non-membership witness exists)", async () => {
  assert.throws(() => ballotFor(members[2], 0), /revoked/);
  // even with a forged low leaf, the circuit rejects it
  const good = ballotFor(members[0], 0).input;
  await witnessFails({ ...ballotFor(members[0], 0).input, rn: members[2].rn.toString(), lowValue: good.lowValue, nextValue: good.nextValue });
});

test("eligibility policy: member below the minimum age band cannot vote", async () => {
  await witnessFails(ballotFor(members[1], 0).input);
});

test("tampering with a public input after proving makes verification fail", async () => {
  const b = ballotFor(members[0], 3);
  const { proof } = await B.prove(b.input, ZKEY);
  const base = { idRoot: idTree.root, revRoot: revTree.root, pollId: POLL, nf: b.nf, PK: keys.PK, policy: POLICY, ctxHash: CTX, C: b.C };
  const swapped = [b.C[1], b.C[0], b.C[2], b.C[3]];
  assert.equal(await B.verify(VKEY, B.publicSignals(P, { ...base, C: swapped }), proof), false, "swapped ciphertexts");
  assert.equal(await B.verify(VKEY, B.publicSignals(P, { ...base, ctxHash: CTX + 1n }), proof), false, "other context");
  assert.equal(await B.verify(VKEY, B.publicSignals(P, { ...base, pollId: POLL + 1n }), proof), false, "other poll");
});

test("end to end: verified submissions, re-vote, tally and recount", async () => {
  const poll = createVerifiedPoll(P, { pollId: POLL, PK: keys.PK, policy: POLICY, idRoot: idTree.root, revRoot: revTree.root, eligible: 3, vkey: VKEY });
  const send = async (b) => {
    const { proof } = await B.prove(b.input, ZKEY);
    await poll.submit({ nf: b.nf, C: b.C, ctxHash: CTX, proof });
  };
  await send(ballotFor(members[0], 0));
  await send(ballotFor(members[0], 3)); // re-vote: only this one counts
  // a ballot whose proof belongs to different ciphertexts is rejected
  const b1 = ballotFor(members[0], 1), b2 = ballotFor(members[0], 2);
  const { proof } = await B.prove(b1.input, ZKEY);
  await assert.rejects(poll.submit({ nf: b2.nf, C: b2.C, ctxHash: CTX, proof }), /rejected/);
  poll.ledger.close();
  const { counted } = P.replay(poll.ledger.events);
  const agg = P.aggregate(counted, 4);
  const partials = keys.shares.map((sh) => ({ index: sh.index, parts: P.partialDecrypt(sh, keys.publicShares[sh.index - 1].PK, agg, POLL) }));
  const counts = P.combine(agg, partials, 2, poll.ledger.distinctVoters);
  assert.deepEqual(counts, [0n, 0n, 0n, 1n]);
  assert.ok(P.checkResult(poll.ledger, { chain: poll.ledger.chain, counts }).ok);
});
