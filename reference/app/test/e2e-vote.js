// SPDX-License-Identifier: Apache-2.0
// End-to-end check of web/vote.html: a local chain (ganache) with the plan's chain id,
// plan 1 replayed up to its ballots, plan 2 replayed (new members, poll 2), a static server
// for reference/, and a headless browser with a minimal injected wallet that votes from the
// page, re-votes, checks its recorded answer, and re-votes from a second browser that only
// knows the ballot from the ledger.
// Usage: node test/e2e-vote.js <plan.json> <plan2.json>
"use strict";
const fs = require("fs"), path = require("path"), http = require("http");
const ganache = require("../../contracts/node_modules/ganache");
const { ethers } = require("../../contracts/node_modules/ethers");
const { chromium } = require("playwright");

async function replay(provider, signer, plan, stopAtClose) {
  const polls = new ethers.Contract(plan.contracts.ProofOfOnePolls, plan.abi.ProofOfOnePolls, signer);
  for (const t of plan.txs) {
    if (stopAtClose && t.note === "waitUntilClosed") break;
    if (t.note === "waitUntilOpen") { await provider.send("evm_increaseTime", [200]); await provider.send("evm_mine", []); }
    if (t.kind === "deploy") await (await signer.sendTransaction({ data: t.data })).wait();
    else if (t.kind === "createPoll") {
      const ts = BigInt((await provider.getBlock("latest")).timestamp);
      await (await polls.createPoll({ ...t.params, openTime: ts, closeTime: ts + BigInt(t.duration || 48 * 3600 + 300) })).wait();
    } else await (await signer.sendTransaction({ to: t.to, data: t.data })).wait();
  }
}

(async () => {
  const [p1, p2] = process.argv.slice(2).map((f) => path.resolve(f));
  const plan1 = JSON.parse(fs.readFileSync(p1, "utf8")), plan2 = JSON.parse(fs.readFileSync(p2, "utf8"));
  const chain = ganache.server({ logging: { quiet: true }, chain: { chainId: Number(plan1.chainId) }, miner: { blockGasLimit: 60_000_000 },
    wallet: { unlockedAccounts: [plan1.deployer] } });
  await new Promise((ok) => chain.listen(8545, ok));
  const provider = new ethers.JsonRpcProvider("http://127.0.0.1:8545", Number(plan1.chainId), { staticNetwork: true });
  await provider.send("evm_setAccountBalance", [plan1.deployer, "0x" + (10n ** 21n).toString(16)]);
  const signer = await provider.getSigner(plan1.deployer);
  await replay(provider, signer, plan1, true);
  await replay(provider, signer, plan2, false);
  await provider.send("evm_increaseTime", [200]); await provider.send("evm_mine", []);
  console.log("chain ready: poll 2 open");

  const root = path.join(__dirname, "..", "..");
  const map = { "/plan2.json": p2 };
  const srv = http.createServer((q, s) => {
    const u = q.url.split("?")[0];
    const rel = u.replace(/^\/reference\//, "");
    const f = map[u] || [path.join(root, rel), process.env.EXTRA_ROOT && path.join(process.env.EXTRA_ROOT, rel)].find((x) => x && fs.existsSync(x)) || "";
    if (!fs.existsSync(f) || fs.statSync(f).isDirectory()) { s.writeHead(404); return s.end(); }
    s.writeHead(200, { "content-type": f.endsWith(".js") ? "text/javascript" : f.endsWith(".json") ? "application/json" : f.endsWith(".wasm") ? "application/wasm" : f.endsWith(".html") ? "text/html" : "application/octet-stream" });
    fs.createReadStream(f).pipe(s);
  });
  await new Promise((ok) => srv.listen(8080, ok));

  // A minimal injected wallet: forwards requests to the local chain, as the deployer.
  const wallet = `window.ethereum = { request: async ({ method, params }) => {
      if (method === "eth_requestAccounts") method = "eth_accounts";
      if (method === "wallet_switchEthereumChain" || method === "wallet_addEthereumChain") return null;
      const r = await fetch("http://127.0.0.1:8545", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params: params || [] }) });
      const j = await r.json(); if (j.error) throw Object.assign(new Error(j.error.message), j.error); return j.result; } };`;
  const browser = await chromium.launch();
  const url = "http://127.0.0.1:8080/reference/app/web/vote.html?plan=/plan2.json&rpc=http://127.0.0.1:8545";
  const done = (id) => (page) => page.waitForFunction((i) => { const t = document.getElementById(i).textContent; return t && !/Downloading|Encrypting|Approve|Sent \(|Checking|Reading/.test(t); }, id, { timeout: 180000 });

  async function voteOnce(page, member, option, label) {
    await page.selectOption("#kit", String(member));
    await page.check(`input[name="opt"][value="${option}"]`);
    await page.evaluate(() => ["made", "sent", "out"].forEach((i) => (document.getElementById(i).textContent = ""))); await page.click("#make"); await done("made")(page);
    const made = await page.textContent("#made");
    if (!made.includes("Ballot ready")) throw new Error(label + ": " + made);
    console.log(`${label}: ${made.match(/in [\d.]+ s/)[0]}`);
    await page.click("#send"); await done("sent")(page);
    const sent = await page.textContent("#sent");
    if (!sent.includes("Ballot recorded")) throw new Error(label + " send: " + sent);
    await done("out")(page);
    const out = await page.textContent("#out");
    if (!out.includes(`Recorded answer: option ${option + 1}`)) throw new Error(label + " check: " + out);
    console.log(`${label}: ${out.split("Ballots")[0].trim()}`);
  }

  const ctx1 = await browser.newContext(); await ctx1.addInitScript(wallet);
  const page = await ctx1.newPage();
  page.on("pageerror", (e) => console.log("pageerror", e.message));
  await page.goto(url);
  await page.waitForFunction(() => document.getElementById("poll").textContent.includes("Distinct voters"));
  await voteOnce(page, 0, 2, "member 5, first ballot (option 3)");
  await voteOnce(page, 0, 0, "member 5, re-vote from the same browser (option 1)");
  await voteOnce(page, 1, 3, "member 6, first ballot (option 4)");

  const ctx2 = await browser.newContext(); await ctx2.addInitScript(wallet);
  const page2 = await ctx2.newPage(); await page2.goto(url);
  await page2.waitForFunction(() => document.getElementById("poll").textContent.includes("Distinct voters"));
  await voteOnce(page2, 0, 1, "member 5, re-vote from another browser (option 2)");
  // The first browser now sees that the latest ballot is not its own.
  await page.selectOption("#kit", "0"); await page.evaluate(() => (document.getElementById("out").textContent = "")); await page.click("#check"); await done("out")(page);
  if (!(await page.textContent("#out")).includes("Not your ballot")) throw new Error("first browser should see a newer ballot");
  console.log("first browser: sees that a newer ballot replaced its own");

  // The running encrypted totals must equal the sum of the latest ballots (option 2 and option 4).
  const polls = new ethers.Contract(plan2.contracts.ProofOfOnePolls, plan2.abi.ProofOfOnePolls, provider);
  console.log("distinct voters in poll 2:", String(await polls.distinctVoters(plan2.pollId)));
  if (String(await polls.distinctVoters(plan2.pollId)) !== "2") throw new Error("expected 2 distinct voters");
  // Optional (needs the PRIVATE synthetic trustee shares): publish and finalize poll 2 as the
  // founder would, with publish.js, and check the totals: member 5 → option 2, member 6 → option 4.
  if (process.env.SECRETS) {
    const { makePublish } = require("../../testnet/publish.js");
    await provider.send("evm_increaseTime", [7 * 24 * 3600 + 400]); await provider.send("evm_mine", []);
    const state = { aggregate: (await polls.aggregate(plan2.pollId)).map((q) => q.map(String)), ballotChain: await polls.ballotChain(plan2.pollId), distinctVoters: String(await polls.distinctVoters(plan2.pollId)) };
    const pub = await makePublish(plan2, JSON.parse(fs.readFileSync(process.env.SECRETS, "utf8")), state);
    await (await signer.sendTransaction({ to: pub.txs[0].to, data: pub.txs[0].data })).wait();
    const r = await polls.getResult(plan2.pollId);
    console.log("poll 2 published totals:", r.counts.map(String).join(" · "));
    if (r.counts.map(String).join() !== "0,1,0,1") throw new Error("expected totals 0 · 1 · 0 · 1");
    await provider.send("evm_increaseTime", [7 * 24 * 3600 + 60]); await provider.send("evm_mine", []);
    await (await signer.sendTransaction({ to: pub.txs[1].to, data: pub.txs[1].data })).wait();
    console.log("poll 2 state:", String((await polls.getPoll(plan2.pollId)).state), "(3 = Final)");
  }
  await browser.close(); srv.close(); await chain.close();
  console.log("E2E VOTE OK");
  process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
