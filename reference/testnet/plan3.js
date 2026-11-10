// SPDX-License-Identifier: Apache-2.0
// Proof of One — Phase 1a, deployment 2 and test poll 3. SYNTHETIC IDENTITIES ONLY.
//
// Puts on the test network the contracts changed since the first deployment:
//   - results are accepted only with a tally proof π_tally and are final at once
//     (Decision Log #53; tally-circuit/);
//   - ballots prove non-revocation against the current revocation root, so a revocation
//     reaches polls already open (Decision Log #52; implementation note N33).
// The identity registry and its 8 members, the ballot verifiers and the Poseidon contracts of
// the first deployment are reused. New: a RevocationRegistry (it now records the previous
// root and when it changed), the TallyVerifier and ProofOfOnePolls. Then:
//   4. create poll 3 (on-chain poll id 1 of the new polls contract; 4 options, 7 days),
//      with published kits for members 5–8;
//   5. revoke member 8 (send only after member 8 has voted): from then on its ballots are
//      refused, after the 10-minute grace.
// The trustee shares of poll 3 go to a PRIVATE file (never published).
//
// Usage: node plan3.js plan.json plan2.json <startNonce> > plan3.json
//   startNonce: the number of transactions the deployer wallet has sent so far.
"use strict";
const fs = require("fs");
const path = require("path");
const { ethers } = require("../contracts/node_modules/ethers");
const { create } = require("../tally/src/protocol");
const B = require("../ballot-circuit/src/ballot");
const A = require("../ballot-circuit/src/attrs");
const { IncrementalTree, RevocationTree } = require("../ballot-circuit/src/trees");
const E = require("../enrolment-circuit/src/enrolment");

const ROOT = path.join(__dirname, "..");
const SNARK_FIELD = 21888242871839275222246405745257275088548364400416034343698204186575808495617n;
const REVOKE_ZKEY = path.join(ROOT, "enrolment-circuit", "setup", "revoke_test.zkey");
const SECRETS = path.join(ROOT, "..", "private", "poll3-secrets.json");
const art = (n) => JSON.parse(fs.readFileSync(path.join(ROOT, "contracts", "build", n + ".json"), "utf8"));
const sp = (p) => ({ a: [p.pi_a[0], p.pi_a[1]], b: [[p.pi_b[0][1], p.pi_b[0][0]], [p.pi_b[1][1], p.pi_b[1][0]]], c: [p.pi_c[0], p.pi_c[1]] });
const json = (o) => JSON.stringify(o, (k, v) => (typeof v === "bigint" ? v.toString() : v), 2);

async function main() {
  const [plan1, plan2] = process.argv.slice(2, 4).map((f) => JSON.parse(fs.readFileSync(f, "utf8")));
  const startNonce = Number(process.argv[4]);
  if (!Number.isInteger(startNonce) || startNonce < 0) throw new Error("give the deployer's current nonce");
  const chainId = BigInt(plan1.chainId), deployer = ethers.getAddress(plan1.deployer);
  const P = await create({ dleq: "poseidon" });   // trustee proofs as π_tally checks them
  await E.init();
  const H = P.hash.H, pt = (X) => P.curve.coords(X);
  const coder = ethers.AbiCoder.defaultAbiCoder();
  const old = plan1.contracts;

  let nonce = startNonce;
  const txs = [];
  const deploy = (name, a, types = [], args = []) => {
    const address = ethers.getCreateAddress({ from: deployer, nonce: nonce++ });
    const data = ethers.concat([a.bytecode, coder.encode(types, args)]);
    txs.push({ step: txs.length + 1, kind: "deploy", name, expectedAddress: address, data, check: { type: "code" } });
    return address;
  };

  // ---- 1–3. new contracts
  const RR = art("RevocationRegistry"), TV = art("TallyVerifier"), PP = art("ProofOfOnePolls");
  const rev = new RevocationTree(H, B.REV_DEPTH);
  const revocation = deploy("RevocationRegistry (records the previous root)", RR, ["address", "address", "uint256"], [old.RevokeVerifier, deployer, rev.root]);
  const tallyV = deploy("TallyVerifier (tally proof π_tally)", TV);
  const polls = deploy("ProofOfOnePolls (tally proof; revocations reach open polls)", PP,
    ["address", "address", "address", "address", "address", "address", "address"],
    [old.Groth16Verifier, old.BallotBatchVerifier, old.IdentityRegistry, revocation, old["Poseidon(3)"], old["Poseidon(5)"], tallyV]);

  // ---- 4. poll 3 = poll id 1 of the new contract
  const pollId = 1n;
  const keys = P.dkg(5, 3);
  const POLICY = { ...A.ageRange([2026, 11, 10], { minAge: 18 }), minExpiryMonth: 24330, requiredNat: 0 };
  const DURATION = 7n * 24n * 3600n;
  const pollParams = { tallyPK: pt(keys.PK), maxBirthDay: POLICY.maxBirthDay, minBirthDay: POLICY.minBirthDay, minExpiryMonth: POLICY.minExpiryMonth,
    requiredNat: 0, maxRevotes: 50, metadataHash: ethers.keccak256(ethers.toUtf8Bytes("Proof of One Phase 1a synthetic test poll 3: tally proof and revocation in an open poll")),
    trusteeKeys: keys.publicShares.map((s) => pt(s.PK)), threshold: 3, sampleThreshold: 0 };
  txs.push({ step: txs.length + 1, kind: "createPoll", name: "Create synthetic poll 3 (poll id 1 of the new contract; 4 options, open for 7 days)", to: polls, params: pollParams, duration: DURATION.toString(), check: { type: "pollCount", min: 1 } });
  nonce++;

  // ---- kits for members 5–8, rebuilt from plan 2's published kits for the new poll
  const ids = new IncrementalTree(H, B.DEPTH);
  const IR = new ethers.Interface(art("IdentityRegistry").abi);
  for (const t of plan1.txs.filter((t) => t.name.startsWith("Register synthetic member"))) ids.insert(IR.decodeFunctionData("register", t.data)[0]);
  for (const t of plan2.txs.filter((t) => t.name.startsWith("Register published synthetic member"))) ids.insert(IR.decodeFunctionData("register", t.data)[0]);
  if (ids.root.toString() !== String(plan2.idRoot)) throw new Error("identity tree does not match plan 2");
  const ctxHash = BigInt(ethers.keccak256(coder.encode(["uint256", "address", "uint256"], [chainId, polls, pollId]))) % SNARK_FIELD;
  const kits = plan2.kits.map((k, i) => {
    const m = { s: BigInt(k.input.s), birthDay: BigInt(k.input.birthDay), sexCode: BigInt(k.input.sexCode), docs: k.input.nat.map((n, j) => ({ nat: BigInt(n), expiry: BigInt(k.input.exp[j]) })).filter((d) => d.nat > 0n),
      salt: BigInt(k.input.salt), rn: BigInt(k.input.rn), index: 4 + i };
    const b = B.buildBallot(P, { pollId, PK: keys.PK, policy: POLICY, ctxHash, member: m, leafIndex: 4 + i, idTree: ids, revTree: rev, choice: 0 });
    const { CA, CB, v, r, ...input } = b.input;
    return { member: k.member, pollId, nf: b.nf, PK: pt(keys.PK), k: B.K, input };
  });

  // ---- 5. revoke member 8 (π_revoke against the empty revocation tree)
  const rn8 = BigInt(plan2.kits[3].input.rn);
  const { input: ri, newRoot } = E.buildRevoke(P, rev, rn8);
  const rp = sp((await E.proveRevoke(ri, REVOKE_ZKEY)).proof);
  const RRi = new ethers.Interface(RR.abi);
  txs.push({ step: txs.length + 1, kind: "call", name: "Revoke member 8 (send only after member 8 has voted)", to: revocation,
    data: RRi.encodeFunctionData("revoke", [rn8, 1, newRoot, rp.a, rp.b, rp.c]),
    waitForBallot: String(kits[3].nf),
    info: "From this moment member 8's ballots are refused in poll 3, after a 10-minute grace. The other members' kits were made for the old revocation root, so re-votes from them also stop after the grace: the app does not yet rebuild the revocation path (N33).",
    check: { type: "revokedCount", min: 1 } });

  fs.mkdirSync(path.dirname(SECRETS), { recursive: true });
  fs.writeFileSync(SECRETS, json({ note: "PRIVATE. Synthetic trustee shares of poll 3, kept to decrypt and publish its result.", pollId, chainId, polls, dleq: "poseidon",
    PK: pt(keys.PK), shares: keys.shares, publicShares: keys.publicShares.map((s) => ({ index: s.index, PK: pt(s.PK) })) }));

  const contracts = { ...old, RevocationRegistry: revocation, TallyVerifier: tallyV, ProofOfOnePolls: polls, RevocationRegistryV1: old.RevocationRegistry, ProofOfOnePollsV1: old.ProofOfOnePolls };
  const plan = {
    title: "Proof of One — Phase 1a deployment 2 and synthetic test poll 3 (tally proof; revocation in an open poll)",
    warning: "SYNTHETIC IDENTITIES ONLY. TEST-ONLY trusted setups. Not audited. Never use with real people or real funds.",
    chainId, deployer, startNonce, pollId, tally: "proof", contracts, idRoot: ids.root, kits,
    abi: { ProofOfOnePolls: PP.abi, IdentityRegistry: art("IdentityRegistry").abi, RevocationRegistry: RR.abi }, txs,
  };
  process.stdout.write(json(plan) + "\n");
  if (globalThis.curve_bn128) await globalThis.curve_bn128.terminate();
}
main().catch((e) => { console.error(e); process.exit(1); });
