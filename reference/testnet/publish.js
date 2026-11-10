// SPDX-License-Identifier: Apache-2.0
// Proof of One — Phase 1a: prepare the "publish the result" transaction of a poll whose
// ballots were sent by anyone (poll 2), after it closes. SYNTHETIC IDENTITIES ONLY.
//
// Input: the plan (plan2.json), the PRIVATE file with the synthetic trustee shares, and what
// the contract shows after the close: aggregate(pollId) (the encrypted totals) and
// ballotChain(pollId). The testnet page prints both as one line of JSON to copy.
// Three of the five synthetic trustees decrypt the totals, each with a DLEQ proof; the
// contract checks every proof and that the totals match its own encrypted sums.
//
// Usage: node publish.js plan2.json poll2-secrets.json state.json > publish2.json
//   state.json: {"aggregate": [[x,y] × 8], "ballotChain": "0x…", "distinctVoters": "n"}
"use strict";
const fs = require("fs");
const path = require("path");
const { ethers } = require("../contracts/node_modules/ethers");
const { create } = require("../tally/src/protocol");

async function makePublish(plan, secrets, state) {
  if (plan.tally === "proof") return makePublishWithProof(plan, secrets, state);
  const P = await create();
  const C = P.curve, pt = (X) => C.coords(X);
  const k = 4, pollId = BigInt(plan.pollId);
  if (BigInt(secrets.pollId) !== pollId) throw new Error("secrets are for another poll");
  // aggregate() returns A_0..A_3 then B_0..B_3 (the contract's ciphertext order).
  const pts = state.aggregate.map((p) => C.fromJSON(p.map(String)));   // checks curve and subgroup
  const agg = Array.from({ length: k }, (_, j) => ({ A: pts[j], B: pts[k + j] }));
  const shares = secrets.shares.slice(0, 3).map((s) => ({ index: s.index, x: BigInt(s.x) }));
  const pub = Object.fromEntries(secrets.publicShares.map((s) => [s.index, C.fromJSON(s.PK)]));
  const partials = shares.map((sh) => ({ index: sh.index, parts: P.partialDecrypt(sh, pub[sh.index], agg, pollId) }));
  const counts = P.combine(agg, partials, 3, Number(state.distinctVoters));
  if (counts.reduce((a, b) => a + b, 0n) !== BigInt(state.distinctVoters)) throw new Error("totals do not add up to the distinct voters");
  const D = P.combinedD(partials, 3, k);
  const toP = (q) => ({ index: q.index, D: q.parts.map((x) => pt(x.D)), T1: q.parts.map((x) => pt(x.proof.T1)), T2: q.parts.map((x) => pt(x.proof.T2)), z: q.parts.map((x) => x.proof.z) });
  const result = { counts, finalBallotChain: state.ballotChain, transcriptHash: ethers.ZeroHash, archiveHash: ethers.ZeroHash, D: D.map(pt), partialsHash: ethers.ZeroHash, publishedAt: 0 };
  const iface = new ethers.Interface(plan.abi.ProofOfOnePolls);
  const S = (v) => JSON.parse(JSON.stringify(v, (_, x) => (typeof x === "bigint" ? x.toString() : x)));
  return {
    title: `Proof of One — Phase 1a: publish the result of test poll ${pollId}`,
    warning: plan.warning, chainId: plan.chainId, deployer: plan.deployer, pollId: plan.pollId, contracts: plan.contracts,
    expectedCounts: counts.map(String), abi: plan.abi,
    txs: [
      { step: 1, kind: "call", name: `Publish the result of poll ${pollId}`, to: plan.contracts.ProofOfOnePolls,
        data: iface.encodeFunctionData("publish", [pollId, result, partials.map(toP)]), note: "waitUntilClosed", check: { type: "pollState", min: 2 } },
      { step: 2, kind: "call", name: "Finalize the result (after the 7-day challenge period)", to: plan.contracts.ProofOfOnePolls,
        data: iface.encodeFunctionData("finalize", [pollId]), note: "waitUntilFinal", check: { type: "pollState", min: 3 } },
    ].map(S),
  };
}

// Deployment 2 (plan3.json): the contract accepts a result only with the tally proof π_tally,
// and it is final at once. The trustees' DLEQ proofs use the Poseidon challenge; the proof is
// made here from the published partial decryptions (no secret is needed for that step).
async function makePublishWithProof(plan, secrets, state) {
  const snarkjs = require("../ballot-circuit/node_modules/snarkjs");
  const { tallyInput } = require("../tally-circuit/src/input");
  const P = await create({ dleq: "poseidon" });
  const C = P.curve, pt = (X) => C.coords(X);
  const k = 4, pollId = BigInt(plan.pollId);
  if (BigInt(secrets.pollId) !== pollId || secrets.dleq !== "poseidon") throw new Error("secrets are for another poll");
  const pts = state.aggregate.map((p) => C.fromJSON(p.map(String)));
  const agg = Array.from({ length: k }, (_, j) => ({ A: pts[j], B: pts[k + j] }));
  const shares = secrets.shares.slice(0, 3).map((s) => ({ index: s.index, x: BigInt(s.x) }));
  const publicShares = secrets.publicShares.map((s) => ({ index: s.index, PK: C.fromJSON(s.PK) }));
  const partials = shares.map((sh) => ({ index: sh.index, parts: P.partialDecrypt(sh, publicShares[sh.index - 1].PK, agg, pollId) }));
  const counts = P.combine(agg, partials, 3, Number(state.distinctVoters));
  const D = P.combinedD(partials, 3, k);
  const TALLY = path.join(__dirname, "..", "tally-circuit");
  const { proof } = await snarkjs.groth16.fullProve(tallyInput(P, { pollId, agg, publicShares, partials, counts }),
    path.join(TALLY, "build", "tally_js", "tally.wasm"), path.join(TALLY, "setup", "tally_test.zkey"));
  const a = [proof.pi_a[0], proof.pi_a[1]], b = [[proof.pi_b[0][1], proof.pi_b[0][0]], [proof.pi_b[1][1], proof.pi_b[1][0]]], c = [proof.pi_c[0], proof.pi_c[1]];
  const result = { counts, finalBallotChain: state.ballotChain, transcriptHash: ethers.ZeroHash, archiveHash: ethers.ZeroHash, D: D.map(pt), publishedAt: 0 };
  const keys = secrets.publicShares.map((s) => s.PK);
  const iface = new ethers.Interface(plan.abi.ProofOfOnePolls);
  const S = (v) => JSON.parse(JSON.stringify(v, (_, x) => (typeof x === "bigint" ? x.toString() : x)));
  if (globalThis.curve_bn128) await globalThis.curve_bn128.terminate();
  return {
    title: `Proof of One — Phase 1a: publish the result of test poll 3 (poll id ${pollId}), with the tally proof`,
    warning: plan.warning, chainId: plan.chainId, deployer: plan.deployer, pollId: plan.pollId, contracts: plan.contracts,
    expectedCounts: counts.map(String), abi: plan.abi,
    partials: S(partials.map((q) => ({ index: q.index, parts: q.parts.map((x) => ({ D: pt(x.D), T1: pt(x.proof.T1), T2: pt(x.proof.T2), z: x.proof.z })) }))),
    txs: [
      { step: 1, kind: "call", name: `Publish the result of poll ${pollId} with its tally proof (final at once)`, to: plan.contracts.ProofOfOnePolls,
        data: iface.encodeFunctionData("publish", [pollId, result, partials.map((q) => q.index), keys, a, b, c]), note: "waitUntilClosed", check: { type: "pollState", min: 3 } },
    ].map(S),
  };
}

if (require.main === module) {
  (async () => {
    const [p, s, st] = process.argv.slice(2).map((f) => JSON.parse(fs.readFileSync(path.resolve(f), "utf8")));
    process.stdout.write(JSON.stringify(await makePublish(p, s, st), null, 2) + "\n");
    process.exit(0);
  })().catch((e) => { console.error(e); process.exit(1); });
}
module.exports = { makePublish };
