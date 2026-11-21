// SPDX-License-Identifier: Apache-2.0
// Just enough X.509 for the enrolment service: read a document signer's certificate (DSC),
// check its signature against a country signing CA (CSCA) with WebCrypto, and read the
// RSA key that π_doc's DSC tree leaf binds. Not a general certificate validator: no
// extensions, no revocation lists (open point of the trust-list specification).

// ---- DER
export function readTlv(b, i = 0) {
  const tag = b[i]; let len = b[i + 1], off = i + 2;
  if (len & 0x80) {
    const n = len & 0x7f;
    if (n < 1 || n > 4) throw new Error("bad DER length");
    len = 0;
    for (let k = 0; k < n; k++) len = len * 256 + b[off + k];
    off += n;
  }
  if (off + len > b.length) throw new Error("DER runs past its end");
  return { tag, start: i, off, len, end: off + len };
}
export function children(b, t) {
  const out = []; let i = t.off;
  while (i < t.end) { const c = readTlv(b, i); out.push(c); i = c.end; }
  if (i !== t.end) throw new Error("bad DER structure");
  return out;
}
const bytes = (b, t) => b.subarray(t.start, t.end);
const value = (b, t) => b.subarray(t.off, t.end);
function oid(b, t) {
  if (t.tag !== 0x06) throw new Error("OID expected");
  const v = value(b, t), out = [Math.floor(v[0] / 40), v[0] % 40];
  let x = 0;
  for (let k = 1; k < v.length; k++) { x = x * 128 + (v[k] & 0x7f); if (!(v[k] & 0x80)) { out.push(x); x = 0; } }
  return out.join(".");
}
const big = (v) => { let x = 0n; for (const c of v) x = (x << 8n) | BigInt(c); return x; };
function time(b, t) {
  const s = new TextDecoder().decode(value(b, t));
  const m = t.tag === 0x17 ? /^(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})Z$/.exec(s) : /^(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})Z$/.exec(s);
  if (!m) throw new Error("bad time");
  let y = Number(m[1]);
  if (t.tag === 0x17) y += y < 50 ? 2000 : 1900;
  return Date.UTC(y, Number(m[2]) - 1, Number(m[3]), Number(m[4]), Number(m[5]), Number(m[6]));
}
function country(b, name) {
  for (const rdn of children(b, name)) for (const atv of children(b, rdn)) {
    const [o, v] = children(b, atv);
    if (oid(b, o) === "2.5.4.6") return new TextDecoder().decode(value(b, v));
  }
  return null;
}

// ---- certificate
const RSA = "1.2.840.113549.1.1.1", EC = "1.2.840.10045.2.1";
export function parseCertificate(der) {
  const b = der instanceof Uint8Array ? der : new Uint8Array(der);
  const top = readTlv(b, 0);
  if (top.tag !== 0x30 || top.end !== b.length) throw new Error("not a certificate");
  const [tbs, sigAlg, sig] = children(b, top);
  let f = children(b, tbs);
  if (f[0].tag === 0xa0) f = f.slice(1);
  const [serial, , issuer, validity, subject, spki] = f;
  const [nb, na] = children(b, validity);
  const [spkiAlg, spkiKey] = children(b, spki);
  const algParts = children(b, spkiAlg);
  const keyAlg = oid(b, algParts[0]);
  const cert = {
    der: b, tbs: bytes(b, tbs), sigAlg: oid(b, children(b, sigAlg)[0]), sigAlgParams: children(b, sigAlg)[1] ? bytes(b, children(b, sigAlg)[1]) : null,
    signature: value(b, sig).subarray(1), serial: big(value(b, serial)), issuer: bytes(b, issuer), subject: bytes(b, subject),
    country: country(b, subject), notBefore: time(b, nb), notAfter: time(b, na), spki: bytes(b, spki), keyAlg,
    curve: keyAlg === EC && algParts[1]?.tag === 0x06 ? oid(b, algParts[1]) : null,
  };
  if (keyAlg === RSA) {
    const kb = value(b, spkiKey).subarray(1);
    const [n, e] = children(kb, readTlv(kb, 0));
    cert.rsa = { n: big(value(kb, n)), e: big(value(kb, e)) };
  }
  return cert;
}

const HASH = { "1.3.14.3.2.26": "SHA-1", "2.16.840.1.101.3.4.2.1": "SHA-256", "2.16.840.1.101.3.4.2.2": "SHA-384", "2.16.840.1.101.3.4.2.3": "SHA-512" };
const RSA_PKCS1 = { "1.2.840.113549.1.1.5": "SHA-1", "1.2.840.113549.1.1.11": "SHA-256", "1.2.840.113549.1.1.12": "SHA-384", "1.2.840.113549.1.1.13": "SHA-512" };
const ECDSA = { "1.2.840.10045.4.3.2": "SHA-256", "1.2.840.10045.4.3.3": "SHA-384", "1.2.840.10045.4.3.4": "SHA-512", "1.2.840.10045.4.1": "SHA-1" };
const CURVES = { "1.2.840.10045.3.1.7": ["P-256", 32], "1.3.132.0.34": ["P-384", 48], "1.3.132.0.35": ["P-521", 66] };

// RSASSA-PSS parameters: hash and salt length (defaults SHA-1, 20).
function pssParams(p) {
  let hash = "SHA-1", salt = 20;
  if (!p) return { hash, salt };
  for (const f of children(p, readTlv(p, 0))) {
    const inner = readTlv(p, f.off);
    if (f.tag === 0xa0) hash = HASH[oid(p, children(p, inner)[0])] || null;
    if (f.tag === 0xa2) salt = Number(big(value(p, inner)));
  }
  return { hash, salt };
}
// ECDSA signature: DER SEQUENCE { r, s } to WebCrypto's r ‖ s of fixed length.
function rawEcdsa(sig, n) {
  const [r, s] = children(sig, readTlv(sig, 0)).map((t) => value(sig, t));
  const fix = (v) => { while (v.length > n && v[0] === 0) v = v.subarray(1); if (v.length > n) throw new Error("bad ECDSA signature"); const o = new Uint8Array(n); o.set(v, n - v.length); return o; };
  const out = new Uint8Array(2 * n); out.set(fix(r)); out.set(fix(s), n); return out;
}

// Whether `cert` carries a valid signature by `ca`'s key (WebCrypto).
export async function signedBy(cert, ca) {
  const subtle = crypto.subtle;
  if (ca.keyAlg === RSA && RSA_PKCS1[cert.sigAlg]) {
    const k = await subtle.importKey("spki", ca.spki, { name: "RSASSA-PKCS1-v1_5", hash: RSA_PKCS1[cert.sigAlg] }, false, ["verify"]);
    return subtle.verify("RSASSA-PKCS1-v1_5", k, cert.signature, cert.tbs);
  }
  if (ca.keyAlg === RSA && cert.sigAlg === "1.2.840.113549.1.1.10") {
    const { hash, salt } = pssParams(cert.sigAlgParams);
    if (!hash) throw new Error("unsupported RSASSA-PSS hash");
    const k = await subtle.importKey("spki", ca.spki, { name: "RSA-PSS", hash }, false, ["verify"]);
    return subtle.verify({ name: "RSA-PSS", saltLength: salt }, k, cert.signature, cert.tbs);
  }
  if (ca.keyAlg === EC && ECDSA[cert.sigAlg]) {
    const c = CURVES[ca.curve];
    if (!c) throw new Error("the CSCA's curve is not supported here (brainpool or explicit parameters)");
    const k = await subtle.importKey("spki", ca.spki, { name: "ECDSA", namedCurve: c[0] }, false, ["verify"]);
    return subtle.verify({ name: "ECDSA", hash: ECDSA[cert.sigAlg] }, k, rawEcdsa(cert.signature, c[1]), cert.tbs);
  }
  throw new Error(`signature algorithm ${cert.sigAlg} not supported`);
}

export const sameBytes = (a, b) => a.length === b.length && a.every((x, i) => x === b[i]);
export async function sha256Hex(b) {
  return Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", b)), (x) => x.toString(16).padStart(2, "0")).join("");
}
export function fromBase64(s) {
  const bin = atob(String(s).replace(/\s+/g, ""));
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}
