// SPDX-License-Identifier: Apache-2.0
// Keyed document fingerprints (OPRF over Baby Jubjub): the reference code and the circuit
// part of π_doc (circuits/lib/fingerprint.circom, through circuits/test/keys_test.circom).
// SYNTHETIC DOCUMENTS ONLY.  Build first: npm run build:keys
"use strict";
const test = require("node:test");
const assert = require("node:assert");
const path = require("path");
const snarkjs = require("snarkjs");
const I = require("../src/icao");
const FPm = require("../src/fingerprint");

const WASM = path.join(__dirname, "..", "build", "keys_test_js", "keys_test.wasm");
const built = require("fs").existsSync(WASM);
const S = (o) => JSON.parse(JSON.stringify(o, (_, v) => (typeof v === "bigint" ? v.toString() : v)));
async function run(input) {
  const w = { type: "mem" };
  await snarkjs.wtns.calculate(S(input), WASM, w);
  const j = await snarkjs.wtns.exportJson(w);
  return { personKey: String(j[1]), documentKey: String(j[2]), issuer: String(j[3]) };
}
const fails = async (input) => assert.rejects(run(input));
const dg1 = (person) => Buffer.from(I.dg1Of ? I.dg1Of(I.mrzTD3(person)) : Buffer.alloc(0));

let FP;
const k = 987654321987654321n;
// The phone's two rounds with a service holding k.
function enrol(d, pathNo = 1, key = k) {
  const prep = FP.prepare(d, 2026, pathNo);
  const ep = FP.evaluate(key, prep.person.B), ed = FP.evaluate(key, prep.document.B);
  assert.ok(FP.verifyEvaluation(FP.keyOf(key), prep.person.B, ep.Z, ep.proof));
  assert.ok(FP.verifyEvaluation(FP.keyOf(key), prep.document.B, ed.Z, ed.proof));
  return FP.complete(prep, ep.Z, ed.Z);
}
const A = { surname: "TESTER", given: "ALEX", number: "X12345678", personal: "1234567890<<<<", birth: "850704", sex: "M", expiry: "300101", issuer: "UTO", nationality: "UTO" };

test.before(async () => { FP = await FPm.init(); });

test("the circuit computes the reference fingerprints; blinding and the service's randomness do not change them", { skip: !built && "run npm run build:keys first" }, async () => {
  const a1 = enrol(dg1(A)), a2 = enrol(dg1(A));
  assert.notStrictEqual(a1.input.pB[0], a2.input.pB[0]); // different blinded points
  assert.strictEqual(a1.personKey, a2.personKey);
  assert.strictEqual(a1.documentKey, a2.documentKey);
  const o = await run({ dg1: [...dg1(A), ...Array(35).fill(0)], natCode: FP.fields(dg1(A), 2026).natCode, birthDay: FP.fields(dg1(A), 2026).birthDay, sexCode: 1n, ...a1.input });
  assert.strictEqual(o.personKey, a1.personKey.toString());
  assert.strictEqual(o.documentKey, a1.documentKey.toString());
  assert.strictEqual(o.issuer, a1.issuer.toString());
});

// The circuit input around DocumentKeys, as π_doc gives it (DG1 bytes and the fields it reads itself).
const full = (d, e) => { const f = FP.fields(d, 2026); return { dg1: [...d, ...Array(35).fill(0)], natCode: f.natCode, birthDay: f.birthDay, sexCode: f.sexCode, ...e.input }; };

test("renewal: a new document number keeps the person key and changes the document key", async () => {
  const a = enrol(dg1(A)), b = enrol(dg1({ ...A, number: "Y87654321", expiry: "360101" }));
  assert.strictEqual(a.personKey, b.personKey);
  assert.notStrictEqual(a.documentKey, b.documentKey);
});

test("another person, or another key, gives other fingerprints; the name path differs from the number path", { skip: !built && "run npm run build:keys first" }, async () => {
  const a = enrol(dg1(A));
  assert.notStrictEqual(a.personKey, enrol(dg1({ ...A, personal: "1234567891<<<<" })).personKey);
  assert.notStrictEqual(a.personKey, enrol(dg1({ ...A, birth: "850705" })).personKey);
  assert.notStrictEqual(a.personKey, enrol(dg1(A), 1, k + 1n).personKey);
  const n = enrol(dg1(A), 2);
  assert.notStrictEqual(a.personKey, n.personKey);
  assert.strictEqual(a.documentKey, n.documentKey);
  await run(full(dg1(A), n)); // the name path proves too
});

test("the circuit rejects wrong hints, a third path, an even or too large r, and an answer from another key", { skip: !built && "run npm run build:keys first" }, async () => {
  const d = dg1(A), a = enrol(d), base = full(d, a);
  await run(base);
  await fails({ ...base, pE: [1n - a.input.pE[0], a.input.pE[1]] });
  await fails({ ...base, pV: [FP.P - a.input.pV[0], a.input.pV[1]] });
  await fails({ ...base, path: 3n });
  await fails({ ...base, path: 2n }); // hints and points are for path 1
  // an answer computed with another key: Z does not match W
  const other = FP.evaluate(k + 7n, a.input.pB).Z;
  await fails({ ...base, pZ: other });
  // a second W for the same Z: W + a point of order 2 (not in the subgroup; V must give W = 8·V)
  const W = FP.mul(a.input.pVw, 8n);
  const W2 = [FP.P - W[0], FP.P - W[1]]; // W + (0, −1)
  await fails({ ...base, pVw: W2 });
  // even r, and r + ℓ (same point, out of range)
  const prep = FP.prepare(d, 2026, 1);
  prep.person.r = prep.person.r + 1n; prep.person.B = FP.blind(prep.person.x, prep.person.r);
  const ev = FP.complete(prep, FP.evaluate(k, prep.person.B).Z, FP.evaluate(k, prep.document.B).Z);
  await fails(full(d, ev));
  await fails({ ...base, pR: a.input.pR + FP.L });
  // fields that are not the document's: another birth day than DG1's
  await fails({ ...base, birthDay: base.birthDay + 1n });
});

test("the service refuses points outside the prime-order subgroup, and the phone refuses a wrong DLEQ proof", async () => {
  assert.throws(() => FP.evaluate(k, [0n, FP.P - 1n]));  // order 2
  assert.throws(() => FP.evaluate(k, [1n, 2n]));         // not on the curve
  const prep = FP.prepare(dg1(A), 2026, 1);
  const ev = FP.evaluate(k, prep.person.B);
  assert.ok(!FP.verifyEvaluation(FP.keyOf(k), prep.person.B, FP.mul(ev.Z, 2n), ev.proof));
  assert.ok(!FP.verifyEvaluation(FP.keyOf(k + 1n), prep.person.B, ev.Z, ev.proof));
});
