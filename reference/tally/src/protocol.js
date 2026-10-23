// SPDX-License-Identifier: Apache-2.0
// Proof of One — reference implementation of the ballot and tally layer.
// Specification: docs/specs/ballot-and-enrolment-v0.1.md, sections 1 and 3–6,
// with red-team changes C5 and C8 and contract checks from docs/specs/contracts-v0.1.md.
//
// WHAT THIS CODE DOES
//   robust key generation by trustees (GJKR-style DKG, src/dkg.js), ballot encryption (one-hot,
//   exponential ElGamal), nullifiers, the ledger's latest-ballot-per-nullifier rule
//   and ballot chain, homomorphic aggregation, threshold partial decryption with
//   Chaum–Pedersen (DLEQ) proofs, Lagrange combination, discrete-log recovery,
//   the contract's result checks, voter verification, and an independent recount.
//
// WHAT THIS CODE DOES NOT DO (handled elsewhere in the design, NOT implemented here)
//   - The zero-knowledge ballot proof π_vote (Groth16 circuit). Here, ballot
//     well-formedness (each v_j ∈ {0,1}, Σ v_j = 1) and membership are ASSUMED.
//     A dishonest voter could otherwise encrypt e.g. 2 and −1. The contract check
//     Σ counts == distinctVoters catches some but NOT all such ballots.
//   - Enrolment, Merkle membership, revocation, relays, network privacy.
// Reference code for review only. Not constant-time. Do not use with real people.

"use strict";
const curve = require("./curve");
const hash = require("./hash");
const dkgLib = require("./dkg");

async function create() {
  const C = await curve.init();
  const Hs = await hash.init();
  const { G, O, L, mod, add, mul, sub, eq, isValidPoint, randScalar, coords } = C;
  const { H, keccak, u256, TAG } = Hs;

  // ---------------------------------------------------------------- nullifier
  // nf = Poseidon(TAG_NULLIFIER, pollId, s). Deterministic per (member, poll), so a
  // repeated ballot replaces the earlier one; unlinkable across polls under the PRF
  // assumption on Poseidon.
  const nullifier = (pollId, s) => H([TAG.NULLIFIER, pollId, s]);

  // ------------------------------------------------------------ trustee DKG
  // Robust t-of-n key generation (src/dkg.js). dkg(n, t) runs a full session with n
  // honest trustees in one process, as the other tests and the simulation need;
  // dkgProtocol exposes the trustee, the session and the public transcript check.
  const dkgProtocol = dkgLib.build(C, Hs);
  function dkg(n, t, pollId = 0n) {
    if (!(t >= 1 && t <= n)) throw new Error("need 1 ≤ t ≤ n");
    const trustees = Array.from({ length: n }, (_, i) => dkgProtocol.newTrustee(i + 1));
    const out = dkgProtocol.run({ pollId, trustees, t });
    if (!out.ok || !out.finished.every((f) => f.ok)) throw new Error("key generation failed: " + out.error);
    return { PK: out.PK, shares: out.finished.map((f) => f.share), publicShares: out.publicShares, t, n, transcript: out.transcript, hash: out.hash };
  }
  function commitEval(ci, x) {
    let acc = O, xp = 1n;
    for (const Aik of ci) { acc = add(acc, mul(Aik, xp)); xp = mod(xp * x); }
    return acc;
  }

  // --------------------------------------------------------- ballot encryption
  // One-hot vector v (v_choice = 1, others 0); each position encrypted as
  // C_j = (r_j·G, v_j·G + r_j·PK). Returns the ciphertexts and the randomness r,
  // which the voter keeps for the receipt window (decision #7) and then deletes.
  function encryptBallot(PK, k, choice) {
    if (!Number.isInteger(choice) || choice < 0 || choice >= k) throw new Error("choice out of range");
    const r = [], Cs = [];
    for (let j = 0; j < k; j++) {
      const rj = randScalar();
      const vj = j === choice ? 1n : 0n;
      r.push(rj);
      Cs.push({ A: mul(G, rj), B: add(vj ? G : O, mul(PK, rj)) });
    }
    return { C: Cs, r };
  }
  const reencrypt = (PK, k, choice, r) =>
    r.map((rj, j) => ({ A: mul(G, rj), B: add(j === choice ? G : O, mul(PK, rj)) }));

  // Canonical hash of a ballot, as the contract computes keccak256(abi.encode(C)).
  const ballotHash = (Cs) => keccak(...Cs.flatMap(({ A, B }) => [...coords(A), ...coords(B)].map(u256)));
  const sameBallot = (X, Y) => X.length === Y.length && X.every((c, j) => eq(c.A, Y[j].A) && eq(c.B, Y[j].B));

  // ------------------------------------------------------- ledger (PollAnswers)
  // Mirrors the contract: latest ballot per nullifier, re-vote cap, count of distinct
  // voters, and an ordered ballot chain fixing the exact set of submissions.
  function createLedger({ pollId, k, maxRevotes = 10, eligible }) {
    const latest = new Map(); // nf -> { hash, count }
    const events = [];
    let chain = "0x" + "00".repeat(32), seq = 0, distinct = 0, closed = false;
    function vote(nf, Cs) {
      if (closed) throw new Error("poll closed");
      if (Cs.length !== k) throw new Error("wrong ballot length");
      for (const { A, B } of Cs) if (!isValidPoint(A) || !isValidPoint(B)) throw new Error("invalid point");
      // NOTE: π_vote verification would happen here (not implemented; see header).
      const slot = latest.get(nf) || { hash: null, count: 0 };
      if (slot.count >= maxRevotes) throw new Error("re-vote cap reached");
      if (slot.count === 0) distinct++;
      const h = ballotHash(Cs);
      latest.set(nf, { hash: h, count: slot.count + 1 });
      chain = keccak(Buffer.from(chain.slice(2), "hex"), u256(nf), Buffer.from(h.slice(2), "hex"), u256(seq));
      events.push({ seq, nf, C: Cs, count: slot.count + 1 });
      seq++;
    }
    return {
      pollId, k, eligible, vote,
      close() { closed = true; },
      latestHash: (nf) => (latest.get(nf) || {}).hash || null,
      get chain() { return chain; },
      get distinctVoters() { return distinct; },
      get events() { return events; },
    };
  }

  // Rebuild the ballot chain and the set of counted ballots from public events only.
  function replay(events) {
    let chain = "0x" + "00".repeat(32);
    const last = new Map();
    events.forEach((e, i) => {
      if (e.seq !== i) throw new Error("events out of order or missing");
      chain = keccak(Buffer.from(chain.slice(2), "hex"), u256(e.nf), Buffer.from(ballotHash(e.C).slice(2), "hex"), u256(e.seq));
      last.set(e.nf.toString(), e.C);
    });
    return { chain, counted: [...last.values()], distinct: last.size };
  }

  // Homomorphic sum per option: (Σ A_j, Σ B_j).
  function aggregate(ballots, k) {
    const agg = Array.from({ length: k }, () => ({ A: O, B: O }));
    for (const Cs of ballots) Cs.forEach((c, j) => { agg[j] = { A: add(agg[j].A, c.A), B: add(agg[j].B, c.B) }; });
    return agg;
  }

  // ------------------------------------------------ partial decryption + DLEQ
  // Trustee i publishes D = x_i·Â and a Chaum–Pedersen proof that
  // log_G(PK_i) = log_Â(D), made non-interactive with Poseidon (Fiat–Shamir).
  // The challenge binds pollId, option index and every point in the statement.
  function dleqChallenge(ctx, PKi, A, D, T1, T2) {
    return mod(H([TAG.DLEQ, ...ctx, ...[G, PKi, A, D, T1, T2].flatMap(coords)]));
  }
  function partialDecrypt(share, PKi, agg, pollId) {
    return agg.map(({ A }, j) => {
      const D = mul(A, share.x);
      const w = randScalar();
      const T1 = mul(G, w), T2 = mul(A, w);
      const c = dleqChallenge([pollId, BigInt(j)], PKi, A, D, T1, T2);
      const z = mod(w + c * share.x);
      return { D, proof: { T1, T2, z } };
    });
  }
  function verifyPartial(PKi, A, part, pollId, j) {
    const { D, proof: { T1, T2, z } } = part;
    if (![PKi, A, D, T1, T2].every(isValidPoint)) return false;
    const c = dleqChallenge([pollId, BigInt(j)], PKi, A, D, T1, T2);
    return eq(mul(G, z), add(T1, mul(PKi, c))) && eq(mul(A, z), add(T2, mul(D, c)));
  }

  // Lagrange coefficient at 0 for index i over the set S (all mod ℓ).
  function lagrange0(i, S) {
    let num = 1n, den = 1n;
    for (const j of S) if (j !== i) { num = mod(num * BigInt(j)); den = mod(den * (BigInt(j) - BigInt(i))); }
    return mod(num * modInv(den));
  }
  function modInv(a) { // Fermat: ℓ is prime
    let r = 1n, b = mod(a), e = L - 2n;
    while (e > 0n) { if (e & 1n) r = mod(r * b); b = mod(b * b); e >>= 1n; }
    return r;
  }

  // Recover n from n·G with 0 ≤ n ≤ max (baby-step giant-step).
  function discreteLog(M, max) {
    const m = BigInt(Math.ceil(Math.sqrt(Number(max) + 1)));
    const table = new Map();
    let P = O;
    for (let a = 0n; a < m; a++) { table.set(C.key(P), a); P = add(P, G); }
    const step = C.neg(mul(G, m));
    let Q = M;
    for (let b = 0n; b <= m; b++) {
      const a = table.get(C.key(Q));
      if (a !== undefined) { const n = b * m + a; if (n <= BigInt(max)) return n; }
      Q = add(Q, step);
    }
    throw new Error("discrete log not found in range");
  }

  // Combine any t verified partial decryptions into the option counts.
  function combine(agg, partials, t, maxCount) {
    const chosen = partials.slice(0, t);
    if (chosen.length < t) throw new Error("not enough valid partial decryptions");
    const S = chosen.map((p) => p.index);
    return agg.map(({ B }, j) => {
      let XA = O;
      for (const p of chosen) XA = add(XA, mul(p.parts[j].D, lagrange0(p.index, S)));
      return discreteLog(sub(B, XA), maxCount);
    });
  }

  // ------------------------------------------------- contract result checks
  // ResultsRegistry.publish(): chain must match, Σ counts == distinct voters (C5),
  // and distinct voters ≤ eligible identities at the snapshot (C5).
  function checkResult(ledger, result) {
    const errors = [];
    if (result.chain !== ledger.chain) errors.push("ballot chain mismatch");
    const sum = result.counts.reduce((a, b) => a + b, 0n);
    if (sum !== BigInt(ledger.distinctVoters)) errors.push(`sum of counts ${sum} != distinct voters ${ledger.distinctVoters}`);
    if (ledger.distinctVoters > ledger.eligible) errors.push("more voters than eligible identities");
    return { ok: errors.length === 0, errors };
  }

  // ---------------------------------------------------- independent recount
  // Uses only public data: poll parameters, trustee public shares, ballot events,
  // the published result and the trustees' partial decryptions with proofs.
  function recount({ pollId, k, t, eligible, publicShares, events, result }) {
    const report = { ok: true, errors: [], invalidTrustees: [] };
    const fail = (m) => { report.ok = false; report.errors.push(m); };
    const { chain, counted, distinct } = replay(events);
    if (chain !== result.chain) fail("ballot chain does not match the published value");
    if (distinct > eligible) fail("more distinct voters than eligible identities");
    const agg = aggregate(counted, k);
    const valid = [];
    for (const p of result.partials) {
      const share = publicShares.find((s) => s.index === p.index);
      const ok = share && p.parts.length === k && p.parts.every((part, j) => verifyPartial(share.PK, agg[j].A, part, pollId, j));
      if (ok) valid.push(p); else report.invalidTrustees.push(p.index);
    }
    if (report.invalidTrustees.length) fail(`invalid partial decryption from trustee(s) ${report.invalidTrustees.join(", ")}`);
    if (valid.length < t) { fail("fewer than t valid partial decryptions"); return report; }
    const counts = combine(agg, valid, t, distinct);
    report.counts = counts;
    report.distinctVoters = distinct;
    if (counts.reduce((a, b) => a + b, 0n) !== BigInt(distinct)) fail("decrypted counts do not add up to distinct voters");
    if (counts.length !== result.counts.length || counts.some((c, j) => c !== result.counts[j])) fail("published counts differ from recount");
    return report;
  }

  // ------------------------------------------------------ voter verification
  // R1: the voter re-encrypts with the kept randomness and compares with the ledger.
  function voterCheckRecorded(PK, k, record, ledgerLatestHash) {
    const expected = ballotHash(reencrypt(PK, k, record.choice, record.r));
    return expected === ledgerLatestHash;
  }
  // ...and that their last ballot is the one counted under their nullifier.
  function voterCheckCounted(PK, k, record, events) {
    const mine = events.filter((e) => e.nf === record.nf);
    if (!mine.length) return false;
    return sameBallot(mine[mine.length - 1].C, reencrypt(PK, k, record.choice, record.r));
  }

  return {
    curve: C, hash: Hs, nullifier, dkg, dkgProtocol, encryptBallot, reencrypt, ballotHash, createLedger, replay,
    aggregate, partialDecrypt, verifyPartial, combine, discreteLog, checkResult, recount,
    voterCheckRecorded, voterCheckCounted,
  };
}

module.exports = { create };
