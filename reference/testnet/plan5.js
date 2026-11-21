// SPDX-License-Identifier: Apache-2.0
// Proof of One — deployment 4: π_doc's verifier for the pilot's enrolment service.
// One step: deploy DocVerifier (reference/contracts/src/DocVerifier.sol), generated from the
// verifying key of the TEST-ONLY suite-2 proving key that the app uses
// (reference/enrol-service/keys/doc_s2_vkey.json; the Android workflow checks that the app's
// key gives exactly this one). The enrolment service only calls it with eth_call: it holds
// no state and receives no transactions. Deployment 3's contracts are kept in the plan so
// the page can show poll 4.
//
// Usage: node plan5.js web/plan4.json <startNonce> > web/plan5.json
"use strict";
const fs = require("fs");
const path = require("path");
const { ethers } = require("../contracts/node_modules/ethers");

const ROOT = path.join(__dirname, "..");
const art = (n) => JSON.parse(fs.readFileSync(path.join(ROOT, "contracts", "build", n + ".json"), "utf8"));

const plan4 = JSON.parse(fs.readFileSync(process.argv[2], "utf8"));
const startNonce = Number(process.argv[3]);
if (!Number.isInteger(startNonce) || startNonce < 0) throw new Error("give the deployer's current nonce");
const deployer = ethers.getAddress(plan4.deployer);
const a = art("DocVerifier");
const vk = fs.readFileSync(path.join(ROOT, "enrol-service", "keys", "doc_s2_vkey.json"));
const address = ethers.getCreateAddress({ from: deployer, nonce: startNonce });
const plan = {
  title: "Proof of One — deployment 4: π_doc's verifier for the pilot's enrolment service",
  warning: "TEST-ONLY trusted setup (reproducible). Not audited. The test wallet never holds real funds.",
  chainId: plan4.chainId, deployer, startNonce, pollId: plan4.pollId,
  contracts: { ...plan4.contracts, DocVerifier: address },
  docVerifierKey: { file: "reference/enrol-service/keys/doc_s2_vkey.json", sha256: require("crypto").createHash("sha256").update(vk).digest("hex") },
  abi: { ...plan4.abi, DocVerifier: a.abi },
  txs: [{ step: 1, kind: "deploy", name: "DocVerifier (π_doc, suite 2; TEST-ONLY key of the app)", expectedAddress: address, data: a.bytecode, check: { type: "code" } }],
};
process.stdout.write(JSON.stringify(plan, null, 2) + "\n");
