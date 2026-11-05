// SPDX-License-Identifier: Apache-2.0
// Replays plan.json on a local EVM (ganache) exactly as index.html will on the public
// test network: same chain id, same deployer, same order. Checks every deployed address,
// the poll's totals and the final state. Usage: node verify-plan.js plan.json <privateKey>
"use strict";
const fs = require("fs");
const ganache = require("../contracts/node_modules/ganache");
const { ethers } = require("../contracts/node_modules/ethers");
(async () => {
  const plan = JSON.parse(fs.readFileSync(process.argv[2], "utf8"));
  // argv[3]: a throwaway private key, or "impersonate" to replay as the plan's deployer
  // without its key (ganache unlocks the address), so a real wallet's plan can be checked.
  const pk = process.argv[3];
  const wallet = pk === "impersonate"
    ? { unlockedAccounts: [plan.deployer], defaultBalance: 1000 }
    : { accounts: [{ secretKey: pk, balance: "0x" + (10n ** 21n).toString(16) }] };
  const g = ganache.provider({ logging: { quiet: true }, chain: { chainId: Number(plan.chainId) }, miner: { blockGasLimit: 60_000_000 }, wallet });
  if (pk === "impersonate") await g.request({ method: "evm_setAccountBalance", params: [plan.deployer, "0x" + (10n ** 21n).toString(16)] });
  const provider = new ethers.BrowserProvider(g);
  const signer = await provider.getSigner(plan.deployer);
  if ((await signer.getAddress()) !== plan.deployer) throw new Error("key does not match the plan's deployer");
  // Reproduce a wallet that has already sent `startNonce` transactions.
  for (let i = 0; i < Number(plan.startNonce || 0); i++) await (await signer.sendTransaction({ to: plan.deployer, value: 0 })).wait();
  const polls = new ethers.Contract(plan.contracts.ProofOfOnePolls, plan.abi.ProofOfOnePolls, signer);
  const now = async () => (await provider.getBlock("latest")).timestamp;
  const inc = async (s) => { await provider.send("evm_increaseTime", [s]); await provider.send("evm_mine", []); };
  for (const t of plan.txs) {
    if (t.note === "waitUntilOpen") await inc(200);
    if (t.note === "waitUntilClosed") await inc(48 * 3600 + 400);
    if (t.note === "waitUntilFinal") await inc(7 * 24 * 3600 + 60);
    let rc;
    if (t.kind === "deploy") {
      rc = await (await signer.sendTransaction({ data: t.data })).wait();
      if (rc.contractAddress !== t.expectedAddress) throw new Error(`step ${t.step}: address ${rc.contractAddress} != ${t.expectedAddress}`);
    } else if (t.kind === "createPoll") {
      const ts = BigInt(await now());
      rc = await (await polls.createPoll({ ...t.params, openTime: ts, closeTime: ts + 48n * 3600n + 300n })).wait();
    } else {
      rc = await (await signer.sendTransaction({ to: t.to, data: t.data })).wait();
    }
    console.log(`step ${t.step} ok  gas ${rc.gasUsed}  ${t.name}`);
  }
  // "Show my recorded answer" (reference/app/web/check.js) for each synthetic receipt.
  if (plan.receipts) {
    const Chk = require("../app/web/check.js");
    for (const rc of plan.receipts) {
      const slot = await polls.ballots(plan.pollId, rc.nf);
      const got = Chk.recordedAnswer(ethers.keccak256, rc, slot.ballotHash);
      if (got !== rc.choice) throw new Error(`receipt of voter ${rc.voter}: ledger shows ${got}, expected ${rc.choice}`);
    }
    console.log(`receipts: ${plan.receipts.length} voters see their own recorded answer`);
  }
  const r = await polls.getResult(plan.pollId);
  const state = (await polls.getPoll(plan.pollId)).state;
  console.log("counts", r.counts.map(String).join(","), "expected", plan.expectedCounts.join(","), "state", state.toString());
  if (r.counts.map(String).join() !== plan.expectedCounts.join() || state !== 3n) throw new Error("final check failed");
  console.log("PLAN VERIFIED");
  process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
