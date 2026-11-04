// SPDX-License-Identifier: Apache-2.0
// Invitation tickets for sampled polls (docs/specs/cost-of-large-polls-v0.1.md §2,
// Decision Log #44; checked by the polls contract, ProofOfOnePolls.invited).
//
//   ticket  = Poseidon(13, nf, seed)       13 = domain tag SAMPLE; nf = Poseidon(1, pollId, s)
//   invited ⇔ (ticket >> 190) < threshold
//
// The ticket uses the poll's nullifier nf. Before a member votes, only the member can
// compute nf (it needs the identity secret s), so nobody else can tell who was invited.
// When the member votes, nf becomes public and anyone, including the contract, can check
// the invitation. The ballot proof therefore needs no change. seed is fixed after the
// poll's membership snapshot, so neither the member nor the poll creator can choose who
// is invited, provided the seed cannot be biased (see the contract's fixSeed).
"use strict";
const { buildPoseidon } = require("circomlibjs");

const TAG_SAMPLE = 13n;
const R = 21888242871839275222246405745257275088548364400416034343698204186575808495617n;
const TOP_RANGE = R >> 190n; // the top 64 bits of a field element lie in [0, TOP_RANGE]

let poseidon = null;
async function init() { if (!poseidon) poseidon = await buildPoseidon(); }
function ticket(nf, seed) {
  return poseidon.F.toObject(poseidon([TAG_SAMPLE, BigInt(nf), BigInt(seed)]));
}
const top64 = (t) => t >> 190n;
// Threshold for invitation rate p (0 < p < 1). An open poll has no threshold (0 in the contract).
function thresholdFor(p) {
  if (!(p > 0 && p < 1)) throw new Error("rate must be in (0, 1); an open poll uses threshold 0");
  const SCALE = 1_000_000_000n;
  return (TOP_RANGE * BigInt(Math.round(p * 1e9))) / SCALE;
}
const invited = (nf, seed, threshold) => threshold === 0n || top64(ticket(nf, seed)) < threshold;

module.exports = { TAG_SAMPLE, init, ticket, top64, thresholdFor, invited };
