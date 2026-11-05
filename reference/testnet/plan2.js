// SPDX-License-Identifier: Apache-2.0
// Proof of One — Phase 1a, poll 2: "vote from your own phone". SYNTHETIC IDENTITIES ONLY.
//
// Uses the contracts already deployed by plan.json (no new deployments, so the wallet's
// nonce does not matter). Prepares, for the founder's test wallet:
//   1. setKeySetRoot: a new synthetic enclave key set (the first run's enclave keys were
//      not kept; the registry's governance is the deployer, as in the reference tests);
//   2–5. register 4 more synthetic members, whose kits are PUBLISHED;
//   6. insert them as one batch (the tree is rebuilt from the 4 leaves of plan.json);
//   7. create poll 2 (4 options, open for 7 days).
// Each published kit is everything a phone holds after enrolment plus the poll's public
// values: with it, any phone can build an encrypted ballot and its proof π_vote for poll 2
// (reference/app/web/vote.html). The kits are synthetic and published on purpose.
// The trustee shares of poll 2 are written to a PRIVATE file (never published) so that the
// result can be decrypted and published after the close.
//
// Usage: node plan2.js plan.json > plan2.json   (writes ../../private/poll2-secrets.json)
"use strict";
const fs = require("fs");
const path = require("path");
const { ethers } = require("../contracts/node_modules/ethers");
const { create } = require("../tally/src/protocol");
const B = require("../ballot-circuit/src/ballot");
const A = require("../ballot-circuit/src/attrs");
const { IncrementalTree, RevocationTree } = require("../ballot-circuit/src/trees");
const E = require("../enrolment-circuit/src/enrolment");

const ROOT = path.join(__dirname, "..");
const SNARK_FIELD = 21888242871839275222246405745257275088548364400416034343698204186575808495617n;
const ZK = { reg: path.join(ROOT, "enrolment-circuit", "setup", "registration_test.zkey"), batch: path.join(ROOT, "enrolment-circuit", "setup", "batch_test.zkey") };
const SECRETS = path.join(ROOT, "..", "private", "poll2-secrets.json");
const art = (n) => JSON.parse(fs.readFileSync(path.join(ROOT, "contracts", "build", n + ".json"), "utf8"));
const sp = (p) => ({ a: [p.pi_a[0], p.pi_a[1]], b: [[p.pi_b[0][1], p.pi_b[0][0]], [p.pi_b[1][1], p.pi_b[1][0]]], c: [p.pi_c[0], p.pi_c[1]] });
const json = (o) => JSON.stringify(o, (k, v) => (typeof v === "bigint" ? v.toString() : v), 2);

async function main() {
  const plan1 = JSON.parse(fs.readFileSync(process.argv[2], "utf8"));
  const chainId = BigInt(plan1.chainId);
  const P = await create();
  await E.init();
  const H = P.hash.H;
  const pt = (X) => P.curve.coords(X);
  const coder = ethers.AbiCoder.defaultAbiCoder();
  const IR = art("IdentityRegistry"), PP = art("ProofOfOnePolls");
  const ir = new ethers.Interface(IR.abi), pp = new ethers.Interface(PP.abi);
  const identity = plan1.contracts.IdentityRegistry, polls = plan1.contracts.ProofOfOnePolls;
  const txs = [];
  const call = (name, to, iface, fn, args, note, check) =>
    txs.push({ step: txs.length + 1, kind: "call", name, to, data: iface.encodeFunctionData(fn, args), note, check });

  // ---- the tree as it is on chain: the 4 leaves registered by plan.json, in order
  const ids = new IncrementalTree(H, B.DEPTH);
  const oldLeaves = plan1.txs.filter((t) => t.name.startsWith("Register synthetic member"))
    .map((t) => ir.decodeFunctionData("register", t.data)[0]);
  if (oldLeaves.length !== 4) throw new Error("expected 4 leaves in plan.json");
  oldLeaves.forEach((l) => ids.insert(l));

  // ---- 1. new synthetic enclave key set
  const enclave = E.createEnclave(P, { epochs: 4 });
  call("Set a new synthetic enclave key set", identity, ir, "setKeySetRoot", [enclave.keySetRoot], undefined, { type: "keySetRoot", value: enclave.keySetRoot.toString() });

  // ---- 2–5. register 4 published synthetic members
  const ATTRS = { birthDay: A.dayNumber(1990, 1, 1), natCode: 999, sexCode: 1, expiryMonth: 24400 };
  const members = [];
  for (let i = 0; i < 4; i++) {
    const m = E.newMember(P, ATTRS);
    const fingerprint = BigInt(ethers.keccak256(ethers.toUtf8Bytes("synthetic member, poll 2, " + i))) % (1n << 248n);
    const { credential } = enclave.issue({ fingerprint, attrs: ATTRS, cm: m.cm, epoch: 2 });
    const { input, leaf, member } = E.buildRegistration(P, enclave, m, credential);
    const p = sp((await E.prove(input, ZK.reg)).proof);
    call(`Register published synthetic member ${i + 5}`, identity, ir, "register", [leaf, member.cn, p.a, p.b, p.c], undefined, { type: "registeredCount", min: 4 + i + 1 });
    members.push({ member, leaf });
  }
  // ---- 6. insert them as one batch
  const { input: bi, newRoot } = E.buildBatchInsert(P, ids, members.map((m) => m.leaf));
  const bp = sp((await E.proveBatch(bi, ZK.batch)).proof);
  call("Insert the 4 published members as one batch", identity, ir, "insertBatch", [newRoot, bp.a, bp.b, bp.c], undefined, { type: "leafCount", min: 8 });
  members.forEach((m) => ids.insert(m.leaf));
  if (ids.root !== newRoot) throw new Error("tree mismatch");

  // ---- 7. poll 2 (the page fills in openTime and closeTime when it sends it)
  const pollId = 2n;
  const keys = P.dkg(5, 3);
  const POLICY = { ...A.ageRange([2026, 11, 5], { minAge: 18 }), minExpiryMonth: 24330, requiredNat: 0 };
  const DURATION = 7n * 24n * 3600n;
  const pollParams = { tallyPK: pt(keys.PK), maxBirthDay: POLICY.maxBirthDay, minBirthDay: POLICY.minBirthDay, minExpiryMonth: POLICY.minExpiryMonth,
    requiredNat: 0, maxRevotes: 50, metadataHash: ethers.keccak256(ethers.toUtf8Bytes("Proof of One Phase 1a synthetic test poll 2: vote from your phone")),
    trusteeKeys: keys.publicShares.map((s) => pt(s.PK)), threshold: 3, sampleThreshold: 0 };
  txs.push({ step: txs.length + 1, kind: "createPoll", name: "Create synthetic poll 2 (4 options, open for 7 days)", to: polls, params: pollParams, duration: DURATION.toString(), check: { type: "pollCount", min: 2 } });

  // ---- kits: everything but the encryption, which the phone makes
  const ctxHash = BigInt(ethers.keccak256(coder.encode(["uint256", "address", "uint256"], [chainId, polls, pollId]))) % SNARK_FIELD;
  const rev = new RevocationTree(H, B.REV_DEPTH);
  const kits = members.map((m, i) => {
    const b = B.buildBallot(P, { pollId, PK: keys.PK, policy: POLICY, ctxHash, member: { ...m.member, index: 4 + i }, leafIndex: 4 + i, idTree: ids, revTree: rev, choice: 0 });
    const { CA, CB, v, r, ...input } = b.input;
    return { member: i + 5, pollId, nf: b.nf, PK: pt(keys.PK), k: B.K, input };
  });

  fs.mkdirSync(path.dirname(SECRETS), { recursive: true });
  fs.writeFileSync(SECRETS, json({ note: "PRIVATE. Synthetic trustee shares of poll 2, kept to decrypt and publish its result.", pollId, chainId, polls, PK: pt(keys.PK),
    shares: keys.shares, publicShares: keys.publicShares.map((s) => ({ index: s.index, PK: pt(s.PK) })) }));

  const plan = {
    title: "Proof of One — Phase 1a synthetic test poll 2 (vote from your phone)",
    warning: "SYNTHETIC IDENTITIES ONLY. TEST-ONLY trusted setups. Not audited. Never use with real people or real funds.",
    chainId, deployer: plan1.deployer, pollId, contracts: plan1.contracts, idRoot: ids.root, kits,
    abi: { ProofOfOnePolls: PP.abi, IdentityRegistry: IR.abi }, txs,
  };
  process.stdout.write(json(plan) + "\n");
  if (globalThis.curve_bn128) await globalThis.curve_bn128.terminate();
}
main().catch((e) => { console.error(e); process.exit(1); });
