// SPDX-License-Identifier: Apache-2.0
// Synthetic ICAO 9303 test documents, and the trust list of document signers.
//
// Builds, with keys created on the spot, everything a phone reads from a passport
// chip that the document-validity proof needs:
//   DG1  data group 1: the machine-readable zone (MRZ) of a TD3 passport
//   DG2  data group 2: the face image (random bytes stand in for the image)
//   LDS security object (eContent of the SOD): the hash of every data group
//   signed attributes: content type and the hash of the eContent
//   signature by a document signer (DSC), whose certificate a country signing CA
//   (CSCA) signed.
// Only RSA-2048 with PKCS#1 v1.5, SHA-256 and exponent 65537 is produced here; other
// suites used by real passports are listed in the specification.
// TEST DATA ONLY: no real document, person or country key is used anywhere.
"use strict";

const crypto = require("crypto");
const forge = require("node-forge");

// ------------------------------------------------------------------ DER helpers
function len(n) {
  if (n < 128) return Buffer.from([n]);
  const b = []; while (n > 0) { b.unshift(n & 0xff); n >>= 8; }
  return Buffer.from([0x80 | b.length, ...b]);
}
const tlv = (tag, ...parts) => { const c = Buffer.concat(parts); return Buffer.concat([Buffer.from(Array.isArray(tag) ? tag : [tag]), len(c.length), c]); };
function oid(s) {
  const p = s.split(".").map(Number), out = [40 * p[0] + p[1]];
  for (const v of p.slice(2)) { const b = [v & 0x7f]; let x = v >> 7; while (x > 0) { b.unshift(0x80 | (x & 0x7f)); x >>= 7; } out.push(...b); }
  return tlv(0x06, Buffer.from(out));
}
const int = (n) => tlv(0x02, Buffer.from([n]));
const seq = (...p) => tlv(0x30, ...p), set = (...p) => tlv(0x31, ...p), octet = (b) => tlv(0x04, b);
const sha256 = (b) => crypto.createHash("sha256").update(b).digest();

const OID = {
  sha256: "2.16.840.1.101.3.4.2.1",
  contentType: "1.2.840.113549.1.9.3",
  messageDigest: "1.2.840.113549.1.9.4",
  signingTime: "1.2.840.113549.1.9.5",
  ldsSecurityObject: "2.23.136.1.1.1",
};

// Byte patterns the circuit checks in front of each value it reads.
const PREFIX = {
  dg1Hash: Buffer.from([0x30, 0x25, 0x02, 0x01, 0x01, 0x04, 0x20]),
  dg2Hash: Buffer.from([0x30, 0x25, 0x02, 0x01, 0x02, 0x04, 0x20]),
  messageDigest: Buffer.concat([Buffer.from([0x30, 0x2f]), oid(OID.messageDigest), Buffer.from([0x31, 0x22, 0x04, 0x20])]),
};

// ------------------------------------------------------------------ the MRZ
// TD3 (passport): two lines of 44 characters.
function checkDigit(s) {
  const w = [7, 3, 1]; let sum = 0;
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    const v = c === "<" ? 0 : c >= "0" && c <= "9" ? c.charCodeAt(0) - 48 : c.charCodeAt(0) - 55;
    sum += v * w[i % 3];
  }
  return String(sum % 10);
}
const pad = (s, n) => (s + "<".repeat(n)).slice(0, n);
function mrzTD3({ issuer = "UTO", nationality = "UTO", surname = "ERIKSSON", given = "ANNA MARIA", number = "L898902C3", birth = "740812", sex = "F", expiry = "120415" }) {
  const l1 = pad("P<" + issuer + surname.replace(/ /g, "<") + "<<" + given.replace(/ /g, "<"), 44);
  const num = pad(number, 9), opt = pad("", 14);
  const body = num + checkDigit(num) + nationality + birth + checkDigit(birth) + sex + expiry + checkDigit(expiry) + opt + checkDigit(opt);
  const composite = checkDigit(num + checkDigit(num) + birth + checkDigit(birth) + expiry + checkDigit(expiry) + opt + checkDigit(opt));
  const l2 = body + composite;
  if (l1.length !== 44 || l2.length !== 44) throw new Error("bad MRZ length");
  return l1 + l2;
}
// DG1 = 61 5B 5F1F 58 <88 MRZ bytes>  (93 bytes for TD3)
const dg1Of = (mrz) => tlv(0x61, tlv([0x5f, 0x1f], Buffer.from(mrz, "ascii")));

// ------------------------------------------------------------------ keys and certificates
function rsaKey() {
  const { privateKey, publicKey } = crypto.generateKeyPairSync("rsa", { modulusLength: 2048, publicExponent: 65537 });
  return { privateKey, publicKey, forgePriv: forge.pki.privateKeyFromPem(privateKey.export({ type: "pkcs1", format: "pem" })),
    forgePub: forge.pki.publicKeyFromPem(publicKey.export({ type: "spki", format: "pem" })) };
}
function cert({ subjectCN, country, key, issuer, serial, ca }) {
  const c = forge.pki.createCertificate();
  c.publicKey = key.forgePub; c.serialNumber = serial;
  c.validity.notBefore = new Date(Date.UTC(2020, 0, 1)); c.validity.notAfter = new Date(Date.UTC(2040, 0, 1));
  c.setSubject([{ name: "commonName", value: subjectCN }, { name: "countryName", value: country }]);
  c.setIssuer(issuer ? issuer.cert.subject.attributes : c.subject.attributes);
  c.setExtensions([{ name: "basicConstraints", cA: !!ca }, { name: "keyUsage", keyCertSign: !!ca, digitalSignature: !ca }]);
  c.sign(issuer ? issuer.key.forgePriv : key.forgePriv, forge.md.sha256.create());
  return c;
}
// A test country: one CSCA and any number of document signers.
function createCountry(code = "UTO", nDsc = 1) {
  const cscaKey = rsaKey();
  const csca = { key: cscaKey, cert: cert({ subjectCN: "CSCA " + code + " (TEST ONLY)", country: code.slice(0, 2), key: cscaKey, serial: "01", ca: true }) };
  const dscs = [];
  for (let i = 0; i < nDsc; i++) {
    const k = rsaKey();
    dscs.push({ key: k, cert: cert({ subjectCN: "DSC " + code + " " + (i + 1) + " (TEST ONLY)", country: code.slice(0, 2), key: k, issuer: csca, serial: "1" + i }) });
  }
  return { code, csca, dscs };
}

// ------------------------------------------------------------------ a document
function issueDocument(country, person = {}, { dscIndex = 0, extraGroups = [14], signingTime = true } = {}) {
  const mrz = mrzTD3({ issuer: country.code, nationality: person.nationality ?? country.code, ...person });
  const dg1 = dg1Of(mrz);
  const dg2 = tlv([0x75], tlv([0x7f, 0x61], crypto.randomBytes(1500)));
  const groups = [[1, dg1], [2, dg2], ...extraGroups.map((n) => [n, tlv(0x60 + n, crypto.randomBytes(40))])];
  const eContent = seq(int(0), seq(oid(OID.sha256)), seq(...groups.map(([n, b]) => seq(int(n), octet(sha256(b))))));
  const attrs = [seq(oid(OID.contentType), set(oid(OID.ldsSecurityObject))), seq(oid(OID.messageDigest), set(octet(sha256(eContent))))];
  if (signingTime) attrs.push(seq(oid(OID.signingTime), set(tlv(0x17, Buffer.from("260101120000Z")))));
  const signedAttrs = set(...attrs); // signed with the SET tag (0x31), as CMS requires
  const dsc = country.dscs[dscIndex];
  const signature = crypto.sign("sha256", signedAttrs, { key: dsc.key.privateKey, padding: crypto.constants.RSA_PKCS1_PADDING });
  return { mrz, dg1, dg2, eContent, signedAttrs, signature, dscCert: dsc.cert, faceImage: dg2 };
}

// ------------------------------------------------------------------ trust list of document signers
// The DSC tree holds one leaf per document-signer key that a public tool has checked
// against a trusted CSCA certificate. Certificates are public and carry no personal
// data, so this check is done once per signer, outside the phone, and anyone can
// redo it. The phone proves only that its signer is a leaf of the tree.
function verifyDsc(dscCert, cscaCerts) {
  for (const ca of cscaCerts) {
    try { if (ca.verify(dscCert)) return ca; } catch (e) { /* not this CA */ }
  }
  return null;
}
const ALG = { RSA2048_SHA256_PKCS1: 1n };
function modulusChunks(cert, n = 121, k = 17) {
  const N = BigInt("0x" + cert.publicKey.n.toString(16));
  if (cert.publicKey.e.toString(10) !== "65537") throw new Error("only e = 65537 is supported");
  const out = []; let x = N;
  for (let i = 0; i < k; i++) { out.push(x & ((1n << BigInt(n)) - 1n)); x >>= BigInt(n); }
  if (x !== 0n) throw new Error("modulus too large");
  return out;
}
function dscLeaf(H, cert) {
  const c = modulusChunks(cert);
  return H([ALG.RSA2048_SHA256_PKCS1, H(c.slice(0, 16)), c[16]]);
}
function buildDscTree(H, Tree, depth, countries) {
  const tree = new Tree(H, depth), index = new Map(), rejected = [];
  const cscas = countries.map((c) => c.csca.cert);
  for (const c of countries) for (const d of c.dscs) {
    if (!verifyDsc(d.cert, cscas)) { rejected.push(d.cert.subject.getField("CN").value); continue; }
    index.set(d.cert.serialNumber + "/" + c.code, tree.insert(dscLeaf(H, d.cert)));
  }
  return { tree, index, rejected };
}

module.exports = { tlv, oid, seq, set, octet, int, sha256, OID, PREFIX, checkDigit, mrzTD3, dg1Of, rsaKey, cert, createCountry, issueDocument, verifyDsc, modulusChunks, dscLeaf, buildDscTree, ALG };
