// SPDX-License-Identifier: Apache-2.0
// The registration path of Decision #61 end to end on a local chain (ganache, plan 1's
// contracts): phones register through the relay; the batch job inserts the full batch; a
// batch left incomplete gets filler members once its wait is over (here 0 hours), and the
// next run inserts it; the published tree gives the registry's root throughout.
// Usage: node test/batch-job.e2e.js web/plan.json
"use strict";
const assert = require("assert");
const fs = require("fs");
const os = require("os");
const path = require("path");
const http = require("http");
const { execFile } = require("child_process");
const run = require("util").promisify(execFile);
const ganache = require("../../contracts/node_modules/ganache");
const { ethers } = require("../../relay/node_modules/ethers");
const E = require("../../enrolment-circuit/src/enrolment");
const A = require("../../ballot-circuit/src/attrs");
const { IncrementalTree } = require("../../ballot-circuit/src/trees");
const { create } = require("../../tally/src/protocol");

(async () => {
  const plan = JSON.parse(fs.readFileSync(process.argv[2], "utf8"));
  const { handle } = await import("../../relay/src/index.js");
  const P = await create(); await E.init();
  const H = P.hash.H;

  // chain
  const server = ganache.server({ logging: { quiet: true }, chain: { chainId: Number(plan.chainId) }, miner: { blockGasLimit: 60_000_000 },
    wallet: { totalAccounts: 0, unlockedAccounts: [plan.deployer] } });
  await new Promise((r) => server.listen(0, r));
  const rpc = `http://127.0.0.1:${server.address().port}`;
  const provider = new ethers.JsonRpcProvider(rpc, Number(plan.chainId), { staticNetwork: true, polling: true, pollingInterval: 200 });
  const relayKey = ethers.Wallet.createRandom();
  await provider.send("evm_setAccountBalance", [plan.deployer, "0x" + (10n ** 21n).toString(16)]);
  await provider.send("evm_setAccountBalance", [relayKey.address, "0x" + (10n ** 18n).toString(16)]);
  const signer = await provider.getSigner(plan.deployer);
  for (const t of plan.txs) { if (t.kind !== "deploy") break; await (await signer.sendTransaction({ data: t.data })).wait(); }
  const registry = new ethers.Contract(plan.contracts.IdentityRegistry, plan.abi.IdentityRegistry, signer);

  // relay, served over HTTP as on Cloudflare
  const env = { RELAY_KEY: relayKey.privateKey, CHAIN_ID: plan.chainId, POLLS: plan.contracts.ProofOfOnePolls, POLL_IDS: "1", REGISTRY: plan.contracts.IdentityRegistry };
  const relay = http.createServer(async (req, res) => {
    let body = ""; for await (const c of req) body += c;
    const r = await handle(new Request("http://relay" + req.url, { method: req.method, body: req.method === "POST" ? body : undefined }), env, { provider });
    res.writeHead(r.status, { "content-type": "application/json" }); res.end(await r.text());
  });
  await new Promise((r) => relay.listen(0, r));
  const relayUrl = `http://127.0.0.1:${relay.address().port}`;

  // key set: a synthetic service key (index 0) and the filler key (index 1)
  const service = E.createEnclave(P, { epochs: 1 });
  const fillerKey = require("crypto").randomBytes(32).toString("hex");
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "poo-batch-"));
  const jobEnv = { ...process.env, RPC_URL: rpc, RELAY_URL: relayUrl, FILLER_KEY: fillerKey, TREE_FILE: path.join(tmp, "tree.json"), KEYSET_FILE: path.join(tmp, "keyset.json"), FILLER_WAIT_HOURS: "1000" };
  // the job runs as its own process (as in the workflow); this process keeps serving the chain
  const job = async (mode = "run") => (await run("node", [path.join(__dirname, "..", "batch-job.js"), mode], { env: jobEnv })).stdout;
  const fillerLeaf = (await job("key-leaf")).match(/filler key leaf: (\d+)/)[1];
  const serviceLeaf = service.keyTree.leaves[0];
  const keyTree = new IncrementalTree(H, 8); keyTree.insert(serviceLeaf); keyTree.insert(BigInt(fillerLeaf));
  const keyset = { root: keyTree.root.toString(), leaves: [serviceLeaf.toString(), fillerLeaf],
    paths: [0, 1].map((i) => { const p = keyTree.path(i); return { siblings: p.siblings.map(String), pathIndex: p.pathIndex.map(String) }; }) };
  fs.writeFileSync(jobEnv.KEYSET_FILE, JSON.stringify(keyset));
  await (await registry.setKeySetRoot(keyset.root)).wait();
  fs.writeFileSync(jobEnv.TREE_FILE, JSON.stringify({ chainId: plan.chainId, registry: plan.contracts.IdentityRegistry, lastBlock: 0, leaves: [], registeredAt: [], fillers: [], leafCount: 0, root: null }));

  // five phones register through the relay
  const view = { keySetRoot: keyTree.root, keyTree: { path: (i) => keyTree.path(i) } };
  const ATTRS = { birthDay: A.dayNumber(1985, 6, 1), natCode: 4805442, sexCode: 2, expiryMonth: 2029 * 12 };
  for (let i = 0; i < 5; i++) {
    const m = E.newMember(P, ATTRS);
    const { credential } = service.issue({ fingerprint: BigInt(i + 1), attrs: ATTRS, cm: m.cm, epoch: 0 });
    const { input, leaf } = E.buildRegistration(P, view, { ...m }, { ...credential, keyIndex: 0 });
    const { proof } = await E.prove(input, path.join(__dirname, "..", "..", "enrolment-circuit", "setup", "registration_test.zkey"));
    const r = await fetch(relayUrl + "/register", { method: "POST", body: JSON.stringify({ leaf: leaf.toString(), cn: m.cn.toString(),
      a: [proof.pi_a[0], proof.pi_a[1]], b: [[proof.pi_b[0][1], proof.pi_b[0][0]], [proof.pi_b[1][1], proof.pi_b[1][0]]], c: [proof.pi_c[0], proof.pi_c[1]] }) });
    assert.strictEqual(r.status, 200, await r.text());
  }
  console.log("5 phones registered through the relay");

  console.log((await job()).trim());
  assert.strictEqual(await registry.leafCount(), 4n);
  let tree = JSON.parse(fs.readFileSync(jobEnv.TREE_FILE, "utf8"));
  assert.strictEqual(tree.leafCount, 4); assert.strictEqual(BigInt(tree.root), await registry.root());
  console.log("first run: the full batch of 4 inserted; the published tree gives the registry's root");

  console.log((await job()).trim());
  assert.strictEqual(await registry.leafCount(), 4n, "a batch waiting less than its time gets no fillers");

  jobEnv.FILLER_WAIT_HOURS = "0";
  console.log((await job()).trim());
  assert.strictEqual(await registry.registeredCount(), 8n);
  console.log((await job()).trim());
  assert.strictEqual(await registry.leafCount(), 8n);
  tree = JSON.parse(fs.readFileSync(jobEnv.TREE_FILE, "utf8"));
  assert.strictEqual(tree.fillers.length, 3); assert.strictEqual(BigInt(tree.root), await registry.root());
  console.log("after the wait: 3 fillers registered, the second batch inserted, the tree still gives the registry's root");
  console.log("BATCH JOB E2E OK");
  relay.close(); await server.close();
  if (globalThis.curve_bn128) await globalThis.curve_bn128.terminate();
  process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
