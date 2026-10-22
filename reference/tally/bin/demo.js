#!/usr/bin/env node
// SPDX-License-Identifier: Apache-2.0
// Run a simulated poll and write its public transcript.
// Usage: node bin/demo.js [voters] [out.json]
"use strict";
const fs = require("fs");
const { create } = require("../src/protocol");
const { runPoll } = require("../src/simulate");
const T = require("../src/transcript");

(async () => {
  const voters = Number(process.argv[2] || 40);
  const out = process.argv[3] || "transcript.json";
  const P = await create();
  console.log(`Simulating a poll: ${voters} voters, 4 options, 9 trustees (threshold 6), some re-votes…`);
  const r = await runPoll(P, { voters, revoters: Math.floor(voters / 6) });
  fs.writeFileSync(out, JSON.stringify(T.toJSON(P, r.transcript), null, 1));
  const rec = [...r.records.values()][0];
  console.log("Ballots submitted:      ", r.ledger.events.length);
  console.log("Distinct voters:        ", r.ledger.distinctVoters);
  console.log("True choices:           ", r.truth.join(" / "));
  console.log("Decrypted totals:       ", r.result.counts.join(" / "));
  console.log("Contract checks:        ", P.checkResult(r.ledger, r.result).ok ? "passed" : "FAILED");
  console.log("Voter #1 sees own vote: ", P.voterCheckRecorded(r.keys.PK, 4, rec, r.ledger.latestHash(rec.nf)) ? "yes" : "NO");
  console.log(`Public transcript written to ${out}. Recount it with: node bin/recount.js ${out}`);
})();
