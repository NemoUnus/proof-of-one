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
const A = require("../src/attrs");
const { IncrementalTree, RevocationTree } = require("../src/trees");
const { createVerifiedPoll } = require("../src/submit");

const ZKEY = path.join(__dirname, "..", "setup", "ballot_test.zkey");
const VKEY = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "setup", "vkey_test.json"), "utf8"));
const TODAY = [2026, 10, 23];
const POLICY = { ...A.ageRange(TODAY, { minAge: 18 }), minExpiryMonth: 24330, requiredNat: 0 };
const POLL = 1001n, CTX = 777n, OPEN = 1795000000n; // the poll's opening time (Decision #62)

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
    { s: C.randScalar(), birthDay: A.dayNumber(1985, 3, 14), natCode: 250, sexCode: 1, expiryMonth: 24400, salt: C.randScalar(), rn: handle() },
    { s: C.randScalar(), birthDay: A.dayNumber(2010, 6, 1), natCode: 250, sexCode: 2, expiryMonth: 24400, salt: C.randScalar(), rn: handle() }, // under 18
    { s: C.randScalar(), birthDay: A.dayNumber(1970, 1, 1), natCode: 250, sexCode: 2, expiryMonth: 24400, salt: C.randScalar(), rn: handle() }, // will be revoked
    // two nationalities (Decision #30); the second document has expired for polls requiring 24330
    { s: C.randScalar(), birthDay: A.dayNumber(1990, 7, 7), sexCode: 1, docs: [{ nat: 250, expiry: 24400 }, { nat: 364, expiry: 24320 }], salt: C.randScalar(), rn: handle() },
    { s: C.randScalar(), birthDay: A.dayNumber(1992, 2, 29), sexCode: 2, docs: [{ nat: 250, expiry: 24400 }, { nat: 124, expiry: 24500 }], salt: C.randScalar(), rn: handle() },
    // Decision #37: turns 18 on the poll date; and a young adult for an age-range poll
    { s: C.randScalar(), birthDay: A.dayNumber(2008, 10, 23), natCode: 250, sexCode: 1, expiryMonth: 24400, salt: C.randScalar(), rn: handle() },
    { s: C.randScalar(), birthDay: A.dayNumber(2004, 5, 5), natCode: 250, sexCode: 2, expiryMonth: 24400, salt: C.randScalar(), rn: handle() },
  ];
  for (const m of members) m.index = idTree.insert(B.memberLeaf(P, m));
  revTree.revoke(handle());
  revTree.revoke(members[2].rn);
});

const ballotFor = (m, choice, extra = {}) =>
  B.buildBallot(P, { pollId: POLL, PK: keys.PK, policy: POLICY, ctxHash: CTX, openTime: OPEN, member: m, leafIndex: m.index, idTree, revTree, choice, ...extra });

test("honest ballot: proof verifies against public inputs rebuilt by the verifier", async () => {
  const b = ballotFor(members[0], 2);
  const { proof } = await B.prove(b.input, ZKEY);
  const signals = B.publicSignals(P, { idRoot: idTree.root, revRoot: revTree.root, pollId: POLL, nf: b.nf, PK: keys.PK, policy: POLICY, ctxHash: CTX, openTime: OPEN, C: b.C });
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

test("per-poll values cannot be changed without changing pollHash", async () => {
  const b = ballotFor(members[0], 1);
  await witnessFails({ ...b.input, pollHash: (BigInt(b.input.pollHash) + 1n).toString() });
  await witnessFails({ ...b.input, maxBirthDay: String(BigInt(b.input.maxBirthDay) + 3650n) }); // weaker age rule than the one in pollHash
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

test("eligibility policy: a member under the minimum age cannot vote", async () => {
  assert.throws(() => ballotFor(members[1], 0), /age range/);
  await witnessFails(ballotFor(members[1], 0, { docIndex: 0 }).input);
});

// ------------------------------------------------ date of birth (Decision #37)
const atDate = (on, rule) => ({ ...A.ageRange(on, rule), minExpiryMonth: 24330, requiredNat: 0 });
const witnessOk = (input) => snarkjs.wtns.calculate(input, B.WASM, { type: "mem" });

test("age is evaluated on each poll's date: a member becomes eligible on their 18th birthday", async () => {
  const m = members[5];
  const dayBefore = atDate([2026, 10, 22], { minAge: 18 }), birthday = atDate([2026, 10, 23], { minAge: 18 });
  assert.throws(() => ballotFor(m, 0, { policy: dayBefore }), /age range/);
  await witnessFails(ballotFor(m, 0, { policy: dayBefore, docIndex: 0 }).input);
  await witnessOk(ballotFor(m, 0, { policy: birthday }).input);
});

test("an age range (18–24): too old or too young cannot be proven; inside the range can", async () => {
  const youth = atDate(TODAY, { minAge: 18, maxAge: 24 });
  await witnessOk(ballotFor(members[6], 0, { policy: youth }).input);                  // aged 22
  await witnessFails(ballotFor(members[0], 0, { policy: youth, docIndex: 0 }).input);  // aged 41
  await witnessFails(ballotFor(members[1], 0, { policy: youth, docIndex: 0 }).input);  // aged 16
  // the range is bound by pollHash: widening it after proving fails
  const b = ballotFor(members[6], 0, { policy: youth });
  await witnessFails({ ...b.input, minBirthDay: "0" });
});

test("tampering with a public input after proving makes verification fail", async () => {
  const b = ballotFor(members[0], 3);
  const { proof } = await B.prove(b.input, ZKEY);
  const base = { idRoot: idTree.root, revRoot: revTree.root, pollId: POLL, nf: b.nf, PK: keys.PK, policy: POLICY, ctxHash: CTX, openTime: OPEN, C: b.C };
  const swapped = [b.C[1], b.C[0], b.C[2], b.C[3]];
  assert.equal(await B.verify(VKEY, B.publicSignals(P, { ...base, C: swapped }), proof), false, "swapped ciphertexts");
  assert.equal(await B.verify(VKEY, B.publicSignals(P, { ...base, ctxHash: CTX + 1n }), proof), false, "other context");
  assert.equal(await B.verify(VKEY, B.publicSignals(P, { ...base, pollId: POLL + 1n }), proof), false, "other poll");
});

test("end to end: verified submissions, re-vote, tally and recount", async () => {
  const poll = createVerifiedPoll(P, { pollId: POLL, PK: keys.PK, policy: POLICY, idRoot: idTree.root, revRoot: revTree.root, openTime: OPEN, eligible: 3, vkey: VKEY });
  const send = async (b) => {
    const { proof } = await B.prove(b.input, ZKEY);
    await poll.submit({ nf: b.nf, C: b.C, ctxHash: CTX, openTime: OPEN, proof });
  };
  await send(ballotFor(members[0], 0));
  await send(ballotFor(members[0], 3)); // re-vote: only this one counts
  // a ballot whose proof belongs to different ciphertexts is rejected
  const b1 = ballotFor(members[0], 1), b2 = ballotFor(members[0], 2);
  const { proof } = await B.prove(b1.input, ZKEY);
  await assert.rejects(poll.submit({ nf: b2.nf, C: b2.C, ctxHash: CTX, openTime: OPEN, proof }), /rejected/);
  poll.ledger.close();
  const { counted } = P.replay(poll.ledger.events);
  const agg = P.aggregate(counted, 4);
  const partials = keys.shares.map((sh) => ({ index: sh.index, parts: P.partialDecrypt(sh, keys.publicShares[sh.index - 1].PK, agg, POLL) }));
  const counts = P.combine(agg, partials, 2, poll.ledger.distinctVoters);
  assert.deepEqual(counts, [0n, 0n, 0n, 1n]);
  assert.ok(P.checkResult(poll.ledger, { chain: poll.ledger.chain, counts }).ok);
});

// ---------------------------------------------------- several nationalities (Decision #30)
const regional = (requiredNat) => ({ ...POLICY, requiredNat });
const ballotUnder = (m, policy, extra = {}) =>
  B.buildBallot(P, { pollId: POLL, PK: keys.PK, policy, ctxHash: CTX, openTime: OPEN, member: m, leafIndex: m.index, idTree, revTree, choice: 0, ...extra });

test("two nationalities: a valid proof for the region of each, without revealing the other", async () => {
  const dual = members[4];
  for (const nat of [250, 124]) {
    const policy = regional(nat);
    const b = ballotUnder(dual, policy);
    const { proof } = await B.prove(b.input, ZKEY);
    const signals = B.publicSignals(P, { idRoot: idTree.root, revRoot: revTree.root, pollId: POLL, nf: b.nf, PK: keys.PK, policy, ctxHash: CTX, openTime: OPEN, C: b.C });
    assert.equal(await B.verify(VKEY, signals, proof), true, `region ${nat}`);
    assert.equal(signals.length, 19, "public inputs do not include any nationality");
  }
});

test("global poll: one nullifier per person, whichever document is used", () => {
  const dual = members[4];
  const viaFirst = ballotUnder(dual, POLICY, { docIndex: 0 }), viaSecond = ballotUnder(dual, POLICY, { docIndex: 1 });
  assert.equal(viaFirst.nf, viaSecond.nf, "a second ballot replaces the first; it is never counted twice");
  return Promise.all([snarkjs.wtns.calculate(viaFirst.input, B.WASM, { type: "mem" }), snarkjs.wtns.calculate(viaSecond.input, B.WASM, { type: "mem" })]);
});

test("cannot vote in the region of a nationality one does not hold", async () => {
  assert.throws(() => ballotUnder(members[4], regional(840)), /no document/);
  await witnessFails(ballotUnder(members[4], regional(840), { docIndex: 0 }).input);
  await witnessFails(ballotUnder(members[4], regional(840), { docIndex: 2 }).input); // empty slot
});

test("an expired document does not count; the member's other valid document still does", async () => {
  const m = members[3];
  assert.throws(() => ballotUnder(m, regional(364)), /no document/);
  await witnessFails(ballotUnder(m, regional(364), { docIndex: 1 }).input);
  await snarkjs.wtns.calculate(ballotUnder(m, regional(250)).input, B.WASM, { type: "mem" });
  await snarkjs.wtns.calculate(ballotUnder(m, POLICY).input, B.WASM, { type: "mem" });
  await witnessFails(ballotUnder(m, POLICY, { docIndex: 1 }).input); // global poll, expired document chosen
});

// ---------------------------------------------------- joining open polls (Decision #62)
test("a member registered after the poll opened answers it, proving against the newest root", async () => {
  const late = { s: P.curve.randScalar(), birthDay: A.dayNumber(1988, 8, 8), natCode: 250, sexCode: 1, expiryMonth: 24400, salt: P.curve.randScalar(), rn: handle() };
  const older = idTree.root;
  late.index = idTree.insert(B.memberLeaf(P, late));
  const b = ballotFor(late, 1);
  const { proof } = await B.prove(b.input, ZKEY);
  const base = { revRoot: revTree.root, pollId: POLL, nf: b.nf, PK: keys.PK, policy: POLICY, ctxHash: CTX, openTime: OPEN, C: b.C };
  assert.equal(await B.verify(VKEY, B.publicSignals(P, { ...base, idRoot: idTree.root }), proof), true);
  assert.equal(await B.verify(VKEY, B.publicSignals(P, { ...base, idRoot: older }), proof), false, "the proof names the root it used");
});

test("a re-issued identity answers only polls opened after it was issued", async () => {
  const re = { s: P.curve.randScalar(), birthDay: A.dayNumber(1979, 9, 9), natCode: 250, sexCode: 2, expiryMonth: 24400, salt: P.curve.randScalar(), rn: handle(), notBefore: OPEN + 60n };
  re.index = idTree.insert(B.memberLeaf(P, re));
  assert.throws(() => ballotFor(re, 0), /issued after the poll opened/);
  const forged = { ...ballotFor({ ...re, notBefore: 0n }, 0).input, notBefore: String(OPEN + 60n) };
  await witnessFails(forged);                                     // the leaf holds the real notBefore
  const later = ballotFor(re, 0, { openTime: OPEN + 3600n });      // a poll opened an hour later
  const { proof } = await B.prove(later.input, ZKEY);
  const signals = B.publicSignals(P, { idRoot: idTree.root, revRoot: revTree.root, pollId: POLL, nf: later.nf, PK: keys.PK, policy: POLICY, ctxHash: CTX, openTime: OPEN + 3600n, C: later.C });
  assert.equal(await B.verify(VKEY, signals, proof), true);
});

test("ballot randomness from the secret: the same revision and answer give the same ballot, anything else a fresh one", () => {
  const m = members[0];
  const a = ballotFor(m, 2, { revision: 0 }), b = ballotFor(m, 2, { revision: 0 }), c = ballotFor(m, 2, { revision: 1 });
  assert.deepEqual(a.input.CA, b.input.CA);
  assert.deepEqual(a.input.CB, b.input.CB);                       // identical: equality is all two copies reveal
  assert.notDeepEqual(a.input.CA, c.input.CA);
  const r = B.ballotRandomness(P, m.s, POLL, 0, 2);
  assert.deepEqual(r.map(String), a.input.r);
});

test("review of deployment 5 (A2/F-01): two different answers never share random values, even with the same revision", () => {
  // Two phones holding one identity, a retry after a slow block, or a relay that misreports the
  // count can all lead to two ballots with the same revision. With different answers their
  // random values must differ in every position, so B - B' never reveals (v - v')·G.
  const m = members[0];
  for (let x = 0; x < B.K; x++)
    for (let y = x + 1; y < B.K; y++) {
      const a = ballotFor(m, x, { revision: 0 }), b = ballotFor(m, y, { revision: 0 });
      for (let j = 0; j < B.K; j++) assert.notDeepEqual(a.input.CA[j], b.input.CA[j], `answers ${x} and ${y}, position ${j}`);
    }
});

test("Decision #62, principle 2: the recorded answer is found from the ballot hash alone", () => {
  const m = members[0];
  const recorded = ballotFor(m, 3, { revision: 2 });
  const hash = P.ballotHash(recorded.C).slice(2, 58);
  const found = B.recordedAnswer(P, { s: m.s, pollId: POLL, PK: keys.PK, count: 3, ballotHash: hash });
  assert.equal(found.choice, 3); assert.equal(found.revision, 2);
  assert.equal(B.recordedAnswer(P, { s: members[1].s, pollId: POLL, PK: keys.PK, count: 3, ballotHash: hash }), null);  // another member's secret
});

