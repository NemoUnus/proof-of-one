#!/usr/bin/env node
// SPDX-License-Identifier: Apache-2.0
// Independent recount of a poll from its public transcript only.
// Usage: node bin/recount.js transcript.json
"use strict";
const fs = require("fs");
const { create } = require("../src/protocol");
const T = require("../src/transcript");

(async () => {
  const file = process.argv[2];
  if (!file) { console.error("usage: node bin/recount.js transcript.json"); process.exit(2); }
  const P = await create();
  const tr = T.fromJSON(P, JSON.parse(fs.readFileSync(file, "utf8")));
  const rep = P.recount(tr);
  console.log("Distinct voters:    ", rep.distinctVoters ?? "-");
  console.log("Recounted totals:   ", rep.counts ? rep.counts.join(" / ") : "-");
  console.log("Published totals:   ", tr.result.counts.join(" / "));
  if (rep.ok) { console.log("RESULT VERIFIED: every check passed."); process.exit(0); }
  console.log("RESULT NOT VERIFIED:");
  for (const e of rep.errors) console.log("  - " + e);
  process.exit(1);
})();
