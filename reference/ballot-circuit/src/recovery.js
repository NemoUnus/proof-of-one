// SPDX-License-Identifier: Apache-2.0
// Build, prove and verify the recovery-ballot proof π_recover (circuits/recovery.circom).
// Design: docs/specs/recovery-ballots-and-oprf-key-v0.1.md §1.5 (Decision Log #52, point 2).
"use strict";
const path = require("path");
const snarkjs = require("snarkjs");
const A = require("./attrs");
const B = require("./ballot");

const TAG_REPLACES = 14n;
const LIMIT = 1n << 252n;          // revocation handles must stay below 2^252
const BUILD = path.join(__dirname, "..", "build");
const WASM = path.join(BUILD, "recovery_js", "recovery.wasm");

// At recovery the enclave links the new identity to the old one through the new
// revocation handle: rn_new = Poseidon(14, rn_old, ρ), retrying ρ until rn_new < 2^252.
// ρ (`link`) goes to the member; rn_new goes into the signed credential as usual.
function recoveredHandle(P, rnOld, randScalar = P.curve.randScalar) {
  for (;;) {
    const link = randScalar();
    const rn = P.hash.H([TAG_REPLACES, BigInt(rnOld), link]);
    if (rn < LIMIT) return { rn, link };
  }
}

function attrOf(P, m) { return A.attrHash(P.hash.H, m, m.salt); }

// Everything the phone needs for one recovery ballot in poll X.
//   oldMember, oldIndex, snapTree: the old identity (from the backup) and X's membership snapshot
//   newMember, newIndex, curTree: the new identity (with `link`, ρ of the design) and the current identity tree
//   revTree: the current revocation tree (the old identity is in it; the new one must not be)
function buildRecovery(P, { pollId, PK, policy, ctxHash, oldMember, oldIndex, snapTree, newMember, newIndex, curTree, revTree, choice, k = B.K, docIndex }) {
  const C = P.curve;
  const di = docIndex ?? A.selectDoc(oldMember, policy);
  if (di < 0 && docIndex === undefined) throw new Error("the old identity is not eligible in this poll");
  const sl = A.slots(oldMember);
  const enc = P.encryptBallot(PK, k, choice);
  const nf = P.nullifier(pollId, oldMember.s);
  const op = snapTree.path(oldIndex), np = curTree.path(newIndex);
  const rev = revTree.nonMembership(newMember.rn);
  if (!rev) throw new Error("the new identity has been revoked");
  const pt = (X) => C.coords(X).map(String);
  const pollHash = B.pollHashOf(P, { idRoot: snapTree.root, revRoot: revTree.root, pollId, PK, policy, ctxHash });
  const input = {
    pollHash: pollHash.toString(), nf: nf.toString(), idRootNow: curTree.root.toString(),
    CA: enc.C.map((c) => pt(c.A)), CB: enc.C.map((c) => pt(c.B)),
    idRoot: snapTree.root.toString(), revRoot: revTree.root.toString(), pollId: pollId.toString(), PK: pt(PK),
    maxBirthDay: String(policy.maxBirthDay), minBirthDay: String(policy.minBirthDay ?? 0), minExpiryMonth: String(policy.minExpiryMonth),
    requiredNat: String(policy.requiredNat), ctxHash: ctxHash.toString(),
    sOld: oldMember.s.toString(), birthDay: String(oldMember.birthDay), sexCode: String(oldMember.sexCode),
    nat: sl.map((d) => d.nat.toString()), exp: sl.map((d) => d.expiry.toString()), docSel: sl.map((_, i) => (i === di ? "1" : "0")),
    salt: oldMember.salt.toString(), rnOld: oldMember.rn.toString(),
    idSiblings: op.siblings.map(String), idPathIndex: op.pathIndex.map(String),
    sNew: newMember.s.toString(), attrNew: attrOf(P, newMember).toString(), link: newMember.link.toString(),
    newSiblings: np.siblings.map(String), newPathIndex: np.pathIndex.map(String),
    lowValue: rev.lowValue.toString(), nextValue: rev.nextValue.toString(),
    revSiblings: rev.siblings.map(String), revPathIndex: rev.pathIndex.map(String),
    v: Array.from({ length: k }, (_, j) => (j === choice ? "1" : "0")),
    r: enc.r.map(String),
  };
  return { input, C: enc.C, r: enc.r, nf };
}

async function prove(input, zkey) { return snarkjs.groth16.fullProve(input, WASM, zkey); }

// Public inputs in declaration order: pollHash, nf, ciphertexts, idRootNow. Rebuilt from
// the poll, the current roots and the submitted ballot, never taken from the submitter.
function publicSignals(P, { idRoot, revRoot, idRootNow, pollId, nf, PK, policy, ctxHash, C }) {
  const pt = (X) => P.curve.coords(X).map(String);
  const pollHash = B.pollHashOf(P, { idRoot, revRoot, pollId, PK, policy, ctxHash });
  return [pollHash, nf, ...C.flatMap((c) => pt(c.A)), ...C.flatMap((c) => pt(c.B)), idRootNow].map(String);
}

async function verify(vkey, signals, proof) { return snarkjs.groth16.verify(vkey, signals, proof); }

module.exports = { TAG_REPLACES, WASM, recoveredHandle, buildRecovery, prove, publicSignals, verify };
