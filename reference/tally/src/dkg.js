// SPDX-License-Identifier: Apache-2.0
// Proof of One — robust trustee key generation (GJKR-style distributed key generation).
// Specification: docs/specs/trustee-key-generation-v0.1.md.
//
// n trustees produce a t-of-n key for one poll. Nobody ever knows the whole secret,
// the public key is uniformly random even if up to t−1 trustees collude and choose
// their messages after seeing the others (Gennaro, Jarecki, Krawczyk and Rabin,
// "Secure distributed key generation for discrete-log based cryptosystems",
// J. Cryptology 2007), and every decision — who is disqualified, whose contribution
// is rebuilt, the public key and every trustee's public share — follows from the
// public transcript alone, so anyone can check it (founding property R2).
//
//   Phase 1  Pedersen sharing. Dealer i posts C_ik = a_ik·G + b_ik·H and, for every j,
//            the shares f_i(j), f'_i(j) encrypted to trustee j's long-term key.
//   Check 1  Trustee j checks f_i(j)·G + f'_i(j)·H = Σ_k j^k·C_ik. If not, j publishes
//            the Diffie–Hellman key K = e_j·E_i with a DLEQ proof. Anyone can then
//            decrypt the disputed shares and decide who is at fault.
//            QUAL = dealers with a complete, valid phase-1 message and no upheld complaint.
//   Phase 2  Each dealer in QUAL posts A_ik = a_ik·G (Feldman values).
//   Check 2  Trustee j checks f_i(j)·G = Σ_k j^k·A_ik; a complaint works as in check 1.
//   Rebuild  For a dealer in QUAL that failed phase 2, the other trustees publish its
//            shares to them in clear. Shares that match the phase-1 commitments are used
//            to rebuild f_i, so its contribution stays in the key and is now public.
//   Output   PK = Σ_{i∈QUAL} f_i(0)·G and PK_j = Σ_{i∈QUAL} f_i(j)·G for every j.
//
// Robust while at most min(t−1, n−t) trustees misbehave. Secret while at most t−1 collude.
// Reference code for review only. Not constant-time. Do not use with real people.

"use strict";

function build(C, Hs) {
  const { F, G, O, L, mod, add, mul, eq, isValidPoint, randScalar, coords } = C;
  const { H, keccak, u256, TAG } = Hs;

  // ------------------------------------------------------------ second generator
  // H must have no known discrete log with respect to G. It is derived by hashing a
  // counter to an x-coordinate (try-and-increment), solving the curve equation
  // a·x² + y² = 1 + d·x²·y² for y and multiplying by the cofactor 8.
  const P_FIELD = 21888242871839275222246405745257275088548364400416034343698204186575808495617n;
  const fm = (x) => ((x % P_FIELD) + P_FIELD) % P_FIELD;
  const fpow = (b, e) => { let r = 1n; b = fm(b); while (e > 0n) { if (e & 1n) r = fm(r * b); b = fm(b * b); e >>= 1n; } return r; };
  // Tonelli–Shanks square root in the BN254 scalar field; null if none exists.
  function fsqrt(n) {
    n = fm(n);
    if (n === 0n) return 0n;
    if (fpow(n, (P_FIELD - 1n) / 2n) !== 1n) return null;
    let q = P_FIELD - 1n, s = 0n;
    while ((q & 1n) === 0n) { q >>= 1n; s++; }
    let z = 2n;
    while (fpow(z, (P_FIELD - 1n) / 2n) !== P_FIELD - 1n) z++;
    let m = s, c = fpow(z, q), t = fpow(n, q), r = fpow(n, (q + 1n) / 2n);
    while (t !== 1n) {
      let i = 0n, t2 = t;
      while (t2 !== 1n) { t2 = fm(t2 * t2); i++; }
      const b = fpow(c, 1n << (m - i - 1n));
      m = i; c = fm(b * b); t = fm(t * c); r = fm(r * b);
    }
    return r < P_FIELD - r ? r : P_FIELD - r; // the smaller root, for a canonical choice
  }
  function hashToGroup(label) {
    for (let ctr = 0n; ; ctr++) {
      const x = fm(H([TAG.DKG_GEN, label, ctr]));
      const x2 = fm(x * x);
      const den = fm(1n - 168696n * x2);
      if (den === 0n) continue;
      const y = fsqrt(fm((1n - 168700n * x2) * fpow(den, P_FIELD - 2n)));
      if (y === null) continue;
      const P = mul([F.e(x), F.e(y)], 8n);
      if (!eq(P, O) && isValidPoint(P)) return P;
    }
  }
  const H2 = hashToGroup(1n);

  // ----------------------------------------------------------------- helpers
  const evalPoly = (a, x) => a.reduceRight((acc, ak) => mod(acc * BigInt(x) + ak), 0n);
  function commitEval(Cs, x) {
    let acc = O, xp = 1n;
    for (const Ck of Cs) { acc = add(acc, mul(Ck, xp)); xp = mod(xp * BigInt(x)); }
    return acc;
  }
  function modInv(a) {
    let r = 1n, b = mod(a), e = L - 2n;
    while (e > 0n) { if (e & 1n) r = mod(r * b); b = mod(b * b); e >>= 1n; }
    return r;
  }
  // Value at x of the polynomial through the points (i, y_i), i ∈ S.
  function interpolate(points, x) {
    let acc = 0n;
    for (const { i, y } of points) {
      let num = 1n, den = 1n;
      for (const { i: m } of points) if (m !== i) { num = mod(num * (BigInt(x) - BigInt(m))); den = mod(den * (BigInt(i) - BigInt(m))); }
      acc = mod(acc + y * num * modInv(den));
    }
    return acc;
  }

  // Session context: binds the poll, n, t and every trustee's long-term key.
  function contextId({ pollId, n, t, trusteeKeys }) {
    if (trusteeKeys.length !== n) throw new Error("one long-term key per trustee");
    let h = H([TAG.DKG_CTX, BigInt(pollId), BigInt(n), BigInt(t)]);
    for (const E of trusteeKeys) h = H([TAG.DKG_CTX, h, ...coords(E)]);
    return h;
  }
  // One-time pad for share `which` (0: f, 1: f') from dealer i to trustee j.
  const pad = (ctxId, i, j, which, K) => mod(H([TAG.DKG_PAD, ctxId, BigInt(i), BigInt(j), BigInt(which), ...coords(K)]));

  // Chaum–Pedersen proof that log_G(E_j) = log_{E_i}(K), bound to the session and pair.
  function dleqChallenge(ctxId, i, j, Ej, Ei, K, T1, T2) {
    return mod(H([TAG.DKG_DLEQ, ctxId, BigInt(i), BigInt(j), ...[Ej, Ei, K, T1, T2].flatMap(coords)]));
  }
  function proveKey(ctxId, i, j, e, Ei) {
    const Ej = mul(G, e), K = mul(Ei, e), w = randScalar();
    const T1 = mul(G, w), T2 = mul(Ei, w);
    const c = dleqChallenge(ctxId, i, j, Ej, Ei, K, T1, T2);
    return { K, proof: { T1, T2, z: mod(w + c * e) } };
  }
  function verifyKey(ctxId, i, j, Ej, Ei, K, { T1, T2, z }) {
    if (![Ei, Ej, K, T1, T2].every(validPoint)) return false;
    const c = dleqChallenge(ctxId, i, j, Ej, Ei, K, T1, T2);
    return eq(mul(G, z), add(T1, mul(Ej, c))) && eq(mul(Ei, z), add(T2, mul(K, c)));
  }

  // Subgroup checks cost as much as a multiplication; the same points are checked by
  // every trustee and by every verification pass, so results are cached per object.
  const checked = new WeakMap();
  const validPoint = (P) => {
    if (!Array.isArray(P)) return false;
    if (!checked.has(P)) checked.set(P, isValidPoint(P));
    return checked.get(P);
  };
  const validPoints = (arr, len) => Array.isArray(arr) && arr.length === len && arr.every(validPoint);
  const isScalar = (x) => typeof x === "bigint" && x >= 0n && x < L;

  // ----------------------------------------------------------------- trustee
  // A trustee's long-term key pair (e, E = e·G) is registered once; one session per poll.
  function newTrustee(index, e = randScalar()) {
    const me = { index, e, E: mul(G, e) };
    let a, b, ctx, ctxId, received = new Map(), myC = null;

    me.start = (context) => { ctx = context; ctxId = contextId(context); received = new Map(); };

    // Phase 1: Pedersen commitments and encrypted shares for every trustee.
    me.phase1 = () => {
      const { n, t, trusteeKeys } = ctx;
      a = Array.from({ length: t }, () => randScalar());
      b = Array.from({ length: t }, () => randScalar());
      myC = a.map((ak, k) => add(mul(G, ak), mul(H2, b[k])));
      const enc = [];
      for (let j = 1; j <= n; j++) {
        const K = mul(trusteeKeys[j - 1], me.e);
        enc.push({ s: mod(evalPoly(a, j) + pad(ctxId, index, j, 0, K)), s2: mod(evalPoly(b, j) + pad(ctxId, index, j, 1, K)) });
      }
      return { C: myC, enc };
    };

    const decrypt = (i, msg) => {
      const K = mul(ctx.trusteeKeys[i - 1], me.e);
      const c = msg.enc[index - 1];
      return { s: mod(c.s - pad(ctxId, i, index, 0, K)), s2: mod(c.s2 - pad(ctxId, i, index, 1, K)) };
    };
    const complaint = (i) => ({ from: index, against: i, ...proveKey(ctxId, i, index, me.e, ctx.trusteeKeys[i - 1]) });

    // Check 1: decrypt my shares and complain about any that do not match.
    me.check1 = (phase1) => {
      const out = [];
      const ok1 = (i, sh) => eq(add(mul(G, sh.s), mul(H2, sh.s2)), commitEval(phase1[i - 1].C, index));
      const got = [];
      phase1.forEach((msg, idx) => {
        const i = idx + 1;
        if (i === index || !msg || !validPoints(msg.C, ctx.t) || !Array.isArray(msg.enc) || msg.enc.length !== ctx.n) return;
        const sh = decrypt(i, msg);
        received.set(i, sh);
        got.push(i);
      });
      // One combined check for all dealers; only if it fails, find the culprits.
      let S = 0n, S2 = 0n, Csum = Array.from({ length: ctx.t }, () => O);
      for (const i of got) {
        const sh = received.get(i); S = mod(S + sh.s); S2 = mod(S2 + sh.s2);
        phase1[i - 1].C.forEach((Ck, k) => { Csum[k] = add(Csum[k], Ck); });
      }
      if (!eq(add(mul(G, S), mul(H2, S2)), commitEval(Csum, index)))
        for (const i of got) if (!ok1(i, received.get(i))) out.push(complaint(i));
      received.set(index, { s: evalPoly(a, index), s2: evalPoly(b, index) });
      return out;
    };

    me.complaint = complaint; // used by tests to model a trustee that complains falsely
    me.phase2 = () => ({ A: a.map((ak) => mul(G, ak)) });

    // Check 2: my share from each dealer in QUAL must match its Feldman values.
    me.check2 = (QUAL, phase2) => {
      const out = [];
      const got = QUAL.filter((i) => i !== index && phase2[i - 1] && validPoints(phase2[i - 1].A, ctx.t) && received.has(i)); // missing: handled publicly
      let S = 0n, Asum = Array.from({ length: ctx.t }, () => O);
      for (const i of got) { S = mod(S + received.get(i).s); phase2[i - 1].A.forEach((Ak, k) => { Asum[k] = add(Asum[k], Ak); }); }
      if (!eq(mul(G, S), commitEval(Asum, index)))
        for (const i of got) if (!eq(mul(G, received.get(i).s), commitEval(phase2[i - 1].A, index))) out.push(complaint(i));
      return out;
    };

    // Rebuild: publish my shares from dealer i in clear.
    me.reveal = (i) => {
      const sh = received.get(i);
      return sh ? { from: index, of: i, s: sh.s, s2: sh.s2 } : null;
    };

    // Final share x_j = Σ_{i∈QUAL} f_i(j).
    me.finish = (out) => {
      let x = 0n;
      for (const i of out.QUAL) {
        const sh = received.get(i);
        if (!sh) throw new Error(`no share from dealer ${i}`);
        x = mod(x + sh.s);
      }
      const ok = eq(mul(G, x), out.publicShares[index - 1].PK);
      me.share = { index, x };
      a = b = null; // the polynomials are no longer needed
      return { ok, share: me.share };
    };
    return me;
  }

  // ------------------------------------------------------- public verification
  // Recomputes everything from the transcript. Never uses a secret.
  function verifyTranscript(tr) {
    const { context, phase1 = [], complaints1 = [], phase2 = [], complaints2 = [], reveals = [] } = tr;
    const { n, t, trusteeKeys } = context;
    if (!(Number.isInteger(n) && Number.isInteger(t) && t >= 1 && t <= n)) throw new Error("need 1 ≤ t ≤ n");
    if (!validPoints(trusteeKeys, n)) throw new Error("invalid trustee key");
    const ctxId = contextId(context);
    const disqualified = {}, falseComplaints = [], ignoredComplaints = [], rebuilt = [];
    const dq = (i, why) => { if (!disqualified[i]) disqualified[i] = why; };

    // Phase 1 messages must be complete and well formed.
    for (let i = 1; i <= n; i++) {
      const m = phase1[i - 1];
      if (!m) dq(i, "no phase-1 message");
      else if (!validPoints(m.C, t)) dq(i, "invalid commitments");
      else if (!Array.isArray(m.enc) || m.enc.length !== n || !m.enc.every((c) => c && isScalar(c.s) && isScalar(c.s2))) dq(i, "missing or malformed encrypted shares");
    }

    // Open a complaint: check the revealed key, decrypt, and test the share.
    const open = (c, phase) => {
      const { from: j, against: i } = c;
      if (!(j >= 1 && j <= n && i >= 1 && i <= n && i !== j)) return null;
      if (!verifyKey(ctxId, i, j, trusteeKeys[j - 1], trusteeKeys[i - 1], c.K, c.proof)) return null;
      const enc = phase1[i - 1].enc[j - 1];
      const s = mod(enc.s - pad(ctxId, i, j, 0, c.K)), s2 = mod(enc.s2 - pad(ctxId, i, j, 1, c.K));
      const pedersenOk = eq(add(mul(G, s), mul(H2, s2)), commitEval(phase1[i - 1].C, j));
      if (phase === 1) return { upheld: !pedersenOk };
      const A = phase2[i - 1].A;
      return { upheld: !pedersenOk || !eq(mul(G, s), commitEval(A, j)) };
    };

    for (const c of complaints1) {
      if (disqualified[c.against]) continue;
      const r = open(c, 1);
      if (!r) ignoredComplaints.push({ phase: 1, from: c.from, against: c.against, why: "invalid key proof" });
      else if (r.upheld) dq(c.against, `upheld complaint from trustee ${c.from}`);
      else falseComplaints.push({ phase: 1, from: c.from, against: c.against });
    }
    const QUAL = [];
    for (let i = 1; i <= n; i++) if (!disqualified[i]) QUAL.push(i);
    if (QUAL.length < t) return { ok: false, error: `only ${QUAL.length} qualified dealers; at least ${t} are needed`, disqualified };

    // Phase 2: dealers in QUAL that do not post valid Feldman values, or whose values
    // are shown wrong by a complaint, are rebuilt from their phase-1 shares.
    const needRebuild = new Map();
    if (tr.phase2) {
      for (const i of QUAL) {
        const m = phase2[i - 1];
        if (!m || !validPoints(m.A, t)) needRebuild.set(i, "no valid phase-2 message");
      }
      for (const c of complaints2) {
        const i = c.against;
        if (!QUAL.includes(i) || needRebuild.has(i)) continue;
        const r = open(c, 2);
        if (!r) ignoredComplaints.push({ phase: 2, from: c.from, against: i, why: "invalid key proof" });
        else if (r.upheld) needRebuild.set(i, `upheld phase-2 complaint from trustee ${c.from}`);
        else falseComplaints.push({ phase: 2, from: c.from, against: i });
      }
    }
    const state = { QUAL, disqualified, needRebuild: [...needRebuild.keys()], falseComplaints, ignoredComplaints };
    if (!tr.phase2) return { ok: true, partial: true, ...state };

    // Contributions: dealers with valid Feldman values are summed coefficient by
    // coefficient (Σ_i A_ik); rebuilt dealers are known in clear as polynomials.
    const sumA = Array.from({ length: t }, () => O);
    const rebuiltPts = [];
    for (const i of QUAL) {
      if (!needRebuild.has(i)) { phase2[i - 1].A.forEach((Ak, k) => { sumA[k] = add(sumA[k], Ak); }); continue; }
      const pts = [], seen = new Set();
      for (const r of reveals) {
        if (r.of !== i || seen.has(r.from) || r.from === i || !(r.from >= 1 && r.from <= n)) continue;
        if (!isScalar(r.s) || !isScalar(r.s2)) continue;
        if (!eq(add(mul(G, r.s), mul(H2, r.s2)), commitEval(phase1[i - 1].C, r.from))) continue;
        seen.add(r.from); pts.push({ i: r.from, y: r.s });
      }
      if (pts.length < t) return { ok: false, error: `dealer ${i} must be rebuilt but only ${pts.length} valid shares were revealed`, ...state };
      const use = pts.slice(0, t);
      rebuilt.push({ dealer: i, why: needRebuild.get(i), from: use.map((p) => p.i) });
      rebuiltPts.push(use);
    }
    const at = (x) => add(commitEval(sumA, x), mul(G, rebuiltPts.reduce((acc, use) => mod(acc + interpolate(use, x)), 0n)));
    const PK = at(0);
    const publicShares = [];
    for (let j = 1; j <= n; j++) publicShares.push({ index: j, PK: at(j) });
    return { ok: true, ...state, rebuilt, PK, publicShares, hash: transcriptHash(tr) };
  }

  // keccak256 over a canonical encoding of the transcript (the contract's trusteeSetHash).
  function transcriptHash(tr) {
    const parts = [];
    const pt = (P) => { const [x, y] = coords(P); parts.push(u256(x), u256(y)); };
    const sc = (x) => parts.push(u256(x));
    const { context: c } = tr;
    sc(BigInt(c.pollId)); sc(BigInt(c.n)); sc(BigInt(c.t)); c.trusteeKeys.forEach(pt);
    (tr.phase1 || []).forEach((m, i) => { sc(BigInt(i + 1)); if (!m) return sc(0n); m.C.forEach(pt); m.enc.forEach((e) => { sc(e.s); sc(e.s2); }); });
    const comp = (list, tag) => (list || []).forEach((x) => { sc(tag); sc(BigInt(x.from)); sc(BigInt(x.against)); pt(x.K); pt(x.proof.T1); pt(x.proof.T2); sc(x.proof.z); });
    comp(tr.complaints1, 1n);
    (tr.phase2 || []).forEach((m, i) => { sc(BigInt(i + 1)); if (!m) return sc(0n); m.A.forEach(pt); });
    comp(tr.complaints2, 2n);
    (tr.reveals || []).forEach((r) => { sc(3n); sc(BigInt(r.from)); sc(BigInt(r.of)); sc(r.s); sc(r.s2); });
    return keccak(...parts);
  }

  // ------------------------------------------------------------ orchestration
  // Runs one session over a simulated public board. `cheat` lets tests replace any
  // trustee's messages: { phase1(i, msg), check1(i, list), phase2(i, msg), check2(i, list), reveal(i, r) }.
  function run({ pollId = 0n, trustees, t, cheat = {} }) {
    const n = trustees.length;
    const context = { pollId, n, t, trusteeKeys: trustees.map((x) => x.E) };
    const hook = (name, i, v) => (cheat[name] ? cheat[name](i, v) : v);
    trustees.forEach((x) => x.start(context));
    const phase1 = trustees.map((x) => hook("phase1", x.index, x.phase1()));
    const complaints1 = trustees.flatMap((x) => hook("check1", x.index, x.check1(phase1)) || []);
    const mid = verifyTranscript({ context, phase1, complaints1 });
    if (!mid.ok) return { ok: false, error: mid.error, transcript: { context, phase1, complaints1 } };
    const phase2 = trustees.map((x) => (mid.QUAL.includes(x.index) ? hook("phase2", x.index, x.phase2()) : null));
    const complaints2 = trustees.flatMap((x) => hook("check2", x.index, x.check2(mid.QUAL, phase2)) || []);
    const mid2 = verifyTranscript({ context, phase1, complaints1, phase2, complaints2, reveals: [] });
    const reveals = [];
    for (const i of mid2.needRebuild || [])
      for (const x of trustees) if (x.index !== i) { const r = hook("reveal", x.index, x.reveal(i)); if (r) reveals.push(r); }
    const transcript = { context, phase1, complaints1, phase2, complaints2, reveals };
    const out = verifyTranscript(transcript);
    if (!out.ok) return { ok: false, error: out.error, transcript };
    const finished = trustees.map((x) => ({ index: x.index, ...x.finish(out) }));
    return { ...out, transcript, finished };
  }

  return { H2, contextId, newTrustee, run, verifyTranscript, transcriptHash, interpolate };
}

module.exports = { build };
