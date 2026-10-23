// SPDX-License-Identifier: Apache-2.0
// Run the compatible Noir ballot circuit on the same valid ballot as the phone benchmark,
// and on forged variants that must be rejected.
import { compile, createFileManager } from "@noir-lang/noir_wasm";
import { Noir } from "@noir-lang/noir_js";
import { readFileSync } from "fs";
const I = JSON.parse(readFileSync(new URL("../../phone-bench/input.json", import.meta.url)));
const b = (a) => a.map((x) => x === "1");
const inp = (o) => ({
  poll_hash: I.pollHash, nf: I.nf, ca: I.CA, cb: I.CB, id_root: I.idRoot, rev_root: I.revRoot, poll_id: I.pollId, pk: I.PK,
  max_bd: I.maxBirthDay, min_bd: I.minBirthDay, min_exp: I.minExpiryMonth, req_nat: I.requiredNat, ctx: I.ctxHash,
  s: I.s, birth: I.birthDay, sex: I.sexCode, nat: I.nat, exp: I.exp, sel: b(I.docSel), salt: I.salt, rn: I.rn,
  id_sib: I.idSiblings, id_idx: b(I.idPathIndex), low: I.lowValue, next: I.nextValue, rev_sib: I.revSiblings, rev_idx: b(I.revPathIndex),
  v: b(I.v), r: I.r, ...o });
const { program } = await compile(createFileManager(new URL("../circuits/ballot_compatible", import.meta.url).pathname));
const noir = new Noir(program);
const t = Date.now();
await noir.execute(inp({}));
console.log("valid ballot: witness OK in", Date.now() - t, "ms");
for (const [name, o] of [["two-hot", { v: [true, true, false, false] }], ["wrong nf", { nf: (BigInt(I.nf) + 1n).toString() }], ["other region", { req_nat: "840" }], ["changed pollHash", { poll_hash: (BigInt(I.pollHash) + 1n).toString() }]]) {
  try { await noir.execute(inp(o)); console.log(name, ": ACCEPTED (bad)"); } catch (e) { console.log(name, ": rejected"); }
}
process.exit(0);
