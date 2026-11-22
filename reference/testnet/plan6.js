// SPDX-License-Identifier: Apache-2.0
// Proof of One — step for Decision #61: the identity registry's key set for the pilot.
// One transaction from the founder's test wallet (the registry's governance):
// setKeySetRoot(root of the key-set tree holding the enrolment service's key and the
// TEST-ONLY filler key). Credentials signed by earlier synthetic keys can no longer register.
//
// Also writes, for the phone (through the enrolment service's KEY_SET variable) and for the
// batch job:
//   web/keyset.json        the key set: root, leaves, each leaf's path (depth 8)
//   web/identity-tree.json the identity tree's 12 leaves registered so far (plans 1, 2 and 4),
//                          checked by the batch job against the registry's root on its first run
//
// Usage: node plan6.js web/plan5.json <service keyLeaf> <filler keyLeaf> > web/plan6.json
"use strict";
const fs = require("fs");
const path = require("path");
const { ethers } = require("../relay/node_modules/ethers");
const { IncrementalTree } = require("../ballot-circuit/src/trees");
const { create } = require("../tally/src/protocol");

(async () => {
  const [planFile, serviceLeaf, fillerLeaf] = process.argv.slice(2);
  if (!/^[0-9]+$/.test(serviceLeaf || "") || !/^[0-9]+$/.test(fillerLeaf || "")) throw new Error("give the service's and the filler key's leaves (decimal)");
  const plan5 = JSON.parse(fs.readFileSync(planFile, "utf8"));
  const P = await create();
  const H = P.hash.H;

  const kt = new IncrementalTree(H, 8);
  kt.insert(BigInt(serviceLeaf)); kt.insert(BigInt(fillerLeaf));
  const keyset = {
    note: "Key set of the identity registry for the pilot (Decision #61): 0 = enrolment service, 1 = TEST-ONLY filler key.",
    root: kt.root.toString(), leaves: [serviceLeaf, fillerLeaf],
    paths: [0, 1].map((i) => { const p = kt.path(i); return { siblings: p.siblings.map(String), pathIndex: p.pathIndex.map(String) }; }),
  };

  // the leaves registered so far, in order, from the plans' register() calls
  const ir = new ethers.Interface(plan5.abi.IdentityRegistry);
  const leaves = [];
  for (const f of ["plan.json", "plan2.json", "plan4.json"]) {
    const p = JSON.parse(fs.readFileSync(path.join(__dirname, "web", f), "utf8"));
    for (const t of p.txs) {
      if (t.kind !== "call" || t.to.toLowerCase() !== plan5.contracts.IdentityRegistry.toLowerCase()) continue;
      const d = ir.parseTransaction({ data: t.data });
      if (d && d.name === "register") leaves.push(d.args[0].toString());
    }
  }
  const tree = {
    note: "The identity registry's leaves, in order, as the batch job reads them from the chain (Decision #61). Published so that phones can find their path. fillers: leaves of filler members.",
    chainId: plan5.chainId, registry: plan5.contracts.IdentityRegistry,
    lastBlock: null, leaves, registeredAt: leaves.map(() => 0), fillers: [], leafCount: leaves.length, root: null, updated: null,
  };
  fs.writeFileSync(path.join(__dirname, "web", "keyset.json"), JSON.stringify(keyset, null, 1) + "\n");
  fs.writeFileSync(path.join(__dirname, "web", "identity-tree.json"), JSON.stringify(tree, null, 1) + "\n");

  const plan = {
    title: "Proof of One — the identity registry's key set for the pilot (Decision #61)",
    warning: "TEST NETWORK. The test wallet never holds real funds.",
    chainId: plan5.chainId, deployer: plan5.deployer, startNonce: null, pollId: plan5.pollId,
    contracts: plan5.contracts, abi: plan5.abi,
    keySet: { root: keyset.root, serviceLeaf, fillerLeaf },
    txs: [{ step: 1, kind: "call", name: "Set the pilot's key set: the enrolment service's key and the TEST-ONLY filler key",
      to: plan5.contracts.IdentityRegistry, data: ir.encodeFunctionData("setKeySetRoot", [keyset.root]),
      check: { type: "keySetRoot", value: keyset.root } }],
  };
  process.stdout.write(JSON.stringify(plan, null, 2) + "\n");
  if (globalThis.curve_bn128) await globalThis.curve_bn128.terminate();
})().catch((e) => { console.error(e); process.exit(1); });
