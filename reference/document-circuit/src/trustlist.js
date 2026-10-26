// SPDX-License-Identifier: Apache-2.0
// The trust list: which country signing CA (CSCA) certificates enrolment trusts, where
// each came from, and the tree of document signers (DSC) checked against them.
// Specification: docs/specs/trust-list-v0.1.md.
//
//  - readMasterList(): parses an ICAO 9303 CSCA master list (CMS SignedData with
//    eContentType id-icao-cscaMasterList), checks the message digest and the signature
//    of the list, checks that the list signer was issued by a given trust anchor, and
//    returns the CSCA certificates it contains.
//  - buildTrustList(): merges several sources into entries of references, not copies:
//    country, SHA-256 fingerprint, key type and validity, and every source that carries
//    the certificate. Anyone who downloads the same sources rebuilds the same list.
//  - checkDsc(): verifies a document-signer certificate against the trust list.
// Certificates are parsed and verified with Node's X.509 support (OpenSSL), so RSA,
// RSA-PSS and ECDSA (including brainpool curves) are covered.
"use strict";

const crypto = require("crypto");
const forge = require("node-forge");

const OID = {
  signedData: "1.2.840.113549.1.7.2",
  cscaMasterList: "2.23.136.1.1.2",
  contentType: "1.2.840.113549.1.9.3",
  messageDigest: "1.2.840.113549.1.9.4",
};
const DIGEST = {
  "1.3.14.3.2.26": "sha1", "2.16.840.1.101.3.4.2.4": "sha224", "2.16.840.1.101.3.4.2.1": "sha256",
  "2.16.840.1.101.3.4.2.2": "sha384", "2.16.840.1.101.3.4.2.3": "sha512",
};
const SIG = {
  "1.2.840.113549.1.1.1": { kind: "rsa" }, // rsaEncryption: digest from the digest algorithm
  "1.2.840.113549.1.1.5": { kind: "rsa", hash: "sha1" }, "1.2.840.113549.1.1.11": { kind: "rsa", hash: "sha256" },
  "1.2.840.113549.1.1.12": { kind: "rsa", hash: "sha384" }, "1.2.840.113549.1.1.13": { kind: "rsa", hash: "sha512" },
  "1.2.840.113549.1.1.10": { kind: "pss" },
  "1.2.840.10045.4.1": { kind: "ecdsa", hash: "sha1" }, "1.2.840.10045.4.3.2": { kind: "ecdsa", hash: "sha256" },
  "1.2.840.10045.4.3.3": { kind: "ecdsa", hash: "sha384" }, "1.2.840.10045.4.3.4": { kind: "ecdsa", hash: "sha512" },
};

const der = (node) => Buffer.from(forge.asn1.toDer(node).getBytes(), "binary");
const oidOf = (node) => forge.asn1.derToOid(node.value);
const sha256hex = (b) => crypto.createHash("sha256").update(b).digest("hex");

// RSASSA-PSS parameters: hash algorithm [0] and salt length [2].
function pssParams(params) {
  let hash = "sha1", saltLength = 20;
  for (const p of (params && params.value) || []) {
    if (p.type === 0) hash = DIGEST[oidOf(p.value[0].value[0])] || hash;
    if (p.type === 2) saltLength = parseInt(forge.util.bytesToHex(p.value[0].value), 16);
  }
  return { hash, saltLength };
}

function verifySignature(cert, algNode, data, signature, digestAlg) {
  const alg = SIG[oidOf(algNode.value[0])];
  if (!alg) throw new Error("unsupported signature algorithm " + oidOf(algNode.value[0]));
  const key = cert.publicKey;
  if (alg.kind === "pss") {
    const { hash, saltLength } = pssParams(algNode.value[1]);
    return crypto.verify(hash, data, { key, padding: crypto.constants.RSA_PKCS1_PSS_PADDING, saltLength }, signature);
  }
  const hash = alg.hash || digestAlg;
  if (alg.kind === "ecdsa") return crypto.verify(hash, data, { key, dsaEncoding: "der" }, signature);
  return crypto.verify(hash, data, { key, padding: crypto.constants.RSA_PKCS1_PADDING }, signature);
}

function describe(cert) {
  const k = cert.publicKey.asymmetricKeyDetails || {};
  const country = (cert.subject.match(/(?:^|\n)C=([^\n]+)/) || [])[1] || "??";
  return {
    country: country.trim().toUpperCase(),
    sha256: sha256hex(cert.raw),
    subject: cert.subject.replace(/\n/g, ", "),
    issuer: cert.issuer.replace(/\n/g, ", "),
    selfIssued: cert.subject === cert.issuer,
    notBefore: new Date(cert.validFrom).toISOString().slice(0, 10),
    notAfter: new Date(cert.validTo).toISOString().slice(0, 10),
    key: cert.publicKey.asymmetricKeyType === "rsa" || cert.publicKey.asymmetricKeyType === "rsa-pss"
      ? "RSA-" + k.modulusLength : "EC-" + (k.namedCurve || "explicit"),
  };
}

// Pinned anchors: SHA-256 fingerprints of the CSCA certificates that may issue a master
// list signer, each checked against the issuing authority's own website.
const PINNED = {
  DE: [{
    sha256: "2084aed7a991b3158e63ad750d3dc38bc6c9dcf5958f28d1162f49884e91ada8",
    note: "German CSCA, certificate 10/24; fingerprint published by the BSI, checked 2026-10-26",
    source: "https://bsi.bund.de/EN/Themen/Oeffentliche-Verwaltung/Elektronische-Identitaeten/Public-Key-Infrastrukturen/CSCA/Root_Cert_Germany/Root_Certificate_node.html",
  }],
};

// Parses and checks a CSCA master list. `anchors` are X509Certificate objects trusted to
// have issued the list signer (normally the issuing country's own CSCA).
// With `pinned` (a list of SHA-256 fingerprints) instead of `anchors`, the anchors are the
// certificates carried in the list itself whose fingerprints are pinned.
function readMasterList(bytes, { anchors = [], pinned = [], name = "master list" } = {}) {
  const ci = forge.asn1.fromDer(forge.util.createBuffer(Buffer.from(bytes).toString("binary")));
  if (oidOf(ci.value[0]) !== OID.signedData) throw new Error("not a CMS SignedData");
  const sd = ci.value[1].value[0];
  const parts = sd.value;
  const encap = parts[2];
  if (oidOf(encap.value[0]) !== OID.cscaMasterList) throw new Error("not a CSCA master list");
  const octets = encap.value[1].value[0];
  const eContent = Buffer.from(octets.constructed ? octets.value.map((o) => o.value).join("") : octets.value, "binary");
  // certificates [0] and signerInfos (the last SET)
  const certsNode = parts.find((p) => p.tagClass === forge.asn1.Class.CONTEXT_SPECIFIC && p.type === 0 && p.constructed);
  const embedded = certsNode ? certsNode.value.map((c) => new crypto.X509Certificate(der(c))) : [];
  const si = parts[parts.length - 1].value[0];
  const siParts = si.value;
  const digestAlg = DIGEST[oidOf(siParts[2].value[0])];
  if (!digestAlg) throw new Error("unsupported digest algorithm");
  const saNode = siParts.find((p) => p.tagClass === forge.asn1.Class.CONTEXT_SPECIFIC && p.type === 0 && p.constructed); // not the [0] subjectKeyIdentifier sid
  if (!saNode) throw new Error("no signed attributes");
  const sigAlg = siParts[siParts.indexOf(saNode) + 1];
  const signature = Buffer.from(siParts[siParts.indexOf(saNode) + 2].value, "binary");

  // messageDigest attribute = digest(eContent)
  const md = saNode.value.find((a) => oidOf(a.value[0]) === OID.messageDigest);
  if (!md || Buffer.from(md.value[1].value[0].value, "binary").compare(crypto.createHash(digestAlg).update(eContent).digest()) !== 0)
    throw new Error(name + ": message digest does not match the list content");
  // the signed attributes are signed with the SET tag (0x31)
  const signedBytes = der(saNode); signedBytes[0] = 0x31;
  const signer = embedded.find((c) => { try { return verifySignature(c, sigAlg, signedBytes, signature, digestAlg); } catch (e) { return false; } });
  if (!signer) throw new Error(name + ": the list signature does not verify under any embedded certificate");
  if (!anchors.length && pinned.length) anchors = embedded.filter((c) => pinned.includes(sha256hex(c.raw)));
  const anchor = anchors.find((a) => signer.checkIssued(a) && signer.verify(a.publicKey));
  if (!anchor) throw new Error(name + ": the list signer was not issued by a trusted anchor");

  // CscaMasterList ::= SEQUENCE { version INTEGER, certList SET OF Certificate }
  const ml = forge.asn1.fromDer(forge.util.createBuffer(eContent.toString("binary")));
  const certs = ml.value[1].value.map((c) => new crypto.X509Certificate(der(c)));
  return { name, signer: describe(signer), anchor: describe(anchor), certs, digestAlg };
}

// Merges sources into one list. Each source: { name, certs: X509Certificate[] }.
// `today` (YYYY-MM-DD) drops certificates whose validity has ended; CSCAs are kept for the
// whole validity of the documents they signed, so only expired CSCAs are dropped.
function buildTrustList(sources, { today, exclude = [] } = {}) {
  const byFp = new Map();
  for (const s of sources) for (const c of s.certs) {
    const d = describe(c);
    if (!c.ca && !d.selfIssued) continue; // only CA certificates
    if (exclude.includes(d.sha256)) continue;
    if (today && d.notAfter < today) continue;
    const e = byFp.get(d.sha256) || { ...d, sources: [], cert: c };
    if (!e.sources.includes(s.name)) e.sources.push(s.name);
    byFp.set(d.sha256, e);
  }
  const entries = [...byFp.values()].sort((a, b) => (a.country + a.sha256).localeCompare(b.country + b.sha256));
  const listHash = sha256hex(Buffer.from(entries.map((e) => e.sha256).join("\n")));
  const countries = [...new Set(entries.map((e) => e.country))];
  return { entries, listHash, countries };
}
// The published form: references only, never the certificates themselves.
const publishable = (list) => ({
  format: "proof-of-one-trust-list/1", listHash: list.listHash, countries: list.countries.length,
  entries: list.entries.map(({ cert, ...e }) => e),
});

// A document signer is trusted when a CSCA of the same country in the list issued it
// and its signature verifies.
function checkDsc(list, dsc) {
  const c = (dsc.subject.match(/(?:^|\n)C=([^\n]+)/) || [])[1];
  for (const e of list.entries) {
    if (c && e.country !== c.trim().toUpperCase()) continue;
    if (dsc.checkIssued(e.cert) && dsc.verify(e.cert.publicKey)) return e;
  }
  return null;
}

// Coverage summary by key type, for choosing which signature suites to support.
function keySummary(list) {
  const s = {};
  for (const e of list.entries) s[e.key] = (s[e.key] || 0) + 1;
  return Object.fromEntries(Object.entries(s).sort((a, b) => b[1] - a[1]));
}

module.exports = { OID, PINNED, readMasterList, buildTrustList, publishable, checkDsc, keySummary, describe, verifySignature };
