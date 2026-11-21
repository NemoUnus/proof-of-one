// SPDX-License-Identifier: Apache-2.0
// End to end, on one machine, as the phone does it (EnrolActivity) against the real service
// code: a SYNTHETIC passport with the personal number in DG13; the service (src/service.js)
// with SQLite in place of D1 and a local chain (ganache) holding the real DocVerifier;
// π_doc made by the native prover (doc-prove) with the TEST-ONLY suite-2 key, the real tree
// path from /path, the session's challenge and date, and fingerprints answered by /evaluate.
// Not part of CI (needs the 179 MB key):
//   node test/e2e.local.mjs <pk_c.bin> <doc_matrices.gz>
// Needs: document-circuit's node_modules and build (document_s2.graph), contracts' build
// (DocVerifier), native-prover's doc-prove and member-check (cargo build --release).
import assert from "node:assert";
import { createRequire } from "node:module";
import { readFileSync, writeFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import crypto from "node:crypto";
import path from "node:path";
import os from "node:os";
import { makeCore, randomHex } from "../src/core.js";
import { handle } from "../src/service.js";

const require = createRequire(import.meta.url);
const here = path.dirname(fileURLToPath(import.meta.url));
const R = path.join(here, "..", "..");
const I = require(path.join(R, "document-circuit/src/icao"));
const D = require(path.join(R, "document-circuit/src/document"));
const FPm = require(path.join(R, "document-circuit/src/fingerprint"));
const { buildEddsa } = require(path.join(R, "document-circuit/node_modules/circomlibjs"));
const ganache = require(path.join(R, "contracts/node_modules/ganache"));
const { ethers } = require(path.join(R, "contracts/node_modules/ethers"));
const [pk, mat] = process.argv.slice(2);
if (!pk || !mat) { console.error("usage: e2e.local.mjs <pk_c.bin> <doc_matrices.gz>"); process.exit(2); }

const core = makeCore(new WebAssembly.Module(readFileSync(process.env.CORE_WASM || path.join(here, "..", "src", "core.wasm"))));
const db = new DatabaseSync(":memory:");
db.exec(readFileSync(path.join(here, "..", "schema.sql"), "utf8"));
const D1 = { prepare(sql) { const st = db.prepare(sql); const mk = (a) => ({ run: async () => ({ meta: { changes: Number(st.run(...a).changes) } }), first: async () => st.get(...a) ?? null, all: async () => ({ results: st.all(...a) }) }); return { bind: (...a) => mk(a), ...mk([]) }; } };

// the chain, with the real verifier
const eth = ganache.provider({ logging: { quiet: true } });
const provider = new ethers.BrowserProvider(eth);
const a = JSON.parse(readFileSync(path.join(R, "contracts/build/DocVerifier.json"), "utf8"));
const c = await new ethers.ContractFactory(a.abi, a.bytecode, await provider.getSigner()).deploy();
await c.waitForDeployment();

const country = I.createCountry("UTO", 1, { suite: 2 });
const env = {
  DB: D1, OPRF_KEY: randomHex(64), CREDENTIAL_KEY: randomHex(64), REVOCATION_KEY: randomHex(64),
  RULES: JSON.stringify({ UTO: { path: 1, pnSrc: 1, pnTag: "5F07" } }), CSCA_CERTS: I.certDer(country.csca.cert).toString("base64"),
  RPC_URL: "http://chain", DOC_VERIFIER: await c.getAddress(), EPOCH: "0", DAILY_SESSIONS: "300",
};
const deps = { core, fetch: async (url, init) => ({ json: async () => ({ jsonrpc: "2.0", id: 1, result: await eth.request(JSON.parse(init.body)) }) }) };
const call = async (method, p, body) => {
  const r = await handle(new Request("https://enrol.test" + p, { method, headers: { "content-type": "application/json" }, body: body === undefined ? undefined : JSON.stringify(body) }), env, deps);
  const j = await r.json();
  if (r.status !== 200) throw new Error(`${p}: HTTP ${r.status} ${j.error}`);
  return j;
};

const FP = await FPm.init();
const eddsa = await buildEddsa();
const person = { surname: "TESTER", given: "SAM", number: "U1234567<", birth: "880412", sex: "M", expiry: "330101", personal: "<<<<<<<<<<<<<<" };
const doc = I.issueDocument(country, person, { dg13: I.nationalDg13({ personal: "0098765432", pnTag: 0x5f07 }) });
const t0 = Date.now();
const info = await call("GET", "/info");
// 1. signer and its path
const sg = await call("POST", "/signer", { dsc: I.certDer(doc.dscCert).toString("base64"), suite: 2 });
const p = await call("GET", `/path?leaf=${sg.leaf}`);
// 2. session
const ses = await call("POST", "/session", { issuer: "UTO" });
assert.deepStrictEqual(ses.rule, { path: "1", pnSrc: "1", pnTag: String(0x5f07) });
// 3. member secrets (the phone's native code)
const member = JSON.parse(execFileSync(path.join(R, "native-prover/target/release/member-check"), [crypto.randomBytes(192).toString("hex")]).toString());
// 4. fingerprints with the service
const rule = { dg13: doc.dg13, pnTag: BigInt(ses.rule.pnTag) };
const prep = FP.prepare(doc.dg1, Number(ses.currentYear), 1, rule);
const S = (o) => JSON.parse(JSON.stringify(o, (_, v) => (typeof v === "bigint" ? v.toString() : v)));
const ans = await call("POST", "/evaluate", { session: ses.session, pB: S(prep.person.B), dB: S(prep.document.B) });
const K = info.K.map(BigInt);
assert.ok(FP.verifyEvaluation(K, prep.person.B, ans.pZ.map(BigInt), { c: BigInt(ans.pC), s: BigInt(ans.pS) }));
assert.ok(FP.verifyEvaluation(K, prep.document.B, ans.dZ.map(BigInt), { c: BigInt(ans.dC), s: BigInt(ans.dS) }));
const keys = FP.complete(prep, ans.pZ.map(BigInt), ans.dZ.map(BigInt));
// 5. π_doc with the real path
const tree = { root: BigInt(p.root), path: () => ({ siblings: p.siblings.map(BigInt), pathIndex: p.pathIndex.map(Number) }) };
const input = D.buildInput(doc, { tree, leafIndex: p.index, today: BigInt(ses.today), currentYear: BigInt(ses.currentYear), cm: BigInt(member.cm),
  challenge: BigInt(ses.challenge), rFace: 12345n, keys, pnTag: 0x5f07 });
const inFile = path.join(os.tmpdir(), `poo-e2e-${process.pid}.json`);
writeFileSync(inFile, JSON.stringify(S(input)));
const g = path.join(R, "document-circuit/build");
const out = execFileSync(path.join(R, "native-prover/target/release/doc-prove"), [pk, mat, path.join(g, "document_s2.graph"), path.join(g, "dsc_test_tree_s2.graph"), inFile], { maxBuffer: 1 << 26 }).toString().trim().split("\n").pop();
const r = JSON.parse(out);
assert.ok(r.verified, "verified on the prover");
assert.ok(!r.testTree, "real tree used");
// 6. enrol
const res = await call("POST", "/enrol", { session: ses.session, proof: r.proof, publicSignals: r.public });
const F = eddsa.F, cr = res.credential;
assert.ok(eddsa.verifyPoseidon(F.e(BigInt(res.msg)), { R8: cr.R8.map((x) => F.e(BigInt(x))), S: BigInt(cr.S) }, cr.A.map((x) => F.e(BigInt(x)))));
assert.deepStrictEqual(cr.A, info.A);
assert.strictEqual(r.public[5], keys.personKey.toString());
console.log(`ENROLLED end to end in ${((Date.now() - t0) / 1000).toFixed(1)} s: signer added, path, session, fingerprints (DLEQ checked), π_doc (${r.witnessMs + r.proveMs} ms) verified by the DocVerifier contract, credential verified`);
// the same passport again: refused by the unique fingerprints
const ses2 = await call("POST", "/session", { issuer: "UTO" });
await assert.rejects(call("POST", "/enrol", { session: ses2.session, proof: r.proof, publicSignals: r.public }), /evaluate first/);
console.log("a replayed proof in a new session: refused");
process.exit(0);
