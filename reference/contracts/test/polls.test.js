// SPDX-License-Identifier: Apache-2.0
// Full on-chain flow on an in-process EVM (ganache), with real proofs from the
// TEST-ONLY setups in ../ballot-circuit and ../enrolment-circuit:
//   enrol (π_reg) → batch insertion → poll snapshot → encrypted ballots (π_vote) →
//   re-vote → revocation after re-enrolment → tally → result proved and checked in full at publication.
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
const SM = require("../../ballot-circuit/src/sampling");
const RB = require("../../ballot-circuit/src/recovery");

const BALLOT_ZKEY = path.join(__dirname, "..", "..", "ballot-circuit", "setup", "ballot_test.zkey");
const REG_ZKEY = path.join(__dirname, "..", "..", "enrolment-circuit", "setup", "registration_test.zkey");
const BATCH_ZKEY = path.join(__dirname, "..", "..", "enrolment-circuit", "setup", "batch_test.zkey");
const REVOKE_ZKEY = path.join(__dirname, "..", "..", "enrolment-circuit", "setup", "revoke_test.zkey");
const RECOVERY_ZKEY = path.join(__dirname, "..", "..", "ballot-circuit", "setup", "recovery_test.zkey");
const Z2 = [0n, 0n], Z22 = [[0n, 0n], [0n, 0n]];
const art = (n) => JSON.parse(fs.readFileSync(path.join(__dirname, "..", "build", n + ".json"), "utf8"));
const A = require("../../ballot-circuit/src/attrs");
const ATTRS = { birthDay: A.dayNumber(1983, 9, 2), natCode: 250, sexCode: 1, expiryMonth: 24400 };
const POLICY = { ...A.ageRange([2026, 10, 23], { minAge: 18 }), minExpiryMonth: 24330, requiredNat: 0 };

let P, provider, signer, poseidon, identity, revocation, polls, enclave, keys, ballotVerifier, ballotBatchVerifier, gas = {};
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
// The contract's running sum equals the reference tally's aggregate of the counted ballots
function assertAgg(agg, onchain) {
  agg.forEach((a, j) => {
    assert.deepEqual(onchain[j].map(BigInt), pt(a.A).map(BigInt), `A_${j}`);
    assert.deepEqual(onchain[4 + j].map(BigInt), pt(a.B).map(BigInt), `B_${j}`);
  });
}

// --- the phone: enrol through the enclave, then register on-chain with π_reg
async function enrol({ fingerprint = fp(), reenrol = false } = {}) {
  const m = E.newMember(P, ATTRS);
  const { credential, revokeOld } = enclave.issue({ fingerprint, attrs: ATTRS, cm: m.cm, epoch: 2, reenrol });
  const { input, leaf, member } = E.buildRegistration(P, enclave, m, credential);
  const { proof } = await E.prove(input, REG_ZKEY);
  const p = sp(proof);
  const g = await used(identity.register(leaf, member.cn, p.a, p.b, p.c));
  gas.register = gas.register || g;
  return { member, leaf, fingerprint, revokeOld, link: credential.link, proof: p };
}

// --- the phone's local view of both registries, rebuilt from events only
async function syncTrees() {
  const H = P.hash.H;
  const inserted = Number(await identity.leafCount());
  const regs = (await identity.queryFilter(identity.filters.Registered())).sort((x, y) => Number(x.args.index - y.args.index));
  const ids = new IncrementalTree(H, B.DEPTH);
  regs.filter((e) => Number(e.args.index) < inserted).forEach((e) => ids.insert(e.args.leaf));
  const pending = regs.filter((e) => Number(e.args.index) >= inserted).map((e) => e.args.leaf);
  const rev = new RevocationTree(H, B.REV_DEPTH);
  for (const e of await revocation.queryFilter(revocation.filters.Revoked())) rev.revoke(e.args.rn);
  const index = new Map(regs.map((e) => [e.args.leaf.toString(), Number(e.args.index)]));
  return { ids, rev, index, pending };
}

// --- anyone: prove and submit the insertion of the next full batch
async function insertNextBatch() {
  const v = await syncTrees();
  const { input, newRoot } = E.buildBatchInsert(P, v.ids, v.pending.slice(0, 4));
  const { proof } = await E.proveBatch(input, BATCH_ZKEY);
  const p = sp(proof);
  return { tx: identity.insertBatch(newRoot, p.a, p.b, p.c), newRoot, p };
}

async function makeBallot(person, choice, id, view) {
  const m = { ...person.member, index: view.index.get(person.leaf.toString()) };
  const b = B.buildBallot(P, { pollId: BigInt(id), PK: keys.PK, policy: POLICY, ctxHash: await polls.contextHash(id), member: m, leafIndex: m.index, idTree: view.ids, revTree: view.rev, choice });
  const { proof } = await B.prove(b.input, BALLOT_ZKEY);
  return { ...b, sp: sp(proof) };
}
// The relay's (or phone's) record of each member's latest ballot, so that a re-vote can
// hand the replaced ballot to the contract, which subtracts it from the running sum.
const ZERO16 = Array(16).fill(0n);
const lastCt = new Map();
const key = (id, nf) => `${BigInt(id)}:${BigInt(nf)}`;
const prevOf = (id, nf) => lastCt.get(key(id, nf)) || ZERO16;
const send = async (b, id) => { const tx = await polls.vote(id, b.nf, ctArray(b.C), prevOf(id, b.nf), b.sp.a, b.sp.b, b.sp.c); lastCt.set(key(id, b.nf), ctArray(b.C)); return tx; };
const sendStatic = (b, id) => polls.vote.staticCall(id, b.nf, ctArray(b.C), prevOf(id, b.nf), b.sp.a, b.sp.b, b.sp.c);
const TALLY = path.join(__dirname, "..", "..", "tally-circuit");
const { tallyInput } = require(path.join(TALLY, "src", "input"));
const snarkjs = require("../../ballot-circuit/node_modules/snarkjs");
async function tallyProof(poll) {
  const { proof } = await snarkjs.groth16.fullProve(tallyInput(P, poll), path.join(TALLY, "build", "tally_js", "tally.wasm"), path.join(TALLY, "setup", "tally_test.zkey"));
  return sp(proof);
}
const trusteeKeys = () => keys.publicShares.map((s) => pt(s.PK));
const trusteeKeysHash = () => ethers.keccak256(ethers.AbiCoder.defaultAbiCoder().encode(["uint256[2][]"], [trusteeKeys()]));
const pollParams = async (over = {}) => {
  const t = await now();
  return { tallyPK: pt(keys.PK), maxBirthDay: POLICY.maxBirthDay, minBirthDay: POLICY.minBirthDay, minExpiryMonth: POLICY.minExpiryMonth, requiredNat: POLICY.requiredNat,
    maxRevotes: 3, openTime: t, closeTime: t + 48n * 3600n + 60n, metadataHash: ethers.ZeroHash,
    trusteeKeys: trusteeKeys(), threshold: 3, sampleThreshold: 0, ...over };
};

test.before(async () => {
  P = await create({ dleq: "poseidon" }); // trustees' DLEQ proofs as π_tally checks them
  await SM.init();
  await E.init();
  provider = new ethers.BrowserProvider(ganache.provider({ logging: { quiet: true }, chain: { chainId: 1337 }, miner: { blockGasLimit: 100_000_000 }, wallet: { deterministic: true } }));
  signer = await provider.getSigner(0);
  const deploy = async (abi, bytecode, ...args) => { const c = await new ethers.ContractFactory(abi, bytecode, signer).deploy(...args); await c.waitForDeployment(); return c; };
  poseidon = await deploy(poseidonContract.generateABI(2), poseidonContract.createCode(2));
  enclave = E.createEnclave(P, { epochs: 4 });
  const BBV = art("BallotBatchVerifier"), RV = art("RegistrationVerifier"), BIV = art("BatchInsertVerifier"), RKV = art("RevokeVerifier"), BV = art("Groth16Verifier"), TV = art("TallyVerifier"), RCV = art("RecoveryVerifier"), IR = art("IdentityRegistry"), RR = art("RevocationRegistry"), PP = art("ProofOfOnePolls");
  const regVerifier = await deploy(RV.abi, RV.bytecode);
  const batchVerifier = await deploy(BIV.abi, BIV.bytecode);
  identity = await deploy(IR.abi, IR.bytecode, await poseidon.getAddress(), await regVerifier.getAddress(), await batchVerifier.getAddress(), 4, enclave.keySetRoot, await signer.getAddress());
  const revokeVerifier = await deploy(RKV.abi, RKV.bytecode);
  const emptyRevRoot = new RevocationTree(P.hash.H, B.REV_DEPTH).root;
  revocation = await deploy(RR.abi, RR.bytecode, await revokeVerifier.getAddress(), await signer.getAddress(), emptyRevRoot);
  ballotVerifier = await deploy(BV.abi, BV.bytecode);
  ballotBatchVerifier = await deploy(BBV.abi, BBV.bytecode);
  const p3 = await deploy(poseidonContract.generateABI(3), poseidonContract.createCode(3));
  const p5 = await deploy(poseidonContract.generateABI(5), poseidonContract.createCode(5));
  polls = await deploy(PP.abi, PP.bytecode, await ballotVerifier.getAddress(), await ballotBatchVerifier.getAddress(), await identity.getAddress(), await revocation.getAddress(),
    await p3.getAddress(), await p5.getAddress(), await (await deploy(TV.abi, TV.bytecode)).getAddress(), await (await deploy(RCV.abi, RCV.bytecode)).getAddress());
  keys = P.dkg(5, 3);
});
test.after(async () => { if (globalThis.curve_bn128) await globalThis.curve_bn128.terminate(); });

test("registration: valid π_reg accepted; reused credential rejected; incomplete batch refused", async () => {
  people.push(await enrol(), await enrol());
  await reverts(identity.insertBatch.staticCall(0n, Z2, Z22, Z2), identity, "BatchNotReady");
  const a = people[0];
  await reverts(identity.register.staticCall(a.leaf, a.member.cn, a.proof.a, a.proof.b, a.proof.c), identity, "CredentialUsed");
  people.push(await enrol(), await enrol());
  const ins = await insertNextBatch();
  await reverts(identity.insertBatch.staticCall(ins.newRoot + 1n, ins.p.a, ins.p.b, ins.p.c), identity, "InvalidProof");
  gas.insertBatch4 = await used(ins.tx);
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
  // Trustee keys: valid points, at most 32, threshold 1..n, and the first t combine to the tally key
  const swapped = trusteeKeys(); [swapped[0], swapped[3]] = [swapped[3], swapped[0]];
  await reverts(polls.createPoll.staticCall(await pollParams({ trusteeKeys: swapped })), polls, "BadTrustees");
  const offCurve = trusteeKeys(); offCurve[4] = [offCurve[4][0], offCurve[4][1] + 1n];
  await reverts(polls.createPoll.staticCall(await pollParams({ trusteeKeys: offCurve })), polls, "BadTrustees");
  await reverts(polls.createPoll.staticCall(await pollParams({ threshold: 0 })), polls, "BadTrustees");
  await reverts(polls.createPoll.staticCall(await pollParams({ threshold: 6 })), polls, "BadTrustees");
  gas.createPoll = await used(polls.createPoll(await pollParams()));
  pollId = await polls.pollCount();
  const poll = await polls.getPoll(pollId);
  assert.equal(poll.idRoot, await identity.root());
  assert.equal(poll.revRoot, await revocation.root());
  assert.equal(poll.eligible, 4n);
  const expected = B.pollHashOf(P, { idRoot: poll.idRoot, revRoot: poll.revRoot, pollId, PK: keys.PK, policy: POLICY, ctxHash: await polls.contextHash(pollId) });
  assert.equal(poll.pollHash, expected, "on-chain pollHash equals the phone's");
});

test("ballots with valid proofs are accepted; a re-vote replaces the earlier ballot", async () => {
  const v = await syncTrees();
  const choices = [0, 1, 1, 3];
  for (let i = 0; i < 4; i++) {
    const g = await used(send(await makeBallot(people[i], choices[i], pollId, v), pollId));
    if (i === 0) gas.voteFirst = g;   // first ballot of the poll (counters written from zero)
    if (i === 1) gas.voteTypical = g; // first ballot of a voter, poll already active
  }
  gas.voteRevote = await used(send(await makeBallot(people[3], 2, pollId, v), pollId));
  assert.equal(await polls.distinctVoters(pollId), 4n);
});

test("forged or replayed ballots are rejected", async () => {
  const v = await syncTrees();
  const a = await makeBallot(people[0], 1, pollId, v), b = await makeBallot(people[0], 2, pollId, v);
  await reverts(polls.vote.staticCall(pollId, a.nf, ctArray(b.C), prevOf(pollId, a.nf), a.sp.a, a.sp.b, a.sp.c), polls, "InvalidProof");
  await used(polls.createPoll(await pollParams()));
  const other = await polls.pollCount();
  await reverts(sendStatic(a, other), polls, "InvalidProof");
});

test("re-enrolment: the old identity is revoked on-chain; it cannot vote in later polls, nor any longer in polls already open", async () => {
  const alice = people[0];
  // Ballots for the open poll, proven against the revocation root before the revocation:
  // one by another member (sent during the revocation), one by the identity being revoked.
  const v0 = await syncTrees();
  const other = await makeBallot(people[2], 1, pollId, v0);   // same answer as before: totals unchanged
  const stale = await makeBallot(alice, 0, pollId, v0);
  const alice2 = await enrol({ fingerprint: alice.fingerprint, reenrol: true });
  assert.equal(alice2.revokeOld, alice.member.rn);

  const before = await syncTrees();
  const { input, newRoot } = E.buildRevoke(P, before.rev, alice2.revokeOld);
  const rp = sp((await E.proveRevoke(input, REVOKE_ZKEY)).proof);
  await reverts(revocation.revoke.staticCall(alice2.revokeOld, 1, newRoot + 1n, rp.a, rp.b, rp.c), revocation, "InvalidProof");
  gas.revoke = await used(revocation.revoke(alice2.revokeOld, 1, newRoot, rp.a, rp.b, rp.c));
  assert.equal(await revocation.revokedCount(), 1n);

  // In the poll already open (Decision Log #52): a proof against the previous root is still
  // accepted for REVOCATION_GRACE, so ballots in flight are not lost...
  gas.voteNewRevRoot = await used(send(other, pollId));
  // ...but not after it, and the revoked identity cannot prove against the new root at all.
  await increase(11 * 60);
  await reverts(sendStatic(stale, pollId), polls, "InvalidProof");
  await assert.rejects(makeBallot(alice, 0, pollId, { ...v0, rev: (await syncTrees()).rev }), /revoked/);

  people.push(alice2, await enrol(), await enrol(), await enrol());
  await used((await insertNextBatch()).tx);
  await used(polls.createPoll(await pollParams()));
  const later = await polls.pollCount();
  assert.equal((await polls.getPoll(later)).eligible, 7n); // 8 leaves − 1 revoked

  const v = await syncTrees();
  assert.equal(v.rev.root, await revocation.root());
  await assert.rejects(makeBallot(alice, 0, later, v), /revoked/);
  await used(send(await makeBallot(alice2, 0, later, v), later));
  await used(send(await makeBallot(people[1], 1, later, v), later));
  assert.equal(await polls.distinctVoters(later), 2n);
});

test("recovery ballot: the recovered member replaces the old identity's ballot in the poll still open", async () => {
  // Decision Log #52, point 2. Alice (people[0]) re-enrolled in the test above: her old identity
  // is revoked and her new one, people[4], is linked to it through its revocation handle. Whoever
  // holds her old phone voted 0 in the first poll. With a backup of her old secret, Alice
  // replaces that ballot with her own answer, 3.
  const alice = people[0], alice2 = people[4];
  assert.ok(alice2.link, "the enclave gave the member the link of the new handle");
  const v = await syncTrees();
  const poll = await polls.getPoll(pollId);
  const snap = new IncrementalTree(P.hash.H, B.DEPTH);
  for (let i = 0; i < Number(poll.eligible); i++) snap.insert(v.ids.leaves[i]);
  assert.equal(snap.root, poll.idRoot, "the poll's snapshot rebuilt from events");
  const args = { pollId: BigInt(pollId), PK: keys.PK, policy: POLICY, ctxHash: await polls.contextHash(pollId),
    oldMember: alice.member, oldIndex: v.index.get(alice.leaf.toString()), snapTree: snap,
    newMember: { ...alice2.member, link: alice2.link }, newIndex: v.index.get(alice2.leaf.toString()), curTree: v.ids, revTree: v.rev, choice: 3 };
  const rb = RB.buildRecovery(P, args);
  assert.equal(rb.nf, P.nullifier(BigInt(pollId), alice.member.s), "the recovery ballot carries the OLD nullifier");
  const { proof } = await RB.prove(rb.input, RECOVERY_ZKEY);
  const pr = sp(proof), ct = ctArray(rb.C);

  // a recovery ballot against another poll, or with a proof for other ciphertexts, is refused
  const other = await makeBallot(people[1], 0, pollId, v);
  await reverts(polls.recoveryVote.staticCall(pollId, rb.nf, ctArray(other.C), prevOf(pollId, rb.nf), pr.a, pr.b, pr.c), polls, "InvalidProof");
  await reverts(polls.recoveryVote.staticCall(pollId, other.nf, ct, prevOf(pollId, other.nf), pr.a, pr.b, pr.c), polls, "InvalidProof");
  // the replaced ballot must be the one recorded
  await reverts(polls.recoveryVote.staticCall(pollId, rb.nf, ct, ctArray(other.C), pr.a, pr.b, pr.c), polls, "BadPrevious");

  const before = await polls.distinctVoters(pollId);
  const rc = await (await polls.recoveryVote(pollId, rb.nf, ct, prevOf(pollId, rb.nf), pr.a, pr.b, pr.c)).wait();
  gas.recoveryVote = rc.gasUsed;
  lastCt.set(key(pollId, rb.nf), ct);
  assert.deepEqual(rc.logs.map((l) => polls.interface.parseLog(l).name), ["Ballot", "RecoveryBallot"]);
  assert.equal(await polls.recovered(pollId, rb.nf), true);
  assert.equal(await polls.distinctVoters(pollId), before, "a replacement, not a new voter");

  // Alice's new identity cannot be used as the old one by a thief: the old secret alone does
  // not give a linked identity (tested in ballot-circuit/test/recovery.test.js). And no one can
  // vote in this poll with the new identity directly: it is not in the poll's snapshot.
  await assert.rejects(makeBallot(alice2, 1, pollId, { ...v, ids: snap }), /./);
});

// --- batched submission (voteBatch): one transaction, n + 3 pairings for n proofs
// voteBatch requires strictly increasing nullifiers, so a relay sorts the batch first.
// The fifth argument lists the replaced ballots of the re-votes in the batch, in batch order.
const asBatch = (bs0, id) => {
  const bs = [...bs0].sort((x, y) => (BigInt(x.nf) < BigInt(y.nf) ? -1 : 1));
  return [bs.map((b) => b.nf), bs.map((b) => ctArray(b.C)), bs.map((b) => ({ a: b.sp.a, b: b.sp.b, c: b.sp.c })),
    bs.filter((b) => lastCt.has(key(id, b.nf))).map((b) => lastCt.get(key(id, b.nf)))];
};
const sendBatch = async (bs, id) => { const tx = await polls.voteBatch(id, ...asBatch(bs, id)); for (const b of bs) lastCt.set(key(id, b.nf), ctArray(b.C)); return tx; };
const intrinsic = (data) => { const b = ethers.getBytes(data); return 21000n + BigInt(b.reduce((g, x) => g + (x ? 16 : 4), 0)); };

test("batched ballots: accepted together, one bad proof rejects the batch, same chain and counts as single ballots", async () => {
  const voters = people.filter((x, i) => i !== 0); // the first identity was revoked
  assert.equal(voters.length, 7);
  await used(polls.createPoll(await pollParams()));
  const pb = await polls.pollCount();
  await used(polls.createPoll(await pollParams()));
  const pc = await polls.pollCount();
  const v = await syncTrees();
  const choices = [0, 1, 2, 3, 0, 1, 2];
  const bB = [], bC = [];
  for (let i = 0; i < 7; i++) bB.push(await makeBallot(voters[i], choices[i], pb, v));
  for (let i = 0; i < 7; i++) bC.push(await makeBallot(voters[i], choices[i], pc, v));

  // Cost of verifying one proof on its own (snarkjs verifier), without the transaction overhead
  const one = bB[0], pub = [(await polls.getPoll(pb)).pollHash, one.nf, ...ctArray(one.C)];
  const data = ballotVerifier.interface.encodeFunctionData("verifyProof", [one.sp.a, one.sp.b, one.sp.c, pub]);
  gas.verifySingle = (await ballotVerifier.verifyProof.estimateGas(one.sp.a, one.sp.b, one.sp.c, pub)) - intrinsic(data);
  assert.equal(await ballotVerifier.verifyProof(one.sp.a, one.sp.b, one.sp.c, pub), true);

  // Rejections: a swapped ciphertext, proofs in the wrong order, an empty batch, another poll
  const [nfs, cts, prs] = asBatch(bB.slice(0, 3), pb);
  await reverts(polls.voteBatch.staticCall(pb, nfs, [cts[0], cts[2], cts[1]], prs, []), polls, "InvalidProof");
  await reverts(polls.voteBatch.staticCall(pb, nfs, cts, [prs[1], prs[0], prs[2]], []), polls, "InvalidProof");
  await reverts(polls.voteBatch.staticCall(pb, [], [], [], []), polls, "BadBatch");
  await reverts(polls.voteBatch.staticCall(pc, nfs, cts, prs, []), polls, "InvalidProof");
  const forged = { ...prs[1], a: [prs[1].a[0], BigInt(prs[1].a[1]) + 1n] }; // not a curve point
  await reverts(polls.voteBatch.staticCall(pb, nfs, cts, [prs[0], forged, prs[2]], []), polls, "InvalidProof");

  // Gas for batches of 1, 2, 4 and 7 first ballots
  gas.batch1 = await used(sendBatch(bB.slice(0, 1), pb));
  gas.batch2 = await used(sendBatch(bB.slice(1, 3), pb));
  gas.batch4 = await used(sendBatch(bB.slice(3, 7), pb));
  gas.batch7 = await used(sendBatch(bC, pc));
  assert.equal(await polls.distinctVoters(pb), 7n);
  assert.equal(await polls.distinctVoters(pc), 7n);

  // The same nullifier twice in one batch is refused, as are nullifiers out of order, so a relay
  // cannot pick which of a member's answers counts; re-votes go in separate transactions
  const r1 = await makeBallot(voters[1], 3, pc, v), r2 = await makeBallot(voters[1], 0, pc, v);
  await reverts(polls.voteBatch.staticCall(pc, [r1.nf, r2.nf], [ctArray(r1.C), ctArray(r2.C)], [r1.sp, r2.sp].map((p) => ({ a: p.a, b: p.b, c: p.c })), []), polls, "BadBatch");
  const [snf, sct, spr] = asBatch(bB.slice(0, 2), pb);
  await reverts(polls.voteBatch.staticCall(pb, [snf[1], snf[0]], [sct[1], sct[0]], [spr[1], spr[0]], []), polls, "BadBatch");
  await used(sendBatch([r1], pc));
  await used(sendBatch([r2], pc));
  assert.equal((await polls.ballots(pc, r1.nf)).count, 3n);
  assert.equal(await polls.distinctVoters(pc), 7n);
  // A re-vote must hand over exactly the ballot it replaces
  const r3 = await makeBallot(voters[2], 3, pc, v);
  const [n3, c3, p3] = asBatch([r3], pc);
  await reverts(polls.voteBatch.staticCall(pc, n3, c3, p3, []), polls, "BadPrevious");
  await reverts(polls.voteBatch.staticCall(pc, n3, c3, p3, [ctArray(r1.C)]), polls, "BadPrevious");
  await reverts(polls.voteBatch.staticCall(pc, ...asBatch([await makeBallot(voters[1], 1, pc, v)], pc)), polls, "RevoteCapReached");

  // The chain and the counted ballots, rebuilt from events, match the contract and the choices
  const toPoint = (x, y) => [P.curve.F.e(x), P.curve.F.e(y)];
  const evs = (await polls.queryFilter(polls.filters.Ballot(pc))).map((l, seq) => {
    const ct = l.args.ciphertexts.map(BigInt);
    return { seq, nf: BigInt(l.args.nf), count: Number(l.args.count),
      C: [0, 1, 2, 3].map((j) => ({ A: toPoint(ct[2 * j], ct[2 * j + 1]), B: toPoint(ct[8 + 2 * j], ct[8 + 2 * j + 1]) })) };
  });
  const rep = P.replay(evs);
  assert.equal(rep.chain, await polls.ballotChain(pc));
  const agg = P.aggregate(rep.counted, 4);
  assertAgg(agg, await polls.aggregate(pc)); // includes a voter who re-voted twice
  const partials = keys.shares.map((sh) => ({ index: sh.index, parts: P.partialDecrypt(sh, keys.publicShares[sh.index - 1].PK, agg, BigInt(pc)) }));
  assert.deepEqual(P.combine(agg, partials, 3, rep.distinct), [3n, 1n, 2n, 1n]); // voter 2 changed 1 → 3 → 0
});

test("sampled poll: seed fixed after the snapshot; only invited members can vote; the contract agrees with the phone", async () => {
  const voters = people.filter((x, i) => i !== 0);
  const th = SM.thresholdFor(0.5);
  const v = await syncTrees();
  let ps, ballots, inv, yes = [], no = [];
  // With 7 members and p = 0.5, a draw may invite all or none; draw a new poll then (rare)
  for (let attempt = 0; attempt < 6 && (yes.length === 0 || no.length === 0); attempt++) {
    await used(polls.createPoll(await pollParams({ sampleThreshold: th })));
    ps = await polls.pollCount();
    ballots = [];
    for (let i = 0; i < voters.length; i++) ballots.push(await makeBallot(voters[i], i % 4, ps, v));
    if (attempt === 0) {
      // No ballot before the seed is fixed; the seed comes from a block created after the poll
      await reverts(sendStatic(ballots[0], ps), polls, "SeedNotFixed");
      await reverts(polls.fixSeed.staticCall(ps), polls, "SeedTooEarly");
      await reverts(polls.fixSeed.staticCall(pollId), polls, "NotSampled");
    }
    for (let i = 0; i < 3; i++) await provider.send("evm_mine", []);
    gas.fixSeed = await used(polls.fixSeed(ps));
    await reverts(polls.fixSeed.staticCall(ps), polls, "BadState");
    const seed = (await polls.sampling(ps)).seed;
    // The phone's ticket and the contract's check agree for every member
    inv = ballots.map((b) => SM.invited(b.nf, seed, th));
    for (let i = 0; i < ballots.length; i++) assert.equal(await polls.invited(ps, ballots[i].nf), inv[i]);
    yes = ballots.filter((b, i) => inv[i]); no = ballots.filter((b, i) => !inv[i]);
  }
  assert.ok(yes.length > 0 && no.length > 0, `need both cases among ${ballots.length} members (invited ${yes.length})`);

  // Invited members vote, alone or in a batch; a member who was not invited cannot
  gas.voteSampled = await used(send(yes[0], ps));
  await reverts(sendStatic(no[0], ps), polls, "NotInvited");
  if (yes.length > 1) await used(sendBatch(yes.slice(1), ps));
  await reverts(polls.voteBatch.staticCall(ps, ...asBatch([no[0]], ps)), polls, "NotInvited");
  assert.equal(await polls.distinctVoters(ps), BigInt(yes.length));
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

test("close, tally; a result is final only with a valid tally proof; unpublished poll marked withheld", async () => {
  await increase(48 * 3600 + 120);
  const { counted, distinct } = P.replay(firstPollEvents);
  const agg = P.aggregate(counted, 4);
  assertAgg(agg, await polls.aggregate(pollId));
  const all = keys.shares.map((sh) => ({ index: sh.index, parts: P.partialDecrypt(sh, keys.publicShares[sh.index - 1].PK, agg, BigInt(pollId)) }));
  const partials = all.slice(0, 3); // trustees 1, 2, 3
  const counts = P.combine(agg, partials, 3, distinct);
  assert.deepEqual(counts, [0n, 2n, 1n, 1n]); // final choices: 3, 1, 1, 2 (member 4 re-voted; member 1 replaced by a recovery ballot)
  const D = P.combinedD(partials, 3, 4);

  const { mul, sub, G } = P.curve;
  const chain = await polls.ballotChain(pollId);
  const R = (c, d = D) => ({ counts: c, finalBallotChain: chain, transcriptHash: ethers.ZeroHash, archiveHash: ethers.ZeroHash, D: d.map(pt), publishedAt: 0 });
  const K_ = trusteeKeys(), T = [1, 2, 3];
  const t0 = Date.now();
  const proof = await tallyProof({ pollId, agg, publicShares: keys.publicShares, partials, counts });
  console.log(`π_tally proved in ${((Date.now() - t0) / 1000).toFixed(1)} s`);
  const pub = (r, tr = T, k = K_, pf = proof) => polls.publish.staticCall(pollId, r, tr, k, pf.a, pf.b, pf.c);

  // Checks made by the contract itself
  await reverts(pub(R([1n, 2n, 2n, 0n])), polls, "CountsMismatch");
  await reverts(pub({ ...R(counts), finalBallotChain: ethers.ZeroHash }), polls, "ChainMismatch");
  const wrongKeys = trusteeKeys(); wrongKeys[0] = wrongKeys[1];
  await reverts(pub(R(counts), T, wrongKeys), polls, "BadTrustees");
  await reverts(pub(R(counts), [1, 2]), polls, "BadPartials");     // fewer than t
  await reverts(pub(R(counts), [2, 1, 3]), polls, "BadPartials");  // not increasing
  await reverts(pub(R(counts), [1, 2, 6]), polls, "BadPartials");  // no such trustee

  // Results the proof does not support. A wrong split with the right sum and a matching
  // D'_j = B_j − c'_j·G (the forged-partial attack: no valid trustee proofs exist for it);
  // the right counts with another trustee set than the one proved; a proof for another poll.
  const fake = [2n, 1n, 1n, 0n];
  const Dfake = agg.map(({ B }, j) => sub(B, mul(G, fake[j])));
  await reverts(pub(R(fake, Dfake)), polls, "InvalidTallyProof");
  await reverts(pub(R(counts), [1, 2, 4]), polls, "InvalidTallyProof");
  const bad = { ...proof, a: [proof.a[0], proof.a[1] === "1" ? "2" : "1"] };
  await reverts(pub(R(counts), T, K_, bad), polls, "InvalidTallyProof");

  // The correct result passes and is final at once; it cannot be replaced.
  const rc = await (await polls.publish(pollId, R(counts), T, K_, proof.a, proof.b, proof.c)).wait();
  gas.publish = rc.gasUsed;
  assert.deepEqual(rc.logs.map((l) => polls.interface.parseLog(l).name), ["ResultPublished", "ResultFinal"]);
  assert.equal((await polls.getPoll(pollId)).state, 3n); // Final
  assert.deepEqual([...(await polls.getResult(pollId)).counts], counts);
  await reverts(pub(R(counts)), polls, "BadState");

  // A poll without ballots: every total is the identity, and so are the honest partials.
  const empty = pollId + 1n;
  assert.equal(await polls.distinctVoters(empty), 0n);
  const eAgg = Array.from({ length: 4 }, () => ({ A: P.curve.O, B: P.curve.O }));
  const eParts = keys.shares.slice(0, 3).map((sh) => ({ index: sh.index, parts: P.partialDecrypt(sh, keys.publicShares[sh.index - 1].PK, eAgg, empty) }));
  const eProof = await tallyProof({ pollId: empty, agg: eAgg, publicShares: keys.publicShares, partials: eParts, counts: [0n, 0n, 0n, 0n] });
  const eR = { counts: [0n, 0n, 0n, 0n], finalBallotChain: await polls.ballotChain(empty), transcriptHash: ethers.ZeroHash, archiveHash: ethers.ZeroHash,
    D: Array(4).fill(pt(P.curve.O)), publishedAt: 0 };
  gas.publishEmpty = await used(polls.publish(empty, eR, T, K_, eProof.a, eProof.b, eProof.c));
  assert.equal((await polls.getPoll(empty)).state, 3n);

  const unpublished = pollId + 2n;
  await increase(14 * 24 * 3600);
  await reverts(polls.publish.staticCall(unpublished, eR, T, K_, eProof.a, eProof.b, eProof.c), polls, "BadState"); // too late
  await used(polls.markWithheld(unpublished));
  assert.equal((await polls.getPoll(unpublished)).state, 4n);
});

test.after(() => {
  console.log("Gas used:", Object.fromEntries(Object.entries(gas).map(([k, v]) => [k, v.toString()])));
});
