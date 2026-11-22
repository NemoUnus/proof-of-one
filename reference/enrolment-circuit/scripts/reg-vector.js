// SPDX-License-Identifier: Apache-2.0
// Test vector for the phone's π_reg inputs (Decision #61): a synthetic member, credential and
// key set, with the inputs buildRegistration makes from them. The native prover's reg-check
// (reference/native-prover) rebuilds the inputs from the same data, as the app does from
// member.json, and must get exactly these; then it proves them with the witness graph.
// Usage: node scripts/reg-vector.js > reg-vector.json
"use strict";
const { create } = require("../../tally/src/protocol");
const E = require("../src/enrolment");
const A = require("../../ballot-circuit/src/attrs");

(async () => {
  const P = await create();
  await E.init();
  const enclave = E.createEnclave(P, { epochs: 2 });
  const attrs = { birthDay: A.dayNumber(1980, 3, 21), natCode: 4805442, sexCode: 1, expiryMonth: 2027 * 12 + 7 };
  const m = E.newMember(P, attrs);
  const { credential } = enclave.issue({ fingerprint: 12345n, attrs, cm: m.cm, epoch: 1 });
  const { input } = E.buildRegistration(P, enclave, m, credential);
  const kp = enclave.keyTree.path(credential.keyIndex);
  const s = (x) => x.toString();
  const data = {
    member: { s: s(m.s), salt: s(m.salt), rho: s(m.rho), idc: s(m.idc), cn: s(m.cn) },
    attrs: { birthDay: s(attrs.birthDay), sexCode: s(attrs.sexCode), natCode: s(attrs.natCode), expMonth: s(attrs.expiryMonth) },
    credential: { rn: s(credential.rn), epoch: s(credential.epoch), A: credential.A.map(s), R8: credential.R8.map(s), S: s(credential.S) },
    keySet: { root: s(enclave.keySetRoot), siblings: kp.siblings.map(s), pathIndex: kp.pathIndex.map(s) },
  };
  process.stdout.write(JSON.stringify({ data, input }, null, 1) + "\n");
  if (globalThis.curve_bn128) await globalThis.curve_bn128.terminate();
})().catch((e) => { console.error(e); process.exit(1); });
