// SPDX-License-Identifier: Apache-2.0
// Proof of One — the identity registry's batch job (Decision #61), run every hour by the
// repository's workflow "Registry batches". TEST NETWORK ONLY.
//
//   1. Reads the registry's Registered events since the last run and adds the leaves to the
//      published identity tree (web/identity-tree.json); checks its root against the registry.
//   2. Inserts every full batch of 4 with a batch-insertion proof π_batch, sent through the
//      relay (POST /batch). Anyone may insert a batch: the registry checks that the proof
//      writes exactly the registered leaves, in order.
//   3. If a batch has stayed incomplete for 48 hours, completes it with filler members: new
//      secrets made here and discarded at once, so that no one can vote with them, a credential
//      signed with the TEST-ONLY filler key (repository secret FILLER_KEY, in the key set
//      beside the enrolment service's key), and π_reg, sent through the relay (POST /register).
//      Fillers are counted in the published tree.
//
// Usage:
//   node batch-job.js run         (needs RPC_URL, RELAY_URL; FILLER_KEY for fillers)
//   node batch-job.js key-leaf    (prints the filler key's public leaf, for the key set)
// Needs reference/enrolment-circuit with its circuits built (npm run build) and node_modules,
// reference/tally's node_modules, and reference/relay's (for ethers).
"use strict";
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { ethers } = require("../relay/node_modules/ethers");
const E = require("../enrolment-circuit/src/enrolment");
const A = require("../ballot-circuit/src/attrs");
const { IncrementalTree } = require("../ballot-circuit/src/trees");
const { create } = require("../tally/src/protocol");

const WEB = path.join(__dirname, "web");
const TREE_FILE = process.env.TREE_FILE || path.join(WEB, "identity-tree.json");
const KEYSET_FILE = process.env.KEYSET_FILE || path.join(WEB, "keyset.json");
const SETUP = path.join(__dirname, "..", "enrolment-circuit", "setup");
const B = 4;                                   // the registry's BATCH (reference parameters)
const WAIT_MS = Number(process.env.FILLER_WAIT_HOURS ?? 48) * 3600 * 1000;   // a batch incomplete this long gets fillers
const CHUNK = 1900;                            // blocks per eth_getLogs request (the public node allows 2,000)
const DEPTH = 32;
// Fillers carry ICAO's code for an unspecified nationality, XXX, so they belong to no region.
const FILLER_ATTRS = { birthDay: A.dayNumber(1990, 1, 1), natCode: 0x585858, sexCode: 1, expiryMonth: 2030 * 12 + 1 };
const ABI = [
  "event Registered(uint256 indexed leaf, uint256 indexed cn, uint256 index)",
  "function registeredCount() view returns (uint256)", "function leafCount() view returns (uint256)",
  "function root() view returns (uint256)", "function keySetRoot() view returns (uint256)", "function BATCH() view returns (uint256)",
];

const log = (...a) => console.log(new Date().toISOString(), ...a);

async function fillerKey(P) {
  const { buildEddsa } = require("../enrolment-circuit/node_modules/circomlibjs");
  const eddsa = await buildEddsa();
  const hex = String(process.env.FILLER_KEY || "").replace(/\s+/g, "");
  if (!/^[0-9a-fA-F]{64,}$/.test(hex)) throw new Error("FILLER_KEY missing or shorter than 32 bytes of hex");
  const prv = Buffer.from(hex.slice(0, 64), "hex");
  const pub = eddsa.prv2pub(prv);
  const F = eddsa.F;
  const Akey = [F.toObject(pub[0]), F.toObject(pub[1])];
  return { eddsa, prv, A: Akey, leaf: P.hash.H(Akey) };
}

async function post(url, body) {
  const r = await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  const j = await r.json().catch(() => ({}));
  if (!r.ok && !(r.status === 409 && j.alreadyRegistered)) throw new Error(`${url}: HTTP ${r.status}: ${j.error || ""}`);
  return j;
}
const solProof = (p) => ({ a: [p.pi_a[0], p.pi_a[1]], b: [[p.pi_b[0][1], p.pi_b[0][0]], [p.pi_b[1][1], p.pi_b[1][0]]], c: [p.pi_c[0], p.pi_c[1]] });

// A filler member: fresh secrets, a credential under the filler key, π_reg; secrets discarded.
async function makeFiller(P, fk, keySet) {
  const H = P.hash.H;
  const m = E.newMember(P, FILLER_ATTRS);
  let rn; do { rn = BigInt("0x" + crypto.randomBytes(32).toString("hex")) >> 4n; } while (rn === 0n);
  const epoch = 0n;
  const msg = H([E.TAG.CREDENTIAL_MSG, ...A.attrFields(FILLER_ATTRS), m.cm, rn, epoch]);
  const sig = fk.eddsa.signPoseidon(fk.prv, fk.eddsa.F.e(msg));
  const F = fk.eddsa.F;
  const idx = keySet.leaves.indexOf(fk.leaf.toString());
  if (idx < 0) throw new Error("the filler key is not in the published key set");
  const credential = { rn, epoch, A: fk.A, R8: [F.toObject(sig.R8[0]), F.toObject(sig.R8[1])], S: sig.S, keyIndex: idx };
  const enclaveView = { keySetRoot: BigInt(keySet.root), keyTree: { path: () => keySet.paths[idx] } };
  const { input, leaf, member } = E.buildRegistration(P, enclaveView, m, credential);
  const { proof } = await E.prove(input, path.join(SETUP, "registration_test.zkey"));
  return { leaf: leaf.toString(), cn: member.cn.toString(), ...solProof(proof) };
}

async function main() {
  const mode = process.argv[2] || "run";
  const P = await create(); await E.init();
  if (mode === "key-leaf") {
    const fk = await fillerKey(P);
    console.log(`filler key leaf: ${fk.leaf}`);
    return;
  }
  const state = JSON.parse(fs.readFileSync(TREE_FILE, "utf8"));
  const keySet = JSON.parse(fs.readFileSync(KEYSET_FILE, "utf8"));
  const provider = new ethers.JsonRpcProvider(process.env.RPC_URL || "https://sepolia.base.org", Number(state.chainId), { staticNetwork: true });
  const reg = new ethers.Contract(state.registry, ABI, provider);
  const relay = (process.env.RELAY_URL || "https://proof-of-one-relay.nemounus.workers.dev").replace(/\/$/, "");
  const H = P.hash.H;
  const before = { leaves: state.leaves.length, leafCount: state.leafCount, lastBlock: state.lastBlock ?? 0, root: state.root, fillers: state.fillers.length };

  // 1. new registrations since the last run
  const latest = await provider.getBlockNumber();
  // First run: start about 28 hours back, before the key set was set (the job is first run
  // by hand right after that transaction); no pilot registration can be older.
  if (state.lastBlock == null) state.lastBlock = latest - 50000;
  for (let from = state.lastBlock + 1; from <= latest; from += CHUNK) {
    const to = Math.min(from + CHUNK - 1, latest);
    let evs;
    for (let attempt = 1; ; attempt++) {
      try { evs = await reg.queryFilter(reg.filters.Registered(), from, to); break; } catch (e) {
        if (attempt >= 4) throw e;
        await new Promise((r) => setTimeout(r, 2000 * attempt));   // the public node limits request rates
      }
    }
    for (const ev of evs) {
      const i = Number(ev.args.index);
      if (i < state.leaves.length) continue;   // already known
      if (i !== state.leaves.length) throw new Error(`registration ${i} out of order (expected ${state.leaves.length})`);
      const blk = await ev.getBlock();
      state.leaves.push(ev.args.leaf.toString());
      state.registeredAt.push(blk.timestamp);
    }
    state.lastBlock = to;
  }
  const [count, leafCount, root, onChainKeySet] = await Promise.all([reg.registeredCount(), reg.leafCount(), reg.root(), reg.keySetRoot()]);
  if (Number(count) !== state.leaves.length) throw new Error(`the registry has ${count} registrations, the events gave ${state.leaves.length}`);
  const treeOf = (n) => { const t = new IncrementalTree(H, DEPTH); for (const l of state.leaves.slice(0, n)) t.insert(BigInt(l)); return t; };
  let inserted = Number(leafCount);
  if (treeOf(inserted).root !== root) throw new Error("the published leaves do not give the registry's root");
  log(`registrations ${count}, in the tree ${inserted}, key set ${onChainKeySet === BigInt(keySet.root) ? "as published" : "NOT the published one"}`);

  // 3. fillers for a batch incomplete for 48 hours (before 2, so that it is inserted in this run)
  const pending = state.leaves.length - inserted;
  const firstPending = state.registeredAt[inserted];
  if (pending > 0 && pending < B && firstPending && Date.now() - firstPending * 1000 >= WAIT_MS) {
    if (onChainKeySet !== BigInt(keySet.root)) throw new Error("the registry's key set is not the published one; no fillers");
    const fk = await fillerKey(P);
    for (let k = pending; k < B; k++) {
      const f = await makeFiller(P, fk, keySet);
      const r = await post(relay + "/register", f);
      log(`filler registered: position ${r.index ?? "pending"} (tx ${r.tx})`);
      state.fillers.push(f.leaf);
    }
    log("fillers sent; the batch is inserted in the next run once their events are read");
  }

  // 2. full batches
  while (state.leaves.length - inserted >= B) {
    const tree = treeOf(inserted);
    const leaves = state.leaves.slice(inserted, inserted + B).map(BigInt);
    const { input, newRoot } = E.buildBatchInsert(P, tree, leaves);
    const { proof } = await E.proveBatch(input, path.join(SETUP, "batch_test.zkey"));
    const r = await post(relay + "/batch", { newRoot: newRoot.toString(), ...solProof(proof) });
    log(`batch ${inserted}–${inserted + B - 1} inserted (tx ${r.tx})`);
    inserted += B;
  }

  // Written (and committed by the workflow) only when something changed, or when the block
  // reached has moved far enough to be worth keeping, so that the file is not rewritten hourly.
  const changed = before.root == null || state.fillers.length !== before.fillers || state.leaves.length !== before.leaves || inserted !== before.leafCount || state.lastBlock - before.lastBlock > 200000;
  if (!changed) { log("nothing new"); return; }
  state.leafCount = inserted;
  state.root = treeOf(inserted).root.toString();
  state.updated = new Date().toISOString().slice(0, 16) + "Z";
  fs.writeFileSync(TREE_FILE, JSON.stringify(state, null, 1) + "\n");
}

main().then(() => { if (globalThis.curve_bn128) return globalThis.curve_bn128.terminate(); })
  .then(() => process.exit(0), (e) => { console.error(e); process.exit(1); });
