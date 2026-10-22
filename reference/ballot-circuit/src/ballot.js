// SPDX-License-Identifier: Apache-2.0
// Build, prove and verify the ballot proof π_vote (circuits/ballot.circom).
"use strict";
const path = require("path");
const snarkjs = require("snarkjs");

const K = 4, DEPTH = 32, REV_DEPTH = 32;
const BUILD = path.join(__dirname, "..", "build");
const WASM = path.join(BUILD, "ballot_js", "ballot.wasm");

// Members' leaves, as the enclave-certified registration would create them.
function memberLeaf(P, m) {
  const { H } = P.hash, C = P.curve;
  const [px, py] = C.coords(C.mul(C.G, m.s));
  const idc = H([px, py]);
  const attr = H([m.ageBand, m.natCode, m.sexCode, m.expiryMonth, m.salt]);
  return H([idc, attr, m.rn]);
}

// Everything the phone needs to submit one ballot.
function buildBallot(P, { pollId, PK, policy, ctxHash, member, leafIndex, idTree, revTree, choice, k = K }) {
  const C = P.curve;
  const enc = P.encryptBallot(PK, k, choice);
  const nf = P.nullifier(pollId, member.s);
  const idp = idTree.path(leafIndex);
  const rev = revTree.nonMembership(member.rn);
  const pt = (X) => C.coords(X).map(String);
  const input = {
    idRoot: idTree.root.toString(), revRoot: revTree.root.toString(), pollId: pollId.toString(), nf: nf.toString(),
    PK: pt(PK), minAgeBand: String(policy.minAgeBand), minExpiryMonth: String(policy.minExpiryMonth),
    requiredNat: String(policy.requiredNat), ctxHash: ctxHash.toString(),
    CA: enc.C.map((c) => pt(c.A)), CB: enc.C.map((c) => pt(c.B)),
    s: member.s.toString(), ageBand: String(member.ageBand), natCode: String(member.natCode), sexCode: String(member.sexCode),
    expiryMonth: String(member.expiryMonth), salt: member.salt.toString(), rn: member.rn.toString(),
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

// The public inputs the verifier must use, in circuit declaration order. They are
// rebuilt from the poll's own parameters and the submitted ballot — never taken from
// the submitter — so a proof for one poll or ballot cannot be reused for another.
function publicSignals(P, { idRoot, revRoot, pollId, nf, PK, policy, ctxHash, C }) {
  const pt = (X) => P.curve.coords(X).map(String);
  return [
    idRoot, revRoot, pollId, nf, ...pt(PK), policy.minAgeBand, policy.minExpiryMonth, policy.requiredNat, ctxHash,
    ...C.flatMap((c) => pt(c.A)), ...C.flatMap((c) => pt(c.B)),
  ].map(String);
}

async function verify(vkey, signals, proof) {
  return snarkjs.groth16.verify(vkey, signals, proof);
}

module.exports = { K, DEPTH, REV_DEPTH, WASM, memberLeaf, buildBallot, prove, publicSignals, verify };
