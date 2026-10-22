// SPDX-License-Identifier: Apache-2.0
// Full on-chain flow on an in-process EVM (ganache), with real proofs from the
// TEST-ONLY setups in ../ballot-circuit and ../enrolment-circuit:
//   enrol (π_reg) → batch insertion → poll snapshot → encrypted ballots (π_vote) →
//   re-vote → revocation after re-enrolment → tally → result checks → finalize.
// The phone's view of the registries is rebuilt from contract events only.
"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const ganache = require("ganache");
const { ethers } = require("ethers");
const { poseidonContract } = require("circomlibjs");
const { create } = require("../../tally/src/protocol");
const B = require("../../ballot-circuit/src/ballot");
const { IncrementalTree, RevocationTree } = require("../../ballot-circuit/src/trees");
const E = require("../../enrolment-circuit/src/enrolment");

const BALLOT_ZKEY = path.join(__dirname, "..", "..", "ballot-circuit", "setup", "ballot_test.zkey");
const REG_ZKEY = path.join(__dirname, "..", "..", "enrolment-circuit", "setup", "registration_test.zkey");
const art = (n) => JSON.parse(fs.readFileSync(path.join(__dirname, "..", "build", n + ".json"), "utf8"));
const ATTRS = { ageBand: 3, natCode: 250, sexCode: 1, expiryMonth: 24400 };
const POLICY = { minAgeBand: 2, minExpiryMonth: 24330, requiredNat: 0 };

let P, provider, signer, poseidon, identity, revocation, polls, enclave, keys, gas = {};
let people = [], pollId, ctx, firstPollEvents;

const fp = () => BigInt("0x" + crypto.randomBytes(31).toString("hex"));
const increase = async (s) => { await provider.send("evm_increaseTime", [s]); await provider.send("evm_mine", []); };
const now = async () => BigInt((await provider.getBlock("latest")).timestamp);
const pt = (X) => P.curve.coords(X);
const sp = (proof) => ({
  a: [proof.pi_a[0], proof.pi_a[1]],
  b: [[proof.pi_b[0][1], proof.pi_b[0][0]], [proof.pi_b[1][1], proof.pi_b[1][0]]],
  c: [proof.pi_c[0], proof.pi_c[1]],
});
const ctArray = (C) => [...C.flatMap((c) => pt(c.A)), ...C.flatMap((c) => pt(c.B))];
async function reverts(call, contract, name) {
  await assert.rejects(call, (e) => {
    const parsed = contract.interface.parseError(e.data);
    assert.equal(parsed && parsed.name, name);
    return true;
  });
}
const used = async (tx) => (await (await tx).wait()).gasUsed;

// --- the phone: enrol through the enclave, then register on-chain with π_reg
async function enrol({ fingerprint = fp(), reenrol = false } = {}) {
  const m = E.newMember(P, ATTRS);
  const { credential, revokeOld } = enclave.issue({ fingerprint, attrs: ATTRS, cm: m.cm, epoch: 2, reenrol });
  const { input, leaf, member } = E.buildRegistration(P, enclave, m, credential);
  const { proof } = await E.prove(input, REG_ZKEY);
  const p = sp(proof);
  const g = await used(identity.register(leaf, member.cn, p.a, p.b, p.c));
  gas.register = gas.register || g;
  return { member, leaf, fingerprint, revokeOld, proof: p };
}

// --- the phone's local view of both registries, rebuilt from events only
async function syncTrees() {
  const H = P.hash.H;
  const ids = new IncrementalTree(H, B.DEPTH);
  const ins = await identity.queryFilter(identity.filters.LeafInserted());
  ins.sort((x, y) => Number(x.args.index - y.args.index)).forEach((e) => ids.insert(e.args.leaf));
  const rev = new RevocationTree(H, B.REV_DEPTH);
  for (const e of await revocation.queryFilter(revocation.filters.Revoked())) rev.revoke(e.args.rn);
  const index = new Map(ins.map((e) => [e.args.leaf.toString(), Number(e.args.index)]));
  return { ids, rev, index };
}

// --- the enclave operator's witness for an on-chain revocation
function revocationWitness(rt, x) {
  const H = P.hash.H;
  const li = rt.lowIndex(x), low = rt.entries[li];
  const lowSiblings = rt.tree.path(li).siblings;
  const saved = rt.tree.leaves[li];
  rt.tree.leaves[li] = H([low.value, x]); // tree after the low-leaf update
  const newSiblings = rt.tree.path(rt.tree.leaves.length).siblings;
  rt.tree.leaves[li] = saved;
  return { lowIndex: li, lowValue: low.value, lowNext: low.next, lowSiblings, newSiblings };
}

async function makeBallot(person, choice, id, view) {
  const m = { ...person.member, index: view.index.get(person.leaf.toString()) };
  const b = B.buildBallot(P, { pollId: BigInt(id), PK: keys.PK, policy: POLICY, ctxHash: await polls.contextHash(id), member: m, leafIndex: m.index, idTree: view.ids, revTree: view.rev, choice });
  const { proof } = await B.prove(b.input, BALLOT_ZKEY);
  return { ...b, sp: sp(proof) };
}
const send = (b, id) => polls.vote(id, b.nf, ctArray(b.C), b.sp.a, b.sp.b, b.sp.c);
const sendStatic = (b, id) => polls.vote.staticCall(id, b.nf, ctArray(b.C), b.sp.a, b.sp.b, b.sp.c);
const pollParams = async (over = {}) => {
  const t = await now();
  return { tallyPK: pt(keys.PK), minAgeBand: POLICY.minAgeBand, minExpiryMonth: POLICY.minExpiryMonth, requiredNat: POLICY.requiredNat,
    maxRevotes: 3, openTime: t, closeTime: t + 48n * 3600n + 60n, metadataHash: ethers.ZeroHash, ...over };
};

test.before(async () => {
  P = await create();
  await E.init();
  provider = new ethers.BrowserProvider(ganache.provider({ logging: { quiet: true }, chain: { chainId: 1337 }, miner: { blockGasLimit: 100_000_000 }, wallet: { deterministic: true } }));
  signer = await provider.getSigner(0);
  const deploy = async (abi, bytecode, ...args) => { const c = await new ethers.ContractFactory(abi, bytecode, signer).deploy(...args); await c.waitForDeployment(); return c; };
  poseidon = await deploy(poseidonContract.generateABI(2), poseidonContract.createCode(2));
  enclave = E.createEnclave(P, { epochs: 4 });
  const RV = art("RegistrationVerifier"), BV = art("Groth16Verifier"), IR = art("IdentityRegistry"), RR = art("RevocationRegistry"), PP = art("ProofOfOnePolls");
  const regVerifier = await deploy(RV.abi, RV.bytecode);
  identity = await deploy(IR.abi, IR.bytecode, await poseidon.getAddress(), await regVerifier.getAddress(), enclave.keySetRoot, 3, await signer.getAddress());
  revocation = await deploy(RR.abi, RR.bytecode, await poseidon.getAddress(), await signer.getAddress());
  const ballotVerifier = await deploy(BV.abi, BV.bytecode);
  polls = await deploy(PP.abi, PP.bytecode, await ballotVerifier.getAddress(), await identity.getAddress(), await revocation.getAddress());
  keys = P.dkg(5, 3);
});
test.after(async () => { if (globalThis.curve_bn128) await globalThis.curve_bn128.terminate(); });

test("registration: valid π_reg accepted; reused credential rejected; small batch refused", async () => {
  people.push(await enrol(), await enrol());
  await reverts(identity.insertBatch.staticCall(), identity, "BatchTooSmall");
  const a = people[0];
  await reverts(identity.register.staticCall(a.leaf, a.member.cn, a.proof.a, a.proof.b, a.proof.c), identity, "CredentialUsed");
  people.push(await enrol(), await enrol());
  gas.insertBatch4 = await used(identity.insertBatch());
  assert.equal(await identity.leafCount(), 4n);
});

test("the phone's tree rebuilt from events matches the on-chain roots", async () => {
  const v = await syncTrees();
  assert.equal(v.ids.root, await identity.root());
  assert.equal(v.rev.root, await revocation.root());
});

test("createPoll: rejects a bad tally key and short polls; snapshot comes from the registries", async () => {
  const p = 21888242871839275222246405745257275088548364400416034343698204186575808495617n;
  await reverts(polls.createPoll.staticCall(await pollParams({ tallyPK: [0n, p - 1n] })), polls, "InvalidTallyKey");
  const short = await pollParams(); short.closeTime = short.openTime + 3600n;
  await reverts(polls.createPoll.staticCall(short), polls, "BadTimes");
  gas.createPoll = await used(polls.createPoll(await pollParams()));
  pollId = await polls.pollCount();
  const poll = await polls.getPoll(pollId);
  assert.equal(poll.idRoot, await identity.root());
  assert.equal(poll.revRoot, await revocation.root());
  assert.equal(poll.eligible, 4n);
});

test("ballots with valid proofs are accepted; a re-vote replaces the earlier ballot", async () => {
  const v = await syncTrees();
  const choices = [0, 1, 1, 3];
  for (let i = 0; i < 4; i++) {
    const g = await used(send(await makeBallot(people[i], choices[i], pollId, v), pollId));
    if (i === 0) gas.voteFirst = g;
  }
  gas.voteRevote = await used(send(await makeBallot(people[3], 2, pollId, v), pollId));
  assert.equal(await polls.distinctVoters(pollId), 4n);
});

test("forged or replayed ballots are rejected", async () => {
  const v = await syncTrees();
  const a = await makeBallot(people[0], 1, pollId, v), b = await makeBallot(people[0], 2, pollId, v);
  await reverts(polls.vote.staticCall(pollId, a.nf, ctArray(b.C), a.sp.a, a.sp.b, a.sp.c), polls, "InvalidProof");
  await used(polls.createPoll(await pollParams()));
  const other = await polls.pollCount();
  await reverts(sendStatic(a, other), polls, "InvalidProof");
});

test("re-enrolment: the old identity is revoked on-chain and cannot vote in later polls", async () => {
  const alice = people[0];
  const alice2 = await enrol({ fingerprint: alice.fingerprint, reenrol: true });
  assert.equal(alice2.revokeOld, alice.member.rn);

  const before = await syncTrees();
  const w = revocationWitness(before.rev, alice2.revokeOld);
  await reverts(revocation.revoke.staticCall(alice2.revokeOld, 1, w.lowIndex, w.lowValue, w.lowNext, w.lowSiblings, w.lowSiblings), revocation, "SlotNotEmpty");
  gas.revoke = await used(revocation.revoke(alice2.revokeOld, 1, w.lowIndex, w.lowValue, w.lowNext, w.lowSiblings, w.newSiblings));
  assert.equal(await revocation.revokedCount(), 1n);

  people.push(alice2, await enrol(), await enrol());
  await used(identity.insertBatch());
  await used(polls.createPoll(await pollParams()));
  const later = await polls.pollCount();
  assert.equal((await polls.getPoll(later)).eligible, 6n); // 7 leaves − 1 revoked

  const v = await syncTrees();
  assert.equal(v.rev.root, await revocation.root());
  await assert.rejects(makeBallot(alice, 0, later, v), /revoked/);
  await used(send(await makeBallot(alice2, 0, later, v), later));
  await used(send(await makeBallot(people[1], 1, later, v), later));
  assert.equal(await polls.distinctVoters(later), 2n);
});

test("ballot chain on-chain equals the chain rebuilt by the reference tally from events", async () => {
  const logs = await polls.queryFilter(polls.filters.Ballot(pollId));
  const toPoint = (x, y) => [P.curve.F.e(x), P.curve.F.e(y)];
  firstPollEvents = logs.map((l, seq) => {
    const ct = l.args.ciphertexts.map(BigInt);
    const C = [0, 1, 2, 3].map((j) => ({ A: toPoint(ct[2 * j], ct[2 * j + 1]), B: toPoint(ct[8 + 2 * j], ct[8 + 2 * j + 1]) }));
    return { seq, nf: BigInt(l.args.nf), C, count: Number(l.args.count) };
  });
  assert.equal(P.replay(firstPollEvents).chain, await polls.ballotChain(pollId));
});

test("close, tally, result checks, challenge period, finalize; unpublished poll marked withheld", async () => {
  await increase(48 * 3600 + 120);
  const { counted, distinct } = P.replay(firstPollEvents);
  const agg = P.aggregate(counted, 4);
  const partials = keys.shares.map((sh) => ({ index: sh.index, parts: P.partialDecrypt(sh, keys.publicShares[sh.index - 1].PK, agg, BigInt(pollId)) }));
  const counts = P.combine(agg, partials, 3, distinct);
  assert.deepEqual(counts, [1n, 2n, 1n, 0n]); // final choices: 0, 1, 1, 2 (member 4 re-voted)

  const chain = await polls.ballotChain(pollId);
  const R = (c) => ({ counts: c, finalBallotChain: chain, transcriptHash: ethers.ZeroHash, archiveHash: ethers.ZeroHash, publishedAt: 0 });
  await reverts(polls.publish.staticCall(pollId, R([1n, 2n, 2n, 0n])), polls, "CountsMismatch");
  await reverts(polls.publish.staticCall(pollId, { ...R(counts), finalBallotChain: ethers.ZeroHash }), polls, "ChainMismatch");
  gas.publish = await used(polls.publish(pollId, R(counts)));
  await reverts(polls.finalize.staticCall(pollId), polls, "ChallengePeriodRunning");
  await increase(7 * 24 * 3600 + 1);
  await used(polls.finalize(pollId));
  assert.equal((await polls.getPoll(pollId)).state, 3n);

  const unpublished = pollId + 1n;
  await increase(14 * 24 * 3600);
  await used(polls.markWithheld(unpublished));
  assert.equal((await polls.getPoll(unpublished)).state, 4n);
});

test.after(() => {
  console.log("Gas used:", Object.fromEntries(Object.entries(gas).map(([k, v]) => [k, v.toString()])));
});
