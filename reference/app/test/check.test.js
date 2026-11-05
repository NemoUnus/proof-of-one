// SPDX-License-Identifier: Apache-2.0
// Checks web/check.js against the reference implementation (tally/src/protocol.js).
"use strict";
const assert = require("assert");
const { ethers } = require("../../contracts/node_modules/ethers");
const { create } = require("../../tally/src/protocol");
const Chk = require("../web/check.js");

(async () => {
  const P = await create();
  const pt = (X) => P.curve.coords(X);
  const keys = P.dkg(3, 2);
  for (let t = 0; t < 4; t++) {
    const choice = t % 4;
    const enc = P.encryptBallot(keys.PK, 4, choice);
    const refHash = P.ballotHash(enc.C);                       // reference, full 32 bytes
    const ledger = refHash.slice(0, 2 + 56);                    // bytes28 as stored on-chain
    const receipt = { PK: pt(keys.PK).map(String), r: enc.r.map(String) };
    // same point arithmetic
    const mine = Chk.ciphertexts(pt(keys.PK), enc.r, choice);
    enc.C.forEach((c, j) => assert.deepStrictEqual(mine[j], [...pt(c.A), ...pt(c.B)]));
    // same hash and the right answer
    assert.strictEqual(Chk.ballotHash(ethers.keccak256, mine.flat()), refHash);
    assert.strictEqual(Chk.recordedAnswer(ethers.keccak256, receipt, ledger), choice);
    // a different ballot on the ledger is not recognised
    const other = P.ballotHash(P.encryptBallot(keys.PK, 4, choice).C).slice(0, 58);
    assert.strictEqual(Chk.recordedAnswer(ethers.keccak256, receipt, other), -1);
  }
  console.log("check.js: 4 receipts OK (points, hash, answer, foreign ballot rejected)");
  process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
