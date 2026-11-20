// SPDX-License-Identifier: Apache-2.0
// The Solidity verifier of π_doc (suite 2) for the enrolment service, from the verifying key
// of the TEST-ONLY proving key that the app uses (snarkjs format, from native-prover's
// doc-vkey), with snarkjs's own Groth16 template:
//   node scripts/gen-doc-verifier.cjs keys/doc_s2_vkey.json ../contracts/src/DocVerifier.sol
// Needs ../document-circuit's node_modules (snarkjs, ejs).
"use strict";
const fs = require("fs");
const path = require("path");
const dc = path.join(__dirname, "..", "..", "document-circuit", "node_modules");
const ejs = require(path.join(dc, "ejs"));
const [vkFile, out] = process.argv.slice(2);
if (!vkFile || !out) { console.error("usage: gen-doc-verifier.cjs <vkey.json> <out.sol>"); process.exit(2); }
const vk = JSON.parse(fs.readFileSync(vkFile, "utf8"));
const tpl = fs.readFileSync(path.join(dc, "snarkjs", "templates", "verifier_groth16.sol.ejs"), "utf8");
const sol = ejs.render(tpl, vk).replace("contract Groth16Verifier {", "contract DocVerifier {");
if (!sol.includes("contract DocVerifier {")) throw new Error("template changed");
fs.writeFileSync(out, sol);
console.log(`wrote ${out}: ${vk.nPublic} public signals`);
