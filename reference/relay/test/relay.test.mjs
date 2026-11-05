// SPDX-License-Identifier: AGPL-3.0-only
// Tests the relay's handler against a local chain (ganache) with plan 1 and plan 2 replayed:
// a valid ballot is submitted and recorded; a malformed ballot, a ballot for another poll and
// a ballot whose proof does not match are refused before any coins are spent.
// Usage: node test/relay.test.mjs <plan.json> <plan2.json>
import { createRequire } from "module";
import assert from "assert";
import { handle } from "../src/index.js";
const require = createRequire(import.meta.url);
const fs = require("fs"), path = require("path");
const ganache = require("../../contracts/node_modules/ganache");
const { ethers } = require("../../contracts/node_modules/ethers");
const snarkjs = require("../../ballot-circuit/node_modules/snarkjs");
const Chk = require("../../app/web/check.js");
const ZKEY = path.join(import.meta.dirname, "..", "..", "ballot-circuit", "setup", "ballot_test.zkey");
const WASM = path.join(import.meta.dirname, "..", "..", "ballot-circuit", "build", "ballot_js", "ballot.wasm");

const [plan1, plan2] = process.argv.slice(2).map((f) => JSON.parse(fs.readFileSync(f, "utf8")));
const relayKey = ethers.Wallet.createRandom();
const g = ganache.provider({ logging: { quiet: true }, chain: { chainId: Number(plan1.chainId) }, miner: { blockGasLimit: 60_000_000 },
  wallet: { totalAccounts: 0, unlockedAccounts: [plan1.deployer] } });
const provider = new ethers.BrowserProvider(g);
const big = "0x" + (10n ** 21n).toString(16);
await g.request({ method: "evm_setAccountBalance", params: [plan1.deployer, big] });
await g.request({ method: "evm_setAccountBalance", params: [relayKey.address, "0x" + (10n ** 16n).toString(16)] });
const signer = await provider.getSigner(plan1.deployer);
for (const plan of [plan1, plan2]) {
  const polls = new ethers.Contract(plan.contracts.ProofOfOnePolls, plan.abi.ProofOfOnePolls, signer);
  for (const t of plan.txs) {
    if (t.note === "waitUntilClosed") break;
    if (t.note === "waitUntilOpen") { await provider.send("evm_increaseTime", [200]); await provider.send("evm_mine", []); }
    if (t.kind === "deploy") await (await signer.sendTransaction({ data: t.data })).wait();
    else if (t.kind === "createPoll") {
      const ts = BigInt((await provider.getBlock("latest")).timestamp);
      await (await polls.createPoll({ ...t.params, openTime: ts, closeTime: ts + BigInt(t.duration || 48 * 3600 + 300) })).wait();
    } else await (await signer.sendTransaction({ to: t.to, data: t.data })).wait();
  }
}
await provider.send("evm_increaseTime", [200]); await provider.send("evm_mine", []);

const env = { RELAY_KEY: relayKey.privateKey, CHAIN_ID: plan1.chainId, POLLS: plan2.contracts.ProofOfOnePolls, POLL_IDS: "2" };
const deps = { provider };
const post = (body) => handle(new Request("https://relay.test/", { method: "POST", body: JSON.stringify(body) }), env, deps);

// A ballot as vote.html makes it, for member 7, option 2.
const kit = plan2.kits[2];
const enc = Chk.encrypt(kit.PK, kit.k, 1);
const input = { ...kit.input, CA: enc.CA.map((p) => p.map(String)), CB: enc.CB.map((p) => p.map(String)), v: ["0", "1", "0", "0"], r: enc.r.map(String) };
const { proof } = await snarkjs.groth16.fullProve(input, WASM, ZKEY);
const ballot = { pollId: "2", nf: String(kit.nf), ct: enc.ct.map(String), prev: Array(16).fill("0"),
  a: [proof.pi_a[0], proof.pi_a[1]], b: [[proof.pi_b[0][1], proof.pi_b[0][0]], [proof.pi_b[1][1], proof.pi_b[1][0]]], c: [proof.pi_c[0], proof.pi_c[1]] };

const status = await (await handle(new Request("https://relay.test/"), env, deps)).json();
assert.strictEqual(status.relay, relayKey.address); console.log("status:", status.balance, "ETH, polls", status.pollIds.join(","));

let r = await post({ ...ballot, ct: ballot.ct.slice(0, 15) });
assert.strictEqual(r.status, 400); console.log("malformed ballot:", (await r.json()).error);
r = await post({ ...ballot, pollId: "1" });
assert.strictEqual(r.status, 400); console.log("other poll:", (await r.json()).error);
const before = await provider.getBalance(relayKey.address);
const swapped = [...ballot.ct]; [swapped[8], swapped[10]] = [swapped[10], swapped[8]];
r = await post({ ...ballot, ct: swapped });
assert.strictEqual(r.status, 400); console.log("proof does not match:", (await r.json()).error);
assert.strictEqual(await provider.getBalance(relayKey.address), before, "a refused ballot must cost nothing");

r = await post(ballot);
const j = await r.json();
assert.strictEqual(r.status, 202, JSON.stringify(j));
const rc = await provider.waitForTransaction(j.tx);
assert.strictEqual(rc.status, 1);
const polls = new ethers.Contract(plan2.contracts.ProofOfOnePolls, plan2.abi.ProofOfOnePolls, provider);
const slot = await polls.ballots(2, kit.nf);
assert.strictEqual(Chk.recordedAnswer(ethers.keccak256, { PK: kit.PK, r: enc.r.map(String) }, slot.ballotHash), 1);
console.log(`valid ballot: recorded (gas ${rc.gasUsed}, cost ${ethers.formatEther(rc.gasUsed * rc.gasPrice)} ETH); recorded answer: option 2`);
console.log("RELAY TESTS OK");
process.exit(0);
