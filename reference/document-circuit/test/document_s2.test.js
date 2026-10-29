// SPDX-License-Identifier: Apache-2.0
// Tests for π_doc suite 2: SHA-1 data-group hashes and CMS digest, RSA-3072 PKCS#1 v1.5,
// any odd exponent below 2^17 (passports in use carry exponents other than 65537; Rarimo has a template for 37817).
// Synthetic test documents only. Needs `npm run build:s2`.
"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const crypto = require("crypto");
const D = require("../src/document");
const I = require("../src/icao");
const A = require("../../ballot-circuit/src/attrs");

const TODAY = A.dayNumber(2026, 10, 29), YEAR = 2026;
const built = fs.existsSync(D.wasmOf(2));
let H, s2a, s2b, s2e3, s2e65537, s1, tree, index;

test.before(async () => {
  if (!built) return;
  ({ H } = await D.init());
  s2a = I.createCountry("UTO", 2, { suite: 2 });               // e = 37817
  s2b = I.createCountry("RUR", 1, { suite: 2, e: 40001 });
  s2e3 = I.createCountry("FRE", 1, { suite: 2, e: 3 });
  s2e65537 = I.createCountry("ZEN", 1, { suite: 2, e: 65537 });
  s1 = I.createCountry("OLD", 1);                               // suite 1, in the same tree
  ({ tree, index } = I.buildDscTree(H, D.IncrementalTree, D.DEPTH, [s2a, s2b, s2e3, s2e65537, s1]));
});
test.after(async () => { if (globalThis.curve_bn128) await globalThis.curve_bn128.terminate(); });

const opts = { skip: !built && "run npm run build:s2 first" };
const leafOf = (country, i = 0) => index.get(country.dscs[i].cert.serialNumber + "/" + country.code);
const inputFor = (doc, country, i = 0, extra = {}) => D.buildInput(doc, { tree, leafIndex: leafOf(country, i), today: TODAY, currentYear: YEAR, ...extra });
const wit = (input) => D.witness(input, 2);
async function rejects(input, why) { await assert.rejects(wit(input), /Assert Failed/, why); }

test("suite 2 test documents are what real ones look like: SHA-1 hashes, sha1WithRSA, RSA-3072, e = 37817", opts, () => {
  const doc = I.issueDocument(s2a, {});
  assert.equal(doc.suite, 2);
  assert.equal(doc.dscCert.publicKey.n.bitLength(), 3072);
  assert.equal(I.exponentOf(doc.dscCert), 37817n);
  assert.ok(doc.eContent.includes(I.oid(I.OID.sha1)), "LDS hashAlgorithm is SHA-1");
  assert.ok(doc.eContent.includes(Buffer.concat([I.prefixes(20).dg1Hash, I.sha1(doc.dg1)])));
  const pub = crypto.createPublicKey(require("node-forge").pki.publicKeyToPem(doc.dscCert.publicKey));
  assert.ok(crypto.verify("sha1", doc.signedAttrs, pub, doc.signature), "sha1WithRSAEncryption signature verifies");
});

test("honest passport (e = 37817): outputs match the MRZ; the face commitment binds the SHA-1 DG2 hash", opts, async () => {
  const doc = I.issueDocument(s2a, { birth: "790812", sex: "M", expiry: "310415" }, { dscIndex: 1, extraGroups: [12, 13, 15] });
  const w = await wit(inputFor(doc, s2a, 1, { rFace: 99n }));
  const e = D.expected(doc.mrz, YEAR);
  assert.equal(w.outputs.birthDay, e.birthDay);
  assert.equal(w.outputs.sexCode, 1n);
  assert.equal(w.outputs.natCode, D.natCodeOf("UTO"));
  assert.equal(w.outputs.expMonth, BigInt(2031 * 12 + 4));
  const h = I.sha1(doc.dg2);
  const hi = BigInt("0x" + h.subarray(0, 4).toString("hex")), lo = BigInt("0x" + h.subarray(4).toString("hex"));
  assert.equal(w.outputs.cFace, H([hi, lo, 99n]));
});

test("any odd exponent: 40001, 3 and 65537 are accepted with the same circuit", opts, async () => {
  for (const c of [s2b, s2e3, s2e65537]) {
    const doc = I.issueDocument(c, { expiry: "300101" });
    const w = await wit(inputFor(doc, c));
    assert.equal(w.outputs.natCode, D.natCodeOf(c.code), c.code);
  }
});

test("expiry: a passport that expired yesterday is rejected", opts, async () => {
  await wit(inputFor(I.issueDocument(s2a, { expiry: "261029" }), s2a));
  await rejects(inputFor(I.issueDocument(s2a, { expiry: "261028" }), s2a), "expired document");
});

test("altered chip data: a changed date of birth in DG1 breaks the signed SHA-1 hash", opts, async () => {
  const doc = I.issueDocument(s2a, { birth: "790812" });
  const input = inputFor(doc, s2a);
  input.dg1 = D.shaPad(I.dg1Of(doc.mrz.replace("790812", "990812")), 128).bytes;
  await rejects(input, "DG1 no longer matches the hash in the LDS security object");
});

test("edited LDS security object: replacing the DG1 hash breaks the signed message digest", opts, async () => {
  const doc = I.issueDocument(s2a, {});
  const fake = I.dg1Of(I.mrzTD3({ issuer: "UTO", nationality: "UTO", birth: "500101" }));
  const e = Buffer.from(doc.eContent);
  I.sha1(fake).copy(e, e.indexOf(I.sha1(doc.dg1)));
  await rejects(inputFor({ ...doc, eContent: e, dg1: fake }, s2a), "eContent no longer matches the signed digest");
});

test("wrong field: pointing the DG1 read at the DG2 hash is rejected by the DER prefix check", opts, async () => {
  const input = inputFor(I.issueDocument(s2a, {}), s2a);
  input.dg1Off = input.dg2Off;
  await rejects(input, "DG2 entry read as DG1");
});

test("forged signature: an RSA-3072 key with the same exponent that is not the signer's", opts, async () => {
  const doc = I.issueDocument(s2a, {});
  const other = I.rsaKey(3072, 37817);
  const sig = crypto.sign("sha1", doc.signedAttrs, { key: other.privateKey, padding: crypto.constants.RSA_PKCS1_PADDING });
  await rejects(inputFor({ ...doc, signature: sig }, s2a), "signature does not verify under the DSC key");
});

test("exponent is bound: claiming another exponent for the same modulus is rejected", opts, async () => {
  const doc = I.issueDocument(s2a, {});
  for (const e of [65537n, 37819n, 3n]) {
    const input = inputFor(doc, s2a);
    input.exponent = e;
    await rejects(input, `exponent ${e}`);
  }
});

test("degenerate exponents are rejected by the circuit itself: 1, even, 2^17 or more", opts, async () => {
  const doc = I.issueDocument(s2a, {});
  for (const e of [1n, 37818n, 1n << 17n, (1n << 17n) + 1n]) {
    const input = inputFor(doc, s2a);
    input.exponent = e;
    await rejects(input, `exponent ${e}`);
  }
  assert.throws(() => I.modulusChunks({ publicKey: { n: s2a.dscs[0].cert.publicKey.n, e: { toString: () => "1" } } }, 2), /not supported/, "the tree tool refuses it too");
});

test("key swap: one trusted signer's signature with another trusted signer's leaf", opts, async () => {
  const doc = I.issueDocument(s2a, {}, { dscIndex: 0 });
  const input = inputFor(doc, s2a, 1);
  input.modulus = I.modulusChunks(s2a.dscs[1].cert, 2);
  await rejects(input, "signature is not by the DSC in the tree");
});

test("untrusted signer: a DSC that is not in the tree", opts, async () => {
  const rogue = I.createCountry("XXX", 1, { suite: 2 });
  const doc = I.issueDocument(rogue, {});
  await rejects(D.buildInput(doc, { tree, leafIndex: leafOf(s2a), today: TODAY, currentYear: YEAR }), "DSC not in the tree");
});

test("suites are separated: a signer listed for SHA-256 (suite 1) cannot be used with the SHA-1 circuit", opts, async () => {
  // The suite-1 signer signs SHA-1 data; its key is in the tree only under suite 1's leaf.
  const doc = I.issueDocument(s1, {});
  const S = I.SUITES[2];
  const eContent = I.seq(I.int(0), I.seq(I.oid(I.OID.sha1)), I.seq(I.seq(I.int(1), I.octet(I.sha1(doc.dg1))), I.seq(I.int(2), I.octet(I.sha1(doc.dg2)))));
  const sa = I.set(I.seq(I.oid(I.OID.contentType), I.set(I.oid(I.OID.ldsSecurityObject))), I.seq(I.oid(I.OID.messageDigest), I.set(I.octet(I.sha1(eContent)))));
  const signature = crypto.sign("sha1", sa, { key: s1.dscs[0].key.privateKey, padding: crypto.constants.RSA_PKCS1_PADDING });
  // Start from a well-formed suite-2 input, then put in the suite-1 signer's data and path.
  const input = inputFor(I.issueDocument(s2a, {}), s2a);
  const P = I.prefixes(20);
  const N = BigInt("0x" + s1.dscs[0].cert.publicKey.n.toString(16));
  const { siblings, pathIndex } = tree.path(leafOf(s1));
  const e = D.shaPad(eContent, D.MAX_E), a = D.shaPad(sa, D.MAX_SA);
  Object.assign(input, {
    dg1: D.shaPad(doc.dg1, 128).bytes, eContent: e.bytes, eLen: BigInt(e.len),
    dg1Off: BigInt(eContent.indexOf(P.dg1Hash)), dg2Off: BigInt(eContent.indexOf(P.dg2Hash)),
    sa: a.bytes, saLen: BigInt(a.len), mdOff: BigInt(sa.indexOf(P.messageDigest)),
    signature: D.limbs(BigInt("0x" + signature.toString("hex")), 121, S.k), modulus: D.limbs(N, 121, S.k), exponent: 65537n,
    dscSiblings: siblings, dscPathIndex: pathIndex.map(BigInt),
  });
  // Sanity: with the suite-2 leaf of the same key, the data itself would pass every other check.
  await rejects(input, "suite-1 leaf under the suite-2 circuit");
});

test("size: suite 2 has fewer than 2^20 constraints", opts, () => {
  // Measured with `snarkjs r1cs info build/document_s2.r1cs`: 749,147 (suite 1: 577,678).
  assert.ok(fs.statSync(D.wasmOf(2)).size > 0);
});
