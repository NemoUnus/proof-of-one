// SPDX-License-Identifier: Apache-2.0
// Proof of One — keyed document fingerprints (OPRF over Baby Jubjub), reference code.
// Whitepaper §6.6 and §7.5; Decision Log #43, #47 and #58. Specification:
// docs/specs/document-fingerprint-oprf-v0.1.md.
//
// The uniqueness service holds a secret key k (public key K = k·G). For a document it
// must compute two stable values without ever seeing the document's fields:
//   person key   Fp: from nationality, personal number (path 1) or MRZ name (path 2),
//                    birth date and sex — the same person, across renewals;
//   document key Fd: from the issuing state and the document number — the same document.
// For each:  x = HashToCurve(fields)            on the phone (deterministic point)
//            B = r·x, r random and odd         on the phone (blinded; sent to the service)
//            Z = k·B, with a DLEQ proof        by the service (proves it used K's k)
//            W = r⁻¹·Z = k·x;  F = H(x, W)     on the phone
// The enrolment proof π_doc shows that x comes from the signed DG1, that B = r·x and
// Z = r·W, and outputs F; so the service gets F bound to the document, and learns nothing
// else about the fields. Without k, F cannot be computed, so the small space of the
// fields cannot be searched.
//
// Hash to curve: two field elements from Poseidon, each mapped with Elligator 2 on the
// Montgomery form of Baby Jubjub (modelled on RFC 9380's map_to_curve_elligator2), the
// two points added, the cofactor 8 cleared. This is a custom construction for a
// circuit-friendly curve; it is NOT one of RFC 9380/9497's suites and needs review.
//
// SYNTHETIC DATA in tests only. This is reference code: NOT constant-time.
"use strict";
const crypto = require("crypto");
const { buildBabyjub, buildPoseidon } = require("circomlibjs");

const P = 21888242871839275222246405745257275088548364400416034343698204186575808495617n; // BN254 scalar field
const L = 2736030358979909402780800718157159386076813972158567259200215660948447373041n;  // Baby Jubjub subgroup order
const MA = 168698n;   // Montgomery form: v² = u³ + A·u² + u (B = 1)
const Z = 5n;         // the smallest non-square mod P
const ascii = (s) => BigInt("0x" + Buffer.from(s, "ascii").toString("hex"));
const DST_H2C = ascii("PoO-fingerprint-h2c-v1");
const DST_F = ascii("PoO-fingerprint-F-v1");
const DST_DLEQ = ascii("PoO-fingerprint-dleq-v1");
const PATH_NUMBER = 1n, PATH_NAME = 2n, TAG_DOCUMENT = 3n;

const mod = (a, m = P) => ((a % m) + m) % m;
function pow(b, e, m = P) { let r = 1n; b = mod(b, m); while (e > 0n) { if (e & 1n) r = r * b % m; b = b * b % m; e >>= 1n; } return r; }
const inv = (a, m = P) => pow(a, m - 2n, m);
const isSquare = (a) => a === 0n || pow(a, (P - 1n) / 2n) === 1n;
// Tonelli–Shanks (P ≡ 1 mod 8).
function sqrt(a) {
  a = mod(a);
  if (a === 0n) return 0n;
  if (!isSquare(a)) throw new Error("not a square");
  let q = P - 1n, s = 0n;
  while ((q & 1n) === 0n) { q >>= 1n; s++; }
  let m = s, c = pow(Z, q), t = pow(a, q), r = pow(a, (q + 1n) / 2n);
  while (t !== 1n) {
    let i = 0n, tt = t;
    while (tt !== 1n) { tt = tt * tt % P; i++; }
    const b = pow(c, 1n << (m - i - 1n));
    m = i; c = b * b % P; t = t * c % P; r = r * b % P;
  }
  return r;
}

let bj = null, poseidon = null;
async function init() {
  if (!bj) { bj = await buildBabyjub(); poseidon = await buildPoseidon(); }
  const F = bj.F;
  const H = (xs) => poseidon.F.toObject(poseidon(xs.map((v) => BigInt(v))));
  const toPt = (p) => [F.e(p[0]), F.e(p[1])];
  const fromPt = (p) => [F.toObject(p[0]), F.toObject(p[1])];
  const add = (a, b) => fromPt(bj.addPoint(toPt(a), toPt(b)));
  const mul = (a, k) => fromPt(bj.mulPointEscalar(toPt(a), mod(BigInt(k), L)));
  const mulRaw = (a, k) => fromPt(bj.mulPointEscalar(toPt(a), BigInt(k)));
  const G = fromPt(bj.Base8);
  const eq = (a, b) => a[0] === b[0] && a[1] === b[1];
  // Every point received from outside must be on the curve and in the prime-order subgroup.
  const valid = (p) => Array.isArray(p) && p.length === 2 && p.every((v) => typeof v === "bigint" && v >= 0n && v < P) &&
    bj.inCurve(toPt(p)) && bj.inSubgroup(toPt(p)) && !eq(p, [0n, 1n]);

  // Elligator 2 on v² = u³ + A·u² + u, then to twisted Edwards (x = u/v, y = (u−1)/(u+1)).
  // Returns the point and the hints the circuit needs: v (Montgomery y) and e (1 if the
  // first candidate was used). The sign rule: v is odd exactly when e = 1.
  function map(t) {
    t = mod(BigInt(t));
    const den = mod(1n + Z * t * t);
    if (den === 0n) throw new Error("exceptional input to the map");
    const u1 = mod(-MA * inv(den));
    const g = (u) => mod(u * u * u + MA * u * u + u);
    const e = isSquare(g(u1)) ? 1n : 0n;
    const u = e ? u1 : mod(-u1 - MA);
    let v = sqrt(g(u));
    if ((v & 1n) !== e) v = mod(-v);
    if (v === 0n || mod(u + 1n) === 0n) throw new Error("exceptional input to the map");
    return { point: [mod(u * inv(v)), mod((u - 1n) * inv(u + 1n))], v, e };
  }

  // HashToCurve(tag, 5 values): u_i = Poseidon(DST, tag, values…, i), i = 0, 1.
  function hashToCurve(tag, vals) {
    if (vals.length !== 5) throw new Error("five values expected");
    const m0 = map(H([DST_H2C, tag, ...vals, 0n])), m1 = map(H([DST_H2C, tag, ...vals, 1n]));
    const x = mulRaw(add(m0.point, m1.point), 8n);
    if (!valid(x)) throw new Error("hash to curve failed");
    return { x, hints: [m0, m1] };
  }

  // The fields of a TD3 passport's DG1 (93 bytes: 5 header bytes, then 2 × 44 MRZ characters).
  function fields(dg1, currentYear) {
    const mrz = Buffer.from(dg1).subarray(5, 93);
    const l1 = mrz.subarray(0, 44), l2 = mrz.subarray(44, 88);
    const code3 = (b) => BigInt(b[0]) * 65536n + BigInt(b[1]) * 256n + BigInt(b[2]);
    const big = (b) => BigInt("0x" + Buffer.from(b).toString("hex"));
    const num = (a, b) => Number(l2.subarray(a, b).toString("ascii"));
    const yy = num(13, 15), by = yy > currentYear % 100 ? 1900 + yy : 2000 + yy;
    const birthDay = BigInt(Math.round((Date.UTC(by, num(15, 17) - 1, num(17, 19)) - Date.UTC(1900, 0, 1)) / 86400000));
    const sex = String.fromCharCode(l2[20]);
    return {
      issuer: code3(l1.subarray(2, 5)), natCode: code3(l2.subarray(10, 13)),
      name0: big(l1.subarray(5, 36)), name1: big(l1.subarray(36, 44)),
      docNumber: big(l2.subarray(0, 9)), personalNumber: big(l2.subarray(28, 42)),
      birthDay, sexCode: sex === "M" ? 1n : sex === "F" ? 2n : 0n,
    };
  }
  // The value of the DG13 field with tag `tag` (spec §3; circuits/lib/fingerprint.circom,
  // Dg13Field): the value left-aligned in 31 bytes, and its length.
  function dg13Field(dg13, tag) {
    const b = Buffer.from(dg13);
    if (b[0] !== 0x6d) throw new Error("not a DG13");
    let cs, clen;
    if (b[1] < 0x80) { cs = 2; clen = b[1]; } else if (b[1] === 0x81) { cs = 3; clen = b[2]; } else if (b[1] === 0x82) { cs = 4; clen = b[2] * 256 + b[3]; } else throw new Error("DG13 length");
    const end = cs + clen;
    let i = cs, hit = null, n = 0;
    while (i < end) {
      const two = (b[i] & 0x1f) === 0x1f, tl = two ? 2 : 1, t = two ? b[i] * 256 + b[i + 1] : b[i];
      const lb = b[i + tl];
      let L, hl;
      if (lb < 0x80) { L = lb; hl = tl + 1; } else if (lb === 0x81) { L = b[i + tl + 1]; hl = tl + 2; } else throw new Error("DG13 field length");
      if (t === Number(tag)) { hit = b.subarray(i + hl, i + hl + L); n++; }
      i += hl + L;
    }
    if (i !== end || n !== 1) throw new Error("DG13 field not found exactly once");
    if (hit.length < 1 || hit.length > 31) throw new Error("DG13 field length out of range");
    return { value: BigInt("0x" + Buffer.concat([hit, Buffer.alloc(31 - hit.length)]).toString("hex")), len: BigInt(hit.length) };
  }

  // The values hashed for each key (path: 1 = personal number, 2 = name). With `rule`
  // { dg13, pnTag }, path 1 takes the number from that DG13 field (pnSrc = 1).
  function personValues(f, path, rule = null) {
    if (BigInt(path) === PATH_NUMBER && rule) { const d = dg13Field(rule.dg13, rule.pnTag); return [f.natCode, d.value, d.len, f.birthDay, f.sexCode]; }
    if (BigInt(path) === PATH_NUMBER) return [f.natCode, f.personalNumber, 0n, f.birthDay, f.sexCode];
    if (BigInt(path) === PATH_NAME) return [f.natCode, f.name0, f.name1, f.birthDay, f.sexCode];
    throw new Error("unknown path");
  }
  const documentValues = (f) => [f.issuer, f.docNumber, 0n, 0n, 0n];

  // Phone: a random odd blinding scalar in [1, ℓ) (odd, so that Z = r·W fixes W, see spec).
  function randomR() {
    for (;;) { const r = mod(BigInt("0x" + crypto.randomBytes(64).toString("hex")), L); if (r & 1n) return r; }
  }
  const blind = (x, r) => mul(x, r);

  // Service: Z = k·B with a Chaum–Pedersen proof that log_G K = log_B Z.
  function evaluate(k, B) {
    if (!valid(B)) throw new Error("invalid blinded point");
    const Zp = mul(B, k), K = mul(G, k);
    const t = mod(BigInt("0x" + crypto.randomBytes(64).toString("hex")), L);
    const T1 = mul(G, t), T2 = mul(B, t);
    const c = mod(H([DST_DLEQ, ...K, ...B, ...Zp, ...T1, ...T2]), L);
    return { Z: Zp, proof: { c, s: mod(t + c * BigInt(k), L) } };
  }
  // Phone: checks the service's answer.
  function verifyEvaluation(K, B, Zp, { c, s }) {
    if (!valid(K) || !valid(B) || !valid(Zp)) return false;
    const negc = mod(-BigInt(c), L);
    const T1 = add(mul(G, s), mul(K, negc)), T2 = add(mul(B, s), mul(Zp, negc));
    return mod(H([DST_DLEQ, ...K, ...B, ...Zp, ...T1, ...T2]), L) === BigInt(c);
  }
  // Phone: W = r⁻¹·Z = k·x and the fingerprint F = Poseidon(DST, x, W).
  function finish(x, r, Zp) {
    const W = mul(Zp, inv(BigInt(r), L));
    return { W, F: H([DST_F, ...x, ...W]) };
  }

  // Phone, round 1: the two points to send, blinded. Round 2: with the service's answers,
  // the fingerprints and the inputs of π_doc's DocumentKeys (circuits/lib/fingerprint.circom).
  function prepare(dg1, currentYear, path, rule = null) {
    if (rule && BigInt(path) !== PATH_NUMBER) throw new Error("a DG13 rule applies to path 1 only");
    const f = fields(dg1, currentYear);
    const one = (tag, vals) => { const h = hashToCurve(tag, vals), r = randomR(); return { x: h.x, hints: h.hints, r, B: blind(h.x, r) }; };
    return { f, path: BigInt(path), rule, person: one(BigInt(path), personValues(f, path, rule)), document: one(TAG_DOCUMENT, documentValues(f)) };
  }
  const inv8 = inv(8n, L);
  function complete(prep, Zp, Zd) {
    const fin = (o, Zx) => ({ ...finish(o.x, o.r, Zx), Zx });
    const p = fin(prep.person, Zp), d = fin(prep.document, Zd);
    const io = (o, w) => ({ V: o.hints.map((h) => h.v), E: o.hints.map((h) => h.e), R: o.r, Vw: mul(w.W, inv8), B: o.B, Z: w.Zx });
    const P_ = io(prep.person, p), D_ = io(prep.document, d);
    return {
      personKey: p.F, documentKey: d.F, issuer: prep.f.issuer,
      input: { path: prep.path, pnSrc: prep.rule ? 1n : 0n, pV: P_.V, pE: P_.E, pR: P_.R, pVw: P_.Vw, pB: P_.B, pZ: P_.Z,
        dV: D_.V, dE: D_.E, dR: D_.R, dVw: D_.Vw, dB: D_.B, dZ: D_.Z },
    };
  }

  return { P, L, G, H, add, mul, valid, map, hashToCurve, prepare, complete, dg13Field, fields, personValues, documentValues, randomR, blind, evaluate,
    verifyEvaluation, finish, keyOf: (k) => mul(G, k), PATH_NUMBER, PATH_NAME, TAG_DOCUMENT };
}

module.exports = { init, sqrt, isSquare, P, L, MA, Z, DST_H2C, DST_F, DST_DLEQ };
