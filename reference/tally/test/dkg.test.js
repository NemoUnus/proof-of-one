// SPDX-License-Identifier: Apache-2.0
// Tests for robust trustee key generation (docs/specs/trustee-key-generation-v0.1.md):
// honest sessions, every way a trustee can cheat, the public transcript check, and
// a tally that survives an absent and a cheating trustee.
"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { create } = require("../src/protocol");

let P, C, D;
test.before(async () => { P = await create(); C = P.curve; D = P.dkgProtocol; });

const trustees = (n) => Array.from({ length: n }, (_, i) => D.newTrustee(i + 1));
const sumPoints = (pts) => pts.reduce((a, b) => C.add(a, b), C.O);
// The joint secret from any t final shares (only possible in a test, where all shares are known).
const secretFrom = (shares) => D.interpolate(shares.map((s) => ({ i: s.index, y: s.x })), 0);

// A small poll with this key: returns the decrypted counts from the given trustees.
function tally(out, ballots, pollId, useIdx) {
  const k = 3;
  const agg = P.aggregate(ballots.map((c) => P.encryptBallot(out.PK, k, c).C), k);
  const shares = out.finished.map((f) => f.share).filter((s) => useIdx.includes(s.index));
  const partials = shares.map((sh) => ({ index: sh.index, parts: P.partialDecrypt(sh, out.publicShares[sh.index - 1].PK, agg, pollId) }));
  return { agg, partials, counts: P.combine(agg, partials, out.transcript.context.t, ballots.length) };
}

test("honest session: everyone agrees on the key, and anyone can check it from the transcript", () => {
  const out = D.run({ pollId: 11n, trustees: trustees(5), t: 3 });
  assert.ok(out.ok, out.error);
  assert.deepEqual(out.QUAL, [1, 2, 3, 4, 5]);
  assert.ok(out.finished.every((f) => f.ok), "each trustee's share matches its public share");
  const pub = D.verifyTranscript(out.transcript); // uses no secret
  assert.ok(C.eq(pub.PK, out.PK));
  assert.equal(pub.hash, out.hash);
  // Any 3 of the 5 shares give the same secret, and it matches the public key.
  const sh = out.finished.map((f) => f.share);
  const x = secretFrom([sh[0], sh[2], sh[4]]);
  assert.equal(x, secretFrom([sh[1], sh[3], sh[4]]));
  assert.ok(C.eq(C.mul(C.G, x), out.PK));
  assert.deepEqual(tally(out, [0, 1, 1, 2, 1], 11n, [2, 4, 5]).counts, [1n, 3n, 1n]);
});

test("a dealer that sends one trustee a wrong share is disqualified by a public complaint", () => {
  const out = D.run({
    pollId: 12n, trustees: trustees(5), t: 3,
    cheat: { phase1: (i, m) => (i === 2 ? { ...m, enc: m.enc.map((e, j) => (j === 3 ? { ...e, s: C.mod(e.s + 1n) } : e)) } : m) },
  });
  assert.ok(out.ok, out.error);
  assert.match(out.disqualified[2], /upheld complaint from trustee 4/);
  assert.deepEqual(out.QUAL, [1, 3, 4, 5]);
  assert.ok(out.finished.every((f) => f.ok));
  assert.deepEqual(tally(out, [2, 2, 0], 12n, [1, 3, 4]).counts, [1n, 0n, 2n]);
});

test("a false complaint with a genuine key proof is rejected; the dealer stays", () => {
  const ts = trustees(4);
  const out = D.run({
    pollId: 13n, trustees: ts, t: 2,
    // Trustee 3 reveals its real key with dealer 1 and claims the share was wrong.
    cheat: { check1: (i, list) => (i === 3 ? [...list, ts[2].complaint(1)] : list) },
  });
  assert.ok(out.ok, out.error);
  assert.ok(out.QUAL.includes(1), "the honest dealer is not disqualified");
  assert.deepEqual(out.falseComplaints, [{ phase: 1, from: 3, against: 1 }]);
});

test("a complaint with a forged key proof is ignored", () => {
  const ts = trustees(4);
  const out = D.run({
    pollId: 14n, trustees: ts, t: 2,
    cheat: {
      check1: (i, list) => {
        if (i !== 3) return list;
        const K = C.mul(C.G, C.randScalar());
        return [...list, { from: 3, against: 1, K, proof: { T1: C.G, T2: C.G, z: 1n } }];
      },
    },
  });
  assert.ok(out.ok, out.error);
  assert.ok(out.QUAL.includes(1));
  assert.equal(out.ignoredComplaints.length, 1);
});

test("invalid commitments (a point outside the prime-order subgroup) disqualify the dealer", () => {
  const small = [C.F.zero, C.F.neg(C.F.one)]; // (0, −1) has order 2
  const out = D.run({
    pollId: 15n, trustees: trustees(4), t: 2,
    cheat: { phase1: (i, m) => (i === 4 ? { ...m, C: [small, ...m.C.slice(1)] } : m) },
  });
  assert.ok(out.ok, out.error);
  assert.equal(out.disqualified[4], "invalid commitments");
});

test("rogue key: a dealer cannot choose its commitment to cancel the others", () => {
  // A rushing dealer sees the others' commitments and replaces its own constant term
  // so that the key would become X − (others). It cannot produce matching shares.
  const ts = trustees(4);
  const target = C.mul(C.G, 12345n);
  const out = D.run({
    pollId: 16n, trustees: ts, t: 2,
    cheat: { phase1: (i, m) => (i === 4 ? { ...m, C: [target, ...m.C.slice(1)] } : m) },
  });
  assert.ok(out.ok, out.error);
  assert.match(out.disqualified[4], /upheld complaint/);
  assert.ok(!C.eq(out.PK, target));
});

test("wrong Feldman values in phase 2 cannot bias the key: the dealer is rebuilt", () => {
  const ts = trustees(5);
  const shift = C.mul(C.G, 777n);
  const out = D.run({
    pollId: 17n, trustees: ts, t: 3,
    cheat: { phase2: (i, m) => (i === 1 ? { A: [C.add(m.A[0], shift), ...m.A.slice(1)] } : m) },
  });
  assert.ok(out.ok, out.error);
  assert.deepEqual(out.rebuilt.map((r) => r.dealer), [1]);
  assert.ok(out.finished.every((f) => f.ok));
  // The key is the one defined in phase 1, not the shifted one.
  const posted = sumPoints(out.transcript.phase2.map((m) => m.A[0]));
  assert.ok(!C.eq(out.PK, posted), "the shifted value was not used");
  assert.ok(C.eq(C.mul(C.G, secretFrom(out.finished.slice(0, 3).map((f) => f.share))), out.PK));
});

test("a dealer that withdraws after seeing the others still contributes: it is rebuilt", () => {
  const out = D.run({
    pollId: 18n, trustees: trustees(5), t: 3,
    cheat: { phase2: (i, m) => (i === 5 ? null : m) },
  });
  assert.ok(out.ok, out.error);
  assert.deepEqual(out.QUAL, [1, 2, 3, 4, 5]);
  assert.equal(out.rebuilt[0].dealer, 5);
  assert.ok(out.finished.every((f) => f.ok));
  assert.deepEqual(tally(out, [1, 0, 1], 18n, [1, 2, 3]).counts, [1n, 2n, 0n]);
});

test("wrong revealed shares are ignored during a rebuild", () => {
  const out = D.run({
    pollId: 19n, trustees: trustees(5), t: 3,
    cheat: {
      phase2: (i, m) => (i === 2 ? null : m),
      reveal: (i, r) => (i === 3 && r ? { ...r, s: C.mod(r.s + 5n) } : r),
    },
  });
  assert.ok(out.ok, out.error);
  assert.ok(!out.rebuilt[0].from.includes(3), "trustee 3's altered share was not used");
  assert.ok(out.finished.every((f) => f.ok));
});

test("too many dishonest dealers: the session fails openly instead of producing a weak key", () => {
  const bad = (m) => ({ ...m, C: [C.mul(C.G, 5n), ...m.C.slice(1)] });
  const out = D.run({ pollId: 20n, trustees: trustees(3), t: 2, cheat: { phase1: (i, m) => (i === 1 ? m : bad(m)) } });
  assert.equal(out.ok, false);
  assert.match(out.error, /only 1 qualified dealers; at least 2 are needed/);
});

test("the transcript hash binds every message; an edited transcript gives another key", () => {
  const out = D.run({ pollId: 21n, trustees: trustees(4), t: 2 });
  const tr = structuredClone(out.transcript);
  tr.phase2[1].A[0] = C.mul(C.G, 99n);
  const pub = D.verifyTranscript(tr);
  assert.notEqual(pub.hash, out.hash);
  assert.ok(!C.eq(pub.PK, out.PK));
});

test("tally with one trustee absent and one cheating: the recount names the cheater and is exact", () => {
  const out = D.run({ pollId: 22n, trustees: trustees(5), t: 3 });
  assert.ok(out.ok, out.error);
  const k = 3, choices = [0, 1, 2, 2, 1, 2];
  const ledger = P.createLedger({ pollId: 22n, k, eligible: 10 });
  for (const c of choices) ledger.vote(P.nullifier(22n, C.randScalar()), P.encryptBallot(out.PK, k, c).C);
  ledger.close();
  const agg = P.aggregate(P.replay(ledger.events).counted, k);
  const partials = out.finished.map((f) => f.share).filter((s) => s.index !== 5) // trustee 5 is absent
    .map((sh) => ({ index: sh.index, parts: P.partialDecrypt(sh, out.publicShares[sh.index - 1].PK, agg, 22n) }));
  partials[1] = { index: 2, parts: partials[1].parts.map((p) => ({ ...p, D: C.add(p.D, C.G) })) }; // trustee 2 cheats
  const valid = partials.filter((p) => p.parts.every((part, j) => P.verifyPartial(out.publicShares[p.index - 1].PK, agg[j].A, part, 22n, j)));
  const counts = P.combine(agg, valid, 3, ledger.distinctVoters);
  assert.deepEqual(counts, [1n, 2n, 3n]);
  const rep = P.recount({ pollId: 22n, k, t: 3, eligible: 10, publicShares: out.publicShares, events: ledger.events, result: { chain: ledger.chain, counts, partials } });
  assert.deepEqual(rep.invalidTrustees, [2]);
  assert.deepEqual(rep.counts, [1n, 2n, 3n], "the recount still rebuilds the exact result");
});
