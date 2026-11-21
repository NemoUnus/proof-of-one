// SPDX-License-Identifier: Apache-2.0
// The service core against the project's JavaScript references: the OPRF answer and its
// DLEQ proof against document-circuit/src/fingerprint.js (the phone's side), the
// credential against circomlibjs (the verifier of π_reg) and enrolment.js's message.
// SYNTHETIC DOCUMENTS and TEST secrets only.
//   Backend: build/core.wasm if present (CI), else the native core-cli (cargo).
// Needs reference/document-circuit's node_modules (npm ci there).
import test from "node:test";
import assert from "node:assert";
import { createRequire } from "node:module";
import { existsSync, readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { makeCore, randomHex } from "../src/core.js";

const require = createRequire(import.meta.url);
const here = path.dirname(fileURLToPath(import.meta.url));
const FPm = require("../../document-circuit/src/fingerprint");
const I = require("../../document-circuit/src/icao");
const { buildEddsa, buildPoseidon } = require("../../document-circuit/node_modules/circomlibjs");

const WASM = process.env.CORE_WASM || path.join(here, "..", "src", "core.wasm");
const useWasm = existsSync(WASM);
let core;
if (useWasm) core = makeCore(new WebAssembly.Module(readFileSync(WASM)));
else {
  const dir = path.join(here, "..", "..", "service-core");
  execFileSync("cargo", ["build", "--release", "--quiet"], { cwd: dir, stdio: "inherit" });
  const bin = path.join(dir, "target", "release", "core-cli");
  core = { call: (name, input) => { const v = JSON.parse(execFileSync(bin, [name], { input: JSON.stringify(input) }).toString()); if (v && v.error) throw new Error(v.error); return v; } };
}
console.log(`# backend: ${useWasm ? "WebAssembly " + WASM : "native core-cli"}`);

const S = (o) => JSON.parse(JSON.stringify(o, (_, v) => (typeof v === "bigint" ? v.toString() : v)));
const big = (hex) => BigInt("0x" + hex);
const secrets = { oprf: randomHex(64), credential: randomHex(64), revocation: randomHex(64) };
let FP, eddsa, H;
test.before(async () => { FP = await FPm.init(); eddsa = await buildEddsa(); const p = await buildPoseidon(); H = (xs) => p.F.toObject(p(xs.map(BigInt))); });

const k = () => big(secrets.oprf) % FP.L;
const dg1 = (person) => Buffer.from(I.dg1Of(I.mrzTD3(person)));
const A = { surname: "TESTER", given: "ALEX", number: "X12345678", birth: "900101", sex: "F", expiry: "350101", personal: "12345678901234" };

test("public keys: K = k·G and the credential key A = a·Base8", () => {
  const pub = core.call("public", { secrets });
  assert.deepStrictEqual(pub.K, S(FP.keyOf(k())));
  const a = big(secrets.credential) % FP.L;
  assert.deepStrictEqual(pub.A, S(FP.mul(FP.G, a)));
  assert.strictEqual(pub.keyLeaf, H(pub.A).toString());
});

test("evaluate: the phone accepts both answers, and the fingerprints are k's", () => {
  const prep = FP.prepare(dg1(A), 2026, 1);
  const ans = core.call("evaluate", { secrets, pB: S(prep.person.B), dB: S(prep.document.B), rand: randomHex(128) });
  const K = FP.keyOf(k());
  const Zp = ans.pZ.map(BigInt), Zd = ans.dZ.map(BigInt);
  assert.ok(FP.verifyEvaluation(K, prep.person.B, Zp, { c: BigInt(ans.pC), s: BigInt(ans.pS) }));
  assert.ok(FP.verifyEvaluation(K, prep.document.B, Zd, { c: BigInt(ans.dC), s: BigInt(ans.dS) }));
  assert.ok(!FP.verifyEvaluation(K, prep.person.B, Zp, { c: BigInt(ans.dC), s: BigInt(ans.dS) }));
  const out = FP.complete(prep, Zp, Zd);
  const ref = FP.complete(prep, FP.evaluate(k(), prep.person.B).Z, FP.evaluate(k(), prep.document.B).Z);
  assert.strictEqual(out.personKey, ref.personKey);
  assert.strictEqual(out.documentKey, ref.documentKey);
  // a second session with other blinding and other nonces gives the same fingerprints
  const prep2 = FP.prepare(dg1(A), 2026, 1);
  const ans2 = core.call("evaluate", { secrets, pB: S(prep2.person.B), dB: S(prep2.document.B), rand: randomHex(128) });
  assert.notStrictEqual(ans2.pC, ans.pC);
  assert.strictEqual(FP.complete(prep2, ans2.pZ.map(BigInt), ans2.dZ.map(BigInt)).personKey, out.personKey);
  // the core's own check agrees
  assert.strictEqual(core.call("verifyAnswer", { K: S(K), B: S(prep.person.B), Z: ans.pZ, c: ans.pC, s: ans.pS }), true);
  assert.strictEqual(core.call("verifyAnswer", { K: S(K), B: S(prep.person.B), Z: ans.pZ, c: ans.pC, s: ans.dS }), false);
});

test("evaluate refuses points outside the prime-order subgroup, the identity, malformed input", () => {
  const good = S(FP.prepare(dg1(A), 2026, 1).person.B);
  const bad = [["0", (FP.P - 1n).toString()], ["1", "2"], ["0", "1"], [good[0], good[1] + "0"], ["01", good[1]], [good[0]]];
  for (const B of bad) assert.throws(() => core.call("evaluate", { secrets, pB: B, dB: good, rand: randomHex(128) }), undefined, JSON.stringify(B));
  // order 8·ℓ point: a point of order 2 added to a good one
  const mixed = S(FP.add(good.map(BigInt), [0n, FP.P - 1n]));
  assert.throws(() => core.call("evaluate", { secrets, pB: good, dB: mixed, rand: randomHex(128) }), /subgroup/);
  assert.throws(() => core.call("evaluate", { secrets, pB: good, dB: good, rand: randomHex(64) }), /128 random bytes/);
  assert.throws(() => core.call("evaluate", { secrets: { ...secrets, oprf: "00" }, pB: good, dB: good, rand: randomHex(128) }), /64 random bytes/);
  assert.throws(() => core.call("nothing", {}), /unknown function/);
});

test("sign: circomlib verifies the credential; message and handle as enrolment.js", () => {
  const attrs = ["32872", "2", "5592143", "202901", "0", "0", "0", "0"];
  const fp = "123456789012345678901234567890", cm = "987654321", epoch = "0";
  const c = core.call("sign", { secrets, fp, attrs, cm, epoch, rand: randomHex(64) });
  const kR = big(secrets.revocation) % FP.P;
  assert.strictEqual(c.rn, (H([6n, kR, BigInt(fp), 0n]) % (1n << 252n)).toString());
  assert.strictEqual(c.msg, H([5n, ...attrs.map(BigInt), BigInt(cm), BigInt(c.rn), BigInt(epoch)]).toString());
  const pub = core.call("public", { secrets });
  assert.deepStrictEqual(c.A, pub.A);
  const F = eddsa.F;
  const sig = { R8: c.R8.map((v) => F.e(BigInt(v))), S: BigInt(c.S) };
  const Apt = c.A.map((v) => F.e(BigInt(v)));
  assert.ok(eddsa.verifyPoseidon(F.e(BigInt(c.msg)), sig, Apt));
  assert.ok(!eddsa.verifyPoseidon(F.e(BigInt(c.msg) + 1n), sig, Apt));
  assert.strictEqual(core.call("verifySignature", { A: c.A, msg: c.msg, R8: c.R8, S: c.S }), true);
  // the same person key gives the same handle; another gives another
  const c2 = core.call("sign", { secrets, fp, attrs, cm: "5", epoch, rand: randomHex(64) });
  assert.strictEqual(c2.rn, c.rn);
  assert.notStrictEqual(core.call("sign", { secrets, fp: "7", attrs, cm, epoch, rand: randomHex(64) }).rn, c.rn);
  assert.throws(() => core.call("sign", { secrets, fp, attrs: attrs.slice(1), cm, epoch, rand: randomHex(64) }), /8 attribute/);
});

test("poseidon equals circomlibjs for 1 to 16 inputs", () => {
  for (let n = 1; n <= 16; n++) {
    const xs = Array.from({ length: n }, (_, i) => BigInt(i * 1000003 + n));
    assert.strictEqual(core.call("poseidon", { inputs: S(xs) }), H(xs).toString(), `n = ${n}`);
  }
});

test("tree: root and paths equal ballot-circuit's IncrementalTree", () => {
  const { IncrementalTree } = require("../../ballot-circuit/src/trees");
  for (const n of [0, 1, 2, 5]) {
    const ref = new IncrementalTree(H, 16);
    const leaves = Array.from({ length: n }, (_, i) => BigInt(i * 7919 + 11));
    leaves.forEach((l) => ref.insert(l));
    assert.strictEqual(core.call("tree", { leaves: S(leaves), depth: 16 }).root, ref.root.toString());
    for (let i = 0; i < n; i++) {
      const t = core.call("tree", { leaves: S(leaves), depth: 16, index: i }), r = ref.path(i);
      assert.deepStrictEqual([t.siblings, t.pathIndex], [r.siblings.map(String), r.pathIndex.map(String)]);
    }
  }
  assert.throws(() => core.call("tree", { leaves: ["1"], depth: 16, index: 1 }), /no such leaf/);
});

test("time per call (the Worker's limit is about 10 ms of processor time per request)", { skip: !useWasm && "WebAssembly only" }, () => {
  const prep = FP.prepare(dg1(A), 2026, 1);
  const inp = { secrets, pB: S(prep.person.B), dB: S(prep.document.B), rand: randomHex(128) };
  const time = (f) => { f(); const t = performance.now(); for (let i = 0; i < 20; i++) f(); return (performance.now() - t) / 20; };
  const tPub = time(() => core.call("public", { secrets }));
  const tEval = time(() => core.call("evaluate", inp));
  const tSign = time(() => core.call("sign", { secrets, fp: "1", attrs: ["1", "1", "1", "1", "0", "0", "0", "0"], cm: "1", epoch: "0", rand: randomHex(64) }));
  console.log(`# ms per call: public ${tPub.toFixed(2)}, evaluate ${tEval.toFixed(2)}, sign ${tSign.toFixed(2)}`);
});
