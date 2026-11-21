// SPDX-License-Identifier: Apache-2.0
// The tree of checked signers (src/signers.js, src/x509.js, /signer, /path, /signers) on
// SYNTHETIC countries from document-circuit/src/icao.js: leaves and paths equal the
// reference code's (icao.js dscLeaf, ballot-circuit's IncrementalTree), which π_doc's
// circuit follows. TEST certificates only. Needs Node 22 and document-circuit's node_modules.
import test from "node:test";
import assert from "node:assert";
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import { fileURLToPath } from "node:url";
import crypto from "node:crypto";
import path from "node:path";
import { makeCore } from "../src/core.js";
import { handle } from "../src/service.js";
import { parseCertificate, signedBy } from "../src/x509.js";

const require = createRequire(import.meta.url);
const here = path.dirname(fileURLToPath(import.meta.url));
const I = require("../../document-circuit/src/icao");
const { IncrementalTree } = require("../../ballot-circuit/src/trees");
const { buildPoseidon } = require("../../document-circuit/node_modules/circomlibjs");
const core = makeCore(new WebAssembly.Module(readFileSync(process.env.CORE_WASM || path.join(here, "..", "src", "core.wasm"))));

function fakeD1() {
  const db = new DatabaseSync(":memory:");
  db.exec(readFileSync(path.join(here, "..", "schema.sql"), "utf8"));
  return { sql: db, prepare(sql) { const st = db.prepare(sql); const mk = (a) => ({ run: async () => ({ meta: { changes: Number(st.run(...a).changes) } }), first: async () => st.get(...a) ?? null, all: async () => ({ results: st.all(...a) }) }); return { bind: (...a) => mk(a), ...mk([]) }; } };
}
let H, uto, zzz, env, clock;
const b64 = (c) => I.certDer(c).toString("base64");
const call = async (method, p, body) => {
  const r = await handle(new Request("https://enrol.test" + p, { method, headers: { "content-type": "application/json" }, body: body === undefined ? undefined : JSON.stringify(body) }), env, { core, now: () => clock });
  return { status: r.status, body: await r.json() };
};

test.before(async () => {
  const p = await buildPoseidon(); H = (xs) => p.F.toObject(p(xs.map(BigInt)));
  uto = I.createCountry("UTO", 2, { suite: 2 });   // RSA-3072 signers, exponent 37817
  zzz = I.createCountry("ZZZ", 1, { suite: 1 });
});
test.beforeEach(() => {
  clock = Date.UTC(2026, 10, 21, 10);
  env = { DB: fakeD1(), CSCA_CERTS: `${b64(uto.csca.cert)},\n${b64(zzz.csca.cert)}`, OPRF_KEY: "11".repeat(64), CREDENTIAL_KEY: "22".repeat(64), REVOCATION_KEY: "33".repeat(64) };
});

test("signers are checked, added once, and the tree equals the reference", async () => {
  const ref = new IncrementalTree(H, 16);
  const a = await call("POST", "/signer", { dsc: b64(uto.dscs[0].cert), suite: 2 });
  assert.strictEqual(a.status, 200, JSON.stringify(a.body));
  assert.strictEqual(a.body.leaf, I.dscLeaf(H, uto.dscs[0].cert, 2).toString());
  ref.insert(a.body.leaf);
  assert.strictEqual(a.body.root, ref.root.toString());
  assert.deepStrictEqual([a.body.index, a.body.added], [0, true]);
  const again = await call("POST", "/signer", { dsc: b64(uto.dscs[0].cert), suite: 2 });
  assert.deepStrictEqual([again.body.index, again.body.added, again.body.root], [0, false, a.body.root]);
  const b = await call("POST", "/signer", { dsc: b64(uto.dscs[1].cert), suite: 2 });
  const c = await call("POST", "/signer", { dsc: b64(zzz.dscs[0].cert), suite: 1 });
  assert.strictEqual(c.body.leaf, I.dscLeaf(H, zzz.dscs[0].cert, 1).toString());
  ref.insert(b.body.leaf); ref.insert(c.body.leaf);
  for (const [i, leaf] of [[0, a.body.leaf], [1, b.body.leaf], [2, c.body.leaf]]) {
    const pth = await call("GET", `/path?leaf=${leaf}`);
    const r = ref.path(i);
    assert.strictEqual(pth.body.root, ref.root.toString());
    assert.deepStrictEqual(pth.body.siblings, r.siblings.map(String));
    assert.deepStrictEqual(pth.body.pathIndex, r.pathIndex.map(String));
  }
  const list = await call("GET", "/signers");
  assert.strictEqual(list.body.signers.length, 3);
  assert.deepStrictEqual(Object.keys(list.body.signers[0]).sort(), ["created", "csca", "dsc", "idx", "leaf", "suite"]);
  assert.strictEqual(list.body.signers[0].dsc, crypto.createHash("sha256").update(I.certDer(uto.dscs[0].cert)).digest("hex"));
  assert.strictEqual(list.body.signers[0].csca, crypto.createHash("sha256").update(I.certDer(uto.csca.cert)).digest("hex"));
  assert.ok(!JSON.stringify(list.body).includes("UTO") && !JSON.stringify(list.body).includes("ZZZ")); // no country names
  // every root stays accepted; /info shows the current one
  assert.strictEqual(env.DB.sql.prepare("SELECT count(*) AS n FROM roots").get().n, 3);
  assert.strictEqual((await call("GET", "/info")).body.dscRoot, ref.root.toString());
  assert.strictEqual((await call("GET", "/path?leaf=12345")).status, 404);
});

test("refused: a signer of a CSCA not held, the wrong suite, an expired certificate, garbage", async () => {
  const other = I.createCountry("UTO", 1, { suite: 1 }); // same code, another CSCA
  const r1 = await call("POST", "/signer", { dsc: b64(other.dscs[0].cert), suite: 1 });
  assert.strictEqual(r1.status, 403); assert.match(r1.body.error, /no CSCA/);
  const r2 = await call("POST", "/signer", { dsc: b64(uto.dscs[0].cert), suite: 1 });
  assert.strictEqual(r2.status, 403); assert.match(r2.body.error, /larger than suite 1|exponent/);
  const r3 = await call("POST", "/signer", { dsc: b64(zzz.dscs[0].cert), suite: 3 });
  assert.strictEqual(r3.status, 400);
  clock = Date.UTC(2041, 0, 2);
  const r4 = await call("POST", "/signer", { dsc: b64(zzz.dscs[0].cert), suite: 1 });
  assert.strictEqual(r4.status, 403); assert.match(r4.body.error, /not valid today/);
  clock = Date.UTC(2026, 10, 21);
  const r5 = await call("POST", "/signer", { dsc: "AAAA", suite: 1 });
  assert.strictEqual(r5.status, 403); assert.match(r5.body.error, /not a certificate/);
  const r6 = await call("POST", "/signer", { dsc: b64(uto.csca.cert), suite: 2 }); // the CSCA itself
  assert.strictEqual(r6.status, 403); assert.match(r6.body.error, /self-signed/);
  assert.strictEqual(env.DB.sql.prepare("SELECT count(*) AS n FROM signers").get().n, 0);
});

// A certificate built by hand, signed with node's crypto: `alg` is the signature algorithm
// (DER), `signer(tbs)` the signature.
function handCert({ subject, issuer, spki, alg, signer, ca }) {
  const name = (cn, c) => I.seq(I.set(I.seq(I.oid("2.5.4.3"), I.tlv(0x0c, Buffer.from(cn)))), I.set(I.seq(I.oid("2.5.4.6"), I.tlv(0x13, Buffer.from(c)))));
  const t = (d) => I.tlv(0x17, Buffer.from(d));
  const tbs = I.seq(I.tlv(0xa0, I.int(2)), I.int(ca ? 1 : 2), alg, name(...issuer), I.seq(t("200101000000Z"), t("391231000000Z")), name(...subject), spki);
  return Buffer.concat([I.seq(tbs, alg, I.tlv(0x03, Buffer.concat([Buffer.from([0]), signer(tbs)])))]);
}
const ECDSA256 = I.seq(I.oid("1.2.840.10045.4.3.2"));
function ecCert({ sign, ...o }) { return handCert({ ...o, alg: ECDSA256, signer: (tbs) => crypto.sign("sha256", tbs, sign) }); }
test("an ECDSA CSCA (P-256) and the X.509 reader", async () => {
  const ca = crypto.generateKeyPairSync("ec", { namedCurve: "P-256" });
  const caDer = ecCert({ subject: ["CSCA EC TEST", "EC"], issuer: ["CSCA EC TEST", "EC"], spki: ca.publicKey.export({ type: "spki", format: "der" }), sign: ca.privateKey, ca: true });
  const dk = crypto.generateKeyPairSync("rsa", { modulusLength: 2048, publicExponent: 65537 });
  const dDer = ecCert({ subject: ["DSC EC TEST", "EC"], issuer: ["CSCA EC TEST", "EC"], spki: dk.publicKey.export({ type: "spki", format: "der" }), sign: ca.privateKey });
  const c = parseCertificate(dDer), cc = parseCertificate(caDer);
  assert.strictEqual(c.country, "EC");
  assert.strictEqual(c.rsa.e, 65537n);
  assert.strictEqual(c.rsa.n, BigInt("0x" + Buffer.from(dk.publicKey.export({ format: "jwk" }).n, "base64url").toString("hex")));
  assert.ok(await signedBy(c, cc));
  const bad = Buffer.from(dDer); bad[40] ^= 1;
  assert.ok(!(await signedBy(parseCertificate(bad), cc)));
  env.CSCA_CERTS = caDer.toString("base64");
  const r = await call("POST", "/signer", { dsc: dDer.toString("base64"), suite: 1 });
  assert.strictEqual(r.status, 200, JSON.stringify(r.body));
});

// Real CSCAs use RSA exponents other than 3 and 65537, which the Workers runtime refuses to
// import (the pilot's issuer: 56611); RSA signatures are therefore checked in BigInt.
test("RSA CSCAs with an unusual exponent: PKCS #1 v1.5 and PSS, as the Workers runtime cannot", async () => {
  const ca = crypto.generateKeyPairSync("rsa", { modulusLength: 2048, publicExponent: 56611 });
  const caSpki = ca.publicKey.export({ type: "spki", format: "der" });
  const sha256rsa = I.seq(I.oid("1.2.840.113549.1.1.11"), I.tlv(0x05, Buffer.alloc(0)));
  const sha1rsa = I.seq(I.oid("1.2.840.113549.1.1.5"), I.tlv(0x05, Buffer.alloc(0)));
  const pss = I.seq(I.oid("1.2.840.113549.1.1.10"), I.seq(
    I.tlv(0xa0, I.seq(I.oid("2.16.840.1.101.3.4.2.1"))),
    I.tlv(0xa1, I.seq(I.oid("1.2.840.113549.1.1.8"), I.seq(I.oid("2.16.840.1.101.3.4.2.1")))),
    I.tlv(0xa2, I.int(32))));
  const caDer = handCert({ subject: ["CSCA RSA TEST", "RX"], issuer: ["CSCA RSA TEST", "RX"], spki: caSpki, alg: sha256rsa, ca: true,
    signer: (tbs) => crypto.sign("sha256", tbs, ca.privateKey) });
  const dk = crypto.generateKeyPairSync("rsa", { modulusLength: 3072, publicExponent: 58333 });
  const dSpki = dk.publicKey.export({ type: "spki", format: "der" });
  const make = (alg, signer) => handCert({ subject: ["DSC RSA TEST", "RX"], issuer: ["CSCA RSA TEST", "RX"], spki: dSpki, alg, signer });
  const cases = {
    pkcs1sha256: make(sha256rsa, (tbs) => crypto.sign("sha256", tbs, ca.privateKey)),
    pkcs1sha1: make(sha1rsa, (tbs) => crypto.sign("sha1", tbs, ca.privateKey)),
    pss: make(pss, (tbs) => crypto.sign("sha256", tbs, { key: ca.privateKey, padding: crypto.constants.RSA_PKCS1_PSS_PADDING, saltLength: 32 })),
  };
  const cc = parseCertificate(caDer);
  assert.strictEqual(cc.rsa.e, 56611n);
  for (const [name, der] of Object.entries(cases)) {
    assert.ok(await signedBy(parseCertificate(der), cc), name);
    const bad = Buffer.from(der); bad[bad.length - 5] ^= 1; // a changed signature byte
    assert.ok(!(await signedBy(parseCertificate(bad), cc)), name + " (changed signature)");
    const bad2 = Buffer.from(der); bad2[60] ^= 1; // a changed signed byte
    assert.ok(!(await signedBy(parseCertificate(bad2), cc)), name + " (changed data)");
  }
  env.CSCA_CERTS = caDer.toString("base64");
  const r = await call("POST", "/signer", { dsc: cases.pss.toString("base64"), suite: 2 });
  assert.strictEqual(r.status, 200, JSON.stringify(r.body));
});
