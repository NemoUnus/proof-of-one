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
// Two signature suites are produced (SUITES below): suite 1, RSA-2048 PKCS#1 v1.5 with
// SHA-256 and exponent 65537; suite 2, RSA-3072 PKCS#1 v1.5 with SHA-1 and an unusual
// exponent, as some passports in use do. Other suites are listed in the specification.
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
const sha1 = (b) => crypto.createHash("sha1").update(b).digest();
const digest = (alg, b) => crypto.createHash(alg).update(b).digest();

const OID = {
  sha256: "2.16.840.1.101.3.4.2.1",
  sha1: "1.3.14.3.2.26",
  contentType: "1.2.840.113549.1.9.3",
  messageDigest: "1.2.840.113549.1.9.4",
  signingTime: "1.2.840.113549.1.9.5",
  ldsSecurityObject: "2.23.136.1.1.1",
};

// Signature suites of the document-validity proof. Each has its own circuit
// (circuits/document*.circom) and its own identifier in the leaves of the DSC tree.
//   alg     first input of the DSC leaf
//   lds     hash of the data groups (LDS hashAlgorithm); sig: CMS digest and signature hash
//   k       121-bit limbs of the modulus; fixedE: the only exponent allowed, or null (any
//           odd exponent 3 <= e < 2^ebits, bound in the leaf)
const SUITES = {
  1: { id: 1, alg: 1n, lds: "sha256", sig: "sha256", bits: 2048, k: 17, fixedE: 65537, circuit: "document" },
  2: { id: 2, alg: 2n, lds: "sha1", sig: "sha1", bits: 3072, k: 26, fixedE: null, ebits: 17, circuit: "document_s2" },
};
const HASH_LEN = { sha1: 20, sha256: 32 };

// Byte patterns the circuit checks in front of each value it reads, for a hash of hl bytes.
function prefixes(hl) {
  return {
    dg1Hash: Buffer.from([0x30, 5 + hl, 0x02, 0x01, 0x01, 0x04, hl]),
    dg2Hash: Buffer.from([0x30, 5 + hl, 0x02, 0x01, 0x02, 0x04, hl]),
    messageDigest: Buffer.concat([Buffer.from([0x30, 15 + hl]), oid(OID.messageDigest), Buffer.from([0x31, 2 + hl, 0x04, hl])]),
  };
}
const PREFIX = prefixes(32); // suite 1

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
function rsaKey(bits = 2048, e = 65537) {
  const { privateKey, publicKey } = crypto.generateKeyPairSync("rsa", { modulusLength: bits, publicExponent: e });
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
// A test country: one CSCA and any number of document signers, all of one suite.
// `e` overrides the DSC exponent (suite 2 uses 37817 by default, the exponent of a
// public Rarimo template).
function createCountry(code = "UTO", nDsc = 1, { suite = 1, e } = {}) {
  const S = SUITES[suite];
  const dscE = e ?? S.fixedE ?? 37817;
  const cscaKey = rsaKey();
  const csca = { key: cscaKey, cert: cert({ subjectCN: "CSCA " + code + " (TEST ONLY)", country: code.slice(0, 2), key: cscaKey, serial: "01", ca: true }) };
  const dscs = [];
  for (let i = 0; i < nDsc; i++) {
    const k = rsaKey(S.bits, dscE);
    dscs.push({ suite, key: k, cert: cert({ subjectCN: "DSC " + code + " " + (i + 1) + " (TEST ONLY)", country: code.slice(0, 2), key: k, issuer: csca, serial: "1" + i }) });
  }
  return { code, suite, csca, dscs };
}

// ------------------------------------------------------------------ a document
function issueDocument(country, person = {}, { dscIndex = 0, extraGroups = [14], signingTime = true } = {}) {
  const mrz = mrzTD3({ issuer: country.code, nationality: person.nationality ?? country.code, ...person });
  const dg1 = dg1Of(mrz);
  const dg2 = tlv([0x75], tlv([0x7f, 0x61], crypto.randomBytes(1500)));
  const dsc = country.dscs[dscIndex];
  const S = SUITES[dsc.suite ?? 1];
  const groups = [[1, dg1], [2, dg2], ...extraGroups.map((n) => [n, tlv(0x60 + n, crypto.randomBytes(40))])];
  const eContent = seq(int(0), seq(oid(OID[S.lds])), seq(...groups.map(([n, b]) => seq(int(n), octet(digest(S.lds, b))))));
  const attrs = [seq(oid(OID.contentType), set(oid(OID.ldsSecurityObject))), seq(oid(OID.messageDigest), set(octet(digest(S.sig, eContent))))];
  if (signingTime) attrs.push(seq(oid(OID.signingTime), set(tlv(0x17, Buffer.from("260101120000Z")))));
  const signedAttrs = set(...attrs); // signed with the SET tag (0x31), as CMS requires
  const signature = crypto.sign(S.sig, signedAttrs, { key: dsc.key.privateKey, padding: crypto.constants.RSA_PKCS1_PADDING });
  return { suite: S.id, mrz, dg1, dg2, eContent, signedAttrs, signature, dscCert: dsc.cert, faceImage: dg2 };
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
const ALG = { RSA2048_SHA256_PKCS1: 1n, RSA3146_SHA1_PKCS1_ANYE: 2n };
const exponentOf = (cert) => BigInt(cert.publicKey.e.toString(10));
// The DSC modulus in k limbs of n bits, least significant first. Checks that the key
// fits the suite: size, and exponent (fixed, or odd, at least 3 and below 2^ebits).
function modulusChunks(cert, suite = 1, n = 121) {
  const S = SUITES[suite], k = S.k;
  const N = BigInt("0x" + cert.publicKey.n.toString(16)), e = exponentOf(cert);
  if (S.fixedE !== null && e !== BigInt(S.fixedE)) throw new Error(`suite ${suite} requires e = ${S.fixedE}`);
  if (S.fixedE === null && (e < 3n || e % 2n === 0n || e >= 1n << BigInt(S.ebits))) throw new Error(`suite ${suite}: exponent ${e} not supported`);
  const out = []; let x = N;
  for (let i = 0; i < k; i++) { out.push(x & ((1n << BigInt(n)) - 1n)); x >>= BigInt(n); }
  if (x !== 0n) throw new Error("modulus too large");
  return out;
}
// The leaf binds the suite, every limb of the modulus and, where the suite allows any
// exponent, the exponent (circuits/lib/document_core.circom, step 5).
function dscLeaf(H, cert, suite = 1) {
  const S = SUITES[suite], c = modulusChunks(cert, suite);
  if (S.k === 17 && S.fixedE !== null) return H([S.alg, H(c.slice(0, 16)), c[16]]);
  return H([S.alg, H(c.slice(0, 16)), H([...c.slice(16), exponentOf(cert)])]);
}
function buildDscTree(H, Tree, depth, countries) {
  const tree = new Tree(H, depth), index = new Map(), rejected = [];
  const cscas = countries.map((c) => c.csca.cert);
  for (const c of countries) for (const d of c.dscs) {
    if (!verifyDsc(d.cert, cscas)) { rejected.push(d.cert.subject.getField("CN").value); continue; }
    index.set(d.cert.serialNumber + "/" + c.code, tree.insert(dscLeaf(H, d.cert, d.suite ?? 1)));
  }
  return { tree, index, rejected };
}

// ------------------------------------------------------------------ CSCA master lists
// A CSCA master list as ICAO 9303 part 12 defines it: CMS SignedData whose content
// (id-icao-cscaMasterList) is SEQUENCE { version 0, SET OF Certificate }, signed by a
// master-list signer certificate that the issuing country's CSCA issued.
const certDer = (c) => Buffer.from(forge.asn1.toDer(forge.pki.certificateToAsn1(c)).getBytes(), "binary");
function createMasterList(issuer, cscaCerts, { tamper = false, signWith = null } = {}) {
  const signerKey = rsaKey();
  const signerCert = cert({ subjectCN: "Master List Signer " + issuer.code + " (TEST ONLY)", country: issuer.code.slice(0, 2), key: signerKey, issuer: issuer.csca, serial: "7f" });
  const eContent = seq(int(0), set(...cscaCerts.map(certDer)));
  const listBytes = tamper ? Buffer.concat([eContent.subarray(0, eContent.length - 1), Buffer.from([eContent[eContent.length - 1] ^ 1])]) : eContent;
  const attrs = [seq(oid(OID.contentType), set(oid("2.23.136.1.1.2"))), seq(oid(OID.messageDigest), set(octet(sha256(eContent))))];
  const signedAttrs = set(...attrs);
  const sig = crypto.sign("sha256", signedAttrs, { key: (signWith || signerKey).privateKey, padding: crypto.constants.RSA_PKCS1_PADDING });
  const signerInfo = seq(int(3), tlv(0x80, crypto.randomBytes(20)), seq(oid(OID.sha256)),
    tlv(0xa0, ...attrs), seq(oid("1.2.840.113549.1.1.11"), Buffer.from([0x05, 0x00])), octet(sig));
  const signedData = seq(int(3), set(seq(oid(OID.sha256))),
    seq(oid("2.23.136.1.1.2"), tlv(0xa0, octet(listBytes))),
    tlv(0xa0, certDer(signerCert), certDer(issuer.csca.cert)),
    set(signerInfo));
  return seq(oid("1.2.840.113549.1.7.2"), tlv(0xa0, signedData));
}

module.exports = { SUITES, HASH_LEN, prefixes, digest, sha1, exponentOf, createMasterList, certDer, tlv, oid, seq, set, octet, int, sha256, OID, PREFIX, checkDigit, mrzTD3, dg1Of, rsaKey, cert, createCountry, issueDocument, verifyDsc, modulusChunks, dscLeaf, buildDscTree, ALG };
