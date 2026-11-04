// SPDX-License-Identifier: Apache-2.0
// Tests for the invitation ticket of sampled polls (src/sampling.js). The contract-side
// check is tested in ../contracts/test/polls.test.js with real ballots.
"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const crypto = require("crypto");
const S = require("../src/sampling");

const rand = () => BigInt("0x" + crypto.randomBytes(31).toString("hex"));
test.before(async () => { await S.init(); });

test("the invitation rate matches p (10,000 members, p = 0.1)", () => {
  const seed = rand(), th = S.thresholdFor(0.1);
  let n = 0;
  for (let i = 0; i < 10000; i++) if (S.invited(rand(), seed, th)) n++;
  assert.ok(n > 900 && n < 1100, `invited ${n} of 10,000`);
});

test("an open poll (threshold 0) admits everyone; rates outside (0, 1) are refused", () => {
  for (let i = 0; i < 5; i++) assert.equal(S.invited(rand(), rand(), 0n), true);
  assert.throws(() => S.thresholdFor(1), /open poll/);
  assert.throws(() => S.thresholdFor(0), /open poll/);
});

test("a new seed draws a new, independent sample", () => {
  const th = S.thresholdFor(0.5), nfs = Array.from({ length: 2000 }, rand);
  const a = nfs.map((nf) => S.invited(nf, 111n, th)), b = nfs.map((nf) => S.invited(nf, 222n, th));
  const both = a.filter((x, i) => x && b[i]).length;
  assert.ok(both > 400 && both < 600, `overlap ${both} of 2,000 (expected about 500)`);
});
