// SPDX-License-Identifier: Apache-2.0
// Checks web/tlog.js against Tessera's own test log (testdata/log of Tessera v1.0.4,
// Apache-2.0, copied to test/vectors): 15 entries ("one" … "fivten") and a checkpoint per size.
"use strict";
const assert = require("assert");
const fs = require("fs"), path = require("path");
const T = require("../web/tlog.js");
const DIR = path.join(__dirname, "vectors", "tessera-testdata-log");
const VKEY = "example.com/log/testdata+33d7b496+AeHTu4Q3hEIMHNqc6fASMsq3rKNx280NI+oO5xCFkkSx";
const fetchBytes = async (p) => new Uint8Array(fs.readFileSync(path.join(DIR, p)));
const WORDS = ["one", "two", "three", "four", "five", "six", "seven", "eit", "nain", "ten", "ileven", "twelf", "threeten", "fourten", "fivten"];

(async () => {
  // every checkpoint size, every entry
  for (let n = 1; n <= 15; n++) {
    const note = fs.readFileSync(path.join(DIR, "checkpoint." + n), "utf8");
    for (let i = 0; i < n; i++) {
      // a reader of size n must only use tiles that existed at size n: the files are kept for each size
      const r = await T.checkEntry(fetchBytes, note, VKEY, i);
      assert.strictEqual(Buffer.from(r.entry).toString(), WORDS[i]);
      assert.strictEqual(r.checkpoint.size, n);
    }
  }
  console.log("15 checkpoints, all entries: signature, root from tiles, leaf hashes OK");
  const note = fs.readFileSync(path.join(DIR, "checkpoint"), "utf8");
  // a wrong key, a tampered root, a tampered entry and a tampered tile are refused
  await assert.rejects(T.checkEntry(fetchBytes, note, "example.com/log/testdata+33d7b496+AeHTu4Q3hEIMHNqc6fASMsq3rKNx280NI+oO5xCFkkSy", 0));
  const lines = note.split("\n"); lines[2] = Buffer.alloc(32, 7).toString("base64");
  await assert.rejects(T.checkEntry(fetchBytes, lines.join("\n"), VKEY, 0), /not signed/);
  const evil = async (p) => { const b = await fetchBytes(p); if (p.startsWith("tile/entries")) b[3] ^= 1; return b; };
  await assert.rejects(T.checkEntry(evil, note, VKEY, 0), /does not match/);
  const evil2 = async (p) => { const b = await fetchBytes(p); if (p.startsWith("tile/0/")) b[40] ^= 1; return b; };
  await assert.rejects(T.checkEntry(evil2, note, VKEY, 3), /signed root/);
  await assert.rejects(T.checkEntry(fetchBytes, note, VKEY, 15), /outside/);
  console.log("wrong key, tampered checkpoint, entry and tile, out-of-range index: refused");
  console.log("TLOG TESTS OK");
})().catch((e) => { console.error(e); process.exit(1); });
