# Proof of One: an introduction

**Open, verifiable polls in which each person takes part once and no one can see how anyone answered.**

*November 2026. For organisations and readers without a technical background. Design stage: not audited and not ready for real participants. Licence: CC BY-SA 4.0.*

---

## Why this matters

Public opinion is hard to measure honestly, and hardest where it matters most.

- **Online polls and petitions can be faked.** Software can pose as thousands of people, and one person can answer many times. As AI agents spread, this gets cheaper every year.
- **Published results cannot be checked.** People have to trust whoever ran the poll, and nobody outside can recount.
- **Where speaking openly is risky, honest answers are rare.** Many people will not tell a pollster, a website or a phone survey what they really think if their answer could be traced back to them.

A tool that gave everyone a safe, private way to be counted, once each, with results anyone can check, would help journalists, researchers, communities and decision-makers everywhere. It would help most where opinion is otherwise unheard.

## What Proof of One is

An open-source, non-commercial system for opinion polls with four properties:

1. **One person, one voice.** Each participant joins once, by holding their chip passport or chip ID card to an ordinary phone and matching their live face to the photo in the chip. A person cannot join twice, and computer programs cannot join at all.
2. **Private answers.** Answers are locked with encryption on the phone. Only the totals are ever unlocked. The people who run the system cannot see who answered what.
3. **Each person can check their own answer.** After answering, the phone reads the public record and shows the answer that was recorded.
4. **Anyone can recount.** The locked answers are kept on a public ledger, and the totals can be checked by anyone without trusting the operators.

Taking part is free. The participants themselves choose which questions are asked, region by region, with a global track for questions that concern everyone.

## How it works, in three steps

1. **Join once.** The phone checks the document and the face. Nothing personal is put on the public ledger. The phone receives an anonymous membership that cannot be traced back to the document.
2. **Answer.** The phone locks the answer and attaches a mathematical proof (a "zero-knowledge proof") that it comes from a real, eligible member who has not answered before. The proof says nothing about which member.
3. **Count.** The locked answers are added up while still locked. Several independent key holders together unlock only the totals, with proofs that anyone can check. In the latest version, tested but not yet on the public test network, the system refuses a result unless it comes with a proof that it is correct.

## What it does not promise

We would rather be trusted for our limits than for our claims.

- **It is not yet safe for real use.** No independent human expert has reviewed it yet. All tests use made-up identities.
- **It does not hide that someone took part** from everyone. Someone who watches a person's internet connection, or holds their unlocked phone, may be able to tell that they answered, though not what they answered once the short receipt period is over.
- **A state that issues passports could create false identities.** The design makes this costly and visible, but cannot fully prevent it.
- **Not everyone can join yet.** Only about one person in six worldwide has a chip document that a phone can read, with large gaps in South Asia and Africa. For people without a suitable phone, it is planned that one phone can hold the profiles of several family members, each with its own PIN.
- **A stolen phone** can be used to answer until the member's recovery is complete, which takes a waiting period for safety.
- **These are opinion polls, not elections.** Results are not legally binding.

## Where it stands (November 2026)

- **Published:** a full design document (whitepaper version 1.2), detailed specifications, and the decisions behind them, all in the open.
- **Working on a public test network, with made-up identities only:** the voting contracts, two test polls with answers sent from ordinary phones, a page on which each voter sees their recorded answer, a relay that lets people answer without any cryptocurrency wallet, and a public test log of answers.
- **Measured:** on a recent phone, the proof for one answer takes half a second; the proof for checking a passport takes about three seconds. Low-cost phones have not been measured yet.
- **Next:** review by independent experts, measurements on low-cost phones, and the first enrolment screens with made-up documents. Real participants come only after the reviews and their findings are fixed.

## Who is behind it

The project is led by a single founder under the pseudonym **Nemo Unus**, who prefers to stay anonymous for personal safety. The code and documents are written with openly disclosed AI agents, and the founder reviews and decides every change. Everything is public at github.com/NemoUnus/proof-of-one. The project has no company, no investors, no token and nothing for sale, and it does not accept money until legal questions have been answered. It never asks for money in private messages.

We know that an anonymous, AI-assisted project has to earn trust. That is why everything is open to inspection, and why we ask for independent review before anyone relies on it.

## How your organisation could help

We are not asking for endorsement or partnership at this stage. We are asking for **advice and critique**, in any of these areas:

- **Participant safety:** what could put people in danger, and what would make it safer.
- **Digital security:** weak points in the design, the phone app or the network setup.
- **Data protection and law:** face data, identity documents and running polls across borders.
- **Polling methods:** how to make results meaningful and honest.
- **Review and audit:** introductions to people or programmes that review open-source tools for internet freedom.

A short reply naming the biggest problem you see would already help.

---

**Read more:** github.com/NemoUnus/proof-of-one (start with the one-page summary or the technical brief for reviewers).
**Contact:** NemoUnus@proton.me
