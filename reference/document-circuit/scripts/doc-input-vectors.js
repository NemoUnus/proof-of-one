// SPDX-License-Identifier: Apache-2.0
// Test vectors for the phone's π_doc input builder (reference/android-prototype, DocInput.kt):
// synthetic passports of both suites and several exponents. For each, writes the raw chip
// data as the phone reads it (<name>.chip, one "key=hex" per line) and the input this
// module builds (<name>.json, in DocInput's field order, without the DSC tree fields, which
// come from the public list or, in tests, from the native prover's test tree).
//   node scripts/doc-input-vectors.js <dir>
// Synthetic data only.
"use strict";
const fs = require("fs");
const path = require("path");
const D = require("../src/document");
const I = require("../src/icao");
const A = require("../../ballot-circuit/src/attrs");
const ORDER = ["today", "currentYear", "cm", "challenge", "dg1", "eContent", "eLen", "dg1Off", "dg2Off", "sa", "saLen", "mdOff",
  "signature", "modulus", "exponent", "rFace", "rsaQ", "rsaR", "pnTag", "dg13", "d13Len", "d13Off"];
(async () => {
  const { H } = await D.init();
  const dir = process.argv[2] || "vectors";
  fs.mkdirSync(dir, { recursive: true });
  const cases = [
    ["s1", { suite: 1 }, { birth: "790812", sex: "F", expiry: "310415" }],
    ["s2_e37817", { suite: 2 }, { birth: "021129", sex: "M", expiry: "290229" }],
    ["s2_e3", { suite: 2, e: 3 }, { birth: "550101", sex: "X", expiry: "270630" }],
    ["s2_e65537", { suite: 2, e: 65537 }, { birth: "991231", sex: "F", expiry: "300101" }],
    ["s2_dg13", { suite: 2 }, { birth: "880808", sex: "M", expiry: "330303" }, 0x5f07],
  ];
  for (const [name, opt, person, pnTag] of cases) {
    const c = I.createCountry("UTO", 1, opt);
    const { tree } = I.buildDscTree(H, D.IncrementalTree, D.DEPTH, [c]);
    const dg13 = pnTag ? I.nationalDg13({ personal: "0011223344", pnTag }) : null;
    const doc = I.issueDocument(c, person, { extraGroups: pnTag ? [12, 15] : [11, 12, 14, 15], dg13 });
    const input = D.buildInput(doc, { tree, leafIndex: 0, today: A.dayNumber(2026, 11, 16), currentYear: 2026, pnTag: pnTag ?? null });
    const S = I.SUITES[opt.suite];
    const hash = S.lds === "sha1" ? "SHA-1" : "SHA-256";
    const n = BigInt("0x" + doc.dscCert.publicKey.n.toString(16));
    fs.writeFileSync(path.join(dir, name + ".chip"), [
      "dg1=" + doc.dg1.toString("hex"), "eContent=" + doc.eContent.toString("hex"), "signedAttrs=" + doc.signedAttrs.toString("hex"),
      "signature=" + doc.signature.toString("hex"), "modulus=" + n.toString(16), "exponent=" + I.exponentOf(doc.dscCert).toString(16),
      "ldsHash=" + hash, "sigHash=" + hash, "sigOid=1.2.840.113549.1.1.1", "today=2026-11-16",
      ...(pnTag ? ["dg13=" + dg13.toString("hex"), "pnTag=" + pnTag] : []),
    ].join("\n") + "\n");
    const s = (v) => Array.isArray(v) ? "[" + v.map(s).join(",") + "]" : JSON.stringify(String(v));
    fs.writeFileSync(path.join(dir, name + ".json"), "{" + ORDER.map((k) => JSON.stringify(k) + ":" + s(input[k])).join(",") + "}");
    console.log("written", name);
  }
  process.exit(0);
})();
