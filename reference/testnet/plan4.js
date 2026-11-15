// SPDX-License-Identifier: Apache-2.0
// Proof of One — Phase 1a, deployment 3 and test poll 4: a recovery ballot on the test network.
// SYNTHETIC IDENTITIES ONLY.
//
// Puts on the test network the polls contract with recovery ballots (Decision Log #52, point 2;
// docs/specs/recovery-ballots-and-oprf-key-v0.1.md §1.5) and plays the stolen-phone story:
//   1–2. deploy the RecoveryVerifier and ProofOfOnePolls (deployment 3); the identity and
//        revocation registries, the ballot verifiers, Poseidon contracts and the TallyVerifier
//        of deployment 2 are reused;
//   3.   create poll 4 (on-chain poll id 1 of the new contract; 4 options, 7 days), with kits
//        for members 5–7 (member 8 was revoked in poll 3);
//        → someone "who took member 7's phone" answers with member 7's kit;
//   4.   a new synthetic enclave key set;
//   5–8. member 7 re-enrols: the new identity's revocation handle is linked to the old one,
//        Poseidon(14, rn_old, link); three more synthetic members fill the batch;
//   9.   insert the four as one batch;
//   10.  revoke member 7's old identity (send only after member 7 has voted in poll 4);
//        → member 7, with the new identity and a backup of the old secret, sends a RECOVERY
//          ballot from the app: it replaces the thief's ballot.
// The trustee shares of poll 4 go to a PRIVATE file (never published). The recovery kit
// holds member 7's old and new secrets: synthetic, published on purpose for the test.
//
// Usage: node plan4.js plan.json plan2.json plan3.json <startNonce> > plan4.json
"use strict";
const fs = require("fs");
const path = require("path");
const { ethers } = require("../contracts/node_modules/ethers");
const { create } = require("../tally/src/protocol");
const B = require("../ballot-circuit/src/ballot");
const A = require("../ballot-circuit/src/attrs");
const R = require("../ballot-circuit/src/recovery");
const { IncrementalTree, RevocationTree } = require("../ballot-circuit/src/trees");
const E = require("../enrolment-circuit/src/enrolment");

const ROOT = path.join(__dirname, "..");
const SNARK_FIELD = 21888242871839275222246405745257275088548364400416034343698204186575808495617n;
const ZK = { reg: path.join(ROOT, "enrolment-circuit", "setup", "registration_test.zkey"), batch: path.join(ROOT, "enrolment-circuit", "setup", "batch_test.zkey"),
  revoke: path.join(ROOT, "enrolment-circuit", "setup", "revoke_test.zkey") };
const SECRETS = process.env.POLL4_SECRETS || path.join(ROOT, "..", "private", "poll4-secrets.json");
const art = (n) => JSON.parse(fs.readFileSync(path.join(ROOT, "contracts", "build", n + ".json"), "utf8"));
const sp = (p) => ({ a: [p.pi_a[0], p.pi_a[1]], b: [[p.pi_b[0][1], p.pi_b[0][0]], [p.pi_b[1][1], p.pi_b[1][0]]], c: [p.pi_c[0], p.pi_c[1]] });
const json = (o) => JSON.stringify(o, (k, v) => (typeof v === "bigint" ? v.toString() : v), 2);

async function main() {
  const [plan1, plan2, plan3] = process.argv.slice(2, 5).map((f) => JSON.parse(fs.readFileSync(f, "utf8")));
  const startNonce = Number(process.argv[5]);
  if (!Number.isInteger(startNonce) || startNonce < 0) throw new Error("give the deployer's current nonce");
  const chainId = BigInt(plan1.chainId), deployer = ethers.getAddress(plan1.deployer);
  const P = await create({ dleq: "poseidon" });
  await E.init();
  const H = P.hash.H, pt = (X) => P.curve.coords(X);
  const coder = ethers.AbiCoder.defaultAbiCoder();
  const old = plan3.contracts;
  let nonce = startNonce;
  const txs = [];
  const deploy = (name, a, types = [], args = []) => {
    const address = ethers.getCreateAddress({ from: deployer, nonce: nonce++ });
    txs.push({ step: txs.length + 1, kind: "deploy", name, expectedAddress: address, data: ethers.concat([a.bytecode, coder.encode(types, args)]), check: { type: "code" } });
    return address;
  };
  const IR = art("IdentityRegistry"), RR = art("RevocationRegistry"), PP = art("ProofOfOnePolls"), RCV = art("RecoveryVerifier");
  const ir = new ethers.Interface(IR.abi), rr = new ethers.Interface(RR.abi);
  const call = (name, to, iface, fn, args, extra = {}) => { txs.push({ step: txs.length + 1, kind: "call", name, to, data: iface.encodeFunctionData(fn, args), ...extra }); nonce++; };

  // ---- 1–2. contracts
  const recoveryV = deploy("RecoveryVerifier (recovery-ballot proof π_recover)", RCV);
  const polls = deploy("ProofOfOnePolls (recovery ballots)", PP,
    ["address", "address", "address", "address", "address", "address", "address", "address"],
    [old.Groth16Verifier, old.BallotBatchVerifier, old.IdentityRegistry, old.RevocationRegistry, old["Poseidon(3)"], old["Poseidon(5)"], old.TallyVerifier, recoveryV]);

  // ---- the registries as they are on chain: 8 identities; member 8 revoked in poll 3
  const ids = new IncrementalTree(H, B.DEPTH);
  for (const t of plan1.txs.filter((t) => t.name.startsWith("Register synthetic member"))) ids.insert(ir.decodeFunctionData("register", t.data)[0]);
  for (const t of plan2.txs.filter((t) => t.name.startsWith("Register published synthetic member"))) ids.insert(ir.decodeFunctionData("register", t.data)[0]);
  if (ids.root.toString() !== String(plan3.idRoot)) throw new Error("identity tree does not match plan 3");
  const rev = new RevocationTree(H, B.REV_DEPTH);
  const memberOf = (k) => ({ s: BigInt(k.input.s), birthDay: BigInt(k.input.birthDay), sexCode: BigInt(k.input.sexCode),
    docs: k.input.nat.map((n, j) => ({ nat: BigInt(n), expiry: BigInt(k.input.exp[j]) })).filter((d) => d.nat > 0n), salt: BigInt(k.input.salt), rn: BigInt(k.input.rn) });
  rev.revoke(memberOf(plan2.kits[3]).rn);   // member 8
  const snap = new IncrementalTree(H, B.DEPTH); for (const l of ids.leaves) snap.insert(l);

  // ---- 3. poll 4 = poll id 1 of the new contract
  const pollId = 1n;
  const keys = P.dkg(5, 3);
  const POLICY = { ...A.ageRange([2026, 11, 17], { minAge: 18 }), minExpiryMonth: 24330, requiredNat: 0 };
  const DURATION = 7n * 24n * 3600n;
  txs.push({ step: txs.length + 1, kind: "createPoll", name: "Create synthetic poll 4 (poll id 1 of deployment 3; 4 options, open for 7 days)", to: polls,
    params: { tallyPK: pt(keys.PK), maxBirthDay: POLICY.maxBirthDay, minBirthDay: POLICY.minBirthDay, minExpiryMonth: POLICY.minExpiryMonth, requiredNat: 0, maxRevotes: 50,
      metadataHash: ethers.keccak256(ethers.toUtf8Bytes("Proof of One Phase 1a synthetic test poll 4: a recovery ballot after a stolen phone")),
      trusteeKeys: keys.publicShares.map((s) => pt(s.PK)), threshold: 3, sampleThreshold: 0 },
    duration: DURATION.toString(), check: { type: "pollCount", min: 1 } });
  nonce++;
  const ctxHash = BigInt(ethers.keccak256(coder.encode(["uint256", "address", "uint256"], [chainId, polls, pollId]))) % SNARK_FIELD;
  const kits = [0, 1, 2].map((i) => {
    const m = { ...memberOf(plan2.kits[i]), index: 4 + i };
    const b = B.buildBallot(P, { pollId, PK: keys.PK, policy: POLICY, ctxHash, member: m, leafIndex: 4 + i, idTree: ids, revTree: rev, choice: 0 });
    const { CA, CB, v, r, ...input } = b.input;
    return { member: i + 5, pollId, nf: b.nf, PK: pt(keys.PK), k: B.K, input };
  });

  // ---- 4. new synthetic enclave key set
  const enclave = E.createEnclave(P, { epochs: 4 });
  call("Set a new synthetic enclave key set", old.IdentityRegistry, ir, "setKeySetRoot", [enclave.keySetRoot], { check: { type: "keySetRoot", value: enclave.keySetRoot.toString() } });

  // ---- 5–8. member 7 re-enrols (linked handle), with three filler members
  const old7 = memberOf(plan2.kits[2]);
  const ATTRS = { birthDay: Number(old7.birthDay), natCode: Number(old7.docs[0].nat), sexCode: Number(old7.sexCode), expiryMonth: Number(old7.docs[0].expiry) };
  const fillerAttrs = { birthDay: A.dayNumber(1990, 1, 1), natCode: 999, sexCode: 1, expiryMonth: 24400 };
  const newLeaves = [];
  let new7;
  for (let i = 0; i < 4; i++) {
    const attrs = i === 0 ? ATTRS : fillerAttrs;
    const m = E.newMember(P, attrs);
    const fingerprint = BigInt(ethers.keccak256(ethers.toUtf8Bytes("synthetic member, poll 4, " + i))) % (1n << 248n);
    const { credential } = enclave.issue({ fingerprint, attrs, cm: m.cm, epoch: 2, ...(i === 0 ? { replaces: old7.rn } : {}) });
    const { input, leaf, member } = E.buildRegistration(P, enclave, m, credential);
    const p = sp((await E.prove(input, ZK.reg)).proof);
    call(i === 0 ? "Register member 7's new identity (re-enrolment after a lost phone; handle linked to the old one)" : `Register synthetic filler member ${i + 8}`,
      old.IdentityRegistry, ir, "register", [leaf, member.cn, p.a, p.b, p.c], { check: { type: "registeredCount", min: 8 + i + 1 } });
    newLeaves.push(leaf);
    if (i === 0) new7 = { ...member, link: credential.link, index: 8 };
  }
  if (P.hash.H([14n, old7.rn, new7.link]) !== new7.rn) throw new Error("link check failed");
  // ---- 9. insert them as one batch
  const { input: bi, newRoot } = E.buildBatchInsert(P, ids, newLeaves);
  const bp = sp((await E.proveBatch(bi, ZK.batch)).proof);
  call("Insert the 4 new identities as one batch", old.IdentityRegistry, ir, "insertBatch", [newRoot, bp.a, bp.b, bp.c], { check: { type: "leafCount", min: 12 } });
  newLeaves.forEach((l) => ids.insert(l));
  if (ids.root !== newRoot) throw new Error("tree mismatch");

  // ---- 10. revoke member 7's old identity (after the "thief" has voted with it)
  const { input: ri, newRoot: revRoot } = E.buildRevoke(P, rev, old7.rn);
  const rp = sp((await E.proveRevoke(ri, ZK.revoke)).proof);
  call("Revoke member 7's old identity (send only after member 7 has voted in poll 4)", old.RevocationRegistry, rr, "revoke", [old7.rn, 2, revRoot, rp.a, rp.b, rp.c],
    { waitForBallot: String(kits[2].nf), info: "From now on member 7's old identity is refused (after the 10-minute grace). Member 7 then sends a recovery ballot from the app, with the new identity.", check: { type: "revokedCount", min: 2 } });
  const revNow = new RevocationTree(H, B.REV_DEPTH);           // after step 10: members 8 and 7
  revNow.revoke(memberOf(plan2.kits[3]).rn); revNow.revoke(old7.rn);
  if (revNow.root !== revRoot) throw new Error("revocation tree mismatch");

  // ---- the recovery kit: everything for π_recover but the encryption, which the phone makes
  const rb = R.buildRecovery(P, { pollId, PK: keys.PK, policy: POLICY, ctxHash, oldMember: old7, oldIndex: 6, snapTree: snap, newMember: new7, newIndex: 8, curTree: ids, revTree: revNow, choice: 0 });
  const { CA, CB, v, r, ...rinput } = rb.input;
  const recoveryKits = [{ member: 7, pollId, nf: rb.nf, PK: pt(keys.PK), k: B.K, input: rinput,
    note: "SYNTHETIC: member 7's old and new secrets and the link, published for the test. Valid while the identity root and revocation root stay as after steps 9 and 10." }];

  fs.mkdirSync(path.dirname(SECRETS), { recursive: true });
  fs.writeFileSync(SECRETS, json({ note: "PRIVATE. Synthetic trustee shares of poll 4, kept to decrypt and publish its result.", pollId, chainId, polls, dleq: "poseidon",
    PK: pt(keys.PK), shares: keys.shares, publicShares: keys.publicShares.map((s) => ({ index: s.index, PK: pt(s.PK) })) }));

  const contracts = { ...old, RecoveryVerifier: recoveryV, ProofOfOnePolls: polls, ProofOfOnePollsV2: old.ProofOfOnePolls };
  process.stdout.write(json({
    title: "Proof of One — Phase 1a deployment 3 and synthetic test poll 4 (a recovery ballot after a stolen phone)",
    warning: "SYNTHETIC IDENTITIES ONLY. TEST-ONLY trusted setups. Not audited. Never use with real people or real funds.",
    chainId, deployer, startNonce, pollId, tally: "proof", contracts, idRoot: snap.root, kits, recoveryKits,
    abi: { ProofOfOnePolls: PP.abi, IdentityRegistry: IR.abi, RevocationRegistry: RR.abi }, txs,
  }) + "\n");
  if (globalThis.curve_bn128) await globalThis.curve_bn128.terminate();
}
main().catch((e) => { console.error(e); process.exit(1); });
