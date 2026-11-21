// SPDX-License-Identifier: Apache-2.0
// The tree of checked signers (docs/specs/pilot-enrolment-service-v0.1.md, §5).
// A phone that meets a document signer (DSC) not yet in the tree sends its certificate;
// the service checks it against the CSCA certificates it holds and adds the key's leaf,
// exactly as π_doc builds it (reference/document-circuit/src/icao.js, dscLeaf; circuit
// lib/document_core.circom, step 5), to a depth-16 Poseidon tree.
import { parseCertificate, signedBy, sha256Hex, fromBase64, sameBytes } from "./x509.js";

export const DEPTH = 16;
const LIMB = 121n;
// π_doc's suites (document-circuit/src/icao.js, SUITES)
export const SUITES = {
  1: { alg: 1n, k: 17, maxBits: 2048, fixedE: 65537n },
  2: { alg: 2n, k: 26, maxBits: 3146, fixedE: null, ebits: 17n },
};

// The DSC tree leaf of an RSA key for a suite.
export function dscLeaf(core, { n, e }, suite) {
  const S = SUITES[suite];
  if (!S) throw new Error("unknown suite");
  if (n.toString(2).length > S.maxBits) throw new Error(`the signer's key is larger than suite ${suite} allows`);
  if (S.fixedE !== null && e !== S.fixedE) throw new Error(`suite ${suite} requires the exponent ${S.fixedE}`);
  if (S.fixedE === null && (e < 3n || e % 2n === 0n || e >= 1n << S.ebits)) throw new Error(`suite ${suite}: exponent not supported`);
  const c = []; let x = n;
  for (let i = 0; i < S.k; i++) { c.push(x & ((1n << LIMB) - 1n)); x >>= LIMB; }
  if (x !== 0n) throw new Error("modulus too large");
  const H = (xs) => core.call("poseidon", { inputs: xs.map(String) });
  const m16 = H(c.slice(0, 16));
  const rest = S.k === 17 && S.fixedE !== null ? String(c[16]) : H([...c.slice(16), e]);
  return H([S.alg, m16, rest]);
}

// The CSCA certificates the service holds (variable CSCA_CERTS: base64 DER, separated by
// commas or white space), parsed once per configuration.
let cache = { src: null, list: [] };
export async function cscas(env) {
  const src = String(env.CSCA_CERTS || "");
  if (cache.src !== src) {
    const list = [];
    for (const part of src.split(/[\s,]+/).filter(Boolean)) {
      const c = parseCertificate(fromBase64(part));
      list.push({ ...c, sha256: await sha256Hex(c.der) });
    }
    cache = { src, list };
  }
  return cache.list;
}

// Checks a DSC: signed by one of the CSCAs, within its validity now, issued while the
// CSCA was valid, an RSA key the suite takes. Returns the leaf and the fingerprints.
export async function checkSigner(core, env, der, suite, now) {
  let cert;
  try { cert = parseCertificate(der); } catch (e) { throw new Error(`not a certificate: ${e.message}`); }
  if (sameBytes(cert.issuer, cert.subject)) throw new Error("a self-signed certificate is not a document signer");
  if (!cert.rsa) throw new Error("only RSA document signers are supported by π_doc's suites");
  if (now < cert.notBefore || now > cert.notAfter) throw new Error("the signer's certificate is not valid today");
  let by = null;
  for (const ca of await cscas(env)) {
    if (ca.country !== cert.country) continue;
    let ok = false;
    try { ok = await signedBy(cert, ca); } catch { ok = false; }
    if (ok) { by = ca; break; }
  }
  if (!by) throw new Error("no CSCA held by the service signed this certificate");
  if (cert.notBefore < by.notBefore || cert.notBefore > by.notAfter) throw new Error("the signer's certificate was issued outside its CSCA's validity");
  const leaf = dscLeaf(core, cert.rsa, suite);
  return { leaf, dsc: await sha256Hex(cert.der), csca: by.sha256 };
}
