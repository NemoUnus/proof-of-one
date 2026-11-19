// SPDX-License-Identifier: Apache-2.0
// Inputs for the document-validity proof π_doc (circuits/document.circom), and the
// values the circuit is expected to output. What runs here runs on the phone.
"use strict";

const path = require("path");
const snarkjs = require("snarkjs");
const { buildPoseidon } = require("circomlibjs");
const I = require("./icao");
const { IncrementalTree } = require("../../ballot-circuit/src/trees");
const A = require("../../ballot-circuit/src/attrs");

const MAX_E = 448, MAX_SA = 192, DEPTH = 16, MAX_DG13 = 512;
const WASM = path.join(__dirname, "..", "build", "document_js", "document.wasm");
// Compiled circuit of each suite (npm run build builds suite 1, npm run build:s2 suite 2).
const wasmOf = (suite = 1) => suite === 1 ? WASM
  : path.join(__dirname, "..", "build", `${I.SUITES[suite].circuit}_js`, `${I.SUITES[suite].circuit}.wasm`);

let poseidon = null, FP = null;
// TEST ONLY: the key of the synthetic uniqueness service used when an input is built
// without the service's answers (tests and benchmarks).
const TEST_SERVICE_KEY = 1234567891011121314151617181920n;
async function init() {
  if (!poseidon) poseidon = await buildPoseidon();
  if (!FP) FP = await require("./fingerprint").init();
  const H = (xs) => poseidon.F.toObject(poseidon(xs.map(BigInt)));
  return { H, FP };
}
// The fingerprint part of the input (step 8): the phone's two rounds with a service.
// `answer(B)` returns the service's Z for a blinded point; by default the TEST-ONLY service.
function keysFor(dg1, currentYear, path = 1, answer = (B) => FP.evaluate(TEST_SERVICE_KEY, B).Z, rule = null) {
  if (!FP) throw new Error("call init() first");
  const prep = FP.prepare(dg1, currentYear, path, rule);
  return FP.complete(prep, answer(prep.person.B), answer(prep.document.B));
}

// SHA-256 padding (SHA-1 pads the same way), then zeros up to `max` bytes.
function shaPad(buf, max) {
  const bitLen = BigInt(buf.length) * 8n;
  let padded = Buffer.concat([buf, Buffer.from([0x80])]);
  while (padded.length % 64 !== 56) padded = Buffer.concat([padded, Buffer.from([0])]);
  const l = Buffer.alloc(8); l.writeBigUInt64BE(bitLen); padded = Buffer.concat([padded, l]);
  if (padded.length > max) throw new Error(`data too long: ${padded.length} > ${max} bytes after padding`);
  return { bytes: [...padded, ...new Array(max - padded.length).fill(0)].map(BigInt), len: padded.length };
}
function limbs(x, n = 121, k = 17) {
  const out = []; for (let i = 0; i < k; i++) { out.push(x & ((1n << BigInt(n)) - 1n)); x >>= BigInt(n); } return out;
}

// Hints for the RSA check (circuits/lib/rsa_pkcs1.circom): quotient and remainder of each
// modular multiplication of signature^e mod n, in the circuit's order, as limbs. Suite 1
// (e = 65537): 16 squarings of the signature, then a multiplication by it. Other suites:
// for each of the EBITS exponent bits from the top, a squaring and a multiplication by the
// signature (both always computed; the multiplication is kept when the bit is 1).
function rsaHints(sig, n, e, k, ebits) {
  const q = [], r = [];
  const mul = (a, b) => { const p = a * b; q.push(limbs(p / n, 121, k)); r.push(limbs(p % n, 121, k)); return p % n; };
  if (!ebits) {
    let acc = sig;
    for (let i = 0; i < 16; i++) acc = mul(acc, acc);
    mul(sig, acc);
  } else {
    let acc = 1n;
    for (let s = 0; s < ebits; s++) {
      const sq = mul(acc, acc), m = mul(sq, sig);
      acc = (e >> BigInt(ebits - 1 - s)) & 1n ? m : sq;
    }
  }
  return { rsaQ: q, rsaR: r };
}

// What the circuit outputs, computed directly from the MRZ (for checking).
function expected(mrz, currentYear) {
  const l2 = mrz.slice(44);
  const yy = +l2.slice(13, 15), cy = currentYear % 100;
  const by = yy > cy ? 1900 + yy : 2000 + yy;
  const ey = 2000 + +l2.slice(21, 23), em = +l2.slice(23, 25);
  const nat = l2.slice(10, 13);
  return {
    birthDay: BigInt(A.dayNumber(by, +l2.slice(15, 17), +l2.slice(17, 19))),
    sexCode: BigInt(l2[20] === "M" ? 1 : l2[20] === "F" ? 2 : 0),
    natCode: BigInt(nat.charCodeAt(0) * 65536 + nat.charCodeAt(1) * 256 + nat.charCodeAt(2)),
    expMonth: BigInt(ey * 12 + em),
    expiryDay: A.dayNumber(ey, em, +l2.slice(25, 27)),
  };
}
const natCodeOf = A.natCode;

// Circuit input for one document. `dsc` = { tree, index } from icao.buildDscTree.
// `pnTag`: when the issuer's rule puts the personal number in DG13 under this tag, the
// person key takes it from there (doc.dg13 must be present).
function buildInput(doc, { tree, leafIndex, today, currentYear, cm = 1n, challenge = 1n, rFace = 7n, keys = null, pnTag = null }) {
  const rule = pnTag === null ? null : { dg13: doc.dg13, pnTag: BigInt(pnTag) };
  keys = keys || keysFor(doc.dg1, currentYear, 1, undefined, rule);
  const S = I.SUITES[doc.suite ?? 1];
  const P = I.prefixes(I.HASH_LEN[S.lds]), PM = I.prefixes(I.HASH_LEN[S.sig]);
  const dg1 = shaPad(doc.dg1, 128);
  const e = shaPad(doc.eContent, MAX_E), sa = shaPad(doc.signedAttrs, MAX_SA);
  const dg1Off = doc.eContent.indexOf(Buffer.concat([P.dg1Hash, I.digest(S.lds, doc.dg1)]));
  const dg2Off = doc.eContent.indexOf(P.dg2Hash);
  const mdOff = doc.signedAttrs.indexOf(PM.messageDigest);
  if (dg1Off < 0 || dg2Off < 0 || mdOff < 0) throw new Error("unexpected document structure");
  // DG13 (step 8a): when unused, any bytes; the entry checked is then DG1's.
  let d13 = { bytes: Array(MAX_DG13).fill(0n), len: 64 }, d13Off = dg1Off;
  if (pnTag !== null) {
    d13 = shaPad(doc.dg13, MAX_DG13);
    d13Off = doc.eContent.indexOf(Buffer.concat([P.dg13Hash, I.digest(S.lds, doc.dg13)]));
    if (d13Off < 0) throw new Error("no DG13 entry in the security object");
  }
  const { siblings, pathIndex } = tree.path(leafIndex);
  const sigInt = BigInt("0x" + doc.signature.toString("hex"));
  const nInt = BigInt("0x" + doc.dscCert.publicKey.n.toString(16));
  return {
    dscRoot: tree.root, today: BigInt(today), currentYear: BigInt(currentYear), cm, challenge,
    dg1: dg1.bytes, eContent: e.bytes, eLen: BigInt(e.len), dg1Off: BigInt(dg1Off), dg2Off: BigInt(dg2Off),
    sa: sa.bytes, saLen: BigInt(sa.len), mdOff: BigInt(mdOff),
    signature: limbs(sigInt, 121, S.k), modulus: I.modulusChunks(doc.dscCert, S.id),
    exponent: I.exponentOf(doc.dscCert),
    dscSiblings: siblings, dscPathIndex: pathIndex.map(BigInt), rFace,
    ...rsaHints(sigInt % nInt, nInt, I.exponentOf(doc.dscCert), S.k, S.fixedE === null ? S.ebits : 0),
    ...keys.input,
    pnTag: pnTag === null ? 0n : BigInt(pnTag), dg13: d13.bytes, d13Len: BigInt(d13.len), d13Off: BigInt(d13Off),
  };
}

// Computes the witness; rejects if any constraint fails. Returns the public signals
// (outputs first, then public inputs, in circom order).
async function witness(input, suite = 1) {
  const wtns = { type: "mem" };
  await snarkjs.wtns.calculate(input, wasmOf(suite), wtns);
  const w = await snarkjs.wtns.exportJson(wtns);
  return { outputs: { birthDay: w[1], sexCode: w[2], natCode: w[3], expMonth: w[4], cFace: w[5], personKey: w[6], documentKey: w[7], issuer: w[8] }, raw: w };
}
async function prove(input, zkey, suite = 1) { return snarkjs.groth16.fullProve(input, wasmOf(suite), zkey); }
async function verify(vkey, publicSignals, proof) { return snarkjs.groth16.verify(vkey, publicSignals, proof); }

module.exports = { TEST_SERVICE_KEY, keysFor, MAX_DG13, MAX_E, MAX_SA, DEPTH, WASM, wasmOf, init, shaPad, limbs, rsaHints, expected, natCodeOf, buildInput, witness, prove, verify, IncrementalTree };
