// SPDX-License-Identifier: Apache-2.0
// π_doc's verifier contract (DocVerifier, generated from the TEST-ONLY suite-2 key by
// ../enrol-service/scripts/gen-doc-verifier.cjs) with a real proof of a SYNTHETIC passport,
// called exactly as the enrolment service calls it (eth_call with its own calldata).
"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");
const ganache = require("ganache");
const { ethers } = require("ethers");

const art = (n) => JSON.parse(fs.readFileSync(path.join(__dirname, "..", "build", n + ".json"), "utf8"));
const ex = require("../../enrol-service/keys/doc_s2_proof_example.json");

test("DocVerifier accepts the synthetic π_doc and refuses changed signals or proofs", async () => {
  const { verifyCalldata } = await import("../../enrol-service/src/service.js");
  const provider = new ethers.BrowserProvider(ganache.provider({ logging: { quiet: true } }));
  const signer = await provider.getSigner();
  const a = art("DocVerifier");
  const c = await new ethers.ContractFactory(a.abi, a.bytecode, signer).deploy();
  await c.waitForDeployment();
  const to = await c.getAddress();
  const ask = async (proof, signals) => BigInt(await provider.call({ to, data: verifyCalldata(proof, signals) }));
  assert.equal(await ask(ex.proof, ex.publicSignals), 1n);
  for (const i of [5, 6, 12, 14, 23]) {
    const s = [...ex.publicSignals];
    s[i] = (BigInt(s[i]) + 1n).toString();
    assert.equal(await ask(ex.proof, s), 0n, `signal ${i}`);
  }
  const bad = JSON.parse(JSON.stringify(ex.proof));
  bad.pi_c = ex.proof.pi_a;
  assert.equal(await ask(bad, ex.publicSignals), 0n);
  const gas = await provider.estimateGas({ to, data: verifyCalldata(ex.proof, ex.publicSignals) });
  console.log(`# verifyProof: ${gas} gas (free by eth_call)`);
});
