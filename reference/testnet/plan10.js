// SPDX-License-Identifier: Apache-2.0
// Proof of One — a pilot poll that chooses the topic of a later poll (founder's proposal,
// 2026-11-25; a first, simple form of Decisions #15 and #18: members choose the topics).
//
// The app groups polls by category; v0.16 adds a fourth, "agenda": polls that choose what
// later polls ask about. This plan adds, on the same contract as plan9.js:
//   poll 4  agenda: which of four everyday topics one of the next pilot polls is about
// The topics are harmless (Decision #57, point 2). The winning topic becomes a later poll,
// whose question is written to the wording guideline (Decision #20).
// The category is part of the poll's text, so it is bound by the poll's metadataHash.
//
// Writes: stdout (web/plan10.json), ../relay/src/pilot-polls.json (adds poll 4), and
// $POLL_SECRETS (default ../../private/pilot4-secrets.json): PRIVATE synthetic trustee shares.
// Usage: node plan10.js web/plan9.json > web/plan10.json
"use strict";
const fs = require("fs");
const path = require("path");
const { ethers } = require("../contracts/node_modules/ethers");
const { create } = require("../tally/src/protocol");
const A = require("../ballot-circuit/src/attrs");
const B = require("../ballot-circuit/src/ballot");

const ROOT = path.join(__dirname, "..");
const SECRETS = process.env.POLL_SECRETS || path.join(ROOT, "..", "private", "pilot4-secrets.json");
const json = (o) => JSON.stringify(o, (k, v) => (typeof v === "bigint" ? v.toString() : v), 2);

const POLLS = [
  { pollId: 4n, text: {
    category: "agenda",
    en: { question: "Which topic should one of the next pilot polls be about?", options: ["Sleep and rest", "Reading and learning", "Food and cooking", "Travel and free time"] },
    fa: { question: "یکی از نظرسنجی‌های بعدی آزمایش درباره‌ی کدام موضوع باشد؟", options: ["خواب و استراحت", "کتاب و یادگیری", "غذا و آشپزی", "سفر و اوقات فراغت"] },
    ar: { question: "عن أي موضوع ينبغي أن يكون أحد استطلاعات التجربة القادمة؟", options: ["النوم والراحة", "القراءة والتعلّم", "الطعام والطبخ", "السفر وأوقات الفراغ"] },
    fr: { question: "Sur quel sujet devrait porter l'un des prochains sondages de l'essai ?", options: ["Le sommeil et le repos", "La lecture et l'apprentissage", "La nourriture et la cuisine", "Les voyages et les loisirs"] },
    es: { question: "¿Sobre qué tema debería ser una de las próximas encuestas de la prueba?", options: ["El sueño y el descanso", "La lectura y el aprendizaje", "La comida y la cocina", "Los viajes y el tiempo libre"] },
    de: { question: "Um welches Thema soll es in einer der nächsten Umfragen des Pilotversuchs gehen?", options: ["Schlaf und Erholung", "Lesen und Lernen", "Essen und Kochen", "Reisen und Freizeit"] },
    ru: { question: "О какой теме должен быть один из следующих опросов пилотного испытания?", options: ["Сон и отдых", "Чтение и учёба", "Еда и кулинария", "Путешествия и свободное время"] },
    zh: { question: "试点的下一次问卷之一应该关于哪个主题？", options: ["睡眠与休息", "阅读与学习", "饮食与烹饪", "旅行与休闲"] },
  } },
];

async function main() {
  const plan8 = JSON.parse(fs.readFileSync(process.argv[2], "utf8"));   // plan9.json: the same contracts and policy
  const chainId = BigInt(plan8.chainId), deployer = ethers.getAddress(plan8.deployer);
  const polls = plan8.contracts.ProofOfOnePolls;
  const P = await create({ dleq: "poseidon" });
  const pt = (X) => P.curve.coords(X);
  const POLICY = plan8.policy;
  const DURATION = 14n * 24n * 3600n;
  const txs = [], secrets = [], entries = [];
  for (const { pollId, text } of POLLS) {
    for (const [l, v] of Object.entries(text)) if (l !== "category" && v.options.length !== B.K) throw new Error("four options in every language");
    const keys = P.dkg(5, 3);
    const textJson = JSON.stringify(text);
    const metadataHash = ethers.keccak256(ethers.toUtf8Bytes(textJson));
    txs.push({ step: txs.length + 1, kind: "createPoll", name: `Create pilot poll ${pollId} (${text.category}; 4 options, open for 14 days, text in eight languages)`, to: polls,
      params: { tallyPK: pt(keys.PK), maxBirthDay: POLICY.maxBirthDay, minBirthDay: POLICY.minBirthDay, minExpiryMonth: POLICY.minExpiryMonth, requiredNat: 0, maxRevotes: 20,
        metadataHash, trusteeKeys: keys.publicShares.map((s) => pt(s.PK)), threshold: 3, sampleThreshold: 0 },
      duration: DURATION.toString(), check: { type: "pollCount", min: Number(pollId) } });
    secrets.push({ pollId, PK: pt(keys.PK), shares: keys.shares, publicShares: keys.publicShares.map((s) => ({ index: s.index, PK: pt(s.PK) })) });
    entries.push({ chainId: chainId.toString(), polls, pollId: pollId.toString(), metadataHash, textJson, text });
  }
  fs.mkdirSync(path.dirname(SECRETS), { recursive: true });
  fs.writeFileSync(SECRETS, json({ note: "PRIVATE. Synthetic trustee shares of pilot poll 4 (agenda; deployment 6), kept to decrypt and publish its result.", chainId, polls, dleq: "poseidon", polls_: secrets }));
  const file = path.join(ROOT, "relay", "src", "pilot-polls.json");
  const pilot = JSON.parse(fs.readFileSync(file, "utf8"));
  pilot.polls = pilot.polls.filter((p) => !(p.polls === polls && entries.some((e) => e.pollId === p.pollId))).concat(entries);
  fs.writeFileSync(file, JSON.stringify(pilot, null, 1) + "\n");
  process.stdout.write(json({
    title: "Proof of One — pilot poll 4 (agenda: the topic of a later poll) on deployment 6",
    warning: "TEST-ONLY trusted setups. Not audited. The test wallet never holds real funds.",
    chainId, deployer, startNonce: plan8.startNonce, pollId: 4n, tally: "proof", contracts: plan8.contracts, keySet: plan8.keySet, policy: POLICY,
    abi: plan8.abi, txs,
  }) + "\n");
  if (globalThis.curve_bn128) await globalThis.curve_bn128.terminate();
}
main().catch((e) => { console.error(e); process.exit(1); });
