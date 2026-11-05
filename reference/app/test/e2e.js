// SPDX-License-Identifier: Apache-2.0
// End-to-end check of web/index.html: a local chain (ganache) with the plan's chain id,
// the plan replayed up to the ballots, a static server for reference/, and a headless
// browser that presses "Show my recorded answer" for each synthetic voter.
// Usage: node test/e2e.js <plan.json>
"use strict";
const fs = require("fs"), path = require("path"), http = require("http");
const ganache = require("../../contracts/node_modules/ganache");
const { ethers } = require("../../contracts/node_modules/ethers");
const { chromium } = require("playwright");

(async () => {
  const planPath = path.resolve(process.argv[2]);
  const plan = JSON.parse(fs.readFileSync(planPath, "utf8"));
  const chain = ganache.server({ logging: { quiet: true }, chain: { chainId: Number(plan.chainId) }, miner: { blockGasLimit: 60_000_000 },
    wallet: { unlockedAccounts: [plan.deployer] } });
  await new Promise((ok) => chain.listen(8545, ok));
  const provider = new ethers.JsonRpcProvider("http://127.0.0.1:8545", Number(plan.chainId), { staticNetwork: true });
  await provider.send("evm_setAccountBalance", [plan.deployer, "0x" + (10n ** 21n).toString(16)]);
  const signer = await provider.getSigner(plan.deployer);
  for (let i = 0; i < Number(plan.startNonce || 0); i++) await (await signer.sendTransaction({ to: plan.deployer, value: 0 })).wait();
  const polls = new ethers.Contract(plan.contracts.ProofOfOnePolls, plan.abi.ProofOfOnePolls, signer);
  for (const t of plan.txs) {
    if (t.note === "waitUntilClosed") break;               // ballots are enough for this check
    if (t.note === "waitUntilOpen") { await provider.send("evm_increaseTime", [200]); await provider.send("evm_mine", []); }
    if (t.kind === "deploy") await (await signer.sendTransaction({ data: t.data })).wait();
    else if (t.kind === "createPoll") {
      const ts = BigInt((await provider.getBlock("latest")).timestamp);
      await (await polls.createPoll({ ...t.params, openTime: ts, closeTime: ts + 48n * 3600n + 300n })).wait();
    } else await (await signer.sendTransaction({ to: t.to, data: t.data })).wait();
  }

  // Serve reference/ as GitHub Pages would: reference/app/web and reference/testnet/web.
  const root = path.join(__dirname, "..", "..");            // code/ (app/, testnet/)
  const files = { "/app/web/index.html": "app/web/index.html", "/app/web/check.js": "app/web/check.js",
    "/testnet/web/ethers.umd.min.js": "testnet/web/ethers.umd.min.js", "/plan.json": planPath };
  const srv = http.createServer((q, s) => {
    const f = files[q.url.split("?")[0]];
    if (!f) { s.writeHead(404); return s.end(); }
    s.writeHead(200, { "content-type": f.endsWith(".js") ? "text/javascript" : f.endsWith(".json") ? "application/json" : "text/html" });
    s.end(fs.readFileSync(path.isAbsolute(f) ? f : path.join(root, f)));
  });
  await new Promise((ok) => srv.listen(8080, ok));

  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.goto("http://127.0.0.1:8080/app/web/index.html?plan=/plan.json&rpc=http://127.0.0.1:8545");
  await page.waitForFunction(() => document.getElementById("poll").textContent.includes("Distinct voters"));
  console.log("poll:", (await page.textContent("#poll")).trim());
  for (let i = 0; i < plan.receipts.length; i++) {
    await page.selectOption("#who", String(i));
    await page.click("#go");
    await page.waitForFunction(() => !document.getElementById("out").textContent.startsWith("Checking"));
    const txt = (await page.textContent("#out")).trim();
    const want = `Recorded answer: option ${plan.receipts[i].choice + 1}`;
    console.log(`voter ${plan.receipts[i].voter}: ${txt.split("Ballots")[0]}`);
    if (!txt.includes(want)) throw new Error(`voter ${plan.receipts[i].voter}: expected "${want}"`);
  }
  // A tampered receipt must not show an answer.
  const bad = { ...plan.receipts[0], r: [...plan.receipts[0].r].reverse() };
  await page.fill("#paste", JSON.stringify(bad));
  await page.click("#go");
  await page.waitForFunction(() => !document.getElementById("out").textContent.startsWith("Checking"));
  if (!(await page.textContent("#out")).includes("Not your ballot")) throw new Error("tampered receipt was accepted");
  console.log("tampered receipt: rejected");
  await page.screenshot({ path: process.env.SHOT || "/dev/null", fullPage: true });
  await browser.close(); srv.close(); await chain.close();
  console.log("E2E OK");
  process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
