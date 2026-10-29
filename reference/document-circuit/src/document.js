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

const MAX_E = 448, MAX_SA = 192, DEPTH = 16;
const WASM = path.join(__dirname, "..", "build", "document_js", "document.wasm");
// Compiled circuit of each suite (npm run build builds suite 1, npm run build:s2 suite 2).
const wasmOf = (suite = 1) => suite === 1 ? WASM
  : path.join(__dirname, "..", "build", `${I.SUITES[suite].circuit}_js`, `${I.SUITES[suite].circuit}.wasm`);

let poseidon = null;
async function init() {
  if (!poseidon) poseidon = await buildPoseidon();
  const H = (xs) => poseidon.F.toObject(poseidon(xs.map(BigInt)));
  return { H };
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
function buildInput(doc, { tree, leafIndex, today, currentYear, cm = 1n, challenge = 1n, rFace = 7n }) {
  const S = I.SUITES[doc.suite ?? 1];
  const P = I.prefixes(I.HASH_LEN[S.lds]), PM = I.prefixes(I.HASH_LEN[S.sig]);
  const dg1 = shaPad(doc.dg1, 128);
  const e = shaPad(doc.eContent, MAX_E), sa = shaPad(doc.signedAttrs, MAX_SA);
  const dg1Off = doc.eContent.indexOf(Buffer.concat([P.dg1Hash, I.digest(S.lds, doc.dg1)]));
  const dg2Off = doc.eContent.indexOf(P.dg2Hash);
  const mdOff = doc.signedAttrs.indexOf(PM.messageDigest);
  if (dg1Off < 0 || dg2Off < 0 || mdOff < 0) throw new Error("unexpected document structure");
  const { siblings, pathIndex } = tree.path(leafIndex);
  return {
    dscRoot: tree.root, today: BigInt(today), currentYear: BigInt(currentYear), cm, challenge,
    dg1: dg1.bytes, eContent: e.bytes, eLen: BigInt(e.len), dg1Off: BigInt(dg1Off), dg2Off: BigInt(dg2Off),
    sa: sa.bytes, saLen: BigInt(sa.len), mdOff: BigInt(mdOff),
    signature: limbs(BigInt("0x" + doc.signature.toString("hex")), 121, S.k), modulus: I.modulusChunks(doc.dscCert, S.id),
    exponent: I.exponentOf(doc.dscCert),
    dscSiblings: siblings, dscPathIndex: pathIndex.map(BigInt), rFace,
  };
}

// Computes the witness; rejects if any constraint fails. Returns the public signals
// (outputs first, then public inputs, in circom order).
async function witness(input, suite = 1) {
  const wtns = { type: "mem" };
  await snarkjs.wtns.calculate(input, wasmOf(suite), wtns);
  const w = await snarkjs.wtns.exportJson(wtns);
  return { outputs: { birthDay: w[1], sexCode: w[2], natCode: w[3], expMonth: w[4], cFace: w[5] }, raw: w };
}
async function prove(input, zkey, suite = 1) { return snarkjs.groth16.fullProve(input, wasmOf(suite), zkey); }
async function verify(vkey, publicSignals, proof) { return snarkjs.groth16.verify(vkey, publicSignals, proof); }

module.exports = { MAX_E, MAX_SA, DEPTH, WASM, wasmOf, init, shaPad, limbs, expected, natCodeOf, buildInput, witness, prove, verify, IncrementalTree };
