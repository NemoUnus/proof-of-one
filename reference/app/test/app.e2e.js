// SPDX-License-Identifier: Apache-2.0
// End-to-end check of web/app.html (the app prototype): a local chain with deployment 1, poll 2
// and deployment 2 with poll 3 replayed; two people added on one "phone" (simulated scan, PIN);
// a wrong PIN refused; the right PIN shows the person's open polls; an answer to poll 3 sent with
// an injected test wallet and counted; after the close, the result published with the tally
// proof and shown in the app.
// Usage: node test/app.e2e.js <plan.json> <plan2.json> <plan3.json> <poll3-secrets.json>
"use strict";
const fs = require("fs"), path = require("path"), http = require("http");
const ganache = require("../../contracts/node_modules/ganache");
const { ethers } = require("../../contracts/node_modules/ethers");
const { chromium } = require("playwright");
const { makePublish } = require("../../testnet/publish.js");

(async () => {
  const [p1, p2, p3, sec] = process.argv.slice(2).map((f) => path.resolve(f));
  const [plan1, plan2, plan3] = [p1, p2, p3].map((f) => JSON.parse(fs.readFileSync(f, "utf8")));
  const chain = ganache.server({ logging: { quiet: true }, chain: { chainId: 84532 }, miner: { blockGasLimit: 60_000_000 }, wallet: { unlockedAccounts: [plan1.deployer] } });
  await new Promise((ok) => chain.listen(8546, ok));
  const provider = new ethers.JsonRpcProvider("http://127.0.0.1:8546", 84532, { staticNetwork: true });
  await provider.send("evm_setAccountBalance", [plan1.deployer, "0x" + (10n ** 21n).toString(16)]);
  const signer = await provider.getSigner(plan1.deployer);
  const inc = async (s) => { await provider.send("evm_increaseTime", [s]); await provider.send("evm_mine", []); };
  async function run(plan, stopAtClose, skipWait) {
    const polls = new ethers.Contract(plan.contracts.ProofOfOnePolls, plan.abi.ProofOfOnePolls, signer);
    for (const t of plan.txs) {
      if (stopAtClose && t.note === "waitUntilClosed") break;
      if (skipWait && t.waitForBallot) continue;
      if (t.note === "waitUntilOpen") await inc(200);
      if (t.kind === "deploy") await (await signer.sendTransaction({ data: t.data })).wait();
      else if (t.kind === "createPoll") { const ts = BigInt((await provider.getBlock("latest")).timestamp) + 60n; await (await polls.createPoll({ ...t.params, openTime: ts, closeTime: ts + BigInt(t.duration || 48 * 3600 + 300) })).wait(); }
      else await (await signer.sendTransaction({ to: t.to, data: t.data })).wait();
    }
  }
  await run(plan1, true); await run(plan2, false);
  if ((await provider.getTransactionCount(plan1.deployer)) > plan3.startNonce) throw new Error("plan3 was made for nonce " + plan3.startNonce);
  while ((await provider.getTransactionCount(plan1.deployer)) < plan3.startNonce) await (await signer.sendTransaction({ to: plan1.deployer, value: 0 })).wait();
  await run(plan3, false, true); await inc(200);
  console.log("chain ready: polls 2 and 3 open");

  const root = path.join(__dirname, "..", "..");
  const extra = process.env.EXTRA_ROOT;
  const srv = http.createServer((q, s) => {
    const rel = q.url.split("?")[0].replace(/^\/reference\//, "");
    const f = [rel === "testnet/web/plan3.json" ? p3 : null, path.join(root, rel), extra && path.join(extra, rel)].find((x) => x && fs.existsSync(x) && fs.statSync(x).isFile());
    if (!f) { s.writeHead(404); return s.end(); }
    s.writeHead(200, { "content-type": f.endsWith(".js") ? "text/javascript" : f.endsWith(".json") ? "application/json" : f.endsWith(".wasm") ? "application/wasm" : f.endsWith(".html") ? "text/html" : "application/octet-stream" });
    fs.createReadStream(f).pipe(s);
  });
  await new Promise((ok) => srv.listen(8092, ok));
  const wallet = `window.ethereum = { request: async ({ method, params }) => {
      if (method === "eth_requestAccounts") method = "eth_accounts";
      if (method === "wallet_switchEthereumChain") return null;
      const r = await fetch("http://127.0.0.1:8546", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params: params || [] }) });
      const j = await r.json(); if (j.error) throw Object.assign(new Error(j.error.message), j.error); return j.result; } };`;
  const browser = await chromium.launch(); const ctx = await browser.newContext(); await ctx.addInitScript(wallet);
  const page = await ctx.newPage(); page.on("pageerror", (e) => console.log("pageerror", e.message));
  await page.goto("http://127.0.0.1:8092/reference/app/web/app.html?rpc=http://127.0.0.1:8546&explorer=http://explorer.test/api");
  // A stand-in for the explorer's log API, in its format (topics padded with null), served from
  // the local chain; switched on below.
  let explorerOn = false, nodesFail = false;
  await page.route("http://explorer.test/**", async (route) => {
    if (!explorerOn) return route.abort();
    const u = new URL(route.request().url()), g = (k) => u.searchParams.get(k);
    const logs = await provider.getLogs({ address: g("address"), topics: [g("topic0"), g("topic1"), g("topic2")], fromBlock: Number(g("fromBlock")), toBlock: "latest" });
    route.fulfill({ status: 200, headers: { "access-control-allow-origin": "*", "content-type": "application/json" },
      body: JSON.stringify({ message: "OK", result: logs.map((l) => ({ address: l.address.toLowerCase(), blockNumber: "0x" + l.blockNumber.toString(16), data: l.data, topics: [...l.topics, null] })) }) });
  });
  await page.route("http://127.0.0.1:8546/**", (route) => (nodesFail && /eth_getLogs/.test(route.request().postData() || "") ? route.fulfill({ status: 400, body: "" }) : route.continue()));
  await page.waitForSelector("#add");
  async function addPerson(m, name, pin) {
    await page.click("#add"); await page.click(`.doc[data-m="${m}"]`);
    await page.waitForSelector("#sv", { timeout: 20000 });
    await page.fill("#nm", name); await page.fill("#p1", pin); await page.fill("#p2", pin); await page.click("#sv");
    await page.waitForSelector("#add", { timeout: 30000 });
  }
  await addPerson(5, "Mother", "111111"); await addPerson(6, "Father", "222222");
  await page.waitForFunction(() => document.getElementById("b0") && /open poll/.test(document.getElementById("b0").textContent), null, { timeout: 30000 });
  console.log("home:", (await page.textContent("#view")).replace(/\s+/g, " ").slice(0, 200));
  await page.fill("#pin1", "000000"); await page.click('[data-open="1"]'); await page.waitForFunction(() => document.getElementById("m1").textContent.includes("Wrong PIN"), null, { timeout: 20000 });
  console.log("wrong PIN refused");
  await page.fill("#pin1", "222222"); await page.click('[data-open="1"]');
  await page.waitForFunction(() => document.querySelectorAll("[data-vote]").length > 0, null, { timeout: 30000 });
  console.log("Father's polls:", (await page.textContent("#pl")).replace(/\s+/g, " ").slice(0, 240));
  await page.click('[data-vote="1"]'); await page.check('input[name="o"][value="1"]'); await page.click("#mk");
  await page.waitForFunction(() => /Ready|could not|did not/.test(document.getElementById("made").textContent), null, { timeout: 180000 });
  console.log("made:", (await page.textContent("#made")).trim().slice(0, 60));
  await page.click("#ws");
  await page.waitForFunction(() => /Counted|refused|failed|No wallet|wrong/i.test(document.getElementById("sent").textContent), null, { timeout: 120000 });
  const sent = (await page.textContent("#sent")).replace(/\s+/g, " ");
  console.log("sent:", sent.slice(0, 120));
  if (!sent.includes("Counted: option 2")) throw new Error("answer not counted");
  // change the answer: the replaced ballot comes from the receipt locked with Father's PIN
  await page.click("#bk"); await page.waitForFunction(() => document.querySelectorAll("[data-vote]").length > 0, null, { timeout: 30000 });
  await page.click('[data-vote="1"]'); await page.check('input[name="o"][value="2"]'); await page.click("#mk");
  await page.waitForFunction(() => /Ready|could not|did not/.test(document.getElementById("made").textContent), null, { timeout: 180000 });
  await page.click("#ws");
  await page.waitForFunction(() => /Counted|refused|failed|not found|did not answer/i.test(document.getElementById("sent").textContent), null, { timeout: 120000 });
  const sent2 = (await page.textContent("#sent")).replace(/\s+/g, " ");
  console.log("changed answer:", sent2.slice(0, 60));
  if (!sent2.includes("Counted: option 3")) throw new Error("changed answer not counted");
  // change it again with the receipts deleted: the replaced ballot is read from the public record
  // (the explorer is unreachable here, so this exercises the node path; then the explorer path)
  await page.evaluate(() => Object.keys(localStorage).filter((k) => k.startsWith("poo-app-r-")).forEach((k) => localStorage.removeItem(k)));
  await page.click("#bk"); await page.waitForFunction(() => document.querySelectorAll("[data-vote]").length > 0, null, { timeout: 30000 });
  await page.click('[data-vote="1"]'); await page.check('input[name="o"][value="3"]'); await page.click("#mk");
  await page.waitForFunction(() => /Ready|could not|did not/.test(document.getElementById("made").textContent), null, { timeout: 180000 });
  await page.click("#ws");
  await page.waitForFunction(() => /Counted|refused|failed|could not be read|did not answer/i.test(document.getElementById("sent").textContent), null, { timeout: 180000 });
  const sent3 = (await page.textContent("#sent")).replace(/\s+/g, " ");
  console.log("changed again from the record:", sent3.slice(0, 60));
  if (!sent3.includes("Counted: option 4")) throw new Error("second change not counted: " + sent3.slice(0, 200));
  // once more, with the nodes refusing log queries: the explorer's log index must be enough
  explorerOn = true; nodesFail = true;
  await page.evaluate(() => Object.keys(localStorage).filter((k) => k.startsWith("poo-app-r-")).forEach((k) => localStorage.removeItem(k)));
  await page.click("#bk"); await page.waitForFunction(() => document.querySelectorAll("[data-vote]").length > 0, null, { timeout: 30000 });
  await page.click('[data-vote="1"]'); await page.check('input[name="o"][value="2"]'); await page.click("#mk");
  await page.waitForFunction(() => /Ready|could not|did not/.test(document.getElementById("made").textContent), null, { timeout: 180000 });
  await page.click("#ws");
  await page.waitForFunction(() => /Counted|refused|failed|could not be read|did not answer/i.test(document.getElementById("sent").textContent), null, { timeout: 180000 });
  const sent4 = (await page.textContent("#sent")).replace(/\s+/g, " ");
  console.log("changed again from the explorer:", sent4.slice(0, 60));
  if (!sent4.includes("Counted: option 3")) throw new Error("explorer path failed: " + sent4.slice(0, 300));
  // and with both refusing, the message must say what each source answered
  explorerOn = false;
  await page.evaluate(() => Object.keys(localStorage).filter((k) => k.startsWith("poo-app-r-")).forEach((k) => localStorage.removeItem(k)));
  await page.click("#bk"); await page.waitForFunction(() => document.querySelectorAll("[data-vote]").length > 0, null, { timeout: 30000 });
  await page.click('[data-vote="1"]'); await page.check('input[name="o"][value="1"]'); await page.click("#mk");
  await page.waitForFunction(() => /Ready|could not|did not/.test(document.getElementById("made").textContent), null, { timeout: 180000 });
  await page.click("#ws");
  await page.waitForFunction(() => /Counted|refused|failed|could not be read|did not answer/i.test(document.getElementById("sent").textContent), null, { timeout: 300000 });
  const sent5 = (await page.textContent("#sent")).replace(/\s+/g, " ");
  console.log("both refusing:", sent5.slice(0, 260));
  if (!/explorer: .*127\.0\.0\.1: 0 answers/.test(sent5)) throw new Error("no details in the message");
  nodesFail = false;

  // close poll 3 and publish its result with the tally proof, then see it in the app
  await inc(7 * 24 * 3600 + 400);
  const polls3 = new ethers.Contract(plan3.contracts.ProofOfOnePolls, plan3.abi.ProofOfOnePolls, provider);
  const state = { aggregate: (await polls3.aggregate(plan3.pollId)).map((q) => q.map(String)), ballotChain: await polls3.ballotChain(plan3.pollId), distinctVoters: String(await polls3.distinctVoters(plan3.pollId)) };
  const pub = await makePublish(plan3, JSON.parse(fs.readFileSync(sec, "utf8")), state);
  await (await signer.sendTransaction({ to: pub.txs[0].to, data: pub.txs[0].data })).wait();
  await page.click("#bk");   // back to Father's polls, which reads the ledger again
  await page.waitForFunction(() => document.querySelectorAll("[data-res]").length > 0, null, { timeout: 30000 });
  await page.click('[data-res="1"]'); await page.waitForFunction(() => document.getElementById("view").textContent.includes("participants"), null, { timeout: 20000 });
  const res = (await page.textContent("#view")).replace(/\s+/g, " ");
  console.log("result:", res.slice(0, 200));
  if (!res.includes("1 participants") || !res.includes("Final")) throw new Error("result not shown");
  await browser.close(); srv.close(); await chain.close();
  console.log("APP E2E OK"); process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
