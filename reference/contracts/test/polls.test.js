// SPDX-License-Identifier: Apache-2.0
// End-to-end contract tests on an in-process EVM (ganache): real Groth16 proofs from
// ../ballot-circuit (TEST-ONLY setup), real encrypted ballots, tally and result checks.
"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const ganache = require("ganache");
const { ethers } = require("ethers");
const { create } = require("../../tally/src/protocol");
const B = require("../../ballot-circuit/src/ballot");
const { IncrementalTree, RevocationTree } = require("../../ballot-circuit/src/trees");

const ZKEY = path.join(__dirname, "..", "..", "ballot-circuit", "setup", "ballot_test.zkey");
const art = (n) => JSON.parse(fs.readFileSync(path.join(__dirname, "..", "build", n + ".json"), "utf8"));
const POLICY = { minAgeBand: 2, minExpiryMonth: 24330, requiredNat: 0 };

let P, provider, signer, polls, keys, idTree, revTree, members, pollId, ctx, gas = {};

const handle = () => BigInt("0x" + crypto.randomBytes(31).toString("hex"));
const increase = async (s) => { await provider.send("evm_increaseTime", [s]); await provider.send("evm_mine", []); };
const now = async () => BigInt((await provider.getBlock("latest")).timestamp);
const pt = (X) => P.curve.coords(X);

function solidityProof(proof) {
  return {
    a: [proof.pi_a[0], proof.pi_a[1]],
    b: [[proof.pi_b[0][1], proof.pi_b[0][0]], [proof.pi_b[1][1], proof.pi_b[1][0]]],
    c: [proof.pi_c[0], proof.pi_c[1]],
  };
}
const ctArray = (C) => [...C.flatMap((c) => pt(c.A)), ...C.flatMap((c) => pt(c.B))];

async function makeBallot(m, choice, id = pollId) {
  const b = B.buildBallot(P, { pollId: BigInt(id), PK: keys.PK, policy: POLICY, ctxHash: ctx, member: m, leafIndex: m.index, idTree, revTree, choice });
  const { proof } = await B.prove(b.input, ZKEY);
  return { ...b, sp: solidityProof(proof) };
}
const send = (b, id = pollId) => polls.vote(id, b.nf, ctArray(b.C), b.sp.a, b.sp.b, b.sp.c);
const sendStatic = (b, id = pollId) => polls.vote.staticCall(id, b.nf, ctArray(b.C), b.sp.a, b.sp.b, b.sp.c);
// ganache does not return revert data from gas estimation, so failing calls are checked
// with staticCall and the custom error is decoded from the returned revert data.
async function reverts(call, name) {
  await assert.rejects(call, (e) => {
    const parsed = polls.interface.parseError(e.data);
    assert.equal(parsed && parsed.name, name);
    return true;
  });
}

test.before(async () => {
  P = await create();
  provider = new ethers.BrowserProvider(ganache.provider({ logging: { quiet: true }, chain: { chainId: 1337 }, wallet: { deterministic: true } }));
  signer = await provider.getSigner(0);
  const V = art("Groth16Verifier"), M = art("ProofOfOnePolls");
  const verifier = await new ethers.ContractFactory(V.abi, V.bytecode, signer).deploy();
  polls = await new ethers.ContractFactory(M.abi, M.bytecode, signer).deploy(await verifier.getAddress());

  keys = P.dkg(5, 3);
  idTree = new IncrementalTree(P.hash.H, B.DEPTH);
  revTree = new RevocationTree(P.hash.H, B.REV_DEPTH);
  const C = P.curve;
  members = Array.from({ length: 4 }, () => ({ s: C.randScalar(), ageBand: 3, natCode: 250, sexCode: 1, expiryMonth: 24400, salt: C.randScalar(), rn: handle() }));
  for (const m of members) m.index = idTree.insert(B.memberLeaf(P, m));
  revTree.revoke(handle());
});

const pollParams = async (over = {}) => {
  const t = await now();
  return {
    creator: ethers.ZeroAddress, idRoot: idTree.root, revRoot: revTree.root, eligible: 4n,
    tallyPK: pt(keys.PK), minAgeBand: POLICY.minAgeBand, minExpiryMonth: POLICY.minExpiryMonth, requiredNat: POLICY.requiredNat,
    maxRevotes: 3, openTime: t, closeTime: t + 48n * 3600n + 60n, metadataHash: ethers.ZeroHash, state: 0, ...over,
  };
};

test("createPoll rejects a tally key outside the prime-order subgroup", async () => {
  const p = 21888242871839275222246405745257275088548364400416034343698204186575808495617n;
  await reverts(polls.createPoll.staticCall(await pollParams({ tallyPK: [0n, p - 1n] })), "InvalidTallyKey"); // order-2 point
  await reverts(polls.createPoll.staticCall(await pollParams({ tallyPK: [1n, 2n] })), "InvalidTallyKey");   // not on the curve
});

test("createPoll accepts a valid key and enforces the 48-hour minimum", async () => {
  const bad = await pollParams();
  bad.closeTime = bad.openTime + 3600n;
  await reverts(polls.createPoll.staticCall(bad), "BadTimes");
  const tx = await polls.createPoll(await pollParams());
  gas.createPoll = (await tx.wait()).gasUsed;
  pollId = await polls.pollCount();
  ctx = await polls.contextHash(pollId);
});

test("valid ballots are accepted; a re-vote replaces the earlier ballot", async () => {
  const choices = [0, 1, 1, 3];
  for (let i = 0; i < 4; i++) {
    const tx = await send(await makeBallot(members[i], choices[i]));
    const g = (await tx.wait()).gasUsed;
    if (i === 0) gas.voteFirst = g;
  }
  const re = await send(await makeBallot(members[3], 2)); // member 3 changes 3 → 2
  gas.voteRevote = (await re.wait()).gasUsed;
  assert.equal(await polls.distinctVoters(pollId), 4n);
  assert.equal(await polls.totalSubmissions(pollId), 5n);
});

test("a proof attached to different ciphertexts is rejected", async () => {
  const a = await makeBallot(members[0], 1), b = await makeBallot(members[0], 2);
  await reverts(polls.vote.staticCall(pollId, a.nf, ctArray(b.C), a.sp.a, a.sp.b, a.sp.c), "InvalidProof");
});

test("a proof cannot be replayed in another poll", async () => {
  const tx = await polls.createPoll(await pollParams());
  await tx.wait();
  const other = await polls.pollCount();
  const b = await makeBallot(members[0], 0); // made for pollId (context and nullifier bound to it)
  await reverts(sendStatic(b, other), "InvalidProof");
});

test("re-vote cap is enforced", async () => {
  await send(await makeBallot(members[1], 0));
  await send(await makeBallot(members[1], 1)); // third submission for member 1 (cap = 3)
  await reverts(sendStatic(await makeBallot(members[1], 1)), "RevoteCapReached");
});

test("ballot chain on-chain equals the chain rebuilt by the reference tally from events", async () => {
  const logs = await polls.queryFilter(polls.filters.Ballot(pollId));
  const toPoint = (x, y) => [P.curve.F.e(x), P.curve.F.e(y)];
  const events = logs.map((l, seq) => {
    const ct = l.args.ciphertexts.map(BigInt);
    const C = [0, 1, 2, 3].map((j) => ({ A: toPoint(ct[2 * j], ct[2 * j + 1]), B: toPoint(ct[8 + 2 * j], ct[8 + 2 * j + 1]) }));
    return { seq, nf: BigInt(l.args.nf), C, count: Number(l.args.count) };
  });
  const { chain } = P.replay(events);
  assert.equal(chain, await polls.ballotChain(pollId));
  this_events = events;
});
let this_events;

test("no voting after close; result checks; challenge period; finalize", async () => {
  await increase(48 * 3600 + 120);
  await reverts(sendStatic(await makeBallot(members[0], 0)), "PollNotOpen");

  const { counted, distinct } = P.replay(this_events);
  const agg = P.aggregate(counted, 4);
  const partials = keys.shares.map((sh) => ({ index: sh.index, parts: P.partialDecrypt(sh, keys.publicShares[sh.index - 1].PK, agg, BigInt(pollId)) }));
  const counts = P.combine(agg, partials, 3, distinct);
  assert.deepEqual(counts, [1n, 2n, 1n, 0n]); // final choices: m0→0, m1→1 (after two re-votes), m2→1, m3→2

  const chain = await polls.ballotChain(pollId);
  const R = (c) => ({ counts: c, finalBallotChain: chain, transcriptHash: ethers.ZeroHash, archiveHash: ethers.ZeroHash, publishedAt: 0 });
  await reverts(polls.publish.staticCall(pollId, R([1n, 2n, 2n, 0n])), "CountsMismatch");
  await reverts(polls.publish.staticCall(pollId, { ...R(counts), finalBallotChain: ethers.ZeroHash }), "ChainMismatch");
  const tx = await polls.publish(pollId, R(counts));
  gas.publish = (await tx.wait()).gasUsed;
  await reverts(polls.finalize.staticCall(pollId), "ChallengePeriodRunning");
  await increase(7 * 24 * 3600 + 1);
  await polls.finalize(pollId);
  assert.equal((await polls.getPoll(pollId)).state, 3n); // Final
});

test("an unpublished poll can be marked withheld after the deadline", async () => {
  const other = await polls.pollCount(); // the second poll, never published
  await reverts(polls.markWithheld.staticCall(other), "DeadlineNotReached");
  await increase(14 * 24 * 3600);
  await polls.markWithheld(other);
  assert.equal((await polls.getPoll(other)).state, 4n);
});

test.after(() => {
  console.log("Gas used:", Object.fromEntries(Object.entries(gas).map(([k, v]) => [k, v.toString()])));
});
