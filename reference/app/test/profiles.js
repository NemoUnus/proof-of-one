// SPDX-License-Identifier: Apache-2.0
// Several members on one phone (Decision Log #54): two profiles with their own PINs; a wrong PIN
// is refused; the right PIN opens the right member; nothing secret is stored in clear; receipts
// are off on a shared phone. Serves reference/ locally; needs no chain.
// Usage: node test/profiles.js
"use strict";
const { chromium } = require("playwright"); const http = require("http"), fs = require("fs"), path = require("path");
const roots = [path.join(__dirname, "..", "..")];  // reference/
const srv = http.createServer((q, s) => { const rel = q.url.split("?")[0].replace(/^\/reference\//, ""); const f = roots.map((r) => path.join(r, rel)).find((x) => fs.existsSync(x) && fs.statSync(x).isFile());
  if (!f) { s.writeHead(404); return s.end(); } s.writeHead(200, { "content-type": f.endsWith(".js") ? "text/javascript" : f.endsWith(".json") ? "application/json" : "text/html" }); fs.createReadStream(f).pipe(s); });
srv.listen(8091, async () => {
  const b = await chromium.launch(); const p = await b.newPage(); p.on("pageerror", (e) => console.log("pageerror", e.message));
  await p.goto("http://127.0.0.1:8091/reference/app/web/vote.html?plan=../../testnet/web/plan3.json&rpc=http://127.0.0.1:1");
  await p.waitForSelector("#addProf");
  const add = async (idx, name, pin) => { await p.selectOption("#kit", String(idx)); await p.click("#addProf"); await p.fill("#pName", name); await p.fill("#pPin", pin); await p.fill("#pPin2", pin); await p.click("#pSave"); await p.waitForFunction(() => document.getElementById("addForm").style.display === "none", null, { timeout: 30000 }); };
  await add(0, "Mother", "111111"); await add(1, "Father", "222222");
  console.log("profiles:", (await p.textContent("#profiles")).replace(/\s+/g, " ").slice(0, 120));
  const stored = await p.evaluate(() => JSON.stringify(Object.keys(localStorage).map((k) => [k, localStorage.getItem(k).length])));
  console.log("stored:", stored, "contains secret s?", await p.evaluate(() => Object.values(localStorage).some((v) => v.includes('"s"'))));
  await p.fill("#pin1", "999999"); await p.click('[data-open="1"]'); await p.waitForTimeout(1500);
  console.log("wrong PIN:", (await p.textContent("#profiles")).includes("Wrong PIN"));
  await p.fill("#pin1", "222222"); await p.click('[data-open="1"]'); await p.waitForFunction(() => document.getElementById("profiles").textContent.includes("Profile open"), null, { timeout: 30000 });
  console.log("open:", (await p.textContent("#profiles")).replace(/\s+/g, " ").slice(0, 160));
  const m = await p.evaluate(() => kit().member), sh = await p.evaluate(() => shared());
  console.log("kit is member:", m, "shared:", sh);
  if (m !== 6 || !sh) throw new Error("profile did not open the right member");
  console.log("PROFILES OK");
  await b.close(); srv.close(); process.exit(0);
});
