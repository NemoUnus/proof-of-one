// SPDX-License-Identifier: Apache-2.0
// Makes synthetic test ballots for the test log, one file per ballot, in entries/pending/.
// The build workflow appends every pending file to the log with Tessera and then moves it to
// entries/added/. SYNTHETIC: random nullifiers, answers encrypted under a test key, no proof.
//
// Entry format (test, version 0): one line of JSON, keys in this order:
//   {"type":"proof-of-one/test-ballot/v0","poll":<string>,"nf":<decimal>,"r":<revision>,"ct":[16 decimals]}
// ct is the encrypted one-hot ballot in the contract's order (all A points, then all B points).
// In the design (docs/specs/transparency-log-ballots-v0.1.md) a log accepts a ballot only after
// checking its proof; this test log does not check proofs yet.
// Usage: node make-entries.js <count> [poll]
"use strict";
const fs = require("fs"), path = require("path");
const Chk = require("../app/web/check.js");
const n = Number(process.argv[2] || 4), poll = process.argv[3] || "test-log-1";
// Poll key of the synthetic test poll 2 (reference/testnet/web/plan2.json): any valid point works.
const plan2 = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "testnet", "web", "plan2.json"), "utf8"));
const dir = path.join(__dirname, "entries", "pending");
fs.mkdirSync(dir, { recursive: true });
const stamp = new Date().toISOString().replace(/[-:]/g, "").slice(0, 15);
for (let i = 0; i < n; i++) {
  const enc = Chk.encrypt(plan2.kits[0].PK, 4, Math.floor(Math.random() * 4));
  const e = { type: "proof-of-one/test-ballot/v0", poll, nf: String(Chk.randScalar()), r: 1, ct: enc.ct.map(String) };
  fs.writeFileSync(path.join(dir, `${stamp}-${String(i).padStart(3, "0")}.json`), JSON.stringify(e));
}
console.log(`${n} synthetic ballots written to entries/pending/`);
