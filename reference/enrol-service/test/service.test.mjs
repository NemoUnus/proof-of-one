// SPDX-License-Identifier: Apache-2.0
// The enrolment service (src/service.js) end to end, with the phone's side from the
// reference code (document-circuit/src/fingerprint.js), the core in WebAssembly, an
// in-memory SQLite in place of D1, and a stand-in for the test network's verifier (the real
// verifier contract is checked with a real π_doc in reference/contracts).
// SYNTHETIC DOCUMENTS and TEST secrets only. Needs Node 22 (node:sqlite) and
// reference/document-circuit's node_modules.
import test from "node:test";
import assert from "node:assert";
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { makeCore, randomHex } from "../src/core.js";
import { handle, SIGNALS, natCode, dayNumber, verifyCalldata } from "../src/service.js";

const require = createRequire(import.meta.url);
const here = path.dirname(fileURLToPath(import.meta.url));
const FPm = require("../../document-circuit/src/fingerprint");
const I = require("../../document-circuit/src/icao");
const { buildEddsa } = require("../../document-circuit/node_modules/circomlibjs");
const core = makeCore(new WebAssembly.Module(readFileSync(process.env.CORE_WASM || path.join(here, "..", "src", "core.wasm"))));

// D1's interface over node:sqlite
function fakeD1() {
  const db = new DatabaseSync(":memory:");
  db.exec(readFileSync(path.join(here, "..", "schema.sql"), "utf8"));
  return {
    sql: db,
    prepare(sql) {
      const st = db.prepare(sql);
      const mk = (args) => ({
        run: async () => ({ meta: { changes: Number(st.run(...args).changes) } }),
        first: async () => st.get(...args) ?? null,
        all: async () => ({ results: st.all(...args) }),
      });
      return { bind: (...args) => mk(args), ...mk([]) };
    },
  };
}

const S = (o) => JSON.parse(JSON.stringify(o, (_, v) => (typeof v === "bigint" ? v.toString() : v)));
const ROOT = "123456789";
let FP, eddsa, clock;
const k = () => BigInt("0x" + env.OPRF_KEY) % FP.L;
const env = {
  OPRF_KEY: randomHex(64), CREDENTIAL_KEY: randomHex(64), REVOCATION_KEY: randomHex(64),
  RULES: JSON.stringify({ UTO: { path: 1, pnSrc: 0 }, ZZZ: { path: 1, pnSrc: 1, pnTag: "5F10" } }),
  DSC_ROOTS: `999, ${ROOT}`, RPC_URL: "https://rpc.test", DOC_VERIFIER: "0x0000000000000000000000000000000000000001", EPOCH: "0", DAILY_SESSIONS: "300",
};
let chainSays = true, calls = [];
const deps = {
  core, now: () => clock,
  fetch: async (url, init) => { calls.push(JSON.parse(init.body)); return { json: async () => ({ jsonrpc: "2.0", id: 1, result: "0x" + (chainSays ? "1" : "0").padStart(64, "0") }) }; },
};
const call = async (method, p, body) => {
  const r = await handle(new Request("https://enrol.test" + p, { method, headers: { "content-type": "application/json" }, body: body === undefined ? undefined : JSON.stringify(body) }), env, deps);
  return { status: r.status, body: await r.json() };
};

test.before(async () => { FP = await FPm.init(); eddsa = await buildEddsa(); });
test.beforeEach(() => { env.DB = fakeD1(); chainSays = true; calls = []; clock = Date.UTC(2026, 10, 21, 10); });

const A = { surname: "TESTER", given: "ALEX", number: "X12345678", birth: "900101", sex: "F", expiry: "350101", personal: "12345678901234" };
const dg1 = (p) => Buffer.from(I.dg1Of(I.mrzTD3(p)));

// The phone: session, round 1, round 2, and the public signals a π_doc would have.
async function phone(person = A, { issuer = "UTO", tamper = (v) => v } = {}) {
  const s = await call("POST", "/session", { issuer });
  assert.strictEqual(s.status, 200, JSON.stringify(s.body));
  const prep = FP.prepare(dg1(person), 2026, 1);
  const ev = await call("POST", "/evaluate", { session: s.body.session, pB: S(prep.person.B), dB: S(prep.document.B) });
  assert.strictEqual(ev.status, 200, JSON.stringify(ev.body));
  const pZ = ev.body.pZ.map(BigInt), dZ = ev.body.dZ.map(BigInt);
  const K = (await call("GET", "/info")).body.K.map(BigInt);
  assert.ok(FP.verifyEvaluation(K, prep.person.B, pZ, { c: BigInt(ev.body.pC), s: BigInt(ev.body.pS) }));
  const out = FP.complete(prep, pZ, dZ);
  const f = FP.fields(dg1(person), 2026);
  const v = { birthDay: f.birthDay, sexCode: f.sexCode, natCode: f.natCode, expMonth: 203501n, cFace: 77n, personKey: out.personKey, documentKey: out.documentKey,
    issuer: BigInt(natCode(issuer)), dscRoot: ROOT, today: s.body.today, currentYear: s.body.currentYear, cm: 4242n, challenge: s.body.challenge, path: 1n,
    pB0: prep.person.B[0], pB1: prep.person.B[1], pZ0: pZ[0], pZ1: pZ[1], dB0: prep.document.B[0], dB1: prep.document.B[1], dZ0: dZ[0], dZ1: dZ[1], pnSrc: 0n, pnTag: 0n };
  const t = tamper({ ...v });
  const proof = { pi_a: ["1", "2", "1"], pi_b: [["3", "4"], ["5", "6"], ["1", "0"]], pi_c: ["7", "8", "1"] };
  return { session: s.body.session, out, enrol: () => call("POST", "/enrol", { session: s.body.session, proof, publicSignals: SIGNALS.map((n) => String(t[n])) }) };
}

test("info: the OPRF key and the credential key belong to the secrets", async () => {
  const r = await call("GET", "/info");
  assert.strictEqual(r.status, 200);
  assert.deepStrictEqual(r.body.K, S(FP.keyOf(k())));
  assert.deepStrictEqual(r.body.dscRoots, ["999", ROOT]);
  assert.strictEqual(r.body.enrolments, 0);
});

test("a member enrols once: credential verifies, fingerprints reserved, counts shown", async () => {
  const p = await phone();
  const r = await p.enrol();
  assert.strictEqual(r.status, 200, JSON.stringify(r.body));
  const c = r.body.credential, F = eddsa.F;
  assert.ok(eddsa.verifyPoseidon(F.e(BigInt(r.body.msg)), { R8: c.R8.map((x) => F.e(BigInt(x))), S: BigInt(c.S) }, c.A.map((x) => F.e(BigInt(x)))));
  assert.strictEqual(calls.length, 1);
  assert.strictEqual(calls[0].params[0].data.slice(0, 10), "0x4d01c5a0");
  assert.strictEqual(calls[0].params[0].data.length, 2 + 8 + 64 * (8 + 24));
  const rows = env.DB.sql.prepare("SELECT * FROM members").all();
  assert.strictEqual(rows.length, 1);
  assert.deepStrictEqual(Object.keys(rows[0]).sort(), ["created", "fd", "fp", "issuer", "path"]);
  assert.strictEqual(rows[0].fp, p.out.personKey.toString());
  const info = (await call("GET", "/info")).body;
  assert.strictEqual(info.enrolments, 1);
  assert.strictEqual(info.evaluations, 2);
  // the session cannot be used again
  assert.strictEqual((await p.enrol()).status, 409);
});

test("the same document again, or the same person with a new document, is refused", async () => {
  assert.strictEqual((await (await phone()).enrol()).status, 200);
  const again = await (await phone()).enrol();
  assert.strictEqual(again.status, 409);
  assert.match(again.body.error, /document is already enrolled/);
  const renewed = await (await phone({ ...A, number: "Y87654321", expiry: "360101" })).enrol();
  assert.strictEqual(renewed.status, 409);
  assert.match(renewed.body.error, /person is already enrolled/);
  assert.strictEqual((await (await phone({ ...A, personal: "99999999999999", number: "Z11111111" })).enrol()).status, 200);
  assert.strictEqual(env.DB.sql.prepare("SELECT count(*) AS n FROM members").get().n, 2);
});

test("one evaluation per session; enrol needs an evaluation; sessions expire", async () => {
  const s = (await call("POST", "/session", { issuer: "UTO" })).body;
  const prep = FP.prepare(dg1(A), 2026, 1);
  const body = { session: s.session, pB: S(prep.person.B), dB: S(prep.document.B) };
  assert.strictEqual((await call("POST", "/enrol", { session: s.session, proof: {}, publicSignals: [] })).status, 409);
  assert.strictEqual((await call("POST", "/evaluate", body)).status, 200);
  assert.strictEqual((await call("POST", "/evaluate", body)).status, 409);
  const s2 = (await call("POST", "/session", { issuer: "UTO" })).body;
  clock += 601000;
  assert.strictEqual((await call("POST", "/evaluate", { ...body, session: s2.session })).status, 410);
  assert.strictEqual((await call("POST", "/evaluate", { ...body, session: "x" })).status, 400);
});

test("bad points are refused, and the session is spent", async () => {
  const s = (await call("POST", "/session", { issuer: "UTO" })).body;
  const good = S(FP.prepare(dg1(A), 2026, 1).person.B);
  const r = await call("POST", "/evaluate", { session: s.session, pB: ["0", (FP.P - 1n).toString()], dB: good });
  assert.strictEqual(r.status, 400);
  assert.match(r.body.error, /subgroup|identity/);
  assert.strictEqual((await call("POST", "/evaluate", { session: s.session, pB: good, dB: good })).status, 409);
});

test("proofs that do not match the session, the date, the rule or the signer tree are refused before the chain", async () => {
  const cases = [
    [(v) => ({ ...v, challenge: 1n }), /not for this session/],
    [(v) => ({ ...v, pZ0: v.dZ0 }), /not for this session/],
    [(v) => ({ ...v, issuer: BigInt(natCode("ZZZ")) }), /not for this session/],
    [(v) => ({ ...v, today: BigInt(v.today) - 3n }), /date/],
    [(v) => ({ ...v, currentYear: 2025n }), /year/],
    [(v) => ({ ...v, dscRoot: 5n }), /checked signers/],
    [(v) => ({ ...v, path: 2n }), /rule/],
    [(v) => ({ ...v, pnSrc: 1n }), /rule/],
  ];
  for (const [tamper, msg] of cases) {
    const r = await (await phone(A, { tamper })).enrol();
    assert.strictEqual(r.status, 403, JSON.stringify(r.body));
    assert.match(r.body.error, msg);
  }
  assert.strictEqual(calls.length, 0);
  // the DG13 rule: path 1 with pnSrc 1 and the tag
  const ok = await (await phone(A, { issuer: "ZZZ", tamper: (v) => ({ ...v, pnSrc: 1n, pnTag: 0x5f10n }) })).enrol();
  assert.strictEqual(ok.status, 200, JSON.stringify(ok.body));
  const wrongTag = await (await phone({ ...A, number: "Q22222222", personal: "1" }, { issuer: "ZZZ", tamper: (v) => ({ ...v, pnSrc: 1n, pnTag: 0x5f11n }) })).enrol();
  assert.strictEqual(wrongTag.status, 403);
});

test("a proof the verifier rejects is refused, reserves nothing, and spends the session", async () => {
  chainSays = false;
  const p = await phone();
  const r = await p.enrol();
  assert.strictEqual(r.status, 403);
  assert.match(r.body.error, /does not verify/);
  assert.strictEqual(env.DB.sql.prepare("SELECT count(*) AS n FROM members").get().n, 0);
  chainSays = true;
  assert.strictEqual((await p.enrol()).status, 409);
});

test("issuers without a rule are refused; the daily cap holds; missing secrets are reported", async () => {
  assert.strictEqual((await call("POST", "/session", { issuer: "XYZ" })).status, 403);
  assert.strictEqual((await call("POST", "/session", { issuer: "ab" })).status, 400);
  env.DAILY_SESSIONS = "2";
  assert.strictEqual((await call("POST", "/session", { issuer: "UTO" })).status, 200);
  assert.strictEqual((await call("POST", "/session", { issuer: "UTO" })).status, 200);
  assert.strictEqual((await call("POST", "/session", { issuer: "UTO" })).status, 429);
  clock += 86400000;
  assert.strictEqual((await call("POST", "/session", { issuer: "UTO" })).status, 200);
  env.DAILY_SESSIONS = "300";
  const key = env.OPRF_KEY; env.OPRF_KEY = "";
  const r = await call("GET", "/info");
  env.OPRF_KEY = key;
  assert.strictEqual(r.status, 500);
  assert.match(r.body.error, /secret/);
});

test("calldata: G2 coordinates are swapped for the precompile", () => {
  const d = verifyCalldata({ pi_a: ["1", "2"], pi_b: [["3", "4"], ["5", "6"]], pi_c: ["7", "8"] }, Array(24).fill("9"));
  const w = (i) => BigInt("0x" + d.slice(10 + 64 * i, 10 + 64 * (i + 1)));
  assert.deepStrictEqual([0, 1, 2, 3, 4, 5, 6, 7, 8].map(w), [1n, 2n, 4n, 3n, 6n, 5n, 7n, 8n, 9n]);
  assert.throws(() => verifyCalldata({ pi_a: ["x"] }, []));
});

test("day numbers as π_doc's", () => {
  assert.strictEqual(dayNumber(Date.UTC(1900, 0, 1)), 0);
  assert.strictEqual(dayNumber(Date.UTC(2026, 10, 21, 23)), Math.round((Date.UTC(2026, 10, 21) - Date.UTC(1900, 0, 1)) / 86400000));
});
