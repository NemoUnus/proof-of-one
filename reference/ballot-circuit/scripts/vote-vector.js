// SPDX-License-Identifier: Apache-2.0
// Test vector for the phone's ballot (Decision #61; native-prover src/ballot.rs): synthetic
// members, an identity tree that grew after the poll opened, revocations, and the inputs
// buildBallot makes for one member. The native prover's vote-check rebuilds the identity path
// at the poll's snapshot, the non-revocation witness and π_vote's inputs from the same data,
// as the app does, and must get exactly these; then it proves them with the witness graph.
// Usage: node scripts/vote-vector.js > vote-vector.json
"use strict";
const crypto = require("crypto");
const { create } = require("../../tally/src/protocol");
const A = require("../src/attrs");
const B = require("../src/ballot");
const { IncrementalTree, RevocationTree } = require("../src/trees");

(async () => {
  const P = await create();
  const C = P.curve, H = P.hash.H;
  const keys = P.dkg(3, 2);
  const handle = () => BigInt("0x" + crypto.randomBytes(31).toString("hex"));
  const mk = () => ({ s: C.randScalar(), birthDay: A.dayNumber(1980, 3, 21), natCode: 4805442, sexCode: 1, expiryMonth: 2027 * 12 + 7, salt: C.randScalar(), rn: handle() });
  const members = Array.from({ length: 9 }, mk);
  const leaves = members.map((m) => B.memberLeaf(P, m));
  // the poll opened when 8 leaves were in the tree; one more arrived afterwards
  const snapshot = new IncrementalTree(H, B.DEPTH); leaves.slice(0, 8).forEach((l) => snapshot.insert(l));
  const revoked = [handle(), members[3].rn, handle()];
  const rev = new RevocationTree(H, B.REV_DEPTH); revoked.forEach((x) => rev.revoke(x));
  const POLICY = { maxBirthDay: A.dayNumber(2008, 11, 24), minBirthDay: 0, minExpiryMonth: 2026 * 12 + 11, requiredNat: 0 };
  const pollId = 42n, ctxHash = 777n, openTime = 1795000000n, m = members[5], choice = 2;
  const { input, nf, C: Cs } = B.buildBallot(P, { pollId, PK: keys.PK, policy: POLICY, ctxHash, openTime, member: m, leafIndex: 5, idTree: snapshot, revTree: rev, choice, revision: 3 });
  const s = (x) => x.toString();
  const data = {
    member: { s: s(m.s), salt: s(m.salt) },
    attrs: { birthDay: s(m.birthDay), sexCode: s(m.sexCode), natCode: s(m.natCode), expMonth: s(m.expiryMonth) },
    credential: { rn: s(m.rn) },
    poll: { pollId: s(pollId), PK: C.coords(keys.PK).map(s), idRoot: s(snapshot.root), revRoot: s(rev.root), ctxHash: s(ctxHash), openTime: s(openTime),
      policy: { maxBirthDay: s(POLICY.maxBirthDay), minBirthDay: "0", minExpiryMonth: s(POLICY.minExpiryMonth), requiredNat: "0" } },
    choice, revision: 3,
  };
  const tree = { leaves: leaves.map(s), leaf: s(leaves[5]), idRoot: s(snapshot.root) };
  const revocation = { revoked: revoked.map(s), rn: s(m.rn), revRoot: s(rev.root) };
  const revokedMember = { revoked: revoked.map(s), rn: s(members[3].rn), revRoot: s(rev.root) };
  const late = { leaves: leaves.map(s), leaf: s(leaves[8]), idRoot: s(snapshot.root) };
  // the contract keeps the first 28 bytes of the ballot's Keccak-256 hash; the 4th ballot (revision 3)
  const recorded = { member: { s: s(m.s) }, poll: { pollId: s(pollId), PK: C.coords(keys.PK).map(s) }, count: 4, ballotHash: P.ballotHash(Cs).slice(2, 58) };
  process.stdout.write(JSON.stringify({ data, tree, revocation, revokedMember, late, recorded, input, nf: s(nf) }) + "\n");
  if (globalThis.curve_bn128) await globalThis.curve_bn128.terminate();
})().catch((e) => { console.error(e); process.exit(1); });
