// SPDX-License-Identifier: Apache-2.0
// Test vectors for the phone's fingerprint code (native-prover/src/fingerprint.rs): synthetic
// passports, fixed blinding scalars and a TEST-ONLY service key; for each, the π_doc
// fingerprint inputs the reference code gives.   node scripts/fp-vectors.js > vectors.json
"use strict";
const I = require("../src/icao");
const FPm = require("../src/fingerprint");
(async () => {
  const FP = await FPm.init();
  const S = (o) => JSON.parse(JSON.stringify(o, (_, v) => (typeof v === "bigint" ? v.toString() : v)));
  const people = [
    ["number path", { surname: "TESTER", given: "ALEX", number: "X12345678", personal: "1234567890<<<<", birth: "850704", sex: "M", expiry: "300101" }, 1],
    ["name path", { surname: "DOE", given: "JANE MARIA", number: "A00000001", birth: "011231", sex: "F", expiry: "290229" }, 2],
    ["other sex, old birth", { surname: "LONGSURNAMEWITHMANYLETTERS", given: "GIVENNAMES ARE LONG TOO", number: "Z99999999", personal: "<<<<<<<<<<<<<<", birth: "270101", sex: "<", expiry: "281231" }, 1],
  ];
  const out = [];
  let r = 1000000000000000000000000000001n;
  for (const [name, p, path] of people) {
    const dg1 = I.dg1Of(I.mrzTD3({ issuer: "UTO", nationality: "UTO", ...p }));
    const prep = FP.prepare(dg1, 2026, path);
    prep.person.r = r; prep.person.B = FP.blind(prep.person.x, r); r += 2n;
    prep.document.r = r; prep.document.B = FP.blind(prep.document.x, r); r += 2n;
    const k = 777777777777777777777777n + BigInt(out.length);
    const res = FP.complete(prep, FP.evaluate(k, prep.person.B).Z, FP.evaluate(k, prep.document.B).Z);
    out.push(S({ name, dg1: dg1.toString("hex"), path: String(path), pR: prep.person.r, dR: prep.document.r, k, input: res.input }));
  }
  process.stdout.write(JSON.stringify(out, null, 1) + "\n");
  process.exit(0);
})();
