// SPDX-License-Identifier: Apache-2.0
// Builds the input of the tally proof π_tally (circuits/tally.circom) from what is public after a
// poll closes: the contract's encrypted totals, the trustee keys, and the trustees' published
// partial decryptions with their Chaum–Pedersen proofs (made with dleq: "poseidon").
// Anyone can run this; no secret is needed.
"use strict";

// P: an instance of tally/src/protocol.js created with { dleq: "poseidon" }.
// agg: [{A, B}] for K options; publicShares: [{PK}] of all n trustees (index i at i−1);
// partials: t entries {index, parts: [{D, proof: {T1, T2, z}}]} in increasing index order;
// counts: [K] BigInt.
function tallyInput(P, { pollId, agg, publicShares, partials, counts }) {
  if (P.dleqHash !== "poseidon") throw new Error("the tally proof needs DLEQ proofs with the Poseidon challenge");
  const C = P.curve, { coords, mul, L } = C;
  const s = (x) => x.toString();
  const pt = (q) => coords(q).map(s);
  const inv8 = P.modInv(8n);
  const root8 = (q) => pt(mul(q, inv8));   // R with 8·R = Q, for Q in the prime-order subgroup
  const S = partials.map((p) => p.index);
  const D = P.combinedD(partials, partials.length, agg.length);
  return {
    pollId: s(BigInt(pollId)),
    A: agg.map(({ A }) => pt(A)),
    B: agg.map(({ B }) => pt(B)),
    counts: counts.map(s),
    PK: partials.map((p) => pt(publicShares[p.index - 1].PK)),
    lambda: S.map((i) => s(P.lagrange0(i, S))),
    D: D.map(pt),
    Dij: partials.map((p) => p.parts.map((x) => pt(x.D))),
    T1: partials.map((p) => p.parts.map((x) => pt(x.proof.T1))),
    T2: partials.map((p) => p.parts.map((x) => pt(x.proof.T2))),
    z: partials.map((p) => p.parts.map((x) => s(x.proof.z))),
    Dr: partials.map((p) => p.parts.map((x) => root8(x.D))),
    T1r: partials.map((p) => p.parts.map((x) => root8(x.proof.T1))),
    T2r: partials.map((p) => p.parts.map((x) => root8(x.proof.T2))),
  };
}

// The public inputs in the order the verifier contract expects (circom: main's public signals
// in declaration order, arrays flattened row by row).
function publicSignals(inp) {
  return [inp.pollId, ...inp.A.flat(), ...inp.B.flat(), ...inp.counts, ...inp.PK.flat(), ...inp.lambda, ...inp.D.flat()];
}

module.exports = { tallyInput, publicSignals };
