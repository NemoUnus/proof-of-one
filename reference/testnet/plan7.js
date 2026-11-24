// SPDX-License-Identifier: Apache-2.0
// Proof of One — deployment 5 and the pilot's first poll (Decision #62).
//
// Decision #62: every member can answer every open poll a few minutes after enrolling; a
// member who gets their identity back sees the recorded answer and may keep or change it;
// only an identity re-issued after losing both phone and password is limited to polls opened
// after it was issued. The contracts for it:
//   1. RegistrationVerifier  π_reg with the identity's notBefore (new TEST-ONLY key)
//   2. IdentityRegistry      inserts each registration into the tree at once and keeps the
//                            leaves and every root it has held (no batches, no batch job)
//   3. RevocationRegistry    keeps the revoked handles readable (getRevoked)
//   4. Groth16Verifier       π_vote with the identity root as a public input
//   5. BallotBatchVerifier   the same, for batches of ballots
//   6. RecoveryVerifier      π_recover with both identity roots public
//   7. ProofOfOnePolls       accepts any root the registry has held
//   8. createPoll            the pilot's first poll, open for 14 days
// Reused from earlier deployments: Poseidon(2), Poseidon(3), Poseidon(5), RevokeVerifier and
// the TallyVerifier of deployment 3 (byte-for-byte the same contracts).
// The identity registry starts empty: members register again with the new π_reg.
// Its key set is the one of plan 6 (web/keyset.json): the enrolment service's key and the
// TEST-ONLY filler key; the founder's test wallet is governance and revocation operator.
//
// Writes:
//   stdout                          the plan (web/plan7.json), for the plan page
//   ../relay/src/pilot-polls.json   the poll's text in six languages; the poll's metadataHash
//                                   is the Keccak-256 of the canonical JSON of its "text"
//   $POLL_SECRETS (default ../../private/pilot1-secrets.json)
//                                   PRIVATE: the poll's synthetic trustee shares (never published)
//
// Usage: node plan7.js web/plan5.json <startNonce> > web/plan7.json
"use strict";
const fs = require("fs");
const path = require("path");
const { ethers } = require("../contracts/node_modules/ethers");
const { create } = require("../tally/src/protocol");
const A = require("../ballot-circuit/src/attrs");
const B = require("../ballot-circuit/src/ballot");
const { RevocationTree } = require("../ballot-circuit/src/trees");

const ROOT = path.join(__dirname, "..");
const SECRETS = process.env.POLL_SECRETS || path.join(ROOT, "..", "private", "pilot1-secrets.json");
const art = (n) => JSON.parse(fs.readFileSync(path.join(ROOT, "contracts", "build", n + ".json"), "utf8"));
const json = (o) => JSON.stringify(o, (k, v) => (typeof v === "bigint" ? v.toString() : v), 2);

// The poll's text. Changing it changes the metadataHash: run plan7.js again.
const TEXT = {
  en: { question: "Pilot test poll: which part of the app should we improve first?",
    options: ["Reading the passport", "The face check", "Answering a poll", "Messages and languages"] },
  fa: { question: "نظرسنجی آزمایشی: کدام بخش برنامه را اول بهتر کنیم؟",
    options: ["خواندن گذرنامه", "بررسی چهره", "پاسخ دادن به نظرسنجی", "پیام‌ها و زبان‌ها"] },
  ar: { question: "استطلاع تجريبي: أي جزء من التطبيق نحسّنه أولاً؟",
    options: ["قراءة جواز السفر", "التحقق من الوجه", "الإجابة عن استطلاع", "الرسائل واللغات"] },
  fr: { question: "Sondage d'essai : quelle partie de l'application améliorer en premier ?",
    options: ["La lecture du passeport", "La vérification du visage", "La réponse à un sondage", "Les messages et les langues"] },
  es: { question: "Encuesta de prueba: ¿qué parte de la aplicación mejoramos primero?",
    options: ["La lectura del pasaporte", "La comprobación del rostro", "Responder a una encuesta", "Los mensajes y los idiomas"] },
  de: { question: "Testumfrage: Welchen Teil der App sollen wir zuerst verbessern?",
    options: ["Das Lesen des Passes", "Die Gesichtsprüfung", "Das Beantworten einer Umfrage", "Die Meldungen und Sprachen"] },
};
const metadataHashOf = (text) => ethers.keccak256(ethers.toUtf8Bytes(JSON.stringify(text)));

async function main() {
  const plan5 = JSON.parse(fs.readFileSync(process.argv[2], "utf8"));
  const startNonce = Number(process.argv[3]);
  if (!Number.isInteger(startNonce) || startNonce < 0) throw new Error("give the deployer's current nonce");
  const keyset = JSON.parse(fs.readFileSync(path.join(__dirname, "web", "keyset.json"), "utf8"));
  for (const l of Object.values(TEXT)) if (l.options.length !== B.K) throw new Error("four options in every language");
  const chainId = BigInt(plan5.chainId), deployer = ethers.getAddress(plan5.deployer);
  const P = await create({ dleq: "poseidon" });
  const pt = (X) => P.curve.coords(X);
  const coder = ethers.AbiCoder.defaultAbiCoder();
  const old = plan5.contracts;
  let nonce = startNonce;
  const txs = [];
  const deploy = (name, a, types = [], args = []) => {
    const address = ethers.getCreateAddress({ from: deployer, nonce: nonce++ });
    txs.push({ step: txs.length + 1, kind: "deploy", name, expectedAddress: address, data: ethers.concat([a.bytecode, coder.encode(types, args)]), check: { type: "code" } });
    return address;
  };
  const IR = art("IdentityRegistry"), RR = art("RevocationRegistry"), PP = art("ProofOfOnePolls");
  const regV = deploy("RegistrationVerifier (π_reg with notBefore; TEST-ONLY key)", art("RegistrationVerifier"));
  const identity = deploy("IdentityRegistry (insertion at once; Decision #62)", IR, ["address", "address", "uint256", "address"],
    [old["Poseidon(2)"], regV, BigInt(keyset.root), deployer]);
  const emptyRevRoot = new RevocationTree(P.hash.H, B.REV_DEPTH).root;
  const revocation = deploy("RevocationRegistry (revoked handles readable)", RR, ["address", "address", "uint256"], [old.RevokeVerifier, deployer, emptyRevRoot]);
  const ballotV = deploy("Groth16Verifier (π_vote with the identity root public; TEST-ONLY key)", art("Groth16Verifier"));
  const batchV = deploy("BallotBatchVerifier (19 public inputs per ballot)", art("BallotBatchVerifier"));
  const recoveryV = deploy("RecoveryVerifier (π_recover with both identity roots public; TEST-ONLY key)", art("RecoveryVerifier"));
  const polls = deploy("ProofOfOnePolls (any root the registry has held; Decision #62)", PP,
    ["address", "address", "address", "address", "address", "address", "address", "address"],
    [ballotV, batchV, identity, revocation, old["Poseidon(3)"], old["Poseidon(5)"], old.TallyVerifier, recoveryV]);

  // ---- 8. the pilot's first poll = poll id 1 of the new contract
  const pollId = 1n;
  const keys = P.dkg(5, 3);
  // Adults on the day the poll is made; a document valid in November 2026 or later.
  const POLICY = { ...A.ageRange([2026, 11, 24], { minAge: 18 }), minExpiryMonth: 2026 * 12 + 11, requiredNat: 0 };
  const DURATION = 14n * 24n * 3600n;
  const metadataHash = metadataHashOf(TEXT);
  txs.push({ step: txs.length + 1, kind: "createPoll", name: "Create the pilot's first poll (poll id 1 of deployment 5; 4 options, open for 14 days)", to: polls,
    params: { tallyPK: pt(keys.PK), maxBirthDay: POLICY.maxBirthDay, minBirthDay: POLICY.minBirthDay, minExpiryMonth: POLICY.minExpiryMonth, requiredNat: 0, maxRevotes: 20,
      metadataHash, trusteeKeys: keys.publicShares.map((s) => pt(s.PK)), threshold: 3, sampleThreshold: 0 },
    duration: DURATION.toString(), check: { type: "pollCount", min: 1 } });
  nonce++;

  fs.mkdirSync(path.dirname(SECRETS), { recursive: true });
  fs.writeFileSync(SECRETS, json({ note: "PRIVATE. Synthetic trustee shares of the pilot's first poll, kept to decrypt and publish its result.", pollId, chainId, polls, dleq: "poseidon",
    PK: pt(keys.PK), shares: keys.shares, publicShares: keys.publicShares.map((s) => ({ index: s.index, PK: pt(s.PK) })) }));
  const pilot = { note: "The pilot's polls as the app shows them (written by reference/testnet/plan7.js). metadataHash = keccak256 of JSON.stringify(text), as the poll holds it.",
    polls: [{ chainId: chainId.toString(), polls, pollId: pollId.toString(), metadataHash, text: TEXT }] };
  fs.writeFileSync(path.join(ROOT, "relay", "src", "pilot-polls.json"), JSON.stringify(pilot, null, 1) + "\n");

  const contracts = { ...old, RegistrationVerifier: regV, IdentityRegistry: identity, RevocationRegistry: revocation, Groth16Verifier: ballotV, BallotBatchVerifier: batchV,
    RecoveryVerifier: recoveryV, ProofOfOnePolls: polls,
    RegistrationVerifierV1: old.RegistrationVerifier, IdentityRegistryV1: old.IdentityRegistry, RevocationRegistryV2: old.RevocationRegistry, Groth16VerifierV1: old.Groth16Verifier,
    BallotBatchVerifierV1: old.BallotBatchVerifier, RecoveryVerifierV1: old.RecoveryVerifier, ProofOfOnePollsV3: old.ProofOfOnePolls };
  process.stdout.write(json({
    title: "Proof of One — deployment 5 (Decision #62: every member answers every open poll) and the pilot's first poll",
    warning: "TEST-ONLY trusted setups. Not audited. The test wallet never holds real funds.",
    chainId, deployer, startNonce, pollId, tally: "proof", contracts, keySet: { root: keyset.root }, policy: POLICY, metadataHash,
    abi: { ProofOfOnePolls: PP.abi, IdentityRegistry: IR.abi, RevocationRegistry: RR.abi }, txs,
  }) + "\n");
  if (globalThis.curve_bn128) await globalThis.curve_bn128.terminate();
}
module.exports = { TEXT, metadataHashOf };
if (require.main === module) main().catch((e) => { console.error(e); process.exit(1); });
