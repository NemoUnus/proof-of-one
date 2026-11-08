// SPDX-License-Identifier: Apache-2.0
// Checks a whole test log as anyone can: the checkpoint's signature, the root from the tiles,
// every entry against its leaf hash, and the entry format. Run by the build workflow after
// Tessera appends entries. Usage: node verify-log.js <log dir> <log.vkey>
"use strict";
const fs = require("fs"), path = require("path");
const T = require("./web/tlog.js");
(async () => {
  const [dir, vkeyFile] = process.argv.slice(2);
  const vkey = fs.readFileSync(vkeyFile, "utf8").trim();
  const note = fs.readFileSync(path.join(dir, "checkpoint"), "utf8");
  const fetchBytes = async (p) => new Uint8Array(fs.readFileSync(path.join(dir, p)));
  const signed = await T.openNote(note, [vkey]);
  if (!signed.verified.length) throw new Error("checkpoint not signed by " + vkey);
  const cp = T.parseCheckpoint(signed.text);
  for (let i = 0; i < cp.size; i++) {
    const { entry } = await T.checkEntry(fetchBytes, note, vkey, i);
    const e = JSON.parse(Buffer.from(entry).toString());
    if (e.type !== "proof-of-one/test-ballot/v0" || !Array.isArray(e.ct) || e.ct.length !== 16) throw new Error(`entry ${i}: unexpected format`);
  }
  console.log(`log ${cp.origin}: ${cp.size} entries, signature, root and every leaf OK`);
})().catch((e) => { console.error("LOG CHECK FAILED:", e.message); process.exit(1); });
