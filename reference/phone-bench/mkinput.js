// SPDX-License-Identifier: Apache-2.0
// Builds one valid ballot input (test data only) for the phone benchmark.
const { create } = require("../tally/src/protocol");
const B = require("../ballot-circuit/src/ballot");
const { IncrementalTree, RevocationTree } = require("../ballot-circuit/src/trees");
const crypto = require("crypto"), fs = require("fs");
(async () => {
  const P = await create(), C = P.curve;
  const keys = P.dkg(3, 2);
  const ids = new IncrementalTree(P.hash.H, B.DEPTH), rev = new RevocationTree(P.hash.H, B.REV_DEPTH);
  const h = () => BigInt("0x" + crypto.randomBytes(31).toString("hex"));
  const m = { s: C.randScalar(), ageBand: 3, sexCode: 1, docs: [{ nat: 250, expiry: 24400 }, { nat: 124, expiry: 24500 }], salt: C.randScalar(), rn: h() };
  for (let i = 0; i < 5; i++) ids.insert(h());
  m.index = ids.insert(B.memberLeaf(P, m));
  rev.revoke(h()); rev.revoke(h());
  const policy = { minAgeBand: 2, minExpiryMonth: 24330, requiredNat: 124 };
  const b = B.buildBallot(P, { pollId: 2026n, PK: keys.PK, policy, ctxHash: 99n, member: m, leafIndex: m.index, idTree: ids, revTree: rev, choice: 2 });
  fs.writeFileSync(__dirname + "/input.json", JSON.stringify(b.input));
  console.log("ok");
  process.exit(0);
})();
