// SPDX-License-Identifier: Apache-2.0
// Tests for the invitation ticket of sampled polls. Needs `npm run build:sampling`.
"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const snarkjs = require("snarkjs");
const S = require("../src/sampling");

const WASM = path.join(__dirname, "..", "build", "sampling_test_js", "sampling_test.wasm");
const opts = { skip: !fs.existsSync(WASM) && "run npm run build:sampling first" };
const rand = () => BigInt("0x" + crypto.randomBytes(31).toString("hex"));
async function witness(input) { const w = { type: "mem" }; await snarkjs.wtns.calculate(input, WASM, w); }

test.before(async () => { await S.init(); });
test.after(async () => { if (globalThis.curve_bn128) await globalThis.curve_bn128.terminate(); });

test("the invitation rate matches p (10,000 members, p = 0.1)", async () => {
  const pollId = 42n, seed = rand(), th = S.thresholdFor(0.1);
  let n = 0;
  for (let i = 0; i < 10000; i++) if (S.invited(pollId, seed, rand(), th)) n++;
  assert.ok(n > 900 && n < 1100, `invited ${n} of 10,000`);
});

test("an invited member can prove it; a member who is not invited cannot", opts, async () => {
  const pollId = 7n, seed = rand(), threshold = S.thresholdFor(0.3);
  let yes = null, no = null;
  while (yes === null || no === null) {
    const s = rand();
    if (S.invited(pollId, seed, s, threshold)) yes = yes ?? s; else no = no ?? s;
  }
  await witness({ pollId, seed, s: yes, threshold });
  await assert.rejects(witness({ pollId, seed, s: no, threshold }), /Assert Failed/);
});

test("an open poll (threshold 2^64) admits everyone; a threshold above 2^64 is refused", opts, async () => {
  for (let i = 0; i < 5; i++) await witness({ pollId: 1n, seed: rand(), s: rand(), threshold: S.thresholdFor(1) });
  await assert.rejects(witness({ pollId: 1n, seed: 1n, s: rand(), threshold: 1n << 66n }), /Assert Failed/);
});

test("a new seed draws a new, independent sample", async () => {
  const pollId = 5n, th = S.thresholdFor(0.5), members = Array.from({ length: 2000 }, rand);
  const a = members.map((s) => S.invited(pollId, 111n, s, th)), b = members.map((s) => S.invited(pollId, 222n, s, th));
  const both = a.filter((x, i) => x && b[i]).length;
  assert.ok(both > 400 && both < 600, `overlap ${both} of 2,000 (expected about 500)`);
});
