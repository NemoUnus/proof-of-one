// SPDX-License-Identifier: AGPL-3.0-only
// Tests the relay (Decision #62) against a local chain (ganache) with deployments 5 and 6
// replayed from web/plan7.json and web/plan8.json at the planned addresses (the reused
// contracts of earlier deployments are placed at their addresses first):
//   - a valid π_reg is registered and inserted into the identity tree at once; the same
//     credential again is "already registered"; a malformed request is refused;
//   - GET /state gives the leaves, the roots, the poll and its text (checked against the
//     poll's metadataHash), and the phone's trees rebuilt from it give the on-chain roots;
//   - a member registered AFTER the poll opened answers it at once (principle 1);
//   - the recorded answer is found from the ballot hash /state gives, the member changes it
//     (revision 1, the replaced ballot rebuilt from the secret), and the count goes up (principle 2);
//   - a ballot with a root the registry never held, or for another poll, is refused;
//   - review of deployment 5: two ballots built from the same state with different answers
//     (two phones, or a retry) share no random values, and only one is accepted;
//   - the app's chain reader (android-prototype/app/.../Chain.kt), run on the JVM when
//     CHAINCHECK_JAR is set, reads the same values from the contracts as ethers does.
// Usage: node test/pilot.test.mjs ../testnet/web/plan7.json ../testnet/web/plan8.json
import { createRequire } from "module";
import assert from "assert";
import { handle } from "../src/index.js";
const require = createRequire(import.meta.url);
const fs = require("fs"), path = require("path");
const ganache = require("../../contracts/node_modules/ganache");
const { ethers } = require("../../contracts/node_modules/ethers");
const { poseidonContract } = require("../../contracts/node_modules/circomlibjs");
const E = require("../../enrolment-circuit/src/enrolment");
const A = require("../../ballot-circuit/src/attrs");
const B = require("../../ballot-circuit/src/ballot");
const { IncrementalTree, RevocationTree } = require("../../ballot-circuit/src/trees");
const { create } = require("../../tally/src/protocol");
const { execFile } = require("child_process");
const run = (cmd, args) => new Promise((ok, no) => execFile(cmd, args, { encoding: "utf8" }, (e, out, err) => (e ? no(new Error(err || e.message)) : ok(out))));
const ROOT = path.join(import.meta.dirname, "..", "..");
const REG_ZKEY = path.join(ROOT, "enrolment-circuit", "setup", "registration_test.zkey");
const BALLOT_ZKEY = path.join(ROOT, "ballot-circuit", "setup", "ballot_test.zkey");
const art = (n) => JSON.parse(fs.readFileSync(path.join(ROOT, "contracts", "build", n + ".json"), "utf8"));

const plans = process.argv.slice(2).map((f) => JSON.parse(fs.readFileSync(f, "utf8")));
const plan = plans[plans.length - 1];
const relayKey = ethers.Wallet.createRandom();
// A server, so that the app's chain reader can reach it over HTTP as it reaches the network.
const server = ganache.server({ logging: { quiet: true }, chain: { chainId: Number(plan.chainId) }, miner: { blockGasLimit: 60_000_000 },
  wallet: { totalAccounts: 1, deterministic: true, unlockedAccounts: [plan.deployer] } });
await server.listen(0);
const RPC = `http://127.0.0.1:${server.address().port}`;
const g = server.provider;
const provider = new ethers.BrowserProvider(g);
await g.request({ method: "evm_setAccountBalance", params: [plan.deployer, "0x" + (10n ** 21n).toString(16)] });
await g.request({ method: "evm_setAccountBalance", params: [relayKey.address, "0x" + (10n ** 17n).toString(16)] });

// The reused contracts: deployed anywhere, then their code placed at the old addresses.
const helper = await provider.getSigner(0);
const place = async (address, abiOrNull, bytecode) => {
  const c = await new ethers.ContractFactory(abiOrNull || [], bytecode, helper).deploy(); await c.waitForDeployment();
  await g.request({ method: "evm_setAccountCode", params: [address, await provider.getCode(await c.getAddress())] });
};
const old = plan.contracts;
for (const n of [2, 3, 5]) await place(old[`Poseidon(${n})`], poseidonContract.generateABI(n), poseidonContract.createCode(n));
await place(old.RevokeVerifier, null, art("RevokeVerifier").bytecode);
await place(old.TallyVerifier, null, art("TallyVerifier").bytecode);

const signer = await provider.getSigner(plan.deployer);
for (const pl of plans) {
  await g.request({ method: "evm_setAccountNonce", params: [pl.deployer, "0x" + Number(pl.startNonce).toString(16)] });
  for (const t of pl.txs) {
    if (t.kind === "deploy") {
      const rc = await (await signer.sendTransaction({ data: t.data })).wait();
      assert.strictEqual(rc.contractAddress.toLowerCase(), t.expectedAddress.toLowerCase(), t.name);
    } else if (t.kind === "createPoll") {
      const ts = BigInt((await provider.getBlock("latest")).timestamp) + 120n;
      const pc = new ethers.Contract(t.to, pl.abi.ProofOfOnePolls, signer);
      await (await pc.createPoll({ ...t.params, openTime: ts, closeTime: ts + BigInt(t.duration) })).wait();
    }
  }
  console.log(`${pl.title.split(" (")[0]} replayed: ${pl.txs.length} steps at the planned addresses`);
}
const polls = new ethers.Contract(plan.contracts.ProofOfOnePolls, plan.abi.ProofOfOnePolls, signer);
const registry = new ethers.Contract(old.IdentityRegistry, plan.abi.IdentityRegistry, signer);
assert.strictEqual((await registry.keySetRoot()).toString(), plan.keySet.root);

const pilot = JSON.parse(fs.readFileSync(path.join(import.meta.dirname, "..", "src", "pilot-polls.json"), "utf8"));
const env = { RELAY_KEY: relayKey.privateKey, CHAIN_ID: plan.chainId, POLLS: old.ProofOfOnePolls, POLL_IDS: "1", REGISTRY: old.IdentityRegistry };
const deps = { provider };
const post = (route, body) => handle(new Request("https://relay.test" + route, { method: "POST", body: JSON.stringify(body) }), env, deps);
const get = async (q) => { const r = await handle(new Request("https://relay.test/state?" + q), env, deps); return [r.status, await r.json()]; };
const sp = (p) => ({ a: [p.pi_a[0], p.pi_a[1]], b: [[p.pi_b[0][1], p.pi_b[0][0]], [p.pi_b[1][1], p.pi_b[1][0]]], c: [p.pi_c[0], p.pi_c[1]] });

// A synthetic enclave stands for the enrolment service; governance sets its key set.
const P = await create(); await E.init();
const enclave = E.createEnclave(P, { epochs: 2 });
await (await registry.setKeySetRoot(enclave.keySetRoot)).wait();
const ATTRS = { birthDay: A.dayNumber(1980, 3, 21), natCode: 4805442, sexCode: 1, expiryMonth: 2027 * 12 + 7 };
let fpN = 1n;
async function enrol() {
  const m = E.newMember(P, ATTRS);
  const { credential, attrs } = enclave.issue({ fingerprint: fpN++, attrs: ATTRS, cm: m.cm, epoch: 0, now: Number((await provider.getBlock("latest")).timestamp) });
  const { input, leaf, member } = E.buildRegistration(P, enclave, { ...m, notBefore: attrs.notBefore }, credential);
  const p = sp((await E.prove(input, REG_ZKEY)).proof);
  return { member, leaf, body: { leaf: leaf.toString(), cn: member.cn.toString(), ...p } };
}

// ---- registration
const m1 = await enrol();
let r = await post("/register", m1.body);
let j = await r.json();
assert.strictEqual(r.status, 200, JSON.stringify(j));
assert.strictEqual(j.index, "0");
assert.strictEqual(await registry.leafCount(), 1n, "inserted into the tree at once");
console.log(`registered through the relay: position ${j.index}, in the identity tree at once`);
r = await post("/register", m1.body);
assert.strictEqual(r.status, 409); assert.strictEqual((await r.json()).alreadyRegistered, true);
r = await post("/register", { ...m1.body, a: ["1"] });
assert.strictEqual(r.status, 400);
console.log("same credential again: already registered; malformed: refused");

// ---- the poll opens; a second member registers after it opened
await provider.send("evm_increaseTime", [200]); await provider.send("evm_mine", []);
const m2 = await enrol();
r = await post("/register", m2.body);
assert.strictEqual(r.status, 200);

// ---- /state, and the phone's view rebuilt from it
let [st, s] = await get("poll=1");
assert.strictEqual(st, 200, JSON.stringify(s));
assert.deepStrictEqual(s.identity.leaves, [m1.leaf.toString(), m2.leaf.toString()]);
assert.strictEqual(s.identity.root, (await registry.root()).toString());
assert.strictEqual(s.poll.state, "Open");
assert.strictEqual(s.text && s.text.metadataHash, s.poll.metadataHash);
assert.strictEqual(ethers.keccak256(ethers.toUtf8Bytes(s.text.textJson)), s.poll.metadataHash, "the exact text bytes are the ones the poll holds");
assert.deepStrictEqual(JSON.parse(s.text.textJson), s.text.text);
assert.strictEqual(s.text.text.zh.options.length, 4);
const H = P.hash.H;
const view = (s) => {
  const ids = new IncrementalTree(H, B.DEPTH); s.identity.leaves.forEach((l) => ids.insert(BigInt(l)));
  const rev = new RevocationTree(H, B.REV_DEPTH); s.revocation.revoked.forEach((x) => rev.revoke(BigInt(x)));
  assert.strictEqual(ids.root.toString(), s.identity.root); assert.strictEqual(rev.root.toString(), s.revocation.root);
  return { ids, rev };
};
console.log(`/state: ${s.identity.leaves.length} leaves, roots rebuilt by the phone match; poll ${s.poll.pollId} "${s.text.text.en.question}"`);
[st] = await get("poll=7");
assert.strictEqual(st, 404);

async function ballot(s, mem, choice, revision) {
  const v = view(s);
  const index = s.identity.leaves.indexOf(mem.leaf.toString());
  const policy = Object.fromEntries(Object.entries(s.poll.policy).map(([k, x]) => [k, BigInt(x)]));
  const PK = P.curve.fromJSON(s.poll.PK);
  const b = B.buildBallot(P, { pollId: BigInt(s.poll.pollId), PK, policy, ctxHash: BigInt(s.poll.ctxHash), openTime: BigInt(s.poll.openTime),
    member: { ...mem.member, index }, leafIndex: index, idTree: v.ids, revTree: v.rev, choice, revision });
  const p = sp((await B.prove(b.input, BALLOT_ZKEY)).proof);
  const ct = [...b.C.flatMap((c) => P.curve.coords(c.A)), ...b.C.flatMap((c) => P.curve.coords(c.B))].map(String);
  return { pollId: s.poll.pollId, nf: b.nf.toString(), idRoot: s.identity.root, ct, ...p, _C: b.C };
}
const ZERO = Array(16).fill("0");

// ---- principle 1: member 2, registered after the poll opened, answers it
const b2 = await ballot(s, m2, 3, 0);
r = await post("/", { ...b2, prev: ZERO, _C: undefined });
j = await r.json();
assert.strictEqual(r.status, 202, JSON.stringify(j));
await provider.send("evm_mine", []);
console.log("member registered after the poll opened: ballot accepted");

// ---- principle 2: member 1 answers, then finds the recorded answer from /state alone and changes it
const b1 = await ballot(s, m1, 1, 0);
r = await post("/", { ...b1, prev: ZERO, _C: undefined });
assert.strictEqual(r.status, 202);
await provider.send("evm_mine", []);
[st, s] = await get(`poll=1&nf=${b1.nf}`);
assert.strictEqual(s.ballot.count, 1);
const found = (() => {
  const f = B.recordedAnswer(P, { s: m1.member.s, pollId: 1n, PK: P.curve.fromJSON(s.poll.PK), count: s.ballot.count, ballotHash: s.ballot.ballotHash });
  return f && { choice: f.choice, revision: f.revision };
})();
assert.deepStrictEqual(found, { choice: 1, revision: 0 });
console.log(`recorded answer found from the ballot hash: option ${found.choice + 1}`);
const b1b = await ballot(s, m1, 2, found.revision + 1);
r = await post("/", { ...b1b, prev: b1.ct, _C: undefined });
j = await r.json();
assert.strictEqual(r.status, 202, JSON.stringify(j));
await provider.send("evm_mine", []);
[st, s] = await get(`poll=1&nf=${b1.nf}`);
assert.strictEqual(s.ballot.count, 2);
assert.strictEqual(s.poll.voters, "2");
console.log("answer changed (revision 1): count 2, distinct voters 2");

// ---- review of deployment 5 (A2/F-01): two phones (or a retry) build from the same state with
// different answers. Their random values differ in every position, so nothing about the
// answers follows from comparing them; the second, now stale, is refused.
const p1 = await ballot(s, m1, 0, 2), p2 = await ballot(s, m1, 3, 2);
for (let k = 0; k < 4; k++) assert.notDeepStrictEqual([p1.ct[2 * k], p1.ct[2 * k + 1]], [p2.ct[2 * k], p2.ct[2 * k + 1]]);
r = await post("/", { ...p1, prev: b1b.ct, _C: undefined });
assert.strictEqual(r.status, 202);
await provider.send("evm_mine", []);
r = await post("/", { ...p2, prev: b1b.ct, _C: undefined });
assert.strictEqual(r.status, 400);
[st, s] = await get(`poll=1&nf=${b1.nf}`);
assert.strictEqual(s.ballot.count, 3);
const f3 = B.recordedAnswer(P, { s: m1.member.s, pollId: 1n, PK: P.curve.fromJSON(s.poll.PK), count: s.ballot.count, ballotHash: s.ballot.ballotHash });
assert.deepStrictEqual([f3.choice, f3.revision], [0, 2]);
console.log("two ballots from one state with different answers: no shared random values; the stale one refused; recorded answer still found");

// ---- the app's chain reader reads what ethers reads
if (process.env.CHAINCHECK_JAR) {
  // asynchronously: the chain answers from this same process
  const out = JSON.parse((await run("java", ["-cp", process.env.CHAINCHECK_JAR, "ChainCheckKt", RPC, plan.contracts.ProofOfOnePolls, "1", b1.nf, m2.leaf.toString()])).trim().split("\n").pop());
  const gp = await polls.getPoll(1);
  const identity = new ethers.Contract(plan.contracts.IdentityRegistry, plan.abi.IdentityRegistry, provider);
  const revocationC = new ethers.Contract(plan.contracts.RevocationRegistry, plan.abi.RevocationRegistry, provider);
  const slot = await polls.ballots(1, b1.nf);
  const want = {
    chainId: String(plan.chainId), identity: plan.contracts.IdentityRegistry.toLowerCase(), revocation: plan.contracts.RevocationRegistry.toLowerCase(),
    idRootAtCreation: gp.idRoot.toString(), revRootAtCreation: gp.revRoot.toString(), PKx: gp.tallyPK[0].toString(), PKy: gp.tallyPK[1].toString(),
    maxBirthDay: gp.maxBirthDay.toString(), minBirthDay: gp.minBirthDay.toString(), minExpiryMonth: gp.minExpiryMonth.toString(), requiredNat: gp.requiredNat.toString(),
    maxRevotes: gp.maxRevotes.toString(), openTime: gp.openTime.toString(), closeTime: gp.closeTime.toString(), metadataHash: gp.metadataHash.slice(2), state: gp.state.toString(),
    ctxHash: (await polls.contextHash(1)).toString(), leafCount: (await identity.leafCount()).toString(), idRoot: (await identity.root()).toString(),
    isHistoricalRoot: "true", isHistoricalRootBogus: "false", revRoot: (await revocationC.root()).toString(), keySetRoot: (await identity.keySetRoot()).toString(),
    leafIndex: "1", leafAt0: m1.leaf.toString(), ballotHash: slot.ballotHash.slice(2), count: slot.count.toString(),
    keccakAbc: "4e03657aea45a94fc7d47ba826c8d667c0d1e6e33a64a036ec44f58fa12d6c45",
  };
  assert.deepStrictEqual(out, want);
  console.log(`the app's chain reader (Chain.kt, on the JVM) reads the same ${Object.keys(want).length} values as ethers`);
} else console.log("(CHAINCHECK_JAR not set: the app's chain reader was not run)");

// ---- refusals
r = await post("/", { ...b1b, idRoot: "12345", prev: b1b.ct, _C: undefined });
j = await r.json();
assert.strictEqual(r.status, 400); assert.match(j.error, /UnknownRoot/);
r = await post("/", { ...b1b, pollId: "2", prev: b1b.ct, _C: undefined });
assert.strictEqual(r.status, 400);
console.log(`unknown root: ${j.error}; other poll: refused`);
console.log("pilot relay test: all passed");
if (globalThis.curve_bn128) await globalThis.curve_bn128.terminate();
await server.close();
process.exit(0);
