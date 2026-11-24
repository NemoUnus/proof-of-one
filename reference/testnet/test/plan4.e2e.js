// SPDX-License-Identifier: Apache-2.0
// Replays deployments 1 and 2 (plan.json, plan2.json, a local plan 3 with member 8 revoked) on
// a local chain, makes plan4.json for the resulting nonce and plays the stolen-phone story of
// poll 4: members 5–7 vote, someone holding member 7's phone among them; member 7 re-enrols with
// a linked handle and the old identity is revoked; member 7 sends a recovery ballot, which
// replaces the thief's; the thief can no longer answer; the result, published with the tally
// proof, counts member 7's own answer.
// Usage: node test/plan4.e2e.js web/plan.json web/plan2.json   (writes nothing to private/)
"use strict";
const fs = require("fs"), path = require("path"), cp = require("child_process");
const ganache = require("../../contracts/node_modules/ganache");
const { ethers } = require("../../contracts/node_modules/ethers");
const snarkjs = require("../../ballot-circuit/node_modules/snarkjs");
const Chk = require("../../app/web/check.js");
const { makePublish } = require("../publish.js");
const WASM = path.join(__dirname, "..", "..", "ballot-circuit", "build", "ballot_js", "ballot.wasm");
const ZKEY = path.join(__dirname, "..", "..", "ballot-circuit", "setup", "ballot_test.zkey");
const RWASM = path.join(__dirname, "..", "..", "ballot-circuit", "build", "recovery_js", "recovery.wasm");
const RZKEY = require("../../ballot-circuit/src/zkey").zkey("recovery_test.zkey");
const os = require("os");
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), "plan4-"));
process.env.POLL3_SECRETS = path.join(TMP, "poll3.json"); process.env.POLL4_SECRETS = path.join(TMP, "poll4.json");

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
  const rv3 = plan3.txs.find((t) => t.waitForBallot);
  await (await signer.sendTransaction({ to: rv3.to, data: rv3.data })).wait();
  console.log("  (poll 3: member 8 revoked without voting, as a shortcut)");

  // ---------------------------------------------------------------- deployment 3, poll 4
  const nonce4 = await provider.getTransactionCount(plan1.deployer);
  const out4 = cp.execFileSync("node", [path.join(__dirname, "..", "plan4.js"), process.argv[2], process.argv[3], path.join(__dirname, "plan3-local.json"), String(nonce4)], { maxBuffer: 1 << 28 });
  const plan4 = JSON.parse(out4);
  fs.writeFileSync(path.join(__dirname, "plan4-local.json"), out4);
  console.log("plan 4:", plan4.txs.length, "steps"); await run(plan4, false);
  await inc(200);
  const polls = new ethers.Contract(plan4.contracts.ProofOfOnePolls, plan4.abi.ProofOfOnePolls, signer);
  const pa = (proof) => [[proof.pi_a[0], proof.pi_a[1]], [[proof.pi_b[0][1], proof.pi_b[0][0]], [proof.pi_b[1][1], proof.pi_b[1][0]]], [proof.pi_c[0], proof.pi_c[1]]];
  async function vote(kit, option, prev) {
    const enc = Chk.encrypt(kit.PK, kit.k, option);
    const v = ["0", "0", "0", "0"]; v[option] = "1";
    const input = { ...kit.input, CA: enc.CA.map((p) => p.map(String)), CB: enc.CB.map((p) => p.map(String)), v, r: enc.r.map(String) };
    const { proof } = await snarkjs.groth16.fullProve(input, WASM, ZKEY);
    return { args: [plan4.pollId, kit.nf, enc.ct.map(String), prev || Array(16).fill("0"), ...pa(proof)], ct: enc.ct.map(String) };
  }
  const sent = [];
  for (const [i, c] of [[0, 0], [1, 1], [2, 3]]) {
    const b = await vote(plan4.kits[i], c); await (await polls.vote(...b.args)).wait(); sent.push(b);
    console.log(`  member ${i + 5} votes option ${c + 1}` + (i === 2 ? " (the thief, with member 7's phone)" : ""));
  }
  // within the grace, the thief could still answer with a proof for the previous root...
  const thief2 = await vote(plan4.kits[2], 3, sent[2].ct);
  const rv = plan4.txs.find((t) => t.waitForBallot);
  const rrc = await (await signer.sendTransaction({ to: rv.to, data: rv.data })).wait();
  console.log(`  ${rv.step}. ${rv.name}: gas ${rrc.gasUsed}`);
  // member 7's recovery ballot, with the new identity and the backup of the old secret
  const rk = plan4.recoveryKits[0];
  const enc = Chk.encrypt(rk.PK, rk.k, 2);
  const rinput = { ...rk.input, CA: enc.CA.map((p) => p.map(String)), CB: enc.CB.map((p) => p.map(String)), v: ["0", "0", "1", "0"], r: enc.r.map(String) };
  const t0 = Date.now();
  const { proof: rproof } = await snarkjs.groth16.fullProve(rinput, RWASM, RZKEY);
  console.log(`  recovery proof made in ${((Date.now() - t0) / 1000).toFixed(1)} s`);
  const rrc2 = await (await polls.recoveryVote(plan4.pollId, rk.nf, enc.ct.map(String), sent[2].ct, ...pa(rproof))).wait();
  console.log(`  member 7's recovery ballot (option 3) accepted: gas ${rrc2.gasUsed}; recovered = ${await polls.recovered(plan4.pollId, rk.nf)}`);
  // ...but not once member 7 has recovered: the contract refuses ordinary ballots under that nullifier
  try { await polls.vote.staticCall(...thief2.args.slice(0, 3), enc.ct.map(String), ...thief2.args.slice(4)); throw new Error("the thief should be refused"); }
  catch (e) { const d = e.data && polls.interface.parseError(e.data); if (!d || d.name !== "Recovered") throw e; console.log("  the thief's ballot within the grace, after the recovery: refused (Recovered)"); }
  if (String(await polls.distinctVoters(plan4.pollId)) !== "3") throw new Error("expected 3 voters");
  // close and publish with the tally proof
  await inc(7 * 24 * 3600 + 400);
  const state = { aggregate: (await polls.aggregate(plan4.pollId)).map((q) => q.map(String)), ballotChain: await polls.ballotChain(plan4.pollId), distinctVoters: String(await polls.distinctVoters(plan4.pollId)) };
  const secrets = JSON.parse(fs.readFileSync(process.env.POLL4_SECRETS, "utf8"));
  const pub = await makePublish(plan4, secrets, state);
  const prc = await (await signer.sendTransaction({ to: pub.txs[0].to, data: pub.txs[0].data })).wait();
  const res = await polls.getResult(plan4.pollId);
  console.log(`  publish with the tally proof: gas ${prc.gasUsed}; totals ${res.counts.map(String).join(" · ")}; state ${(await polls.getPoll(plan4.pollId)).state} (3 = Final)`);
  if (res.counts.map(String).join() !== "1,1,1,0") throw new Error("expected 1,1,1,0: member 7's own answer, not the thief's");
  console.log("PLAN 4 E2E OK");
  process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
