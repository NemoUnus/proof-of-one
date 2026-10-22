// SPDX-License-Identifier: Apache-2.0
// What the PollAnswers contract does before accepting a ballot: rebuild the public
// inputs from the poll's own parameters, verify π_vote, then record the ballot.
"use strict";
const B = require("./ballot");

function createVerifiedPoll(P, { pollId, k = B.K, PK, policy, idRoot, revRoot, eligible, vkey, maxRevotes = 10 }) {
  if (!P.curve.isValidPoint(PK)) throw new Error("invalid tally key");
  const ledger = P.createLedger({ pollId, k, eligible, maxRevotes });
  async function submit({ nf, C, ctxHash, proof }) {
    if (C.length !== k) throw new Error("wrong ballot length");
    for (const { A, B: Bp } of C) if (!P.curve.isValidPoint(A) || !P.curve.isValidPoint(Bp)) throw new Error("invalid point");
    const signals = B.publicSignals(P, { idRoot, revRoot, pollId, nf, PK, policy, ctxHash, C });
    if (!(await B.verify(vkey, signals, proof))) throw new Error("ballot proof rejected");
    ledger.vote(nf, C);
  }
  return { ledger, submit };
}

module.exports = { createVerifiedPoll };
