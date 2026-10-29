// SPDX-License-Identifier: Apache-2.0
// Writes build/bench.wtns (suite 1) or build/bench_s2.wtns (`node scripts/make-witness.js 2`):
// the witness of one synthetic test passport, for timing the prover outside Node (see
// reference/prove-bench). Synthetic data only.
"use strict";
const fs = require("fs");
const path = require("path");
const snarkjs = require("snarkjs");
const D = require("../src/document");
const I = require("../src/icao");
const A = require("../../ballot-circuit/src/attrs");
(async () => {
  const { H } = await D.init();
  const suite = Number(process.argv[2] || 1);
  const uto = I.createCountry("UTO", 1, { suite });
  const { tree, index } = I.buildDscTree(H, D.IncrementalTree, D.DEPTH, [uto]);
  const doc = I.issueDocument(uto, { birth: "790812", sex: "F", expiry: "310415" });
  const input = D.buildInput(doc, { tree, leafIndex: index.get(uto.dscs[0].cert.serialNumber + "/UTO"), today: A.dayNumber(2026, 10, 25), currentYear: 2026 });
  const out = path.join(__dirname, "..", "build", suite === 1 ? "bench.wtns" : `bench_s${suite}.wtns`);
  const t = Date.now();
  await snarkjs.wtns.calculate(input, D.wasmOf(suite), out);
  console.log("witness written", out, ((Date.now() - t) / 1000).toFixed(1) + " s");
  if (globalThis.curve_bn128) await globalThis.curve_bn128.terminate();
})();
