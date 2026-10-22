// SPDX-License-Identifier: Apache-2.0
// Compile a circuit and print its UltraHonk size (no proving; needs no public parameters).
import { compile, createFileManager } from "@noir-lang/noir_wasm";
import * as bb from "@aztec/bb.js";
import { gunzipSync } from "zlib";
const dir = new URL("../circuits/" + (process.argv[2] || "ballot_compatible"), import.meta.url).pathname;
const t = Date.now();
const { program } = await compile(createFileManager(dir));
console.log("compiled in", Date.now() - t, "ms; ACIR opcodes:", program.bytecode.length, "b64 chars");
const api = await bb.Barretenberg.new({ skipSrsInit: true });
const bytecode = gunzipSync(Buffer.from(program.bytecode, "base64"));
const st = await api.circuitStats({ circuit: { name: "c", bytecode: new Uint8Array(bytecode), verificationKey: new Uint8Array(0) }, includeGatesPerOpcode: false, settings: { ipaAccumulation: false, oracleHashType: "poseidon2", disableZk: false, optimizedSolidityVerifier: false } });
console.log(JSON.stringify(st));
process.exit(0);
