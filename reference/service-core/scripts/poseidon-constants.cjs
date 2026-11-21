// SPDX-License-Identifier: Apache-2.0
// Writes src/poseidon_opt.bin: circomlib's constants of the optimized Poseidon
// (circomlibjs poseidon_opt.js, after Neptune) for 1 to 16 inputs (widths t = 2 to 17).
// For each t, 32-byte big-endian values: C (8·t + P), S ((2t − 1)·P), M (t·t), P (t·t),
// matrices row by row, where P is the number of partial rounds:
//   node scripts/poseidon-constants.cjs <circomlibjs>/src/poseidon_constants_opt.json
"use strict";
const fs = require("fs");
const path = require("path");
const K = JSON.parse(fs.readFileSync(process.argv[2], "utf8"));
const NP = [56, 57, 56, 60, 60, 63, 64, 63, 60, 66, 60, 65, 70, 60, 64, 68];
const parts = [];
const w = (h) => parts.push(Buffer.from(BigInt(h).toString(16).padStart(64, "0"), "hex"));
for (let t = 2; t <= 17; t++) {
  const [C, S, M, P] = ["C", "S", "M", "P"].map((k) => K[k][t - 2]), np = NP[t - 2];
  if (C.length !== 8 * t + np || S.length !== (2 * t - 1) * np || M.length !== t || P.length !== t) throw new Error(`unexpected constants for t = ${t}`);
  C.forEach(w); S.forEach(w); M.forEach((r) => r.forEach(w)); P.forEach((r) => r.forEach(w));
}
const out = path.join(__dirname, "..", "src", "poseidon_opt.bin");
fs.writeFileSync(out, Buffer.concat(parts));
console.log(`wrote ${out}: ${Buffer.concat(parts).length} bytes`);
