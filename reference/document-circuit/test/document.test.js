// SPDX-License-Identifier: Apache-2.0
// Tests for the document-validity proof π_doc: honest documents and the ways a
// person could try to enrol with a false, altered, borrowed or expired document.
// Uses synthetic test documents only. Witness tests check every constraint; the
// final test makes and verifies a real Groth16 proof with a TEST-ONLY setup.
"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const D = require("../src/document");
const I = require("../src/icao");
const A = require("../../ballot-circuit/src/attrs");

const TODAY = A.dayNumber(2026, 10, 25), YEAR = 2026;
let H, uto, ruritania, rogue, tree, index;

test.before(async () => {
  ({ H } = await D.init());
  uto = I.createCountry("UTO", 2);
  ruritania = I.createCountry("RUR", 1);
  rogue = I.createCountry("XXX", 1); // its CSCA is not trusted
  ({ tree, index } = I.buildDscTree(H, D.IncrementalTree, D.DEPTH, [uto, ruritania]));
});
test.after(async () => { if (globalThis.curve_bn128) await globalThis.curve_bn128.terminate(); });

const leafOf = (country, i = 0) => index.get(country.dscs[i].cert.serialNumber + "/" + country.code);
const inputFor = (doc, country, i = 0, extra = {}) => D.buildInput(doc, { tree, leafIndex: leafOf(country, i), today: TODAY, currentYear: YEAR, ...extra });
// Every rejection must come from a failed circuit constraint, not from a malformed input.
async function rejects(input, why) { await assert.rejects(D.witness(input), /Assert Failed/, why); }

test("honest passport: outputs match the MRZ; the face commitment binds the DG2 hash", async () => {
  const doc = I.issueDocument(uto, { birth: "790812", sex: "F", expiry: "310415" }, { dscIndex: 1 });
  const w = await D.witness(inputFor(doc, uto, 1, { rFace: 99n }));
  const e = D.expected(doc.mrz, YEAR);
  assert.equal(w.outputs.birthDay, e.birthDay);
  assert.equal(w.outputs.birthDay, BigInt(A.dayNumber(1979, 8, 12)));
  assert.equal(w.outputs.sexCode, 2n);
  assert.equal(w.outputs.natCode, D.natCodeOf("UTO"));
  assert.equal(w.outputs.expMonth, BigInt(2031 * 12 + 4));
  const h = I.sha256(doc.dg2);
  const hi = BigInt("0x" + h.subarray(0, 16).toString("hex")), lo = BigInt("0x" + h.subarray(16).toString("hex"));
  assert.equal(w.outputs.cFace, H([hi, lo, 99n]));
});

test("century of birth: '08' is 2008 and '27' is 1927 when enrolling in 2026; a male holder gives sex code 1", async () => {
  const young = I.issueDocument(ruritania, { birth: "080101", sex: "M", expiry: "300101" });
  assert.equal((await D.witness(inputFor(young, ruritania))).outputs.birthDay, BigInt(A.dayNumber(2008, 1, 1)));
  const old = I.issueDocument(ruritania, { birth: "270228", sex: "M", expiry: "300101" });
  const w = await D.witness(inputFor(old, ruritania));
  assert.equal(w.outputs.birthDay, BigInt(A.dayNumber(1927, 2, 28)));
  assert.equal(w.outputs.sexCode, 1n);
});

test("leap days are counted like the ballot proof's day numbers", async () => {
  const doc = I.issueDocument(uto, { birth: "000229", expiry: "280229" });
  const w = await D.witness(inputFor(doc, uto));
  assert.equal(w.outputs.birthDay, BigInt(A.dayNumber(2000, 2, 29)));
});

test("expiry: a passport valid until today is accepted, one that expired yesterday is not", async () => {
  const ok = I.issueDocument(uto, { expiry: "261025" });
  await D.witness(inputFor(ok, uto));
  const expired = I.issueDocument(uto, { expiry: "261024" });
  await rejects(inputFor(expired, uto), "expired document");
});

test("altered chip data: changing the date of birth in DG1 breaks the signed DG1 hash", async () => {
  const doc = I.issueDocument(uto, { birth: "790812" });
  const forged = { ...doc, dg1: I.dg1Of(doc.mrz.replace("790812", "990812")) };
  const input = inputFor(doc, uto);
  input.dg1 = D.shaPad(forged.dg1, 128).bytes;
  await rejects(input, "DG1 no longer matches the hash in the LDS security object");
});

test("borrowed data: another person's DG1 with this document's signed data is rejected", async () => {
  const mine = I.issueDocument(uto, { surname: "DOE", birth: "900101" });
  const theirs = I.issueDocument(uto, { surname: "ROE", birth: "600101" });
  const input = inputFor(mine, uto);
  input.dg1 = D.shaPad(theirs.dg1, 128).bytes;
  await rejects(input, "DG1 from another document");
});

test("edited LDS security object: replacing the DG1 hash breaks the signed message digest", async () => {
  const doc = I.issueDocument(uto, {});
  const fake = I.dg1Of(I.mrzTD3({ issuer: "UTO", nationality: "UTO", birth: "500101" }));
  const e = Buffer.from(doc.eContent);
  const off = e.indexOf(I.sha256(doc.dg1));
  I.sha256(fake).copy(e, off);
  const input = inputFor({ ...doc, eContent: e, dg1: fake }, uto);
  await rejects(input, "eContent no longer matches the signed digest");
});

test("wrong field: pointing the DG1 read at the DG2 hash is rejected by the DER prefix check", async () => {
  const doc = I.issueDocument(uto, {});
  const input = inputFor(doc, uto);
  input.dg1Off = input.dg2Off;
  await rejects(input, "DG2 entry read as DG1");
});

test("reading outside the hashed bytes is rejected", async () => {
  const doc = I.issueDocument(uto, {});
  const input = inputFor(doc, uto);
  // Plant a well-formed DG1 entry in the unhashed zeros after the padded eContent.
  const fakeDg1 = I.dg1Of(I.mrzTD3({ issuer: "UTO", birth: "500101" }));
  const entry = [...I.PREFIX.dg1Hash, ...I.sha256(fakeDg1)].map(BigInt);
  const at = Number(input.eLen) + 8;
  entry.forEach((b, i) => { input.eContent[at + i] = b; });
  input.dg1Off = BigInt(at);
  input.dg1 = D.shaPad(fakeDg1, 128).bytes;
  await rejects(input, "value read past the hashed length");
});

test("forged signature: signed with a key that is not the document signer's", async () => {
  const doc = I.issueDocument(uto, {});
  const other = I.rsaKey();
  const sig = crypto.sign("sha256", doc.signedAttrs, { key: other.privateKey, padding: crypto.constants.RSA_PKCS1_PADDING });
  await rejects(inputFor({ ...doc, signature: sig }, uto), "signature does not verify under the DSC key");
});

test("untrusted signer: a document signed by a DSC whose CSCA is not trusted is not in the tree", async () => {
  const doc = I.issueDocument(rogue, {});
  const { rejected } = I.buildDscTree(H, D.IncrementalTree, D.DEPTH, [uto, { ...rogue, csca: uto.csca }]);
  assert.equal(rejected.length, 1, "the list tool refuses a DSC that no trusted CSCA signed");
  // Using a trusted leaf's path with the rogue key gives a different root.
  await rejects(D.buildInput(doc, { tree, leafIndex: leafOf(uto), today: TODAY, currentYear: YEAR }), "DSC not in the tree");
});

test("key swap: the signature of one trusted DSC cannot be presented with another trusted DSC's leaf", async () => {
  const doc = I.issueDocument(uto, {}, { dscIndex: 0 });
  const input = inputFor(doc, uto, 1); // path and modulus of DSC 2
  input.modulus = I.modulusChunks(uto.dscs[1].cert);
  await rejects(input, "signature is not by the DSC in the tree");
});

test("the outputs are the attributes of registration and ballots: a poll for adult UTO nationals accepts the holder", async () => {
  const doc = I.issueDocument(uto, { birth: "000615", expiry: "300101" });
  const o = (await D.witness(inputFor(doc, uto))).outputs;
  const attrs = { birthDay: o.birthDay, sexCode: o.sexCode, docs: [{ nat: o.natCode, expiry: o.expMonth }] };
  const poll = (on, nat) => ({ ...A.ageRange(on, { minAge: 18 }), minExpiryMonth: 2027 * 12 + 1, requiredNat: A.natCode(nat) });
  assert.equal(A.selectDoc(attrs, poll([2026, 10, 25], "UTO")), 0, "26 years old, UTO national, valid until 2030");
  assert.equal(A.selectDoc(attrs, poll([2026, 10, 25], "RUR")), -1, "not a national of RUR");
  assert.equal(A.selectDoc(attrs, poll([2018, 6, 14], "UTO")), -1, "under 18 on a poll held the day before the 18th birthday");
  assert.equal(A.selectDoc(attrs, poll([2018, 6, 15], "UTO")), 0, "18 on the birthday itself");
});

test("Groth16 proof with a TEST-ONLY setup: verifies; changing today's date or the commitment fails", { skip: !fs.existsSync(path.join(__dirname, "..", "setup", "document_test.zkey")) && "run scripts/setup-test.sh first" }, async () => {
  const zkey = path.join(__dirname, "..", "setup", "document_test.zkey");
  const vkey = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "setup", "vkey_test.json"), "utf8"));
  const doc = I.issueDocument(uto, { birth: "850630", expiry: "300101" });
  const t = Date.now();
  const { proof, publicSignals } = await D.prove(inputFor(doc, uto, 0, { cm: 123n, challenge: 456n }), zkey);
  const ms = Date.now() - t;
  assert.ok(await D.verify(vkey, publicSignals, proof));
  // public signals: 5 outputs, then dscRoot, today, currentYear, cm, challenge
  const changed = (i, v) => { const s = publicSignals.slice(); s[i] = String(v); return s; };
  assert.equal(await D.verify(vkey, changed(6, TODAY - 4000), proof), false, "today's date is bound");
  assert.equal(await D.verify(vkey, changed(8, 124n), proof), false, "the commitment is bound");
  assert.equal(await D.verify(vkey, changed(0, 1n), proof), false, "the birth date output is bound");
  console.log(`# π_doc proving time on this machine: ${(ms / 1000).toFixed(1)} s`);
});
