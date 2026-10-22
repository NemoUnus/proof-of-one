// SPDX-License-Identifier: Apache-2.0
// Tests for the reference tally: correct behaviour and detection of attacks.
"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { create } = require("../src/protocol");
const { runPoll } = require("../src/simulate");

let P;
test.before(async () => { P = await create(); });

test("Poseidon matches the circomlib test vector", () => {
  assert.equal(P.hash.H([1n, 2n]), 7853200120776062878684798364095072458815029376092732009249414926327459813530n);
});

test("honest poll: counts equal the truth, contract checks and recount pass", async () => {
  const r = await runPoll(P, { voters: 60, revoters: 10 });
  assert.deepEqual(r.result.counts, r.truth);
  assert.equal(r.ledger.distinctVoters, 60);
  assert.equal(r.ledger.events.length, 70);
  assert.ok(P.checkResult(r.ledger, r.result).ok);
  const rep = P.recount(r.transcript);
  assert.ok(rep.ok, rep.errors.join("; "));
  assert.deepEqual(rep.counts, r.truth);
});

test("R1: every voter can verify their own recorded and counted ballot", async () => {
  const r = await runPoll(P, { voters: 20, revoters: 5 });
  for (const rec of r.records.values()) {
    assert.ok(P.voterCheckRecorded(r.keys.PK, 4, rec, r.ledger.latestHash(rec.nf)));
    assert.ok(P.voterCheckCounted(r.keys.PK, 4, rec, r.ledger.events));
  }
});

test("R1: a voter detects a ballot that was replaced by someone else", async () => {
  const r = await runPoll(P, { voters: 10, revoters: 0 });
  const rec = [...r.records.values()][0];
  const forged = P.encryptBallot(r.keys.PK, 4, (rec.choice + 1) % 4).C;
  const events = r.ledger.events.concat([{ seq: r.ledger.events.length, nf: rec.nf, C: forged, count: 2 }]);
  assert.equal(P.voterCheckCounted(r.keys.PK, 4, rec, events), false);
});

test("any t of n trustees give the same result", async () => {
  const r = await runPoll(P, { voters: 30, n: 9, t: 6 });
  const rev = [...r.result.partials].reverse();
  assert.deepEqual(P.combine(r.agg, rev, 6, 30), r.truth);
  assert.throws(() => P.combine(r.agg, r.result.partials.slice(0, 5), 6, 30), /not enough/);
});

test("attack: a trustee publishes a wrong partial decryption — DLEQ fails, recount flags it", async () => {
  const r = await runPoll(P, { voters: 25 });
  const C = P.curve;
  const bad = r.transcript.result.partials[0].parts[0];
  bad.D = C.add(bad.D, C.G); // shift by one vote
  const rep = P.recount(r.transcript);
  assert.equal(rep.ok, false);
  assert.deepEqual(rep.invalidTrustees, [1]);
});

test("attack: published counts are altered — recount detects it", async () => {
  const r = await runPoll(P, { voters: 25 });
  r.transcript.result.counts = [...r.result.counts];
  r.transcript.result.counts[0] += 1n; r.transcript.result.counts[1] -= 1n; // same total
  const rep = P.recount(r.transcript);
  assert.equal(rep.ok, false);
  assert.ok(rep.errors.some((e) => /differ/.test(e)));
});

test("attack: a ballot is silently dropped from the published events — chain check fails", async () => {
  const r = await runPoll(P, { voters: 25, revoters: 0 });
  r.transcript.events = r.transcript.events.filter((e) => e.seq !== 3).map((e, i) => ({ ...e, seq: i }));
  const rep = P.recount(r.transcript);
  assert.equal(rep.ok, false);
  assert.ok(rep.errors.some((e) => /chain/.test(e)));
});

test("contract check: counts must add up to distinct voters", async () => {
  const r = await runPoll(P, { voters: 12 });
  const res = { ...r.result, counts: r.result.counts.map((c, j) => (j === 0 ? c + 1n : c)) };
  const chk = P.checkResult(r.ledger, res);
  assert.equal(chk.ok, false);
});

test("contract check: more voters than eligible identities is rejected", async () => {
  const r = await runPoll(P, { voters: 12, eligible: 10 });
  assert.equal(P.checkResult(r.ledger, r.result).ok, false);
});

test("ledger: re-vote cap and invalid points are enforced", async () => {
  const C = P.curve;
  const keys = P.dkg(3, 2);
  const L = P.createLedger({ pollId: 7n, k: 2, maxRevotes: 3, eligible: 10 });
  const nf = P.nullifier(7n, C.randScalar());
  for (let i = 0; i < 3; i++) L.vote(nf, P.encryptBallot(keys.PK, 2, 0).C);
  assert.throws(() => L.vote(nf, P.encryptBallot(keys.PK, 2, 1).C), /cap/);
  const Cs = P.encryptBallot(keys.PK, 2, 0).C;
  Cs[0].A = [C.F.e(1n), C.F.e(2n)]; // not on the curve
  assert.throws(() => L.vote(P.nullifier(7n, C.randScalar()), Cs), /invalid point/);
  assert.equal(L.distinctVoters, 1);
});

test("nullifiers: same member and poll → same value; different polls → different values", () => {
  const s = P.curve.randScalar();
  assert.equal(P.nullifier(1n, s), P.nullifier(1n, s));
  assert.notEqual(P.nullifier(1n, s), P.nullifier(2n, s));
});

test("known limitation: without π_vote a malformed ballot can shift votes undetected", async () => {
  // Documents WHY the zero-knowledge ballot proof is required. A ballot encrypting
  // (+2, −1, 0, 0) still sums to 1, so Σ counts == distinct voters passes.
  const C = P.curve;
  const keys = P.dkg(3, 2);
  const L = P.createLedger({ pollId: 9n, k: 4, eligible: 10 });
  const honest = P.encryptBallot(keys.PK, 4, 1).C;
  L.vote(P.nullifier(9n, C.randScalar()), honest);
  const enc = (v) => { const r = C.randScalar(); return { A: C.mul(C.G, r), B: C.add(C.mul(C.G, C.mod(v)), C.mul(keys.PK, r)) }; };
  L.vote(P.nullifier(9n, C.randScalar()), [enc(2n), enc(-1n), enc(0n), enc(0n)]);
  const { counted } = P.replay(L.events);
  const agg = P.aggregate(counted, 4);
  const partials = keys.shares.map((sh) => ({ index: sh.index, parts: P.partialDecrypt(sh, keys.publicShares[sh.index - 1].PK, agg, 9n) }));
  const counts = P.combine(agg, partials, 2, 2);
  assert.deepEqual(counts, [2n, 0n, 0n, 0n]); // the honest vote for option 1 was cancelled
  assert.ok(P.checkResult(L, { chain: L.chain, counts }).ok); // and the contract check cannot see it
});
