// SPDX-License-Identifier: Apache-2.0
// Proof of One — Phase 1a: the result of a poll whose contract can no longer accept it,
// published off chain with everything needed to check it. SYNTHETIC IDENTITIES ONLY.
//
// Poll 3 (deployment 2) accepts a result only with a tally proof checked by deployment 2's
// TallyVerifier, whose TEST-ONLY proving key was lost (implementation note N37). The
// encrypted totals and the trustee shares are intact, so the result can still be computed
// and proved, only not recorded by that contract. This script:
//   1. decrypts the encrypted totals read from the contract (aggregate(pollId)) with three
//      of the five synthetic trustee shares, each partial decryption with its DLEQ proof;
//   2. makes the tally proof π_tally with the current, reproducible TEST-ONLY key
//      (tally-circuit/scripts/setup-test.sh) and checks it with its verification key.
// Anyone can check the result: recompute the proof's public inputs from the contract's
// aggregate, the poll's trustee keys and the published counts, and verify the proof with
// tally-circuit/setup/vkey_tally_test.json, or rebuild that key from the sources.
//
// Usage: node offchain-result.js plan3.json poll3-secrets.json state.json > result3-offchain.json
//   state.json: the closed-poll line of the testnet page: {"aggregate", "ballotChain", "distinctVoters"}
"use strict";
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { create } = require("../tally/src/protocol");

async function main() {
  const [plan, secrets, state] = process.argv.slice(2, 5).map((f) => JSON.parse(fs.readFileSync(path.resolve(f), "utf8")));
  const snarkjs = require("../ballot-circuit/node_modules/snarkjs");
  const { tallyInput } = require("../tally-circuit/src/input");
  const P = await create({ dleq: "poseidon" });
  const C = P.curve, pt = (X) => C.coords(X);
  const k = 4, pollId = BigInt(plan.pollId);
  if (BigInt(secrets.pollId) !== pollId || secrets.dleq !== "poseidon") throw new Error("secrets are for another poll");
  const pts = state.aggregate.map((p) => C.fromJSON(p.map(String)));        // checks curve and subgroup
  const agg = Array.from({ length: k }, (_, j) => ({ A: pts[j], B: pts[k + j] }));
  const shares = secrets.shares.slice(0, 3).map((s) => ({ index: s.index, x: BigInt(s.x) }));
  const publicShares = secrets.publicShares.map((s) => ({ index: s.index, PK: C.fromJSON(s.PK) }));
  const partials = shares.map((sh) => ({ index: sh.index, parts: P.partialDecrypt(sh, publicShares[sh.index - 1].PK, agg, pollId) }));
  const counts = P.combine(agg, partials, 3, Number(state.distinctVoters));
  if (counts.reduce((a, b) => a + b, 0n) !== BigInt(state.distinctVoters)) throw new Error("totals do not add up to the distinct voters");
  const TALLY = path.join(__dirname, "..", "tally-circuit");
  const vkeyFile = path.join(TALLY, "setup", "vkey_tally_test.json");
  const { proof, publicSignals } = await snarkjs.groth16.fullProve(tallyInput(P, { pollId, agg, publicShares, partials, counts }),
    path.join(TALLY, "build", "tally_js", "tally.wasm"), path.join(TALLY, "setup", "tally_test.zkey"));
  const vkey = JSON.parse(fs.readFileSync(vkeyFile, "utf8"));
  const verified = await snarkjs.groth16.verify(vkey, publicSignals, proof);
  if (!verified) throw new Error("the tally proof does not verify");
  const S = (v) => JSON.parse(JSON.stringify(v, (_, x) => (typeof x === "bigint" ? x.toString() : x)));
  if (globalThis.curve_bn128) await globalThis.curve_bn128.terminate();
  return S({
    title: `Proof of One — Phase 1a: result of test poll 3 (poll id ${pollId} of deployment 2), published off chain`,
    warning: "SYNTHETIC IDENTITIES ONLY. TEST-ONLY trusted setup. Not audited.",
    why: "Deployment 2's TallyVerifier cannot accept a result: its TEST-ONLY proving key was lost (implementation note N37). The proof below uses the current, reproducible TEST-ONLY key.",
    chainId: plan.chainId, polls: plan.contracts.ProofOfOnePolls, pollId: plan.pollId,
    counts, distinctVoters: state.distinctVoters, ballotChain: state.ballotChain, aggregate: state.aggregate,
    trustees: partials.map((q) => q.index), trusteeKeys: secrets.publicShares.map((s) => s.PK),
    partials: partials.map((q) => ({ index: q.index, parts: q.parts.map((x) => ({ D: pt(x.D), T1: pt(x.proof.T1), T2: pt(x.proof.T2), z: x.proof.z })) })),
    tallyProof: { proof, publicSignals, vkey: "reference/tally-circuit/setup/vkey_tally_test.json",
      vkeySha256: crypto.createHash("sha256").update(fs.readFileSync(vkeyFile)).digest("hex"), verified },
  });
}

main().then((r) => { process.stdout.write(JSON.stringify(r, null, 2) + "\n"); process.exit(0); })
  .catch((e) => { console.error(e); process.exit(1); });
