// SPDX-License-Identifier: Apache-2.0
// Proof of One — deployment 6 and the pilot's poll (review of deployment 5).
//
// The independent review of deployment 5 (docs/review/) found, among others, that a later
// revocation could block a poll's result for good (B2) and that a poll's opening time was not
// checked (C5). Both are in ProofOfOnePolls; the registries and verifiers of deployment 5 are
// unchanged and reused, so memberships registered there stay valid:
//   1. ProofOfOnePolls  bound at publication = every membership ever registered; openTime
//                       checked (fits 40 bits, not backdated by more than an hour)
//   2. createPoll       the pilot's poll, open for 14 days, its text in eight languages
// The poll's text is published as the exact JSON string whose Keccak-256 is the poll's
// metadataHash ("textJson" in ../relay/src/pilot-polls.json), so that the app can check it
// byte for byte before showing it (review finding B1/F-02).
//
// Writes:
//   stdout                          the plan (web/plan8.json), for the plan page
//   ../relay/src/pilot-polls.json   the poll's text and textJson
//   $POLL_SECRETS (default ../../private/pilot2-secrets.json)
//                                   PRIVATE: the poll's synthetic trustee shares (never published)
//
// Usage: node plan8.js web/plan7.json <startNonce> > web/plan8.json
"use strict";
const fs = require("fs");
const path = require("path");
const { ethers } = require("../contracts/node_modules/ethers");
const { create } = require("../tally/src/protocol");
const A = require("../ballot-circuit/src/attrs");
const B = require("../ballot-circuit/src/ballot");
const { RevocationTree } = require("../ballot-circuit/src/trees");

const ROOT = path.join(__dirname, "..");
const SECRETS = process.env.POLL_SECRETS || path.join(ROOT, "..", "private", "pilot2-secrets.json");
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
  ru: { question: "Тестовый опрос: какую часть приложения улучшить в первую очередь?",
    options: ["Чтение паспорта", "Проверку лица", "Ответ на опрос", "Сообщения и языки"] },
  zh: { question: "测试问卷：应用的哪一部分应最先改进？",
    options: ["读取护照", "人脸核验", "回答问卷", "提示信息和语言"] },
};
const textJsonOf = (text) => JSON.stringify(text);
const metadataHashOf = (text) => ethers.keccak256(ethers.toUtf8Bytes(textJsonOf(text)));

async function main() {
  const plan7 = JSON.parse(fs.readFileSync(process.argv[2], "utf8"));
  const startNonce = Number(process.argv[3]);
  if (!Number.isInteger(startNonce) || startNonce < 0) throw new Error("give the deployer's current nonce");
  for (const l of Object.values(TEXT)) if (l.options.length !== B.K) throw new Error("four options in every language");
  const chainId = BigInt(plan7.chainId), deployer = ethers.getAddress(plan7.deployer);
  const P = await create({ dleq: "poseidon" });
  const pt = (X) => P.curve.coords(X);
  const coder = ethers.AbiCoder.defaultAbiCoder();
  const c7 = plan7.contracts;
  let nonce = startNonce;
  const txs = [];
  const PP = art("ProofOfOnePolls");
  const polls = ethers.getCreateAddress({ from: deployer, nonce: nonce++ });
  txs.push({ step: 1, kind: "deploy", name: "ProofOfOnePolls (review fixes B2, C5; registries and verifiers of deployment 5)", expectedAddress: polls,
    data: ethers.concat([PP.bytecode, coder.encode(["address", "address", "address", "address", "address", "address", "address", "address"],
      [c7.Groth16Verifier, c7.BallotBatchVerifier, c7.IdentityRegistry, c7.RevocationRegistry, c7["Poseidon(3)"], c7["Poseidon(5)"], c7.TallyVerifier, c7.RecoveryVerifier])]),
    check: { type: "code" } });

  const pollId = 1n;
  const keys = P.dkg(5, 3);
  const POLICY = { ...A.ageRange([2026, 11, 26], { minAge: 18 }), minExpiryMonth: 2026 * 12 + 11, requiredNat: 0 };
  const DURATION = 14n * 24n * 3600n;
  const textJson = textJsonOf(TEXT);
  const metadataHash = metadataHashOf(TEXT);
  txs.push({ step: 2, kind: "createPoll", name: "Create the pilot's poll (poll id 1 of deployment 6; 4 options, open for 14 days, text in eight languages)", to: polls,
    params: { tallyPK: pt(keys.PK), maxBirthDay: POLICY.maxBirthDay, minBirthDay: POLICY.minBirthDay, minExpiryMonth: POLICY.minExpiryMonth, requiredNat: 0, maxRevotes: 20,
      metadataHash, trusteeKeys: keys.publicShares.map((s) => pt(s.PK)), threshold: 3, sampleThreshold: 0 },
    duration: DURATION.toString(), check: { type: "pollCount", min: 1 } });
  nonce++;

  fs.mkdirSync(path.dirname(SECRETS), { recursive: true });
  fs.writeFileSync(SECRETS, json({ note: "PRIVATE. Synthetic trustee shares of the pilot's poll (deployment 6), kept to decrypt and publish its result.", pollId, chainId, polls, dleq: "poseidon",
    PK: pt(keys.PK), shares: keys.shares, publicShares: keys.publicShares.map((s) => ({ index: s.index, PK: pt(s.PK) })) }));
  const pilot = { note: "The pilot's polls as the app shows them (written by reference/testnet/plan8.js). metadataHash = keccak256 of the UTF-8 bytes of textJson, as the poll holds it; the app checks it before showing the poll.",
    polls: [{ chainId: chainId.toString(), polls, pollId: pollId.toString(), metadataHash, textJson, text: TEXT }] };
  fs.writeFileSync(path.join(ROOT, "relay", "src", "pilot-polls.json"), JSON.stringify(pilot, null, 1) + "\n");

  const contracts = { ...c7, ProofOfOnePolls: polls, ProofOfOnePollsV4: c7.ProofOfOnePolls };
  process.stdout.write(json({
    title: "Proof of One — deployment 6 (fixes from the review of deployment 5) and the pilot's poll",
    warning: "TEST-ONLY trusted setups. Not audited. The test wallet never holds real funds.",
    chainId, deployer, startNonce, pollId, tally: "proof", contracts, keySet: plan7.keySet, policy: POLICY, metadataHash,
    abi: { ProofOfOnePolls: PP.abi, IdentityRegistry: plan7.abi.IdentityRegistry, RevocationRegistry: plan7.abi.RevocationRegistry }, txs,
  }) + "\n");
  if (globalThis.curve_bn128) await globalThis.curve_bn128.terminate();
}
module.exports = { TEXT, textJsonOf, metadataHashOf };
if (require.main === module) main().catch((e) => { console.error(e); process.exit(1); });
