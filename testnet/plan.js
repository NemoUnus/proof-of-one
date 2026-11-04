// SPDX-License-Identifier: Apache-2.0
// Proof of One — Phase 1a plan generator (Decision Log #49). SYNTHETIC IDENTITIES ONLY.
//
// Given the chain id and the address of a FRESH deployer wallet (nonce 0), this script
// computes every transaction of a complete synthetic poll in advance:
//   deploy 11 contracts → register 4 synthetic members → insert them as one batch →
//   create a 4-option poll → submit 4 encrypted ballots in one batch →
//   (after the close) publish the result with the trustees' partial decryptions →
//   (after the challenge period) finalize.
// Contract addresses follow from the deployer address and nonce (CREATE), so the
// ballot proofs, which are bound to this chain and this contract, can be made here.
// The browser page (index.html) sends the transactions in order from the founder's
// test-only wallet. Every identity, document, trustee key and enclave key is synthetic
// and generated here; none belongs to a real person.
//
// Usage: node plan.js <chainId> <deployerAddress> > plan.json
"use strict";
const fs = require("fs");
const path = require("path");
const { ethers } = require("../contracts/node_modules/ethers");
const { poseidonContract } = require("../contracts/node_modules/circomlibjs");
const { create } = require("../tally/src/protocol");
const B = require("../ballot-circuit/src/ballot");
const A = require("../ballot-circuit/src/attrs");
const { IncrementalTree, RevocationTree } = require("../ballot-circuit/src/trees");
const E = require("../enrolment-circuit/src/enrolment");

const ROOT = path.join(__dirname, "..");
const SNARK_FIELD = 21888242871839275222246405745257275088548364400416034343698204186575808495617n;
const ZK = {
  ballot: path.join(ROOT, "ballot-circuit", "setup", "ballot_test.zkey"),
  reg: path.join(ROOT, "enrolment-circuit", "setup", "registration_test.zkey"),
  batch: path.join(ROOT, "enrolment-circuit", "setup", "batch_test.zkey"),
};
const art = (n) => JSON.parse(fs.readFileSync(path.join(ROOT, "contracts", "build", n + ".json"), "utf8"));
const sp = (p) => ({ a: [p.pi_a[0], p.pi_a[1]], b: [[p.pi_b[0][1], p.pi_b[0][0]], [p.pi_b[1][1], p.pi_b[1][0]]], c: [p.pi_c[0], p.pi_c[1]] });
const S = (x) => (typeof x === "bigint" ? x.toString() : x);
const json = (o) => JSON.stringify(o, (k, v) => S(v), 2);

async function main() {
  const chainId = BigInt(process.argv[2]);
  const deployer = ethers.getAddress(process.argv[3]);
  const P = await create();
  await E.init();
  const coder = ethers.AbiCoder.defaultAbiCoder();
  const pt = (X) => P.curve.coords(X);
  const txs = [];
  let nonce = 0;
  const addrAt = (n) => ethers.getCreateAddress({ from: deployer, nonce: n });
  function deploy(name, abi, bytecode, types = [], args = []) {
    const address = addrAt(nonce++);
    const data = bytecode + (types.length ? coder.encode(types, args).slice(2) : "");
    txs.push({ step: txs.length + 1, kind: "deploy", name, expectedAddress: address, data, check: { type: "code" } });
    return { address, iface: new ethers.Interface(abi) };
  }
  // `check` says how the page can tell from the chain that a step is done, so a
  // transaction that failed is never mistaken for a finished step.
  function call(name, c, fn, args, note, check) {
    nonce++;
    txs.push({ step: txs.length + 1, kind: "call", name, to: c.address, data: c.iface.encodeFunctionData(fn, args), note, check });
  }

  // ---- synthetic actors
  const enclave = E.createEnclave(P, { epochs: 4 });
  const keys = P.dkg(5, 3);              // 3-of-5 synthetic trustees
  const ATTRS = { birthDay: A.dayNumber(1990, 1, 1), natCode: 999, sexCode: 1, expiryMonth: 24400 }; // 999: test nationality code
  const POLICY = { ...A.ageRange([2026, 11, 4], { minAge: 18 }), minExpiryMonth: 24330, requiredNat: 0 };

  // ---- 1. deploy (same order and arguments as reference/contracts/test/polls.test.js)
  const pos2 = deploy("Poseidon(2)", poseidonContract.generateABI(2), poseidonContract.createCode(2));
  const RV = art("RegistrationVerifier"), BIV = art("BatchInsertVerifier"), RKV = art("RevokeVerifier"), BV = art("Groth16Verifier"),
    BBV = art("BallotBatchVerifier"), IR = art("IdentityRegistry"), RR = art("RevocationRegistry"), PP = art("ProofOfOnePolls");
  const regV = deploy("RegistrationVerifier", RV.abi, RV.bytecode);
  const batchV = deploy("BatchInsertVerifier", BIV.abi, BIV.bytecode);
  const identity = deploy("IdentityRegistry", IR.abi, IR.bytecode, ["address", "address", "address", "uint256", "uint256", "address"],
    [pos2.address, regV.address, batchV.address, 4, enclave.keySetRoot, deployer]);
  const revV = deploy("RevokeVerifier", RKV.abi, RKV.bytecode);
  const emptyRevRoot = new RevocationTree(P.hash.H, B.REV_DEPTH).root;
  const revocation = deploy("RevocationRegistry", RR.abi, RR.bytecode, ["address", "address", "uint256"], [revV.address, deployer, emptyRevRoot]);
  const ballotV = deploy("Groth16Verifier", BV.abi, BV.bytecode);
  const ballotBV = deploy("BallotBatchVerifier", BBV.abi, BBV.bytecode);
  const pos3 = deploy("Poseidon(3)", poseidonContract.generateABI(3), poseidonContract.createCode(3));
  const pos5 = deploy("Poseidon(5)", poseidonContract.generateABI(5), poseidonContract.createCode(5));
  const polls = deploy("ProofOfOnePolls", PP.abi, PP.bytecode, ["address", "address", "address", "address", "address", "address"],
    [ballotV.address, ballotBV.address, identity.address, revocation.address, pos3.address, pos5.address]);

  // ---- 2. register 4 synthetic members, 3. insert them as one batch
  const H = P.hash.H;
  const members = [];
  for (let i = 0; i < 4; i++) {
    const m = E.newMember(P, ATTRS);
    const fingerprint = BigInt(ethers.keccak256(ethers.toUtf8Bytes("synthetic member " + i))) % (1n << 248n);
    const { credential } = enclave.issue({ fingerprint, attrs: ATTRS, cm: m.cm, epoch: 2 });
    const { input, leaf, member } = E.buildRegistration(P, enclave, m, credential);
    const p = sp((await E.prove(input, ZK.reg)).proof);
    call(`Register synthetic member ${i + 1}`, identity, "register", [leaf, member.cn, p.a, p.b, p.c], undefined, { type: "registeredCount", min: i + 1 });
    members.push({ member, leaf, index: i });
  }
  const ids = new IncrementalTree(H, B.DEPTH);
  const { input: bi, newRoot } = E.buildBatchInsert(P, ids, members.map((m) => m.leaf));
  const bp = sp((await E.proveBatch(bi, ZK.batch)).proof);
  call("Insert the 4 members as one batch", identity, "insertBatch", [newRoot, bp.a, bp.b, bp.c], undefined, { type: "leafCount", min: 4 });
  members.forEach((m) => ids.insert(m.leaf));
  if (ids.root !== newRoot) throw new Error("tree mismatch");

  // ---- 4. create the poll (the page fills in openTime and closeTime when it sends it)
  const pollId = 1n;
  const pollParams = { tallyPK: pt(keys.PK), maxBirthDay: POLICY.maxBirthDay, minBirthDay: POLICY.minBirthDay, minExpiryMonth: POLICY.minExpiryMonth,
    requiredNat: 0, maxRevotes: 3, metadataHash: ethers.keccak256(ethers.toUtf8Bytes("Proof of One Phase 1a synthetic test poll 1")),
    trusteeKeys: keys.publicShares.map((s) => pt(s.PK)), threshold: 3, sampleThreshold: 0 };
  nonce++;
  txs.push({ step: txs.length + 1, kind: "createPoll", name: "Create synthetic poll 1 (4 options, open for 48 hours and 5 minutes)", to: polls.address, params: pollParams, check: { type: "pollCount", min: 1 } });

  // ---- 5. four encrypted ballots in one batch
  const ctxHash = BigInt(ethers.keccak256(coder.encode(["uint256", "address", "uint256"], [chainId, polls.address, pollId]))) % SNARK_FIELD;
  const rev = new RevocationTree(H, B.REV_DEPTH);
  const choices = [0, 1, 1, 3];
  const ballots = [];
  for (let i = 0; i < 4; i++) {
    const m = { ...members[i].member, index: i };
    const b = B.buildBallot(P, { pollId, PK: keys.PK, policy: POLICY, ctxHash, member: m, leafIndex: i, idTree: ids, revTree: rev, choice: choices[i] });
    const proof = sp((await B.prove(b.input, ZK.ballot)).proof);
    ballots.push({ ...b, proof });
  }
  ballots.sort((x, y) => (BigInt(x.nf) < BigInt(y.nf) ? -1 : 1));
  const ctArray = (C) => [...C.flatMap((c) => pt(c.A)), ...C.flatMap((c) => pt(c.B))];
  call("Submit 4 encrypted ballots in one batch", polls, "voteBatch",
    [pollId, ballots.map((b) => b.nf), ballots.map((b) => ctArray(b.C)), ballots.map((b) => ({ a: b.proof.a, b: b.proof.b, c: b.proof.c })), []], "waitUntilOpen", { type: "distinctVoters", min: 4 });

  // ---- 6. result: ballot chain, aggregate, partial decryptions of trustees 1–3
  let chain = "0x" + "00".repeat(32);
  ballots.forEach((b, seq) => { chain = P.hash.keccak(Buffer.from(chain.slice(2), "hex"), P.hash.u256(b.nf), Buffer.from(P.ballotHash(b.C).slice(2), "hex"), P.hash.u256(seq)); });
  const agg = P.aggregate(ballots.map((b) => b.C), 4);
  const partials = keys.shares.slice(0, 3).map((sh) => ({ index: sh.index, parts: P.partialDecrypt(sh, keys.publicShares[sh.index - 1].PK, agg, pollId) }));
  const counts = P.combine(agg, partials, 3, 4);
  const D = P.combinedD(partials, 3, 4);
  const toP = (q) => ({ index: q.index, D: q.parts.map((x) => pt(x.D)), T1: q.parts.map((x) => pt(x.proof.T1)), T2: q.parts.map((x) => pt(x.proof.T2)), z: q.parts.map((x) => x.proof.z) });
  const result = { counts, finalBallotChain: chain, transcriptHash: ethers.ZeroHash, archiveHash: ethers.ZeroHash, D: D.map(pt), partialsHash: ethers.ZeroHash, publishedAt: 0 };
  call("Publish the result (after the poll closes)", polls, "publish", [pollId, result, partials.map(toP)], "waitUntilClosed", { type: "pollState", min: 2 });
  call("Finalize the result (after the 7-day challenge period)", polls, "finalize", [pollId], "waitUntilFinal", { type: "pollState", min: 3 });

  const plan = {
    title: "Proof of One — Phase 1a synthetic test poll",
    warning: "SYNTHETIC IDENTITIES ONLY. TEST-ONLY trusted setups. Not audited. Never use with real people or real funds.",
    chainId, deployer, expectedCounts: counts, choices, pollId, contracts: Object.fromEntries(txs.filter((t) => t.kind === "deploy").map((t) => [t.name, t.expectedAddress])),
    abi: { ProofOfOnePolls: PP.abi, IdentityRegistry: IR.abi }, txs,
  };
  process.stdout.write(json(plan) + "\n");
  if (globalThis.curve_bn128) await globalThis.curve_bn128.terminate();
}
main().catch((e) => { console.error(e); process.exit(1); });
