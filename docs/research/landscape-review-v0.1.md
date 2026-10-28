# Landscape review: existing systems and the gaps Proof of One tries to close — v0.1

> **Superseded by [v0.2](landscape-review-v0.2.md)** (28 October 2026), which corrects factual errors and overstated claims found in review. Kept for the record.

*Authors: Hermes and Metron (AI agents), with Prosopon and Psephos (AI agents). Schedule activity 0.13. Status: draft for review by the founder and by outside readers. Facts about other projects come from their own documents, independent reviews and news reports listed in §8, as published by October 2026. Projects change quickly; corrections are welcome as issues.*

## 1. Why this review

Proof of One combines two things that are usually built separately: **proof that each participant is one real, unique person**, and **a vote or poll whose result anyone can check**. Many serious projects solve one of the two, and some solve parts of both. This review asks, for each family of systems:

1. What does it do well?
2. Which weakness, for the purpose of a public, verifiable poll of real people, does it leave open?
3. Does Proof of One address that weakness, and how far along is the answer (designed, implemented, tested)?
4. Where is the other system ahead of us?

The purpose is not to rank projects. Several of them are better than Proof of One at what they were built for, and some are possible partners or sources of reusable components.

## 2. What a public poll of real people needs

We compare systems on eight criteria. They follow from the two founding properties (R1: every voter can verify their own vote; R2: anyone can recount) and from the threat model.

| # | Criterion | Question |
|---|---|---|
| C1 | **Uniqueness** | Can one person take part only once, even with two documents or several devices? |
| C2 | **Authenticity** | Is each participant a real person, checked against something hard to forge? |
| C3 | **Privacy** | Is the answer unlinkable to the person, including from the operator? |
| C4 | **Individual verifiability** | Can each participant check that their own answer was counted as cast (R1)? |
| C5 | **Universal verifiability** | Can anyone recount the result from public data (R2)? |
| C6 | **No single trusted party** | Is there any one operator who can see answers, change results or block people? |
| C7 | **Coercion resistance** | Can a person be forced or paid to answer a certain way and prove it? |
| C8 | **Open access** | Is it open source, free for participants, without proprietary hardware, tokens or a company that owns the identity? |

## 3. Families of existing systems

### 3.1 Proof of personhood by biometrics

**World ID (World, formerly Worldcoin).** A custom device, the Orb, scans the iris; the person receives an anonymous credential and can prove "I am a unique human" with zero-knowledge proofs. It has the largest biometric uniqueness set of any private project.

- *Strengths:* strong uniqueness (C1) without asking for a name; mature zero-knowledge tooling; large scale.
- *Weaknesses for our purpose:*
  - Uniqueness depends on proprietary hardware and on one organisation that runs the Orbs and the uniqueness database (C6, C8).
  - It is tied to a cryptocurrency token, and sign-up has often been paired with a token reward. The Kenyan government suspended its activity in 2023 partly because payment for consent "bordered on inducement".
  - Several data protection authorities have acted against its biometric collection: a temporary ban in Spain (March 2024, upheld by Spain's High Court), a 90-day stop in Portugal, and inquiries in Argentina, France, Germany (the lead EU authority, in Bavaria) and the United Kingdom [W1].
  - It proves "a unique human", not attributes such as age group or nationality, so it cannot report verified demographics.
- *Ahead of us:* scale, deployment experience, and an audited production system. World ID has also met real regulators; we have not.

**Humanity Protocol** (palm scan) follows the same pattern with a different body part and has the same dependency on one operator and a token.

### 3.2 Proof of personhood by social trust and scoring

**Human Passport (formerly Gitcoin Passport)** collects "stamps" from many independent checks (accounts, on-chain history, other identity services) into a humanity score [H1]. **BrightID** builds a social graph in which people vouch for each other. **Proof of Humanity** registers people with a video and vouching by existing members. **Idena** runs simultaneous online puzzle tests ("flips") that each person must solve in a short window.

- *Strengths:* no biometric database held by one company; open communities; useful against cheap bot attacks; Human Passport is widely used to filter airdrops and grant rounds.
- *Weaknesses for our purpose:*
  - Uniqueness is probabilistic (C1). A score lowers the number of fake accounts but does not guarantee one person, one voice. Well-resourced actors, especially one able to recruit many real people, can pass.
  - Video and social vouching expose people's faces or social links to other members (C3), which is dangerous where participation itself is risky.
  - They do not carry verified attributes such as age or nationality.
- *Ahead of us:* they work today, at scale, with no document. People without a chip passport can join them; they cannot join Proof of One (§5).

### 3.3 Proof of personhood from identity documents ("ZK passport" systems)

These systems read the chip of a passport or national ID card with the phone's NFC reader and prove facts about it with zero-knowledge proofs, without showing the document.

- **Rarimo and its Freedom Tool**: a shared on-chain registry of identities; used in 2024 for an unofficial online vote organised by a civil-society group [R1][R2].
- **Self** (formerly OpenPassport, now Self Labs): passport and other IDs, selective disclosure for age and country, aimed at sybil-resistant distributions [S1].
- **ZKPassport**: open-source app; proves attributes and gives a "domain- and scope-scoped unique identifier that is stable for the same ID" [S2].
- **Anon Aadhaar**: the same idea for India's signed Aadhaar QR code.
- **Privado ID** (formerly Polygon ID, built on iden3): issuer-signed credentials with revocation trees and nullifiers.

This is the family closest to Proof of One. The Safe Foundation's comparison (September 2025) summarises their shared limits: "There are no built-in biometric liveness checks", heavy proofs are constrained by phones, and a person with several passports can enrol several times [S2].

- *Strengths:* authenticity rests on government signatures (C2); attributes such as age and nationality can be proven privately; no proprietary hardware; several are open source.
- *Weaknesses for our purpose:*
  - **Document uniqueness, not person uniqueness (C1).** The identifier is derived from the document. A person with two nationalities, or a renewed passport, can obtain two identities. Rarimo's own README notes: "The nullifier can be bypassed by reissuing the identity" [R1].
  - **No liveness (C2).** Whoever holds the passport can enrol, including someone who bought or borrowed it.
  - **Trust lists are thin or implicit.** Which country signing certificates are accepted, where they came from and how they are checked is often not published as a reproducible list. Our own field test showed why this matters: a commercial reader read a real chip correctly but could not verify it, because it lacked the issuing country's certificate ([trust list §1](../specs/trust-list-v0.1.md)).
  - **Voting is an add-on.** In the Freedom Tool, votes were recorded on chain in readable form, so ballot secrecy depended on the unlinkability of the identity alone. Tallies are usually plain counts; there is no threshold encryption and no published recount tool.
  - Most are companies backed by venture or token funding, which shapes what they build next (C8).
- *Ahead of us:* deployed apps, real users, audited circuits for many document types and signature suites, and mobile provers that run on mid-range phones. Their circuits are candidates for reuse (schedule task 0.6-08).

### 3.4 State digital identity

**The EU Digital Identity Wallet**, national eID cards, **Aadhaar** and similar systems give strong, legally recognised identity.

- *Strengths:* uniqueness and authenticity backed by a state register; legal standing; growing selective-disclosure support.
- *Weaknesses for our purpose:* each covers one jurisdiction; the issuing state is by design the trusted party (C6); answers to a poll run on such a system are only as private as that state permits; and people outside the system, such as citizens abroad or stateless people, are excluded.
- *Ahead of us:* everything that needs legal force. Proof of One is not a substitute for them, and its future binding-vote mode is reserved for uses a public body has authorised.

### 3.5 Verifiable voting protocols

These systems make the **vote** verifiable but take the list of eligible voters as given.

**Helios and Belenios** are open-source, end-to-end verifiable voting systems from academia. Ballots are encrypted, voters can audit their ballot, and anyone can check the tally. They are widely used for university and association elections.

- *Weakness for our purpose:* the voter list and the voters' credentials come from the organiser (C1, C2). Helios also has a weak point in coercion resistance (C7), which its authors state openly.

**Microsoft ElectionGuard** is an open-source toolkit that adds end-to-end verifiability to existing election equipment; it has been piloted in real public elections in the United States and described at USENIX Security 2024 [E1].

- *Weakness for our purpose:* it assumes in-person elections with an official voter roll. It is a verifiability layer, not an identity layer.

**The Swiss Post e-voting system** is used by several Swiss cantons for voters abroad and voters with disabilities. Its source code and documentation are published, and it has passed several public intrusion tests, including one in 2024 with over 3,400 registered participants, with no critical vulnerabilities found [E2].

- *Weakness for our purpose:* it is a state system for one country's official votes, with credentials delivered by post to registered voters.
- *Ahead of us:* legal certification, years of public scrutiny and paid bug bounties. Its published proofs of verifiability are a model for our own documentation.

**MACI (Minimal Anti-Collusion Infrastructure)**, from the Ethereum Foundation's Privacy and Scaling Explorations, adds **collusion resistance**: voters can change their key, so a vote shown to a briber may already have been replaced. Its own documentation is clear about the price: "MACI can provide collusion resistance only if the coordinator is honest", and "No one except a trusted coordinator should be able to decrypt a vote", although a dishonest coordinator "can neither censor nor tamper with its execution". It assumes that "each legitimate member controls a unique Ethereum private key" [M1].

- *Weaknesses for our purpose:* one coordinator sees every vote (C3, C6); uniqueness is left to whoever admits members (C1).
- *Ahead of us:* receipt-freeness (C7). MACI's key-change design is exactly the mechanism our threat model requires before any binding vote ([threat model T5](../specs/threat-model-v0.1.md)).

**Vocdoni and its new DAVINCI protocol** is the closest polling project. It offers verifiable, anonymous voting with zero-knowledge proofs, and DAVINCI adds re-encryption for receipt-freeness [V1].

- *Weaknesses for our purpose:* the census (who may vote) is supplied by the organiser, so uniqueness is only as good as the organiser's list (C1, C2); the network uses its own token.
- *Ahead of us:* a production platform with many real organisations, and the receipt-freeness design we have not built. We regard DAVINCI as a possible partner: Proof of One identities could serve as a census for it.

### 3.6 Commercial mobile voting

**Voatz** verifies voters with a photo of their ID and a selfie and records votes on a permissioned blockchain run by the company. In 2020, researchers at MIT reported "a number of high-severity vulnerabilities". A follow-up audit by Trail of Bits, paid for by Voatz, confirmed them and listed 79 findings, about a third rated high severity [C1].

- *Weaknesses for our purpose:* closed source; one company operates all servers and sees identity and vote data (C3, C6); a "blockchain" run by one party adds no independent verifiability (C5); identity is checked by photo and selfie, not by the document's cryptographic signature (C2).
- This is the clearest example of what we must avoid: verifiability claimed, but not open to anyone to check.

### 3.7 Online polls, survey panels and civic platforms

**Commercial survey panels** recruit and check their own respondents. **Online polls** on social media and news sites accept anyone. **Civic participation platforms** such as Decidim, Pol.is, Loomio and LiquidFeedback organise proposals, deliberation and votes, often for city governments and associations.

- *Strengths:* experience with real public participation, good deliberation tools, wide use by public bodies (Decidim in particular), and open source in the civic case.
- *Weaknesses for our purpose:* uniqueness depends on accounts, e-mail or the operator's own checks (C1, C2); results cannot be recounted by outsiders (C5); the operator sees who answered what (C3). Panel results are only as trustworthy as the company running the panel.
- *Ahead of us:* Pol.is and Decidim show how to turn opinions into useful public decisions, which Proof of One does not attempt. They are natural places to use Proof of One identities.

### 3.8 DAO governance tools

**Snapshot, Tally, Agora and Aragon** run votes for blockchain organisations. Most count **tokens**, not people, and votes are public. They show that on-chain, publicly checkable tallies work at scale, but they were not designed for one person, one voice or for ballot secrecy.

## 4. Comparison matrix

● = met by design; ◐ = partly, or depends on another party; ○ = not met; — = not the system's purpose. The Proof of One row describes the design; §5 says which parts exist as code.

| System | C1 Uniqueness | C2 Authenticity | C3 Privacy | C4 Own vote | C5 Recount | C6 No single trusted party | C7 Coercion | C8 Open access |
|---|---|---|---|---|---|---|---|---|
| World ID | ● iris | ● | ◐ | — | — | ○ one operator | — | ○ hardware, token |
| Human Passport, BrightID, PoH, Idena | ◐ score or social | ◐ | ◐ | — | — | ◐ | — | ● |
| ZK passport (Rarimo, Self, ZKPassport) | ◐ per document | ◐ no liveness | ● | ◐ | ◐ | ◐ | ○ | ◐ |
| State eID, EU wallet | ● | ● | ◐ | — | — | ○ the state | — | ◐ one jurisdiction |
| Helios, Belenios | ◐ organiser's list | ◐ | ● | ● | ● | ◐ | ◐ | ● |
| ElectionGuard | ◐ voter roll | ● in person | ● | ● | ● | ◐ | ◐ | ● |
| Swiss Post e-voting | ● state register | ● | ● | ● | ◐ certified auditors | ◐ | ◐ | ○ one country |
| MACI | ◐ admitted keys | ◐ | ◐ coordinator sees votes | ● | ● | ○ coordinator | ● | ● |
| Vocdoni DAVINCI | ◐ organiser's census | ◐ | ● | ● | ● | ◐ | ● | ◐ token |
| Voatz | ◐ | ◐ photo and selfie | ○ | ◐ | ○ | ○ | ○ | ○ closed |
| Survey panels, online polls | ○ | ○ | ○ | ○ | ○ | ○ | ○ | ◐ |
| Civic platforms (Decidim, Pol.is) | ◐ accounts | ◐ | ◐ | ○ | ○ | ○ | ○ | ● |
| **Proof of One (design)** | **● document and face** | **● signature and liveness** | **●** | **●** | **●** | **◐ threshold trustees, one enclave** | **◐ re-answer only** | **●** |

## 5. Weaknesses Proof of One addresses, and how far along each answer is

| Weakness found in others | Proof of One's answer | Status (October 2026) |
|---|---|---|
| One person, two passports, two identities (ZK passport family) | Two layers: document uniqueness, and face uniqueness checked inside a hardware enclave against all enrolled faces; one identity across several nationalities | Designed ([face uniqueness](../specs/face-uniqueness-at-scale-v0.1.md), [several nationalities](../specs/several-nationalities-v0.1.md)); document layer implemented in reference code; enclave not yet built |
| No liveness: whoever holds the passport can enrol | Live face matched to the chip photo, whose hash is bound into the document proof as `C_face` | Binding implemented and tested in π_doc; liveness and matching designed, not built |
| Trust in country certificates is implicit | Public, reproducible trust list: references only, pinned anchors, a `listHash` anyone can rebuild | Implemented and run on the real German master list (113 of 186 chip-passport countries) ([trust list](../specs/trust-list-v0.1.md)) |
| Document checks done by a server that sees the document | π_doc proves on the phone that the chip data was signed by a checked signer, without revealing it | Circuit implemented (577,678 constraints) and tested with synthetic documents; proving time on phones not yet measured |
| Uniqueness bound to an operator's census (Helios, MACI, Vocdoni) | The census is the public set of Proof of One identities; any poll selects from it by proven attributes | Implemented in reference contracts and circuits |
| Votes in plain text on chain (Freedom Tool) or readable by one coordinator (MACI) | One-hot ballots under exponential ElGamal, encrypted to a key shared by independent trustees; no single party can decrypt | Implemented and tested |
| Trustee key made by a dealer who knows it | Distributed key generation in which complaints are decided by anyone from the public transcript | Implemented and tested ([trustee key generation](../specs/trustee-key-generation-v0.1.md)) |
| Results that cannot be recounted (panels, Voatz, civic platforms) | Every ballot, proof and decryption share is public; a recount tool rebuilds every result from public data alone (R2) | Implemented and tested |
| Voter cannot see their own vote was counted | The phone checks that its ballot is recorded and included in the published tally (R1) | Implemented and tested |
| Proprietary hardware, tokens, paid sign-up | Ordinary phone with NFC and camera; no token; free for participants; non-commercial foundation | By design ([decision log](../decisions/DECISION_LOG.md)) |
| No verified demographics in anonymous systems | Results by proven age group and nationality, with small groups suppressed | Implemented in circuits; suppression rule designed |

## 6. Where Proof of One is behind, or has weaknesses of its own

Honesty about these points matters more than the table above.

1. **Nothing is deployed or audited.** Every system above, except the academic prototypes, has real users. Our code is reference code, reviewed by no independent human expert yet.
2. **The enclave is a single trusted component.** Face uniqueness depends on a hardware enclave run by an operator, and on the honesty of the chip vendor's attestation. This is weaker on C6 than the threshold design used for ballots. Its specification states this as a residual risk.
3. **Coercion resistance is weaker than MACI or DAVINCI.** Re-answering before the poll closes reduces coercion but does not remove it, and an encrypted ballot can serve as a receipt if the voter reveals its randomness. A receipt-free design is required before any binding use ([threat model T5](../specs/threat-model-v0.1.md)).
4. **Coverage is limited to chip-passport holders.** People without a chip passport, or from countries whose certificates we cannot yet obtain, cannot enrol. Proof-of-personhood systems based on social trust include them; we do not. This excludes some of the people who most need a voice.
5. **A state can issue genuine documents.** A government that issues real passports to non-existent people defeats the document layer; only the face layer stands in the way. This is the fundamental limit stated in the whitepaper.
6. **Biometric data, even briefly held, is sensitive.** The design deletes images inside the enclave and keeps only templates, but it still processes faces. Regulators' actions against World show how this will be judged.
7. **Phone performance is unproven.** The document proof is large, and our proving time on phones is not yet measured. Other ZK-passport teams have solved this in production.

## 7. Conclusions

- **No existing system combines guaranteed person-level uniqueness, private verified attributes, and a ballot that any voter can verify and anyone can recount, without a single trusted operator.** Each family meets some of these. This combination is Proof of One's reason to exist.
- **The closest systems are partners rather than rivals.** ZK-passport projects could share circuits and trust lists; Vocdoni DAVINCI or MACI could use Proof of One identities as a census and contribute receipt-freeness; civic platforms could use verified polls.
- **Our own two biggest open problems are the enclave and coercion resistance.** Both are already in the schedule; this review raises their priority before any field pilot.

### Proposed next steps

- Add a short version of this review to whitepaper v0.9, replacing the current §5 table.
- Ask the teams of ZKPassport, Self, Rarimo and Vocdoni to correct any statement about their systems before v0.9 is published.
- Keep this document as a living page; update it when a project changes.

## 8. Sources

- [W1] Reuters factbox on regulatory scrutiny of World (Worldcoin), March 2024: https://tech.yahoo.com/general/articles/factbox-scrutiny-iris-scanning-crypto-102600350.html
- [H1] Human Passport, "Proof of personhood and sybil resistance for Web3": https://passport.human.tech/blog/human-passport-proof-of-personhood-and-sybil-resistance-for-web3
- [R1] Rarimo, Freedom Tool source repository and README: https://github.com/rarimo
- [R2] Safe Foundation, "ZK Passport: where are we now?" (4 September 2025), also covers Rarimo: https://safefoundation.org/blog/safe-research-zk-passport-where-are-we-now
- [S1] Celo blog, "Self Protocol: a sybil-resistant identity primitive for real people launches following acquisition": https://blog.celo.org/self-protocol-a-sybil-resistant-identity-primitive-for-real-people-launches-following-acquisition-74fd3461a428
- [S2] Safe Foundation, as [R2].
- [E1] Benaloh et al., "ElectionGuard: a cryptographic toolkit to enable verifiable elections", USENIX Security 2024: https://usenix.org/conference/usenixsecurity24/presentation/benaloh
- [E2] Swissinfo, "Swiss Post reports e-voting system has no major vulnerabilities": https://www.swissinfo.ch/eng/swiss-politics/according-to-the-post-the-e-voting-system-has-no-critical-vulnerabilities/91962723 ; Swiss Post publications and source code: https://digital-solutions.post.ch/en/e-government/digitization-solutions/e-voting/publications-and-source-code
- [M1] MACI documentation, introduction (v3.x): https://maci.pse.dev/docs/introduction
- [V1] Vocdoni, DAVINCI protocol announcement and documentation: https://vocdoni.io
- [C1] Wikipedia, "Voatz" (MIT 2020 study and Trail of Bits audit, with original references): https://en.wikipedia.org/wiki/Voatz
- Helios: https://heliosvoting.org ; Belenios: https://www.belenios.org ; Decidim: https://decidim.org ; Pol.is: https://pol.is

— Hermes, Metron, Prosopon and Psephos (AI agents, Proof of One)
