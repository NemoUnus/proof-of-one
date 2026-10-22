// SPDX-License-Identifier: Apache-2.0
// Proof of One — reference simulation of enrolment: the enclave's credential
// issuance (after its uniqueness checks), the phone's registration proof π_reg, and
// the IdentityRegistry / RevocationRegistry rules (credential nullifiers, minimum
// batch insertion, revocation on re-enrolment).
//
// WHAT IS SIMULATED, NOT IMPLEMENTED
// - Document reading, the document-validity proof, face matching and duplicate
//   search all happen BEFORE issue(): here the caller passes a `fingerprint` that
//   stands for "this person, as recognised by the enclave".
// - The enclave runs in an attested, isolated environment in the real design; here it
//   is an ordinary object.
// Reference code for review. Not audited.

"use strict";
const path = require("path");
const crypto = require("crypto");
const snarkjs = require("snarkjs");
const { buildEddsa } = require("circomlibjs");
const { IncrementalTree, RevocationTree } = require("../../ballot-circuit/src/trees");

const TAG = Object.freeze({ CREDENTIAL: 3n, COMMITMENT: 4n, CREDENTIAL_MSG: 5n, REVOCATION: 6n });
const KEY_DEPTH = 8;
const WASM = path.join(__dirname, "..", "build", "registration_js", "registration.wasm");
const RN_LIMIT = 1n << 252n;

let eddsa = null;
async function init() { if (!eddsa) eddsa = await buildEddsa(); return eddsa; }

// ------------------------------------------------------------------ the phone
// Creates the member's secrets. Only `cm` (a hiding commitment) is sent to the enclave.
function newMember(P, attrs) {
  const C = P.curve, H = P.hash.H;
  const s = C.randScalar(), salt = C.randScalar(), rho = C.randScalar();
  const [px, py] = C.coords(C.mul(C.G, s));
  const idc = H([px, py]);
  const cm = H([TAG.COMMITMENT, idc, salt, rho]);
  const cn = H([TAG.CREDENTIAL, rho]);
  return { s, salt, rho, idc, cm, cn, ...attrs };
}
function leafOf(P, m) {
  const H = P.hash.H;
  return H([m.idc, H([m.ageBand, m.natCode, m.sexCode, m.expiryMonth, m.salt]), m.rn]);
}

// ---------------------------------------------------------------- the enclave
// One signing key per epoch; the public keys form a small Merkle tree whose root is
// published (EnclaveKeyRegistry). Proofs show "signed by one of these keys" without
// revealing which, so the epoch stays hidden (red-team change C2).
function createEnclave(P, { epochs = 4 } = {}) {
  const H = P.hash.H;
  const F = eddsa.F;
  const keys = [];
  const keyTree = new IncrementalTree(H, KEY_DEPTH);
  for (let e = 0; e < epochs; e++) {
    const prv = crypto.randomBytes(32);
    const pub = eddsa.prv2pub(prv);
    const A = [F.toObject(pub[0]), F.toObject(pub[1])];
    keys.push({ epoch: BigInt(e), prv, A, index: keyTree.insert(H(A)) });
  }
  const kR = P.curve.randScalar();              // secret for revocation handles
  const enrolled = new Map();                   // fingerprint -> { generation, rn, revokeAfter }
  const issuedLog = [];                         // what the enclave sees: for unlinkability tests

  // rn = Poseidon(TAG, kR, fingerprint, generation), truncated below 2^252.
  const handle = (fp, g) => H([TAG.REVOCATION, kR, fp, g]) % RN_LIMIT;

  // Called only after the uniqueness checks pass. `reenrol` marks a lost-phone case:
  // the old handle is returned for publication in the revocation registry.
  function issue({ fingerprint, attrs, cm, epoch = 0, reenrol = false }) {
    const prev = enrolled.get(fingerprint);
    if (prev && !reenrol) throw new Error("already enrolled");
    const generation = prev ? prev.generation + 1n : 0n;
    const rn = handle(fingerprint, generation);
    const k = keys[epoch];
    const msg = H([TAG.CREDENTIAL_MSG, attrs.ageBand, attrs.natCode, attrs.sexCode, attrs.expiryMonth, cm, rn, k.epoch]);
    const sig = eddsa.signPoseidon(k.prv, F.e(msg));
    enrolled.set(fingerprint, { generation, rn });
    issuedLog.push({ cm, rn, attrs });
    return {
      credential: { rn, epoch: k.epoch, A: k.A, R8: [F.toObject(sig.R8[0]), F.toObject(sig.R8[1])], S: sig.S, keyIndex: k.index },
      revokeOld: prev ? prev.rn : null,
    };
  }
  return { issue, keyTree, get keySetRoot() { return keyTree.root; }, issuedLog };
}

// ------------------------------------------------------- the phone's π_reg input
function buildRegistration(P, enclave, member, credential) {
  const m = { ...member, rn: credential.rn };
  const leaf = leafOf(P, m);
  const kp = enclave.keyTree.path(credential.keyIndex);
  const input = {
    leaf: leaf.toString(), cn: m.cn.toString(), keySetRoot: enclave.keySetRoot.toString(),
    s: m.s.toString(), ageBand: String(m.ageBand), natCode: String(m.natCode), sexCode: String(m.sexCode),
    expiryMonth: String(m.expiryMonth), salt: m.salt.toString(), rho: m.rho.toString(), rn: m.rn.toString(),
    epoch: credential.epoch.toString(), Ax: credential.A[0].toString(), Ay: credential.A[1].toString(),
    R8x: credential.R8[0].toString(), R8y: credential.R8[1].toString(), S: credential.S.toString(),
    keySiblings: kp.siblings.map(String), keyPathIndex: kp.pathIndex.map(String),
  };
  return { input, leaf, member: m };
}
const prove = (input, zkey) => snarkjs.groth16.fullProve(input, WASM, zkey);

// ------------------------------------------- IdentityRegistry / RevocationRegistry
function createRegistry(P, { vkey, keySetRoot, minBatch = 3, depth = 32 }) {
  const H = P.hash.H;
  const ids = new IncrementalTree(H, depth);
  const revoked = new RevocationTree(H, depth);
  const usedCn = new Set();
  const pending = [];
  const positions = new Map(); // leaf -> index (public information once inserted)

  async function register({ leaf, cn, proof }) {
    if (usedCn.has(cn)) throw new Error("credential already used");
    const ok = await snarkjs.groth16.verify(vkey, [leaf, cn, keySetRoot].map(String), proof);
    if (!ok) throw new Error("registration proof rejected");
    usedCn.add(cn);
    pending.push(leaf);
  }
  // Leaves enter the tree only in batches of at least `minBatch` (C2: anonymity set).
  function insertBatch() {
    if (pending.length < minBatch) return 0;
    const n = pending.length;
    for (const leaf of pending.splice(0)) positions.set(leaf.toString(), ids.insert(leaf));
    return n;
  }
  return {
    register, insertBatch, revoke: (rn) => revoked.revoke(rn),
    get pendingCount() { return pending.length; },
    idTree: ids, revTree: revoked, indexOf: (leaf) => positions.get(leaf.toString()),
  };
}

module.exports = { TAG, KEY_DEPTH, WASM, init, newMember, leafOf, createEnclave, buildRegistration, prove, createRegistry };
