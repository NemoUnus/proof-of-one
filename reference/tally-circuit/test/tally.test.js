// SPDX-License-Identifier: Apache-2.0
// Tests of the tally proof π_tally. Without a key (setup/tally_test.zkey) only the witness is
// checked: an honest result satisfies the circuit and every kind of wrong result does not.
// With the key, an honest result is also proved and verified.
"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");
const snarkjs = require("snarkjs");
const { create } = require("../../tally/src/protocol");
const { tallyInput, publicSignals } = require("../src/input");

const WASM = path.join(__dirname, "..", "build", "tally_js", "tally.wasm");
const ZKEY = path.join(__dirname, "..", "setup", "tally_test.zkey");
const VKEY = path.join(__dirname, "..", "setup", "vkey_tally_test.json");
let P, keys, poll;

const satisfies = async (inp) => {
  try { await snarkjs.wtns.calculate(inp, WASM, { type: "mem" }); return true; } catch { return false; }
};
const clone = (x) => JSON.parse(JSON.stringify(x));

test.before(async () => {
  P = await create({ dleq: "poseidon" });
  keys = P.dkg(5, 3, 7n);
  // a poll with 6 voters: choices 0, 1, 1, 3, 1, 0
  const choices = [0, 1, 1, 3, 1, 0];
  const ballots = choices.map((c) => P.encryptBallot(keys.PK, 4, c).C);
  const agg = P.aggregate(ballots, 4);
  const partials = keys.shares.slice(1, 4).map((sh) => ({ index: sh.index, parts: P.partialDecrypt(sh, keys.publicShares[sh.index - 1].PK, agg, 7n) }));
  const counts = P.combine(agg, partials, 3, 6);
  assert.deepEqual(counts, [2n, 3n, 0n, 1n]);
  poll = { pollId: 7n, agg, publicShares: keys.publicShares, partials, counts };
});

test("an honest result satisfies the circuit", async () => {
  assert.ok(await satisfies(tallyInput(P, poll)));
});

test("wrong counts, a forged partial, a wrong key or a wrong poll do not", async () => {
  const good = tallyInput(P, poll);
  // counts with the right sum but wrong split
  assert.equal(await satisfies({ ...clone(good), counts: ["3", "2", "0", "1"] }), false);
  // a forged partial decryption that still combines to the published D (the attack of the
  // contract tests): D and counts consistent, proof of trustee 1 invalid
  const { mul, add, sub, G, coords } = P.curve;
  const fake = [3n, 2n, 0n, 1n];
  const S = poll.partials.map((p) => p.index), lam = S.map((i) => P.lagrange0(i, S));
  const forged = clone(good);
  for (let j = 0; j < 4; j++) {
    const Dfake = sub(poll.agg[j].B, mul(G, fake[j]));
    const rest = add(mul(poll.partials[1].parts[j].D, lam[1]), mul(poll.partials[2].parts[j].D, lam[2]));
    const D0 = mul(sub(Dfake, rest), P.modInv(lam[0]));
    forged.Dij[0][j] = coords(D0).map(String);
    forged.Dr[0][j] = coords(mul(D0, P.modInv(8n))).map(String);
    forged.D[j] = coords(Dfake).map(String);
  }
  forged.counts = fake.map(String);
  assert.equal(await satisfies(forged), false);
  // a key that is not the trustee's
  const wrongKey = clone(good); wrongKey.PK[0] = good.PK[1];
  assert.equal(await satisfies(wrongKey), false);
  // the same proofs presented for another poll
  assert.equal(await satisfies({ ...clone(good), pollId: "8" }), false);
  // a wrong Lagrange coefficient
  const wrongLam = clone(good); wrongLam.lambda[0] = String(BigInt(good.lambda[0]) + 1n);
  assert.equal(await satisfies(wrongLam), false);
});

test("a poll without ballots: identity totals and identity partials", async () => {
  const O = P.curve.O;
  const agg = Array.from({ length: 4 }, () => ({ A: O, B: O }));
  const partials = keys.shares.slice(0, 3).map((sh) => ({ index: sh.index, parts: P.partialDecrypt(sh, keys.publicShares[sh.index - 1].PK, agg, 9n) }));
  assert.ok(await satisfies(tallyInput(P, { pollId: 9n, agg, publicShares: keys.publicShares, partials, counts: [0n, 0n, 0n, 0n] })));
});

test("with the test key: prove and verify", { skip: !fs.existsSync(ZKEY) && "no test key yet (scripts/setup-test.sh)" }, async () => {
  const inp = tallyInput(P, poll);
  const t0 = Date.now();
  const { proof, publicSignals: ps } = await snarkjs.groth16.fullProve(inp, WASM, ZKEY);
  console.log(`π_tally proved in ${((Date.now() - t0) / 1000).toFixed(1)} s`);
  assert.deepEqual(ps, publicSignals(inp));
  assert.ok(await snarkjs.groth16.verify(JSON.parse(fs.readFileSync(VKEY, "utf8")), ps, proof));
});

test.after(async () => { if (globalThis.curve_bn128) await globalThis.curve_bn128.terminate(); });
