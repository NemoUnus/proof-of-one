// SPDX-License-Identifier: Apache-2.0
// Writes build/bench.wtns: the witness of one synthetic test passport, for timing the
// prover outside Node (see reference/prove-bench). Synthetic data only.
// Run after `npm run build`: node scripts/make-witness.js
"use strict";
const fs = require("fs");
const path = require("path");
const snarkjs = require("snarkjs");
const D = require("../src/document");
const I = require("../src/icao");
const A = require("../../ballot-circuit/src/attrs");
(async () => {
  const { H } = await D.init();
  const uto = I.createCountry("UTO", 1);
  const { tree, index } = I.buildDscTree(H, D.IncrementalTree, D.DEPTH, [uto]);
  const doc = I.issueDocument(uto, { birth: "790812", sex: "F", expiry: "310415" });
  const input = D.buildInput(doc, { tree, leafIndex: index.get(uto.dscs[0].cert.serialNumber + "/UTO"), today: A.dayNumber(2026, 10, 25), currentYear: 2026 });
  const out = path.join(__dirname, "..", "build", "bench.wtns");
  const t = Date.now();
  await snarkjs.wtns.calculate(input, D.WASM, out);
  console.log("witness written", out, ((Date.now() - t) / 1000).toFixed(1) + " s");
  if (globalThis.curve_bn128) await globalThis.curve_bn128.terminate();
})();
