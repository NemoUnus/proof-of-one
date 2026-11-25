// SPDX-License-Identifier: Apache-2.0
// Proof of One — two more pilot polls on deployment 6, by category (founder's proposal).
//
// The app groups open polls by category: polls about the project, social polls, and polls
// about the place where members live. Poll 1 of deployment 6 (plan8.js) is about the project.
// This plan adds, on the same contract:
//   poll 2  social:   how much time members spend on their phones outside work
//   poll 3  regional: the skill children most need for the future, where members live
// The pilot's questions stay harmless (Decision #57, point 2). "Regional" is only a label: a
// poll limited to one nationality would write that country's code on the public ledger and,
// with every pilot member holding the same country's passport, show where the pilot runs.
// Real regional polls (requiredNat) wait until members come from several countries.
// The category is part of the poll's text, so it is bound by the poll's metadataHash.
//
// Writes: stdout (web/plan9.json), ../relay/src/pilot-polls.json (adds polls 2 and 3), and
// $POLL_SECRETS (default ../../private/pilot3-secrets.json): PRIVATE synthetic trustee shares.
// Usage: node plan9.js web/plan8.json > web/plan9.json
"use strict";
const fs = require("fs");
const path = require("path");
const { ethers } = require("../contracts/node_modules/ethers");
const { create } = require("../tally/src/protocol");
const A = require("../ballot-circuit/src/attrs");
const B = require("../ballot-circuit/src/ballot");

const ROOT = path.join(__dirname, "..");
const SECRETS = process.env.POLL_SECRETS || path.join(ROOT, "..", "private", "pilot3-secrets.json");
const json = (o) => JSON.stringify(o, (k, v) => (typeof v === "bigint" ? v.toString() : v), 2);

const POLLS = [
  { pollId: 2n, text: {
    category: "social",
    en: { question: "Outside work, how many hours a day do you spend on your phone?", options: ["Less than 1 hour", "1 to 3 hours", "3 to 5 hours", "More than 5 hours"] },
    fa: { question: "جدا از کار، روزی چند ساعت با گوشی وقت می‌گذرانید؟", options: ["کمتر از ۱ ساعت", "۱ تا ۳ ساعت", "۳ تا ۵ ساعت", "بیشتر از ۵ ساعت"] },
    ar: { question: "خارج العمل، كم ساعة في اليوم تقضي على هاتفك؟", options: ["أقل من ساعة", "من ساعة إلى ٣ ساعات", "من ٣ إلى ٥ ساعات", "أكثر من ٥ ساعات"] },
    fr: { question: "En dehors du travail, combien d'heures par jour passez-vous sur votre téléphone ?", options: ["Moins d'une heure", "1 à 3 heures", "3 à 5 heures", "Plus de 5 heures"] },
    es: { question: "Fuera del trabajo, ¿cuántas horas al día pasa con el teléfono?", options: ["Menos de 1 hora", "De 1 a 3 horas", "De 3 a 5 horas", "Más de 5 horas"] },
    de: { question: "Wie viele Stunden am Tag verbringen Sie außerhalb der Arbeit mit Ihrem Telefon?", options: ["Weniger als 1 Stunde", "1 bis 3 Stunden", "3 bis 5 Stunden", "Mehr als 5 Stunden"] },
    ru: { question: "Сколько часов в день вне работы вы проводите в телефоне?", options: ["Меньше 1 часа", "От 1 до 3 часов", "От 3 до 5 часов", "Больше 5 часов"] },
    zh: { question: "工作之外，您每天花多少小时在手机上？", options: ["少于 1 小时", "1 到 3 小时", "3 到 5 小时", "超过 5 小时"] },
  } },
  { pollId: 3n, text: {
    category: "regional",
    en: { question: "Where you live, what is the most important skill today's children need for the future?", options: ["A foreign language", "Programming and technology", "A practical trade or craft", "Working with others and communication"] },
    fa: { question: "به نظر شما مهم‌ترین مهارتی که بچه‌های امروزِ جایی که زندگی می‌کنید برای آینده لازم دارند چیست؟", options: ["زبان خارجی", "برنامه‌نویسی و فناوری", "مهارت فنی و حرفه‌ای (یک کار با دست)", "ارتباط با دیگران و کار گروهی"] },
    ar: { question: "في المكان الذي تعيش فيه، ما أهم مهارة يحتاجها أطفال اليوم للمستقبل؟", options: ["لغة أجنبية", "البرمجة والتكنولوجيا", "مهارة مهنية أو حرفة يدوية", "التواصل مع الآخرين والعمل الجماعي"] },
    fr: { question: "Là où vous vivez, quelle est la compétence la plus importante dont les enfants d'aujourd'hui auront besoin pour l'avenir ?", options: ["Une langue étrangère", "La programmation et la technologie", "Un métier manuel ou technique", "Travailler avec les autres et communiquer"] },
    es: { question: "Donde usted vive, ¿cuál es la habilidad más importante que los niños de hoy necesitan para el futuro?", options: ["Un idioma extranjero", "Programación y tecnología", "Un oficio práctico o manual", "Trabajar con otros y comunicarse"] },
    de: { question: "Welche Fähigkeit brauchen Kinder dort, wo Sie leben, heute am meisten für die Zukunft?", options: ["Eine Fremdsprache", "Programmieren und Technik", "Ein praktisches Handwerk", "Zusammenarbeit und Kommunikation"] },
    ru: { question: "Там, где вы живёте, какой навык сегодняшним детям важнее всего для будущего?", options: ["Иностранный язык", "Программирование и технологии", "Практическое ремесло", "Работа с людьми и общение"] },
    zh: { question: "在您生活的地方，今天的孩子们为未来最需要的技能是什么？", options: ["一门外语", "编程与技术", "一门实用的手艺或技能", "与人合作和沟通"] },
  } },
];

async function main() {
  const plan8 = JSON.parse(fs.readFileSync(process.argv[2], "utf8"));
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
  fs.writeFileSync(SECRETS, json({ note: "PRIVATE. Synthetic trustee shares of pilot polls 2 and 3 (deployment 6), kept to decrypt and publish their results.", chainId, polls, dleq: "poseidon", polls_: secrets }));
  const file = path.join(ROOT, "relay", "src", "pilot-polls.json");
  const pilot = JSON.parse(fs.readFileSync(file, "utf8"));
  pilot.polls = pilot.polls.filter((p) => !(p.polls === polls && entries.some((e) => e.pollId === p.pollId))).concat(entries);
  fs.writeFileSync(file, JSON.stringify(pilot, null, 1) + "\n");
  process.stdout.write(json({
    title: "Proof of One — pilot polls 2 (social) and 3 (regional) on deployment 6",
    warning: "TEST-ONLY trusted setups. Not audited. The test wallet never holds real funds.",
    chainId, deployer, startNonce: plan8.startNonce, pollId: 3n, tally: "proof", contracts: plan8.contracts, keySet: plan8.keySet, policy: POLICY,
    abi: plan8.abi, txs,
  }) + "\n");
  if (globalThis.curve_bn128) await globalThis.curve_bn128.terminate();
}
main().catch((e) => { console.error(e); process.exit(1); });
