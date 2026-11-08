// SPDX-License-Identifier: Apache-2.0
// TEST HELPER ONLY: a minimal tlog-tiles writer, used to try the viewer page without Tessera.
// The published log is written by Tessera (see the workflow); tlog.js is tested against
// Tessera's own test log. Usage: node test/mini-writer.js <out dir> <entries glob dir> <PRIVATE+KEY+...>
"use strict";
const fs = require("fs"), path = require("path"), c = require("crypto");
const [out, inDir, priv] = process.argv.slice(2);
const sha = (b) => c.createHash("sha256").update(b).digest();
const files = fs.readdirSync(inDir).sort().map((f) => fs.readFileSync(path.join(inDir, f)));
const n = files.length;
const enc = (x) => { const p = []; do { p.unshift(String(x % 1000).padStart(3, "0")); x = Math.floor(x / 1000); } while (x > 0); return p.map((s, i) => (i < p.length - 1 ? "x" + s : s)).join("/"); };
const w = (p, b) => { fs.mkdirSync(path.dirname(path.join(out, p)), { recursive: true }); fs.writeFileSync(path.join(out, p), b); };
// level-0 hashes, then each tile level: hashes at height 8L
let level = files.map((e) => sha(Buffer.concat([Buffer.from([0]), e])));
for (let t = 0; t * 256 < n; t++) {
  const chunk = files.slice(t * 256, t * 256 + 256);
  w(`tile/entries/${enc(t)}` + (chunk.length < 256 ? `.p/${chunk.length}` : ""), Buffer.concat(chunk.flatMap((e) => [Buffer.from([e.length >> 8, e.length & 255]), e])));
}
let L = 0, hashes = level;
while (hashes.length) {
  for (let t = 0; t * 256 < hashes.length; t++) { const ch = hashes.slice(t * 256, t * 256 + 256); w(`tile/${L}/${enc(t)}` + (ch.length < 256 ? `.p/${ch.length}` : ""), Buffer.concat(ch)); }
  // next tile level: complete subtrees of 256 nodes
  const next = [];
  for (let i = 0; i + 256 <= hashes.length; i += 256) { let h = hashes.slice(i, i + 256); while (h.length > 1) { const u = []; for (let j = 0; j < h.length; j += 2) u.push(sha(Buffer.concat([Buffer.from([1]), h[j], h[j + 1]]))); h = u; } next.push(h[0]); }
  hashes = next; L++;
}
const mth = (lo, hi) => { if (hi - lo === 1) return level[lo]; let k = 1; while (k * 2 < hi - lo) k *= 2; return sha(Buffer.concat([Buffer.from([1]), mth(lo, lo + k), mth(lo + k, hi)])); };
const s = priv.slice("PRIVATE+KEY+".length), a = s.indexOf("+"), b = s.indexOf("+", a + 1);
const name = s.slice(0, a), hash = s.slice(a + 1, b), k = s.slice(b + 1);
const seed = Buffer.from(k, "base64").subarray(1);
const key = c.createPrivateKey({ key: Buffer.concat([Buffer.from("302e020100300506032b657004220420", "hex"), seed]), format: "der", type: "pkcs8" });
const text = `${name}\n${n}\n${mth(0, n).toString("base64")}\n`;
const sig = c.sign(null, Buffer.from(text), key);
fs.writeFileSync(path.join(out, "checkpoint"), `${text}\n— ${name} ${Buffer.concat([Buffer.from(hash, "hex"), sig]).toString("base64")}\n`);
console.log(`mini log: ${n} entries`);
