// SPDX-License-Identifier: Apache-2.0
// Domain-separated hashing.
//
// SECURITY ASSUMPTIONS
// - Poseidon (BN254, circomlib parameters) behaves as a random oracle for the
//   Fiat–Shamir challenges and as a PRF for nullifiers.
// - Every use of Poseidon starts with a distinct domain tag, so outputs from one
//   context can never be replayed in another.
// - keccak256 is used only for the public ballot chain, matching the EVM contracts.

"use strict";
const { buildPoseidon } = require("circomlibjs");
const { keccak_256 } = require("@noble/hashes/sha3");

const TAG = Object.freeze({
  NULLIFIER: 1n, // nf = H(TAG, pollId, s)
  DLEQ: 2n, // Fiat–Shamir challenge of a Chaum–Pedersen proof
  // 3–8 are used by enrolment, the poll hash and service identifiers.
  DKG_CTX: 9n, // trustee key generation: session context
  DKG_PAD: 10n, // trustee key generation: share encryption pad
  DKG_DLEQ: 11n, // trustee key generation: complaint key proof
  DKG_GEN: 12n, // trustee key generation: second generator H
});

let poseidon = null;
async function init() {
  if (!poseidon) poseidon = await buildPoseidon();
  return { H, keccak, u256, TAG };
}

// Poseidon over field elements, returned as a BigInt in the BN254 scalar field.
function H(inputs) {
  if (inputs.length > 16) throw new Error("Poseidon arity > 16");
  return poseidon.F.toObject(poseidon(inputs.map(BigInt)));
}

// 32-byte big-endian encoding of an unsigned integer.
function u256(x) {
  let h = BigInt(x).toString(16);
  if (h.length > 64) throw new Error("value exceeds 256 bits");
  return Buffer.from(h.padStart(64, "0"), "hex");
}

function keccak(...parts) {
  return "0x" + Buffer.from(keccak_256(Buffer.concat(parts))).toString("hex");
}

module.exports = { init, TAG };
