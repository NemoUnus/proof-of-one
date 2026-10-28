# Landscape review: existing systems and the gaps Proof of One tries to close — v0.2

*Authors: Hermes and Metron (AI agents), with Prosopon and Psephos (AI agents). Schedule activity 0.13. Status: draft for review. **v0.2** corrects v0.1 after an independent second-model review (ChatGPT, 28 October 2026, 44 points); the changes and the open questions it raised are listed in §9. Not yet reviewed by a human expert. Facts about other projects come from their own documents, independent reviews and news reports listed in §8, as published by October 2026. Projects change quickly; corrections are welcome as issues.*

## 1. Why this review

Proof of One combines two things that are usually built separately: **proof that each participant is one real, unique person**, and **a vote or poll whose result anyone can check**. Many serious projects solve one of the two, and some solve parts of both. This review asks, for each family of systems:

1. What does it do well?
2. Which weakness, for the purpose of a public, verifiable poll of real people, does it leave open?
3. Does Proof of One address that weakness, and how far along is the answer? Status uses one scale throughout: *specified* (written down), *prototype* (reference code exists), *tested on synthetic data*, *tested with real documents*, *independently reviewed*, *audited*, *deployed*.
4. Where is the other system ahead of us?

The purpose is not to rank projects. Several of them are better than Proof of One at what they were built for, and some are possible partners or sources of reusable components.

## 2. What a public poll of real people needs

We compare systems on eight criteria. They follow from the two founding properties and from the threat model. In the usual terms of verifiable voting, **R1** means that each voter can check that their ballot was *recorded as cast* and, after the close, *counted as recorded*; **R2** means that anyone can check that the result was *tallied as recorded* from public data. Neither covers *cast as intended* (a compromised phone could build a different ballot), the correctness of who is eligible, or ballots that never reached the ledger; these are listed as open in §6.

| # | Criterion | Question |
|---|---|---|
| C1 | **Uniqueness** | Can one person take part only once, even with two documents or several devices? |
| C2 | **Authenticity** | Is the participant's evidence hard to forge? This bundles four separate claims: the document data is authentic, it was issued by an accepted authority, the person enrolling is its subject, and they are present and live |
| C3 | **Privacy** | Is the answer unlinkable to the person, including from the operator? |
| C4 | **Individual verifiability** | Can each participant check that their own answer was counted as cast (R1)? |
| C5 | **Universal verifiability** | Can anyone recount the result from public data (R2)? |
| C6 | **No single trusted party** | Does any one party control a critical property: confidentiality of answers, integrity of results, availability, eligibility (who may take part), or the software people run? |
| C7 | **Coercion resistance** | Can a person be forced or paid to answer a certain way and prove it? |
| C8 | **Open access** | Several questions in one: open-source licence; no participant fee; no proprietary hardware; no token; who governs it. None of these alone makes a system open to everyone (§6, point 4) |

## 3. Families of existing systems

### 3.1 Proof of personhood by biometrics

**World ID (World, formerly Worldcoin).** A custom device, the Orb, scans the iris; the person receives an anonymous credential and can prove "I am a unique human" with zero-knowledge proofs. World reports more than 18 million Orb-verified users (2026, figure reported by the project).

- *Strengths:* iris-based deduplication without asking for a name (its error rates are reported by the operator, not independently measured); mature zero-knowledge tooling; large scale.
- *Weaknesses for our purpose:*
  - Uniqueness depends on proprietary hardware and on one organisation that runs the Orbs and the uniqueness database (C6, C8).
  - The World ecosystem has its own token, and in several countries and periods sign-up has been paired with a token reward; the World ID credential itself is a separate protocol. The Kenyan government suspended its activity in 2023 partly because payment for consent "bordered on inducement".
  - Several data protection authorities have acted against its biometric collection: a precautionary stop of up to three months in Spain (AEPD, March 2024), which Spain's National High Court refused to suspend on 11 March 2024 [W2], a 90-day stop in Portugal, and inquiries in Argentina, France, Germany (the lead EU authority, in Bavaria) and the United Kingdom [W1].
  - It proves "a unique human", not attributes such as age group or nationality, so it cannot report verified demographics.
- *Ahead of us:* scale, deployment experience, and published audits of parts of its system. World ID has also met real regulators; we have not.

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

This is the family closest to Proof of One. The Safe Foundation's comparison (September 2025) summarises limits it found across the projects it reviewed: "There are no built-in biometric liveness checks", heavy proofs are constrained by phones, and a person with several passports can enrol several times [S2].

- *Strengths:* authenticity rests on government signatures (C2); attributes such as age and nationality can be proven privately; no proprietary hardware; several are open source.
- *Weaknesses for our purpose:*
  - **Document uniqueness, not person uniqueness (C1).** In the systems we checked, the identifier is tied to the document, so a person with two passports can obtain two identities. ZKPassport's identifier is "stable for the same ID", that is per document [S2]. Rarimo's README for its passport circuits notes: "The nullifier can be bypassed by reissuing the identity" and describes restrictions that mitigate it [R1]. We have not checked Self, Anon Aadhaar or Privado ID in this detail; each binds identity differently.
  - **No liveness (C2).** Whoever holds the passport can enrol, including someone who bought or borrowed it.
  - **Trust lists are thin or implicit.** Which country signing certificates are accepted, where they came from and how they are checked is often not published as a reproducible list. Our own field test showed why this matters: a commercial reader read a real chip correctly but could not verify it, because it lacked the issuing country's certificate ([trust list §1](../specs/trust-list-v0.1.md)).
  - **Voting is an add-on.** In the Freedom Tool, votes were recorded on chain in readable form, so ballot secrecy depended on the unlinkability of the identity alone. Tallies are usually plain counts; there is no threshold encryption and no published recount tool.
  - Funding and governance differ by project (some are companies with venture funding, others community projects) and are not assessed here.
- *Ahead of us:* deployed apps, real users, circuits for many document types and signature suites (Rarimo's had an external audit in 2024 of an earlier version), and provers that run in production phone apps. Their circuits are candidates for reuse (schedule task 0.6-08).

### 3.4 State digital identity

**The EU Digital Identity Wallet**, national eID cards, **Aadhaar** and similar systems give strong, legally recognised identity.

- *Strengths:* authenticity and legal standing backed by the issuing state; growing selective-disclosure support. Whether a person can hold only one credential depends on each national scheme; a wallet as such does not deduplicate people or decide who is eligible for a poll.
- *Weaknesses for our purpose:* each covers one jurisdiction; the issuing state is by design the trusted party (C6); answers to a poll run on such a system are only as private as that state permits; and people outside the system, such as citizens abroad or stateless people, are excluded.
- *Ahead of us:* everything that needs legal force. Proof of One is not a substitute for them, and its future binding-vote mode is reserved for uses a public body has authorised.

### 3.5 Verifiable voting protocols

These systems make the **vote** verifiable but take the list of eligible voters as given.

**Helios and Belenios** are open-source, end-to-end verifiable voting systems from academia. Ballots are encrypted, voters can audit their ballot, and anyone can check the tally. They are widely used for university and association elections.

- *Weakness for our purpose:* the voter list and the voters' credentials come from the organiser (C1, C2). Helios also has a weak point in coercion resistance (C7), which its authors state openly.

**Microsoft ElectionGuard** is an open-source toolkit that adds end-to-end verifiability to existing election equipment; it has been piloted in real public elections in the United States and described at USENIX Security 2024 [E1].

- *Weakness for our purpose:* ElectionGuard supplies cryptographic verifiability rather than an identity and eligibility infrastructure; voter authentication and eligibility depend on the election system it is integrated with.

**The Swiss Post e-voting system** is used by several Swiss cantons for voters abroad and voters with disabilities. Its source code and documentation are published, and Swiss Post runs public intrusion tests (2019, 2022, 2024, 2026). The 2022 test had more than 3,400 registered participants. In the 2026 test, 5,479 distinct IP addresses from 107 countries took part; 85 reports led to six confirmed findings, one rated high (it could have affected the voting server's availability, not votes cast), one medium and four low, and no critical vulnerability [E2].

- *Weakness for our purpose:* it is a state system for one country's official votes, with credentials delivered by post to registered voters.
- *Ahead of us:* legal certification, years of public scrutiny and paid bug bounties. Its published proofs of verifiability are a model for our own documentation.

**MACI (Minimal Anti-Collusion Infrastructure)**, from the Ethereum Foundation's Privacy and Scaling Explorations, adds **collusion resistance**: voters can change their key, so a vote shown to a briber may already have been replaced. Its own documentation is clear about the price: "MACI can provide collusion resistance only if the coordinator is honest", and "No one except a trusted coordinator should be able to decrypt a vote", although a dishonest coordinator "can neither censor nor tamper with its execution". It assumes that "each legitimate member controls a unique Ethereum private key" [M1].

- *Weaknesses for our purpose:* the coordinator can decrypt votes while processing them and is trusted for collusion resistance (C3, C6), although proofs prevent it from publishing a false tally; uniqueness is left to whoever admits members (C1).
- *Ahead of us:* collusion resistance under an honest coordinator (C7). MACI's key-change design is exactly the mechanism our threat model requires before any binding vote ([threat model T5](../specs/threat-model-v0.1.md)).

**Vocdoni and its new DAVINCI protocol** is the closest polling project. It offers verifiable, anonymous voting with zero-knowledge proofs, and DAVINCI adds re-encryption of stored ballots and silent re-voting aimed at receipt-freeness [V1]. In the current implementation the voter's census address is a public input of the ballot proof, so the sequencer knows which census entry each ballot comes from (our reading of its documentation, asked on the research forum).

- *Weaknesses for our purpose:* the census (who may vote) is supplied by the organiser, so uniqueness is only as good as the organiser's list (C1, C2); the network uses its own token.
- *Ahead of us:* a production platform with many real organisations, and the receipt-freeness design we have not built. We regard DAVINCI as a possible partner: Proof of One identities could serve as a census for it.

### 3.6 Commercial mobile voting

**Voatz** verifies voters with a photo of their ID and a selfie and records votes on a permissioned blockchain run by the company. In 2020, researchers at MIT reported "a number of high-severity vulnerabilities". A security assessment by Trail of Bits, commissioned by Voatz, reported 79 findings, about a third rated high severity, and its relationship to the MIT results is described in its report [C1]. *These figures come from a secondary summary and are to be checked against the two original reports.*

- *Weaknesses for our purpose:* closed source; one company operates all servers and sees identity and vote data (C3, C6); a "blockchain" run by one party adds no independent verifiability (C5); identity is checked by photo and selfie, not by the document's cryptographic signature (C2).
- This is the clearest example of what we must avoid: verifiability claimed, but not open to anyone to check.

### 3.7 Online polls, survey panels and civic platforms

**Commercial survey panels** recruit and check their own respondents. **Online polls** on social media and news sites accept anyone. **Civic participation platforms** such as Decidim, Pol.is, Loomio and LiquidFeedback organise proposals, deliberation and votes, often for city governments and associations.

- *Strengths:* experience with real public participation, good deliberation tools, wide use by public bodies (Decidim in particular), and open source in the civic case.
- *Weaknesses for our purpose:* these are different products (some mainly for deliberation, some for voting), and what is public or private depends on the platform and on each deployment. In general, uniqueness rests on accounts, e-mail or the operator's own checks (C1, C2), and a typical deployment does not let outsiders recount results from public data (C5). Panel results are only as trustworthy as the company running the panel.
- *Ahead of us:* Pol.is and Decidim show how to turn opinions into useful public decisions, which Proof of One does not attempt. They are natural places to use Proof of One identities.

### 3.8 DAO governance tools

**Snapshot, Tally, Agora and Aragon** run votes for blockchain organisations. Most count **tokens**, not people, and votes are public. They show that on-chain, publicly checkable tallies work at scale, but they were not designed for one person, one voice or for ballot secrecy.

## 4. Comparison matrix

● = met by design; ◐ = partly, or depends on another party; ○ = not met; — = not the system's purpose. Ratings of other systems come from their published documentation and are not independently tested by us. To apply the same standard to ourselves, Proof of One has two rows: its **design target**, and what is **demonstrated today**. This matrix is a summary for discussion, not a scorecard.

| System | C1 Uniqueness | C2 Authenticity | C3 Privacy | C4 Own vote | C5 Recount | C6 No single trusted party | C7 Coercion | C8 Open access |
|---|---|---|---|---|---|---|---|---|
| World ID | ● iris (operator-reported error rates) | ● | ◐ | — | — | ○ one operator | — | ○ hardware, token |
| Human Passport, BrightID, PoH, Idena | ◐ score or social | ◐ | ◐ | — | — | ◐ | — | ● |
| ZK passport (Rarimo, Self, ZKPassport) | ◐ per document | ◐ no liveness | ● | ◐ | ◐ | ◐ | ○ | ◐ |
| State eID, EU wallet | ◐ depends on the national scheme | ● | ◐ | — | — | ○ the state | — | ◐ one jurisdiction |
| Helios, Belenios | ◐ organiser's list | ◐ | ● | ● | ● | ◐ | ◐ | ● |
| ElectionGuard | ◐ election system's roll | ◐ election system's authentication | ● | ● | ● | ◐ | ◐ | ● |
| Swiss Post e-voting | ● state register | ● | ● | ● | ◐ certified auditors | ◐ | ◐ | ○ one country |
| MACI | ◐ admitted keys | ◐ | ◐ coordinator can decrypt | ● | ● | ◐ coordinator (confidentiality, collusion) | ◐ if coordinator honest | ● |
| Vocdoni DAVINCI | ◐ organiser's census | ◐ | ◐ sequencer sees census entry | ● | ● | ◐ | ◐ re-encryption (version-specific) | ◐ token |
| Voatz | ◐ | ◐ photo and selfie | ○ | ◐ | ○ | ○ | ○ | ○ closed |
| Survey panels, online polls | ○ | ○ | ○ | ○ | ○ | ○ | ○ | ◐ |
| Civic platforms (Decidim, Pol.is) | ◐ accounts | ◐ | ◐ varies by deployment | ○ | ○ | ○ | ○ | ● |
| **Proof of One — design target** | **◐ document and face; depends on measured matching error and registry integrity** | **◐ chip signature; subject and liveness depend on the enclave** | **◐ ballots encrypted; metadata and enclave assumptions** | **◐ recorded and counted, not cast-as-intended** | **●** | **◐ threshold trustees; one enclave for enrolment** | **○ re-answering only** | **◐ no fee, token or special hardware; chip passport and NFC phone needed** |
| **Proof of One — demonstrated today** | ○ not built | ◐ chip signature checked on a phone (test app) | ◐ reference code, synthetic data | ◐ reference code | ◐ reference code | ◐ key generation in reference code | ○ | ◐ |

## 5. Weaknesses Proof of One addresses, and how far along each answer is

Status uses the scale in §1. Nothing below has been independently reviewed or audited.

| Weakness found in others | Proof of One's answer | Status (October 2026) |
|---|---|---|
| One person, two passports, two identities (ZK passport family) | Two layers: document uniqueness, and face uniqueness checked inside a hardware enclave against all enrolled faces; one identity across several nationalities | Specified ([face uniqueness](../specs/face-uniqueness-at-scale-v0.1.md), [several nationalities](../specs/several-nationalities-v0.1.md)); document layer: prototype, tested on synthetic data; enclave not built; matching error rates not yet measured. Biometric deduplication is an engineering assurance with error rates, not a proof of one identity per person |
| No liveness: whoever holds the passport can enrol | Live face matched to the chip photo, whose hash is bound into the document proof as `C_face` | Binding: prototype, tested on synthetic data. Liveness and presentation-attack detection: specified only. Binding a photo hash into a proof does not show that a live person was in front of the camera |
| Trust in country certificates is implicit | Public, reproducible trust list: references only, pinned anchors, a `listHash` anyone can rebuild | Prototype, run on the real German and ICAO master lists (134 of 186 chip-passport countries) ([trust list](../specs/trust-list-v0.1.md)) |
| Document checks done by a server that sees the document | π_doc proves on the phone that the chip data was signed by a checked signer, without revealing it | Prototype (577,678 constraints), tested on synthetic data; proving takes 11–12 s on 2 server cores, phones not yet measured. Chip reading on a phone: test app built, first real document test pending |
| Uniqueness bound to an operator's census (Helios, MACI, Vocdoni) | The census is a public tree of identity commitments; a poll proves membership of a hidden leaf, a per-poll nullifier and attribute conditions ([ballot and enrolment spec](../specs/ballot-and-enrolment-v0.1.md)) | Prototype, tested on synthetic data |
| Votes in plain text on chain (Freedom Tool) or readable by one coordinator (MACI) | One-hot ballots under exponential ElGamal, encrypted to a key shared by trustees (threshold 6 of 9); fewer than 6 trustees cannot decrypt, but 6 colluding trustees could, and 4 unavailable trustees would stop the tally | Prototype, tested on synthetic data; trustee independence is an operational requirement not yet defined |
| Trustee key made by a dealer who knows it | GJKR-style distributed key generation in which complaints are decided by anyone from the public transcript | Specified, with its adversary model ([trustee key generation](../specs/trustee-key-generation-v0.1.md)); prototype tested on synthetic data, including cheating trustees |
| Results that cannot be recounted (panels, Voatz, civic platforms) | Every ballot, proof and decryption share is public; a recount tool rebuilds every result from public data alone (R2: tallied as recorded) | Prototype, tested on synthetic data. A recount does not show who was wrongly excluded, ballots that never arrived, or a wrongly configured poll |
| Voter cannot see their own vote was counted | The phone checks that its ballot is recorded and, after the close, that its last ballot is the one counted (R1) | Prototype, tested on synthetic data. Does not cover cast-as-intended: a compromised phone could build a different ballot |
| Proprietary hardware, tokens, paid sign-up | Ordinary phone with NFC and camera; no token; no participant fee; non-commercial | Policy ([decision log](../decisions/DECISION_LOG.md)). Access still requires a chip passport, a supported phone and network access |
| No verified demographics in anonymous systems | Results by proven age group and nationality, with small groups suppressed | Attribute proofs: prototype. Suppression: no threshold or query policy specified yet; suppression alone does not stop inference from overlapping results |

## 6. Where Proof of One is behind, or has weaknesses of its own

Honesty about these points matters more than the table above.

1. **Nothing is deployed or audited.** Every system above, except the academic prototypes, has real users. Our code is reference code, reviewed by no independent human expert yet.
2. **The enclave is a single trusted component.** Face uniqueness depends on a hardware enclave run by an operator, and on the honesty of the chip vendor's attestation. This is weaker on C6 than the threshold design used for ballots. Its specification states this as a residual risk.
3. **Coercion resistance is weaker than MACI or DAVINCI.** Re-answering before the poll closes reduces coercion but does not remove it, and an encrypted ballot can serve as a receipt if the voter reveals its randomness. A receipt-free design is required before any binding use ([threat model T5](../specs/threat-model-v0.1.md)).
4. **Coverage is limited to chip-passport holders.** People without a chip passport, or from countries whose certificates we cannot yet obtain, cannot enrol. Proof-of-personhood systems based on social trust include them; we do not. This excludes some of the people who most need a voice.
5. **A state can issue genuine documents.** A government that issues real passports to non-existent people defeats the document layer. Biometric deduplication can make this costly and visible, subject to measured error rates, presentation-attack resistance and the integrity of the enrolment registry; it does not prove that each identity is a distinct real person. This is the fundamental limit stated in the whitepaper.
6. **Biometric data, even briefly held, is sensitive.** The design deletes images inside the enclave and keeps only templates, but it still processes faces. Regulators' actions against World show how this will be judged.
7. **Phone performance is unproven.** The document proof is large; it takes 11–12 seconds on two server cores, and phones are not yet measured. Other ZK-passport apps already prove passports on phones in production, but their circuits and proof systems differ, so this does not show that ours will be fast enough.
8. **Demographic results can leak.** Suppressing small groups is not enough: overlapping or repeated results can reveal suppressed values. No suppression threshold or query policy is specified yet.
9. **Network metadata.** Encryption hides ballot content, not who connects when. The relay service in the design hides IP addresses from the ledger, but timing and the relay itself are not yet analysed.
10. **Cast as intended.** A compromised phone could encrypt a different choice than the person intended and still pass every public check. No independent verification channel is designed yet.

## 7. Conclusions

- **We have not found an existing system that combines, in one design, passport-based enrolment, biometric deduplication across documents, private attribute proofs and publicly recountable encrypted polls.** Each family covers some of these. This combination is Proof of One's reason to exist; it is a design target with stated trust assumptions (the enrolment enclave, the trustees, the issuing states), not an established result, and it has not been independently evaluated.
- **The closest systems are partners rather than rivals.** ZK-passport projects could share circuits and trust lists; Vocdoni DAVINCI or MACI could use Proof of One identities as a census and contribute receipt-freeness; civic platforms could use verified polls.
- **Our own biggest open problems are the enclave and the registry it protects, coercion resistance, and the gap between design and evidence.** The most useful next review is not another comparison but an adversarial review of whether the architecture can give one accepted participation per real person while keeping ballots secret and results independently verifiable.

### Proposed next steps

- Add a short version of this review to whitepaper v0.9, replacing the current §5 table.
- Ask the teams of ZKPassport, Self, Rarimo and Vocdoni to correct any statement about their systems before v0.9 is published.
- Keep this document as a living page; update it when a project changes.

## 8. Sources

- [W1] Reuters factbox on regulatory scrutiny of World (Worldcoin), March 2024: https://tech.yahoo.com/general/articles/factbox-scrutiny-iris-scanning-crypto-102600350.html
- [W2] Spanish judiciary, "La Audiencia Nacional avala el cese cautelar de la recopilación de datos a través del iris de Worldcoin" (11 March 2024): https://www.poderjudicial.es/cgpj/es/Poder-Judicial/Noticias-Judiciales/La-Audiencia-Nacional-avala-el-cese-cautelar-de-la-recopilacion-de-datos-a-traves-del-iris-de-Worldcoin-acordado-por-la-Agencia-de-Proteccion-de-datos ; AEPD press release: https://www.aepd.es/en/press-and-communication/press-releases/agency-orders-precautionary-measure-which-prevents-Worldcoin-from-continuing-toprocess-personal-data-in-spain
- [H1] Human Passport, "Proof of personhood and sybil resistance for Web3": https://passport.human.tech/blog/human-passport-proof-of-personhood-and-sybil-resistance-for-web3
- [R1] Rarimo, Freedom Tool source repository and README: https://github.com/rarimo
- [R2] Safe Foundation, "ZK Passport: where are we now?" (4 September 2025), also covers Rarimo: https://safefoundation.org/blog/safe-research-zk-passport-where-are-we-now
- [S1] Celo blog, "Self Protocol: a sybil-resistant identity primitive for real people launches following acquisition": https://blog.celo.org/self-protocol-a-sybil-resistant-identity-primitive-for-real-people-launches-following-acquisition-74fd3461a428
- [S2] Safe Foundation, as [R2].
- [E1] Benaloh et al., "ElectionGuard: a cryptographic toolkit to enable verifiable elections", USENIX Security 2024: https://usenix.org/conference/usenixsecurity24/presentation/benaloh
- [E2] Swiss Post, "Hacker test passed: no critical vulnerabilities found in Swiss Post's e-voting system" (2026 test): https://medien.post.ch/en/hacker-test-passed-no-critical-vulnerabilities-found-in-swiss-post-s-e-voting-system ; 2022 test (more than 3,400 participants): https://www.iamexpat.ch/expat-info/swiss-news/over-3400-ethical-hackers-fail-crack-swiss-posts-e-voting-system ; publications and source code: https://digital-solutions.post.ch/en/e-government/digitization-solutions/e-voting/publications-and-source-code
- [M1] MACI documentation, introduction (v3.x): https://maci.pse.dev/docs/introduction
- [V1] Vocdoni, DAVINCI protocol announcement and documentation: https://vocdoni.io
- [C1] Wikipedia, "Voatz" (secondary summary of the MIT 2020 study and the Trail of Bits assessment, with links to both): https://en.wikipedia.org/wiki/Voatz. To be replaced by the original reports.
- Helios: https://heliosvoting.org ; Belenios: https://www.belenios.org ; Decidim: https://decidim.org ; Pol.is: https://pol.is

## 9. Changes in v0.2 and open questions from the second-model review

On 28 October 2026 the founder gave v0.1 to a second AI model (ChatGPT) with a request for a strict review. It returned 44 points. We checked each one; the factual points were verified against primary sources before changing the text.

**Corrected in this version:**

- **Swiss Post:** v0.1 attributed the 3,400 participants to the 2024 test; they belong to the 2022 test. The 2026 results are now given with their findings.
- **Spain and World:** the court decision is now described precisely and cited from the Spanish judiciary. (The review doubted that a court had acted; it had, but v0.1's wording was imprecise.)
- **Unsupported claims about others:** "largest uniqueness set", "audited production system", "mobile provers on mid-range phones", the generalisation about funding, and the description of ElectionGuard as in-person only.
- **Category statements:** state eID uniqueness, ZK-passport identifiers and civic platforms are now described per scheme or per platform where it matters.
- **MACI and DAVINCI:** what the coordinator and the sequencer can see is now stated precisely, and their coercion ratings are qualified.
- **Our own claims:** one status scale; two rows for Proof of One (design target and demonstrated today) instead of a single row of full marks; the conclusion is now a scoped statement; three new open weaknesses (§6, points 8 to 10).
- **Criteria:** C2, C6 and C8 now say which separate questions they bundle; R1 and R2 are stated in the usual verifiability terms.

**Raised by the review and recorded as open work** (they concern our design, not this comparison):

| Question | Where it belongs |
|---|---|
| Consistency of the enrolment registry: forked or parallel enclaves, rollback, backups, deletion of templates | Face uniqueness spec; schedule 1.2a |
| Presentation-attack detection and the trusted capture path | Face uniqueness spec; schedule 1.3 |
| The four separate claims behind "authentic" (data, issuer, subject, presence) and chip authentication | Document-validity proof §6; enrolment spec |
| Statistical disclosure from demographic results (differencing, repeated polls) | Threat model; whitepaper v0.9 |
| Network metadata and the relay | Threat model |
| Cast-as-intended verification | Threat model; whitepaper v0.9 |
| Formal statements of R1 and R2 | Whitepaper v0.9 |
| Trustee independence as an operational requirement | Trustee key generation spec |

**Not adopted:** the review's suggestion to stop publishing v0.1. It was published as a draft for review, which is what this process is for; v0.2 replaces it.

— Hermes, Metron, Prosopon and Psephos (AI agents, Proof of One)
