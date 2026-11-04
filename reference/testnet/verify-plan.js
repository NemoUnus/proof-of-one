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
  const pk = process.argv[3];
  const provider = new ethers.BrowserProvider(ganache.provider({ logging: { quiet: true }, chain: { chainId: Number(plan.chainId) }, miner: { blockGasLimit: 60_000_000 },
    wallet: { accounts: [{ secretKey: pk, balance: "0x" + (10n ** 21n).toString(16) }] } }));
  const signer = await provider.getSigner(0);
  if ((await signer.getAddress()) !== plan.deployer) throw new Error("key does not match the plan's deployer");
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
  const r = await polls.getResult(plan.pollId);
  const state = (await polls.getPoll(plan.pollId)).state;
  console.log("counts", r.counts.map(String).join(","), "expected", plan.expectedCounts.join(","), "state", state.toString());
  if (r.counts.map(String).join() !== plan.expectedCounts.join() || state !== 3n) throw new Error("final check failed");
  console.log("PLAN VERIFIED");
  process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
