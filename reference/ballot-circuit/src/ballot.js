// SPDX-License-Identifier: Apache-2.0
// Build, prove and verify the ballot proof π_vote (circuits/ballot.circom).
"use strict";
const path = require("path");
const snarkjs = require("snarkjs");
const A = require("./attrs");

const K = 4, DEPTH = 32, REV_DEPTH = 32;
const BUILD = path.join(__dirname, "..", "build");
const WASM = path.join(BUILD, "ballot_js", "ballot.wasm");

// Members' leaves, as the enclave-certified registration would create them.
function memberLeaf(P, m) {
  const { H } = P.hash, C = P.curve;
  const [px, py] = C.coords(C.mul(C.G, m.s));
  const idc = H([px, py]);
  const attr = A.attrHash(H, m, m.salt);
  return H([idc, attr, m.rn]);
}

// pollHash binds the nine per-poll values (computed once by the contract at poll creation).
// Decision #62: the identity root is a public input of its own (any root the registry has
// held), and the poll's opening time is bound instead.
function pollHashOf(P, { revRoot, pollId, PK, policy, ctxHash, openTime }) {
  const H = P.hash.H, [px, py] = P.curve.coords(PK);
  const h1 = H([revRoot, pollId, px, py, openTime].map(BigInt));
  const h2 = H([policy.maxBirthDay, policy.minBirthDay ?? 0, policy.minExpiryMonth, policy.requiredNat, ctxHash].map(BigInt));
  return H([7n, h1, h2]); // domain tag TAG.POLL
}

// Everything the phone needs to submit one ballot.
// `docIndex` (optional) chooses which of the member's documents is used for eligibility;
// by default the first one that satisfies the poll's policy.
// The ballot's random values come from the member's secret, the poll, a revision number and
// the choice (Decision #62; review of deployment 5, finding A2/F-01), so that a phone that
// restored the identity can open the recorded ballot without a stored receipt by trying each
// (revision, choice). The choice is part of the derivation so that two ballots with the same
// random values always have the same plaintext: they are then identical, and publishing both
// (two phones, a retry, a relay that misreports the count) reveals only that they are equal,
// never the answer. Without it, B - B' = (v - v')·G would reveal both answers.
function ballotRandomness(P, s, pollId, revision, choice, k = K) {
  const H = P.hash.H, L = P.curve.L;
  if (!Number.isInteger(choice) || choice < 0 || choice >= k) throw new Error("choice out of range");
  return Array.from({ length: k }, (_, j) => {
    const x = H([P.hash.TAG.BALLOT_RAND, BigInt(s), BigInt(pollId), BigInt(revision), BigInt(choice), BigInt(j)]) % L;
    if (x === 0n) throw new Error("zero ballot randomness");
    return x;
  });
}

function buildBallot(P, { pollId, PK, policy, ctxHash, openTime, member, leafIndex, idTree, revTree, choice, k = K, docIndex, revision }) {
  const C = P.curve;
  const di = docIndex ?? A.selectDoc(member, policy);
  if (di < 0 && docIndex === undefined) throw new Error(A.inAgeRange(member, policy) ? "no document satisfies this poll's policy" : "outside this poll's age range");
  const sl = A.slots(member);
  if (!Number.isInteger(choice) || choice < 0 || choice >= k) throw new Error("choice out of range");
  if (BigInt(member.notBefore ?? 0) > BigInt(openTime)) throw new Error("this identity was issued after the poll opened");
  const enc = revision === undefined ? P.encryptBallot(PK, k, choice) : (() => {
    const r = ballotRandomness(P, member.s, pollId, revision, choice, k);
    return { C: P.reencrypt(PK, k, choice, r), r };
  })();
  const nf = P.nullifier(pollId, member.s);
  const idp = idTree.path(leafIndex);
  const rev = revTree.nonMembership(member.rn);
  const pt = (X) => C.coords(X).map(String);
  const pollHash = pollHashOf(P, { revRoot: revTree.root, pollId, PK, policy, ctxHash, openTime });
  const input = {
    pollHash: pollHash.toString(), idRoot: idTree.root.toString(), openTime: String(openTime), revRoot: revTree.root.toString(), pollId: pollId.toString(), nf: nf.toString(),
    PK: pt(PK), maxBirthDay: String(policy.maxBirthDay), minBirthDay: String(policy.minBirthDay ?? 0), minExpiryMonth: String(policy.minExpiryMonth),
    requiredNat: String(policy.requiredNat), ctxHash: ctxHash.toString(),
    CA: enc.C.map((c) => pt(c.A)), CB: enc.C.map((c) => pt(c.B)),
    s: member.s.toString(), birthDay: String(member.birthDay), sexCode: String(member.sexCode),
    nat: sl.map((d) => d.nat.toString()), exp: sl.map((d) => d.expiry.toString()), docSel: sl.map((_, i) => (i === di ? "1" : "0")),
    notBefore: String(member.notBefore ?? 0), salt: member.salt.toString(), rn: member.rn.toString(),
    idSiblings: idp.siblings.map(String), idPathIndex: idp.pathIndex.map(String),
    lowValue: rev.lowValue.toString(), nextValue: rev.nextValue.toString(),
    revSiblings: rev.siblings.map(String), revPathIndex: rev.pathIndex.map(String),
    v: Array.from({ length: k }, (_, j) => (j === choice ? "1" : "0")),
    r: enc.r.map(String),
  };
  return { input, C: enc.C, r: enc.r, nf };
}

// The answer recorded for this member, from the contract's ballot hash alone: tries each
// revision below `count` (newest first) and each choice. Returns {choice, revision, C} or null
// (a ballot this secret did not make, for example a recovery ballot).
function recordedAnswer(P, { s, pollId, PK, count, ballotHash, k = K }) {
  const want = String(ballotHash).replace(/^0x/, "").slice(0, 56).toLowerCase();
  for (let rev = Number(count) - 1; rev >= 0; rev--)
    for (let c = 0; c < k; c++) {
      const C = P.reencrypt(PK, k, c, ballotRandomness(P, s, pollId, rev, c, k));
      if (P.ballotHash(C).slice(2, 58).toLowerCase() === want) return { choice: c, revision: rev, C };
    }
  return null;
}

async function prove(input, zkey) {
  return snarkjs.groth16.fullProve(input, WASM, zkey);
}

// The public inputs the verifier must use, in circuit declaration order: pollHash, nf,
// idRoot, then the ciphertexts. They are rebuilt from the poll's own parameters and the
// submitted ballot — never taken from the submitter — so a proof for one poll or ballot
// cannot be reused for another.
function publicSignals(P, { idRoot, revRoot, pollId, nf, PK, policy, ctxHash, openTime, C }) {
  const pt = (X) => P.curve.coords(X).map(String);
  const pollHash = pollHashOf(P, { revRoot, pollId, PK, policy, ctxHash, openTime });
  return [pollHash, nf, idRoot, ...C.flatMap((c) => pt(c.A)), ...C.flatMap((c) => pt(c.B))].map(String);
}

async function verify(vkey, signals, proof) {
  return snarkjs.groth16.verify(vkey, signals, proof);
}

module.exports = { K, DEPTH, REV_DEPTH, WASM, memberLeaf, pollHashOf, ballotRandomness, recordedAnswer, buildBallot, prove, publicSignals, verify };
