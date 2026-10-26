// SPDX-License-Identifier: Apache-2.0
// Tests for the trust list (docs/specs/trust-list-v0.1.md): reading CSCA master lists,
// merging sources into a reproducible list of references, and checking document signers.
// Synthetic test countries only.
"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const I = require("../src/icao");
const T = require("../src/trustlist");

const x509 = (c) => new crypto.X509Certificate(I.certDer(c));
let uto, rur, bor, anchorUto;
test.before(() => {
  uto = I.createCountry("UTO", 1); rur = I.createCountry("RUR", 1); bor = I.createCountry("BOR", 1);
  anchorUto = x509(uto.csca.cert);
});

test("a signed master list is read: its CSCAs, its signer and the anchor that issued the signer", () => {
  const r = T.readMasterList(I.createMasterList(uto, [uto.csca.cert, rur.csca.cert]), { anchors: [anchorUto], name: "UTO list" });
  assert.equal(r.certs.length, 2);
  assert.match(r.signer.subject, /Master List Signer UTO/);
  assert.equal(r.anchor.sha256, T.describe(anchorUto).sha256);
});

test("an altered list, a list signed by another key, or a signer from an untrusted anchor is refused", () => {
  assert.throws(() => T.readMasterList(I.createMasterList(uto, [rur.csca.cert], { tamper: true }), { anchors: [anchorUto] }), /message digest/);
  assert.throws(() => T.readMasterList(I.createMasterList(uto, [rur.csca.cert], { signWith: I.rsaKey() }), { anchors: [anchorUto] }), /signature does not verify/);
  assert.throws(() => T.readMasterList(I.createMasterList(uto, [rur.csca.cert]), { anchors: [x509(rur.csca.cert)] }), /not issued by a trusted anchor/);
});

test("merging sources: one entry per certificate with every source named; the list hash does not depend on source order", () => {
  const a = T.readMasterList(I.createMasterList(uto, [uto.csca.cert, rur.csca.cert]), { anchors: [anchorUto], name: "UTO list" });
  const b = { name: "RUR website", certs: [x509(rur.csca.cert), x509(bor.csca.cert)] };
  const l1 = T.buildTrustList([a, b]), l2 = T.buildTrustList([b, a]);
  assert.equal(l1.entries.length, 3);
  assert.deepEqual(l1.entries.find((e) => e.country === "RU").sources.sort(), ["RUR website", "UTO list"]);
  assert.equal(l1.listHash, l2.listHash);
  const pub = T.publishable(l1);
  assert.equal(pub.entries.length, 3);
  assert.ok(pub.entries.every((e) => !("cert" in e) && /^[0-9a-f]{64}$/.test(e.sha256)), "references only, no certificate bytes");
});

test("removal: an excluded (for example compromised) certificate, or an expired one, is not in the list", () => {
  const src = { name: "s", certs: [x509(uto.csca.cert), x509(rur.csca.cert)] };
  const bad = T.describe(x509(rur.csca.cert)).sha256;
  assert.deepEqual(T.buildTrustList([src], { exclude: [bad] }).countries, ["UT"]);
  assert.equal(T.buildTrustList([src], { today: "2041-01-01" }).entries.length, 0, "test CSCAs expire at the start of 2040");
});

test("document signers: accepted only when a CSCA of the same country in the list issued them", () => {
  const list = T.buildTrustList([{ name: "s", certs: [x509(uto.csca.cert), x509(rur.csca.cert)] }]);
  assert.ok(T.checkDsc(list, x509(rur.dscs[0].cert)));
  assert.equal(T.checkDsc(list, x509(bor.dscs[0].cert)), null, "country not in the list");
  // A DSC that names RUR as its country but was issued by UTO's CSCA is refused.
  const k = I.rsaKey();
  const cross = I.cert({ subjectCN: "DSC claiming RUR", country: "RU", key: k, issuer: uto.csca, serial: "99" });
  assert.equal(T.checkDsc(list, x509(cross)), null);
});

test("real data (optional): a CSCA master list file in test/data/, read against the pinned German anchor", { skip: !(fs.existsSync(path.join(__dirname, "data")) && fs.readdirSync(path.join(__dirname, "data")).some((f) => f.endsWith(".ml"))) && "place the German master list (.ml) in test/data/" }, () => {
  const f = fs.readdirSync(path.join(__dirname, "data")).find((x) => x.endsWith(".ml"));
  const r = T.readMasterList(fs.readFileSync(path.join(__dirname, "data", f)), { pinned: T.PINNED.DE.map((p) => p.sha256), name: f });
  const list = T.buildTrustList([r], { today: new Date().toISOString().slice(0, 10) });
  console.log(`# ${f}: ${r.certs.length} certificates, ${list.entries.length} valid CA entries, ${list.countries.length} countries, listHash ${list.listHash.slice(0, 16)}…`);
  console.log("# CSCA key types:", JSON.stringify(T.keySummary(list)));
  assert.ok(list.countries.length > 50);
  // The same file against a wrong pin is refused.
  assert.throws(() => T.readMasterList(fs.readFileSync(path.join(__dirname, "data", f)), { pinned: ["00".repeat(32)] }), /not issued by a trusted anchor/);
});
