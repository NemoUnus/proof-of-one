// SPDX-License-Identifier: Apache-2.0
// JSON (de)serialisation of a public poll transcript. Every point read back is
// validated (on curve and in the prime-order subgroup) by curve.fromJSON.
"use strict";

function toJSON(P, tr) {
  const pt = P.curve.toJSON;
  const ct = (Cs) => Cs.map(({ A, B }) => ({ A: pt(A), B: pt(B) }));
  return {
    format: "proof-of-one/tally-transcript/v0.1",
    pollId: tr.pollId.toString(), k: tr.k, t: tr.t, eligible: tr.eligible,
    publicShares: tr.publicShares.map((s) => ({ index: s.index, PK: pt(s.PK) })),
    events: tr.events.map((e) => ({ seq: e.seq, nf: e.nf.toString(), count: e.count, C: ct(e.C) })),
    result: {
      chain: tr.result.chain,
      counts: tr.result.counts.map(String),
      partials: tr.result.partials.map((p) => ({
        index: p.index,
        parts: p.parts.map(({ D, proof }) => ({ D: pt(D), proof: { T1: pt(proof.T1), T2: pt(proof.T2), z: proof.z.toString() } })),
      })),
    },
  };
}

function fromJSON(P, j) {
  if (j.format !== "proof-of-one/tally-transcript/v0.1") throw new Error("unknown transcript format");
  const pt = P.curve.fromJSON;
  const ct = (Cs) => Cs.map(({ A, B }) => ({ A: pt(A), B: pt(B) }));
  return {
    pollId: BigInt(j.pollId), k: j.k, t: j.t, eligible: j.eligible,
    publicShares: j.publicShares.map((s) => ({ index: s.index, PK: pt(s.PK) })),
    events: j.events.map((e) => ({ seq: e.seq, nf: BigInt(e.nf), count: e.count, C: ct(e.C) })),
    result: {
      chain: j.result.chain,
      counts: j.result.counts.map(BigInt),
      partials: j.result.partials.map((p) => ({
        index: p.index,
        parts: p.parts.map(({ D, proof }) => ({ D: pt(D), proof: { T1: pt(proof.T1), T2: pt(proof.T2), z: BigInt(proof.z) } })),
      })),
    },
  };
}

module.exports = { toJSON, fromJSON };
