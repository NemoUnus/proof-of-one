// SPDX-License-Identifier: Apache-2.0
// Replays deployment 1 (plan.json up to the close of poll 1) and poll 2 (plan2.json) on a local
// chain, makes plan3.json for the resulting nonce, sends every step of it as the testnet page
// would, votes with the published kits of members 5–8, revokes member 8 and checks that its
// ballot is refused after the grace, then publishes poll 3 with the tally proof.
// Usage: node test/plan3.e2e.js web/plan.json web/plan2.json
"use strict";
const fs = require("fs"), path = require("path"), cp = require("child_process");
const ganache = require("../../contracts/node_modules/ganache");
const { ethers } = require("../../contracts/node_modules/ethers");
const snarkjs = require("../../ballot-circuit/node_modules/snarkjs");
const Chk = require("../../app/web/check.js");
const { makePublish } = require("../publish.js");
const WASM = path.join(__dirname, "..", "..", "ballot-circuit", "build", "ballot_js", "ballot.wasm");
const ZKEY = path.join(__dirname, "..", "..", "ballot-circuit", "setup", "ballot_test.zkey");

(async () => {
  const [plan1, plan2] = process.argv.slice(2).map((f) => JSON.parse(fs.readFileSync(f, "utf8")));
  const g = ganache.provider({ logging: { quiet: true }, chain: { chainId: Number(plan1.chainId) }, miner: { blockGasLimit: 60_000_000 }, wallet: { totalAccounts: 0, unlockedAccounts: [plan1.deployer] } });
  const provider = new ethers.BrowserProvider(g);
  await g.request({ method: "evm_setAccountBalance", params: [plan1.deployer, "0x" + (10n ** 21n).toString(16)] });
  const signer = await provider.getSigner(plan1.deployer);
  const now = async () => BigInt((await provider.getBlock("latest")).timestamp);
  const inc = async (s) => { await provider.send("evm_increaseTime", [s]); await provider.send("evm_mine", []); };
  async function run(plan, stopAtClose) {
    const polls = new ethers.Contract(plan.contracts.ProofOfOnePolls, plan.abi.ProofOfOnePolls, signer);
    for (const t of plan.txs) {
      if (stopAtClose && t.note === "waitUntilClosed") break;
      if (t.note === "waitUntilOpen") await inc(200);
      let rc;
      if (t.kind === "deploy") { rc = await (await signer.sendTransaction({ data: t.data })).wait(); if (t.expectedAddress && rc.contractAddress.toLowerCase() !== t.expectedAddress.toLowerCase()) throw new Error("address mismatch at " + t.name); }
      else if (t.kind === "createPoll") { const ts = (await now()) + 120n; rc = await (await polls.createPoll({ ...t.params, openTime: ts, closeTime: ts + BigInt(t.duration || 48 * 3600 + 300) })).wait(); }
      else if (!t.waitForBallot) rc = await (await signer.sendTransaction({ to: t.to, data: t.data })).wait();
      if (rc) console.log(`  ${t.step}. ${t.name}: gas ${rc.gasUsed}`);
    }
  }
  console.log("replay deployment 1 and poll 2"); await run(plan1, true); await run(plan2, false);
  const nonce = await provider.getTransactionCount(plan1.deployer);
  console.log("deployer nonce now", nonce);
  const out = cp.execFileSync("node", [path.join(__dirname, "..", "plan3.js"), process.argv[2], process.argv[3], String(nonce)], { maxBuffer: 1 << 28 });
  const plan3 = JSON.parse(out);
  fs.writeFileSync(path.join(__dirname, "plan3-local.json"), out);
  console.log("plan 3:", plan3.txs.length, "steps"); await run(plan3, false);
  await inc(200);
  const polls = new ethers.Contract(plan3.contracts.ProofOfOnePolls, plan3.abi.ProofOfOnePolls, signer);
  async function vote(kitIdx, option, prev) {
    const kit = plan3.kits[kitIdx];
    const enc = Chk.encrypt(kit.PK, kit.k, option);
    const v = ["0", "0", "0", "0"]; v[option] = "1";
    const input = { ...kit.input, CA: enc.CA.map((p) => p.map(String)), CB: enc.CB.map((p) => p.map(String)), v, r: enc.r.map(String) };
    const { proof } = await snarkjs.groth16.fullProve(input, WASM, ZKEY);
    const args = [plan3.pollId, kit.nf, enc.ct.map(String), prev || Array(16).fill("0"), [proof.pi_a[0], proof.pi_a[1]], [[proof.pi_b[0][1], proof.pi_b[0][0]], [proof.pi_b[1][1], proof.pi_b[1][0]]], [proof.pi_c[0], proof.pi_c[1]]];
    return { args, ct: enc.ct.map(String) };
  }
  const choices = [0, 1, 1, 3];  // members 5, 6, 7, 8
  const sent = [];
  for (let i = 0; i < 4; i++) { const b = await vote(i, choices[i]); const rc = await (await polls.vote(...b.args)).wait(); sent.push(b); console.log(`  member ${i + 5} votes option ${choices[i] + 1}: gas ${rc.gasUsed}`); }
  // step 5: revoke member 8 now that it has voted
  const rv = plan3.txs.find((t) => t.waitForBallot);
  if (BigInt((await polls.ballots(plan3.pollId, rv.waitForBallot)).ballotHash) === 0n) throw new Error("member 8 should have voted");
  const rrc = await (await signer.sendTransaction({ to: rv.to, data: rv.data })).wait();
  console.log(`  ${rv.step}. ${rv.name}: gas ${rrc.gasUsed}`);
  // within the grace, member 8's re-vote proven against the old root is still accepted
  const r1 = await vote(3, 2, sent[3].ct);
  await (await polls.vote(...r1.args)).wait(); console.log("  member 8 re-vote within the grace: accepted (option 3)");
  await inc(11 * 60);
  const r2 = await vote(3, 0, r1.ct);
  try { await polls.vote.staticCall(...r2.args); throw new Error("member 8 should be refused after the grace"); }
  catch (e) { if (!/InvalidProof|0x09bde339|revert/i.test(e.message)) throw e; console.log("  member 8 re-vote after the grace: refused (InvalidProof)"); }
  // close and publish with the tally proof
  await inc(7 * 24 * 3600 + 400);
  const state = { aggregate: (await polls.aggregate(plan3.pollId)).map((q) => q.map(String)), ballotChain: await polls.ballotChain(plan3.pollId), distinctVoters: String(await polls.distinctVoters(plan3.pollId)) };
  const secrets = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "..", "..", "private", "poll3-secrets.json"), "utf8"));
  const pub = await makePublish(plan3, secrets, state);
  const prc = await (await signer.sendTransaction({ to: pub.txs[0].to, data: pub.txs[0].data })).wait();
  const res = await polls.getResult(plan3.pollId);
  console.log(`  publish with the tally proof: gas ${prc.gasUsed}; totals ${res.counts.map(String).join(" · ")}; state ${(await polls.getPoll(plan3.pollId)).state} (3 = Final)`);
  if (res.counts.map(String).join() !== "1,2,1,0") throw new Error("expected 1,2,1,0");
  console.log("PLAN 3 E2E OK");
  process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
