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
function pollHashOf(P, { idRoot, revRoot, pollId, PK, policy, ctxHash }) {
  const H = P.hash.H, [px, py] = P.curve.coords(PK);
  const h1 = H([idRoot, revRoot, pollId, px, py].map(BigInt));
  const h2 = H([policy.maxBirthDay, policy.minBirthDay ?? 0, policy.minExpiryMonth, policy.requiredNat, ctxHash].map(BigInt));
  return H([7n, h1, h2]); // domain tag TAG.POLL
}

// Everything the phone needs to submit one ballot.
// `docIndex` (optional) chooses which of the member's documents is used for eligibility;
// by default the first one that satisfies the poll's policy.
function buildBallot(P, { pollId, PK, policy, ctxHash, member, leafIndex, idTree, revTree, choice, k = K, docIndex }) {
  const C = P.curve;
  const di = docIndex ?? A.selectDoc(member, policy);
  if (di < 0 && docIndex === undefined) throw new Error(A.inAgeRange(member, policy) ? "no document satisfies this poll's policy" : "outside this poll's age range");
  const sl = A.slots(member);
  const enc = P.encryptBallot(PK, k, choice);
  const nf = P.nullifier(pollId, member.s);
  const idp = idTree.path(leafIndex);
  const rev = revTree.nonMembership(member.rn);
  const pt = (X) => C.coords(X).map(String);
  const pollHash = pollHashOf(P, { idRoot: idTree.root, revRoot: revTree.root, pollId, PK, policy, ctxHash });
  const input = {
    pollHash: pollHash.toString(), idRoot: idTree.root.toString(), revRoot: revTree.root.toString(), pollId: pollId.toString(), nf: nf.toString(),
    PK: pt(PK), maxBirthDay: String(policy.maxBirthDay), minBirthDay: String(policy.minBirthDay ?? 0), minExpiryMonth: String(policy.minExpiryMonth),
    requiredNat: String(policy.requiredNat), ctxHash: ctxHash.toString(),
    CA: enc.C.map((c) => pt(c.A)), CB: enc.C.map((c) => pt(c.B)),
    s: member.s.toString(), birthDay: String(member.birthDay), sexCode: String(member.sexCode),
    nat: sl.map((d) => d.nat.toString()), exp: sl.map((d) => d.expiry.toString()), docSel: sl.map((_, i) => (i === di ? "1" : "0")),
    salt: member.salt.toString(), rn: member.rn.toString(),
    idSiblings: idp.siblings.map(String), idPathIndex: idp.pathIndex.map(String),
    lowValue: rev.lowValue.toString(), nextValue: rev.nextValue.toString(),
    revSiblings: rev.siblings.map(String), revPathIndex: rev.pathIndex.map(String),
    v: Array.from({ length: k }, (_, j) => (j === choice ? "1" : "0")),
    r: enc.r.map(String),
  };
  return { input, C: enc.C, r: enc.r, nf };
}

async function prove(input, zkey) {
  return snarkjs.groth16.fullProve(input, WASM, zkey);
}

// The public inputs the verifier must use, in circuit declaration order: pollHash, nf,
// then the ciphertexts. They are rebuilt from the poll's own parameters and the
// submitted ballot — never taken from the submitter — so a proof for one poll or ballot
// cannot be reused for another.
function publicSignals(P, { idRoot, revRoot, pollId, nf, PK, policy, ctxHash, C }) {
  const pt = (X) => P.curve.coords(X).map(String);
  const pollHash = pollHashOf(P, { idRoot, revRoot, pollId, PK, policy, ctxHash });
  return [pollHash, nf, ...C.flatMap((c) => pt(c.A)), ...C.flatMap((c) => pt(c.B))].map(String);
}

async function verify(vkey, signals, proof) {
  return snarkjs.groth16.verify(vkey, signals, proof);
}

module.exports = { K, DEPTH, REV_DEPTH, WASM, memberLeaf, pollHashOf, buildBallot, prove, publicSignals, verify };
