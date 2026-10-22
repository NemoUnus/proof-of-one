// SPDX-License-Identifier: Apache-2.0
// Compile all contracts in src/ with solc-js; write ABI + bytecode to build/.
"use strict";
const fs = require("fs");
const path = require("path");
const solc = require("solc");

const SRC = path.join(__dirname, "..", "src");
const OUT = path.join(__dirname, "..", "build");
const sources = {};
for (const f of fs.readdirSync(SRC).filter((f) => f.endsWith(".sol"))) sources[f] = { content: fs.readFileSync(path.join(SRC, f), "utf8") };

const input = {
  language: "Solidity",
  sources,
  settings: {
    optimizer: { enabled: true, runs: 200 },
    viaIR: true,
    evmVersion: "paris",
    outputSelection: { "*": { "*": ["abi", "evm.bytecode.object"] } },
  },
};
const out = JSON.parse(solc.compile(JSON.stringify(input), { import: (p) => ({ contents: fs.readFileSync(path.join(SRC, path.basename(p)), "utf8") }) }));
let failed = false;
for (const e of out.errors || []) {
  console.error(e.formattedMessage);
  if (e.severity === "error") failed = true;
}
if (failed) process.exit(1);
fs.mkdirSync(OUT, { recursive: true });
for (const [file, contracts] of Object.entries(out.contracts)) {
  for (const [name, c] of Object.entries(contracts)) {
    if (!c.evm.bytecode.object) continue;
    fs.writeFileSync(path.join(OUT, name + ".json"), JSON.stringify({ abi: c.abi, bytecode: "0x" + c.evm.bytecode.object }));
    console.log("compiled", file, name, c.evm.bytecode.object.length / 2, "bytes");
  }
}
