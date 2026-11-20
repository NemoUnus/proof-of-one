// SPDX-License-Identifier: Apache-2.0
// Time per call of the service core (WebAssembly): node scripts/bench-core.mjs [core.wasm]
// The Worker's budget is about 10 ms of processor time per request. TEST secrets.
import { readFileSync } from "node:fs";
import { makeCore, randomHex } from "../src/core.js";
const file = process.argv[2] || new URL("../src/core.wasm", import.meta.url);
const t0 = performance.now();
const core = makeCore(new WebAssembly.Module(readFileSync(file)));
const tInit = performance.now() - t0;
const secrets = { oprf: randomHex(64), credential: randomHex(64), revocation: randomHex(64) };
const pub = core.call("public", { secrets });
const time = (f) => { f(); const t = performance.now(); for (let i = 0; i < 30; i++) f(); return ((performance.now() - t) / 30).toFixed(2); };
console.log(`load ${tInit.toFixed(1)} ms`);
console.log(`public   ${time(() => core.call("public", { secrets }))} ms`);
console.log(`evaluate ${time(() => core.call("evaluate", { secrets, pB: pub.K, dB: pub.A, rand: randomHex(128) }))} ms`);
console.log(`sign     ${time(() => core.call("sign", { secrets, fp: "1", attrs: ["1", "1", "1", "1", "0", "0", "0", "0"], cm: "1", epoch: "0", rand: randomHex(64) }))} ms`);
for (const n of [2, 5, 11, 12]) console.log(`poseidon(${n}) ${time(() => core.call("poseidon", { inputs: Array.from({ length: n }, (_, i) => String(i + 1)) }))} ms`);
