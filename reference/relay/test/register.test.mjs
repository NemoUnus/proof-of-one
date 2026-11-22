// SPDX-License-Identifier: AGPL-3.0-only
// Tests the relay's registrations (Decision #61) against a local chain (ganache) with the
// contracts of plan 1 deployed: a valid π_reg is registered and the phone gets its position;
// the same credential again is answered "already registered"; a malformed request and a
// proof that does not match are refused before any coins are spent.
// Usage: node test/register.test.mjs <plan.json>
import { createRequire } from "module";
import assert from "assert";
import { handle } from "../src/index.js";
const require = createRequire(import.meta.url);
const fs = require("fs"), path = require("path");
const ganache = require("../../contracts/node_modules/ganache");
const { ethers } = require("../../contracts/node_modules/ethers");
const E = require("../../enrolment-circuit/src/enrolment");
const A = require("../../ballot-circuit/src/attrs");
const { create } = require("../../tally/src/protocol");
const ZKEY = path.join(import.meta.dirname, "..", "..", "enrolment-circuit", "setup", "registration_test.zkey");

const [plan] = process.argv.slice(2).map((f) => JSON.parse(fs.readFileSync(f, "utf8")));
const relayKey = ethers.Wallet.createRandom();
const g = ganache.provider({ logging: { quiet: true }, chain: { chainId: Number(plan.chainId) }, miner: { blockGasLimit: 60_000_000 },
  wallet: { totalAccounts: 0, unlockedAccounts: [plan.deployer] } });
const provider = new ethers.BrowserProvider(g);
await g.request({ method: "evm_setAccountBalance", params: [plan.deployer, "0x" + (10n ** 21n).toString(16)] });
await g.request({ method: "evm_setAccountBalance", params: [relayKey.address, "0x" + (10n ** 16n).toString(16)] });
const signer = await provider.getSigner(plan.deployer);
for (const t of plan.txs) { if (t.kind !== "deploy") break; await (await signer.sendTransaction({ data: t.data })).wait(); }
const registry = new ethers.Contract(plan.contracts.IdentityRegistry, plan.abi.IdentityRegistry, signer);

// A synthetic enclave stands for the enrolment service; governance sets its key set.
const P = await create(); await E.init();
const enclave = E.createEnclave(P, { epochs: 2 });
await (await registry.setKeySetRoot(enclave.keySetRoot)).wait();
const attrs = { birthDay: A.dayNumber(1980, 3, 21), natCode: 4805442, sexCode: 1, expiryMonth: 2027 * 12 + 7 };
const m = E.newMember(P, attrs);
const { credential } = enclave.issue({ fingerprint: 1n, attrs, cm: m.cm, epoch: 0 });
const { input, leaf } = E.buildRegistration(P, enclave, m, credential);
const { proof } = await E.prove(input, ZKEY);
const body = { leaf: leaf.toString(), cn: m.cn.toString(),
  a: [proof.pi_a[0], proof.pi_a[1]], b: [[proof.pi_b[0][1], proof.pi_b[0][0]], [proof.pi_b[1][1], proof.pi_b[1][0]]], c: [proof.pi_c[0], proof.pi_c[1]] };

const env = { RELAY_KEY: relayKey.privateKey, CHAIN_ID: plan.chainId, POLLS: plan.contracts.ProofOfOnePolls, POLL_IDS: "1", REGISTRY: plan.contracts.IdentityRegistry };
const deps = { provider };
const post = (b) => handle(new Request("https://relay.test/register", { method: "POST", body: JSON.stringify(b) }), env, deps);

const before = await provider.getBalance(relayKey.address);
let r = await post({ ...body, cn: "x" });
assert.strictEqual(r.status, 400); console.log("malformed:", (await r.json()).error);
r = await post({ ...body, leaf: (BigInt(body.leaf) + 1n).toString() });
assert.strictEqual(r.status, 400); console.log("proof does not match:", (await r.json()).error);
assert.strictEqual(await provider.getBalance(relayKey.address), before, "a refused registration must cost nothing");
r = await post(body);
let j = await r.json();
assert.strictEqual(r.status, 200, JSON.stringify(j));
assert.strictEqual(j.index, "0");
assert.strictEqual(await registry.registeredCount(), 1n);
console.log(`registered: position ${j.index}, block ${j.block}`);
r = await post(body);
j = await r.json();
assert.strictEqual(r.status, 409); assert.strictEqual(j.alreadyRegistered, true);
console.log("same credential again:", j.error);
const st = await (await handle(new Request("https://relay.test/"), env, deps)).json();
assert.strictEqual(st.registry, plan.contracts.IdentityRegistry);
r = await handle(new Request("https://relay.test/register", { method: "POST", body: JSON.stringify(body) }), { ...env, REGISTRY: "" }, deps);
assert.strictEqual(r.status, 404); console.log("relay without a registry:", (await r.json()).error);
console.log("REGISTRATION RELAY TESTS OK");
if (globalThis.curve_bn128) await globalThis.curve_bn128.terminate();
process.exit(0);
