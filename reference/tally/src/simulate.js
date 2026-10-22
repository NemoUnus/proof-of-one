// SPDX-License-Identifier: Apache-2.0
// End-to-end simulation of one poll, used by the tests and the demo script.

"use strict";

async function runPoll(P, { pollId = 1001n, k = 4, voters = 60, n = 9, t = 6, revoters = 10, eligible = 1000, choices } = {}) {
  const C = P.curve;
  const keys = P.dkg(n, t);
  const ledger = P.createLedger({ pollId, k, eligible });
  const records = new Map();
  const truth = Array(k).fill(0n);

  // Each voter: identity secret s, nullifier, encrypted one-hot ballot.
  const people = Array.from({ length: voters }, (_, i) => ({ s: C.randScalar(), choice: choices ? choices[i] : i % k }));
  for (const v of people) {
    const nf = P.nullifier(pollId, v.s);
    const { C: Cs, r } = P.encryptBallot(keys.PK, k, v.choice);
    ledger.vote(nf, Cs);
    records.set(nf, { nf, choice: v.choice, r });
  }
  // Some voters change their mind; only their last ballot counts.
  for (let i = 0; i < Math.min(revoters, voters); i++) {
    const v = people[i];
    v.choice = (v.choice + 1) % k;
    const nf = P.nullifier(pollId, v.s);
    const { C: Cs, r } = P.encryptBallot(keys.PK, k, v.choice);
    ledger.vote(nf, Cs);
    records.set(nf, { nf, choice: v.choice, r });
  }
  for (const v of people) truth[v.choice]++;
  ledger.close();

  // Tally: anyone aggregates; trustees publish partial decryptions with proofs.
  const { counted } = P.replay(ledger.events);
  const agg = P.aggregate(counted, k);
  const partials = keys.shares.map((sh) => {
    const pub = keys.publicShares.find((p) => p.index === sh.index);
    return { index: sh.index, parts: P.partialDecrypt(sh, pub.PK, agg, pollId) };
  });
  const counts = P.combine(agg, partials, t, ledger.distinctVoters);
  const result = { chain: ledger.chain, counts, partials };

  const transcript = { pollId, k, t, eligible, publicShares: keys.publicShares, events: ledger.events, result };
  return { keys, ledger, records, truth, agg, result, transcript };
}

module.exports = { runPoll };
