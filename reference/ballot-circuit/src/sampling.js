// SPDX-License-Identifier: Apache-2.0
// Invitation tickets for sampled polls (circuits/sampling.circom). What runs here runs
// on the phone: only the member can compute their own ticket, because it depends on
// the identity secret s.
"use strict";
const { buildPoseidon } = require("circomlibjs");

const TAG_SAMPLE = 13n;
const R = 21888242871839275222246405745257275088548364400416034343698204186575808495617n;
const TOP_RANGE = R >> 190n; // the top 64 bits of a field element lie in [0, TOP_RANGE]

let poseidon = null;
async function init() { if (!poseidon) poseidon = await buildPoseidon(); }
function ticket(pollId, seed, s) {
  return poseidon.F.toObject(poseidon([TAG_SAMPLE, BigInt(pollId), BigInt(seed), BigInt(s)]));
}
const top64 = (t) => t >> 190n;
// Threshold for invitation rate p (0 < p ≤ 1); p = 1 gives 2^64 (everyone is invited).
function thresholdFor(p) {
  if (!(p > 0 && p <= 1)) throw new Error("rate must be in (0, 1]");
  if (p === 1) return 1n << 64n;
  const SCALE = 1_000_000_000n;
  return (TOP_RANGE * BigInt(Math.round(p * 1e9))) / SCALE;
}
const invited = (pollId, seed, s, threshold) => top64(ticket(pollId, seed, s)) < threshold;

module.exports = { TAG_SAMPLE, init, ticket, top64, thresholdFor, invited };
