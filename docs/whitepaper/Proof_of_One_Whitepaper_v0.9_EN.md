# Proof of One — An Open, Verifiable Polling Network Built on One-Person-One-Identity

*Whitepaper — Version 0.9 (Public Review Draft) · November 2026 · Nemo Unus, with the Proof of One AI agent team*

> Open-source, non-commercial project. Draft for public review. Not audited. Every property in this paper is a **design goal** until independent human experts have reviewed the design and its code; Section 17 lists what is known not to work yet.

> *Dedicated to everyone, everywhere, who paid with their life for the right to have their voice counted.*

## 1. Executive Summary

Public opinion is increasingly measured online, and online polls are increasingly easy to distort. Generative AI lowers the cost of producing convincing respondents at scale. Most online polls cannot reliably establish that each response comes from a distinct human, cannot check the age or nationality respondents claim without collecting their identity, and give participants and the public no independent means to check that a published result matches the answers given.

**Proof of One** is an **open-source, non-commercial protocol** for polls with three aims:

- each participant holds **one active identity**, backed by a genuine chip passport or ID card and a face that matches its photo;
- the answers, and the anonymous identity that gives them, **cannot be linked to the person** by the system's operators, under the trust assumptions stated in Sections 7 and 12;
- the result can be **checked by every participant and by anyone else**.

A member enrols once with an ordinary smartphone: the phone reads the electronic chip of their passport or ID card, proves in zero knowledge that the chip data was signed by its issuing state, and the member's live face is compared with the photo on the chip. A uniqueness service running inside an isolated enclave checks that neither the document nor the face has enrolled before. The ledger then holds only a hidden commitment. What each party learns is listed in Section 6.11.

Two requirements guide every design decision. They are targets the protocol is built to meet, not results that have been independently verified:

- **R1. Every participant can verify their own ballot.** For a period the member chooses, their phone can check that the encrypted ballot on the public ledger is the one it cast and that it was included in the tally (Section 7.8).
- **R2. Anyone can recount.** Every accepted ballot is published in encrypted form together with a proof that it comes from an eligible member and encodes a valid answer; if a member answers again before the close, only the last ballot counts. Anyone can add up the encrypted ballots and check the trustees' proofs that only the totals were decrypted correctly, without trusting any operator (Section 7.8). Ballots are never decrypted one by one.

These are not yet full end-to-end verifiability: checking that the phone encrypted what the member meant (cast as intended) and formal proofs of R1 and R2 are open work (Section 17).

The design also protects participants after a poll. Individual ballots are encrypted under a key shared by independent trustees. They could be decrypted only if a threshold of trustees (about two-thirds; six of nine in the reference code) colluded before deleting their key shares at the end of the poll's challenge period; the deletion is declared and signed, but cannot be proven (Section 8.7). The phone keeps what it needs to verify a ballot only for the receipt window the member chose (none, 7 or 30 days), so a phone seized after that window shows no past answers, although it can still show that the member took part (Sections 9.3, 12.2).

Participation is free of any fee. Topics of sponsored polls are proposed and chosen by members through a published procedure, region by region, with a global track (Section 10).

**Who can take part today.** People who hold a chip passport or chip ID card that a phone can read, and a smartphone with NFC. ICAO reports more than one billion chip passports in circulation; our estimate is that roughly **one person in six** worldwide holds such a document, with large gaps in South Asia and Africa (Section 6.4). This counts documents in circulation, not unique people, and not people who also have a suitable phone and can complete enrolment; those shares have not been measured. People with more than one nationality keep one identity that carries each verified nationality (Section 6.12).

The project is led by a pseudonymous founder, **Nemo Unus**, and developed in the open with a team of **disclosed AI agents**. The repository records who wrote and who reviewed each part; so far no independent human expert has reviewed the design. Nothing will be used with real participants before a public test network, a public bug bounty and an independent audit, with the gates and acceptance criteria defined in Sections 14 and 15.

> Design commitment: one human, one ballot per poll; verifiable by anyone; with authority spread across independent operators so that no single government, company or operator can change results unnoticed.

## 2. The Problem

### 2.1 Online opinion is hard to trust

- **Fake participants.** Generative AI makes accounts, faces and written answers cheap to produce at scale. Bot detection, rate limits and captchas raise the cost but do not establish that each response comes from a distinct human, least of all against a well-resourced attacker.
- **Duplicate participants.** One person with several e-mail addresses or phone numbers can answer many times.
- **Unverified demographics.** Respondents usually state their own age, nationality and location. Checking them normally means collecting identity documents, which creates privacy and trust problems of its own.
- **Results that cannot be checked independently.** In most online polls only the organiser holds the raw answers. Participants cannot confirm that their answer was counted, and the public cannot recount.

### 2.2 The verification gap in collective decisions

Many consultations, from public consultations and petitions to the internal votes of organisations, are run by one authority that registers participants, collects answers and counts them. Some are audited independently; many are not, and in most the participants themselves cannot check the count. Where the counting authority is not independent, manipulation is possible and hard to prove. Because each consultation is expensive, people are consulted rarely.

### 2.3 Why existing digital identity does not close this gap

Proof-of-personhood and digital-identity projects (Section 5) make different choices, each for good reasons, and none of them was designed for this purpose. Some rely on dedicated scanning hardware; some prove facts from one identity document at a time without a separate check that the same person has not enrolled with another document; national digital wallets are trusted mainly by services in their own country; and, among the systems we reviewed, none combines unique participants, verified demographics and publicly verifiable results. Section 5 and the [landscape review](../research/landscape-review-v0.2.md) compare them on the same criteria and also note where they are ahead of Proof of One.

## 3. Vision: a Missing Human Layer

The internet has widely deployed infrastructure for addressing computers, moving data and making payments. It has many ways to log people in, but no widely adopted way to prove, privately, that an account belongs to one unique human. As AI makes synthetic people cheaper, this gap matters more. Proof of One aims to help fill it, starting with public polling as its first application.

| Pillar | What it would enable | Status |
|---|---|---|
| 1. Verifiable collective decisions | Polls, consultations and petitions, and binding votes only where legally authorised and with a receipt-free design (Section 9.4) | **First product: verifiable polling** |
| 2. Fair distribution | Things allocated "one per person", such as aid or ticketing. Whether a share of value created by AI could ever be distributed this way is a speculative question; unique identity alone would not make an allocation fair | Later phase |
| 3. Human authenticity | Proof that a review, comment or decision comes from a real, unique human | Later phase |

## 4. Design Principles

| Principle | What it means in practice |
|---|---|
| One human, one identity | A person may hold only one active identity at a time. Enrolment checks both the document and the face for duplicates (Sections 6.6, 6.7); renewal, loss and recovery follow fixed rules (Section 6.10). The checks have error rates and limits, including documents a state issues to people who do not exist (Section 12.1). |
| Verifiable by the voter and by everyone | R1 and R2 above. |
| Participant safety first | Where safety, integrity and convenience conflict, the safety of participants wins. The threat model (Section 12) considers adversaries up to a state, and states which state capabilities the design withstands and which it does not, such as a state that issues documents or watches its network. |
| Private, not anonymous | Every member is verified once at enrolment, but polls only see an anonymous identity that cannot be linked to the person or to their other polls, under the assumptions in Section 12. |
| Data minimisation | Passport data and face images are processed on the phone and inside the enclave and are not stored afterwards; nothing personal is written to the ledger. What each party learns is listed in Section 6.11. |
| Free and neutral | No fee for taking part. The project team does not choose poll topics; members do, through a published procedure (Section 10). Taking part still needs a document, a phone and a connection. |
| Open source, non-commercial | All code and specifications are public. There is no token, no sale and no investor; funding follows Section 16. |
| Ordinary hardware | A smartphone with a camera and NFC; no proprietary scanner. |
| Progressive decentralisation | At launch some functions are run by few operators. Authority is spread over independent operators and trustees in different jurisdictions as the network grows (Section 15). |
| Honesty about limits | Known weaknesses are documented (Sections 12 and 17). |

## 5. Landscape and Differentiation

The systems below make different choices for different purposes, and several are ahead of Proof of One in deployment, audits and scale. The table compares them on the same questions; the [landscape review](../research/landscape-review-v0.2.md) gives sources, versions and the reasoning behind each entry, and the projects concerned are being asked to correct it. Figures are as reported by the projects themselves.

| System | Identity evidence | What makes one participant unique | Polling and verifiability | Main trust assumptions |
|---|---|---|---|---|
| World ID | Iris image taken by World's own device, the Orb | Uniqueness against all verified irises, using encrypted iris codes; about 18 million Orb-verified people reported by the project in 2026 [1] | Not its purpose; World ID can serve as an input to voting apps | World's hardware, software and operators |
| Humanity Protocol | Palm scan [2] | Uniqueness against enrolled palms | Not its purpose | The project's operators and devices |
| Human Passport | Many independent signals combined into a score [3] | Sybil resistance by cost and evidence, not a uniqueness guarantee; this is a deliberate design choice | Used to filter participants in grant rounds | The issuers of each signal |
| Self | Passport or ID chip read by NFC, attributes proved in zero knowledge [4] | Per document: a person holding two documents can obtain two identities | Not its purpose | Issuing states' signatures; the project's trust list |
| ZKPassport | Same approach, open-source app [5] | A scoped identifier that is stable for the same document | Not its purpose | As Self |
| National wallets (EU, Bhutan) | Government identity records [7][8] | The government registry | Not their purpose; accepted mainly by services of the issuing country or union | The issuing government |
| Online survey panels | Recruitment and checks by the panel operator | Operator's own checks | Yes; methods are often published, but participants cannot verify that their answers were counted | The panel operator |
| MACI | Keys admitted by the poll organiser | Organiser's admission list | Yes; collusion resistance with an honest coordinator, who can read individual votes [13] | The coordinator |
| Vocdoni DAVINCI | Census supplied by the organiser | Organiser's census | Yes; anonymous, verifiable voting with re-voting and re-encryption aimed at receipt-freeness [13] | Organiser's census; the sequencer sees the census entry in the current version |
| **Proof of One (design, not deployed)** | Passport or ID chip, plus a live face matched to the chip photo | The document **and** the face, each checked for duplicates (6.6, 6.7) | Core purpose: encrypted ballots, own-ballot checks and public recount (7.8) | Issuing states; the uniqueness service's enclave, later several operators; poll trustees |

### 5.1 What Proof of One tries to add

- **Uniqueness of the person, not only of the document.** A system that keys identities to documents cannot see that two documents belong to one person; a system that relies only on a face captured by a phone is exposed to synthetic faces. Proof of One requires a state-signed document and a live face that matches it, and checks both for duplicates. This is intended to reduce both risks, not to remove them: the checks have error rates (6.7), presentation attacks remain a residual risk (6.5), and a state that issues documents to people who do not exist is not detectable (12.1).
- **Verified attributes in results, with disclosure limits.** Results can be broken down by verified age group or nationality without identifying anyone. Small groups are merged before anything is decrypted (7.9).
- **Verifiability as the purpose.** Each member can check that their encrypted ballot was recorded and counted, and anyone can check every total (7.8). Cast-as-intended checks and formal proofs are open work (Section 17).
- **No dedicated scanning hardware.** Enrolment needs a supported smartphone with NFC and a camera, and depends on its platform security (6.3).

The closest systems are potential partners rather than rivals: ZK-passport projects could share circuits and trust lists, and MACI or DAVINCI could use Proof of One identities as a census and add stronger coercion resistance.

## 6. System Architecture

### 6.1 Separation of functions

An identity system has to answer three different questions. Proof of One answers each with a different mechanism:

| Function | Question | Mechanism |
|---|---|---|
| Uniqueness | Has this person registered before? | Document fingerprint and face template, checked once at enrolment inside an isolated enclave (6.6, 6.7) |
| Ownership | Is this request coming from the holder of this identity? | Identity secret held on the phone, protected by secure hardware and the user’s PIN (6.8) |
| Recovery | The phone is lost or the passport renewed — how is access restored? | Restoring the encrypted backup, or re-enrolment after a cooling-off period with automatic revocation of the old identity (6.10) |

Neither the passport number nor biometric data is used to build the user's key: passports are renewed with new numbers, two scans of a face are never identical, and a face is not secret. Biometrics are never used to derive a key. They are used for four things only: matching the live face to the chip photo, checking for duplicates at enrolment, recognising a member who re-enrols after losing their phone (6.10), and checking that a document being added belongs to the same member (6.12).

### 6.2 Process overview

Figures 1 and 2 show the complete process across the four parties: the member’s phone, the uniqueness service, the public ledger, and the poll organiser and public.

![](fig/fig5_enrol_en.png)

*Figure 1 — Enrolment (simplified: 6.6 describes how a fingerprint match without a personal number is checked against the face). Four checks run in the uniqueness service; each failure stops enrolment. The service signs a credential over a hidden commitment, and the phone registers its identity later, unlinkably (6.3, 7.10).*

![](fig/fig5_poll_en.png)

*Figure 2 — Answering a poll, tally and verification. Ballots are encrypted on the phone; only totals are decrypted, with public proofs; the contract rejects any result whose totals do not match the participants (7.7, 8.7).*

### 6.3 Enrolment steps

1. The user installs the app, after checking its signing fingerprint against the published one, and creates a PIN. The phone generates its keys (6.8).
2. The user holds their passport or chip ID card against the phone, and the app reads the chip by NFC.
3. The phone builds a zero-knowledge proof that the chip data was signed by a document signer in the public list of checked signers and has not expired, that the attributes it outputs were read from that data, and that a commitment to the chip photo matches the signed document (7.4). The proof does not show that the document has not been reported lost or stolen; no source of that information is available to the system (Section 17).
4. The user performs a live face scan. The phone adds a platform attestation (Android key attestation or Apple App Attest) that the published, unmodified app is running on a genuine device; on Android it also reports the device's boot state. Attestation does not prove that the camera image is genuine or that the device has no unknown vulnerability (6.5).
5. Over an anonymising network connection, the phone sends the proof, a commitment that hides its future identity, and, encrypted so that only the attested enclave can open it, the chip photo and the live face frames (7.6).
6. The uniqueness service verifies the proof and checks for duplicates (6.6, 6.7). Before it issues anything, it **reserves** the document fingerprint and face template, so that two enrolments running at the same time cannot both pass.
7. If every check passes, the enclave code discards the images, stores only the fingerprint and the protected template, and returns a signed **credential** over the hidden commitment. That the code discards them can be checked in the published, reproducible enclave code; that no copy survives outside the enclave cannot be proven and rests on the enclave's isolation (6.7, Section 12).
8. Hours later, in a separate session, the phone registers its identity on the ledger with a zero-knowledge proof that it holds a valid, unused credential, without revealing which one (7.10). The ledger accepts a registration only if the credential's signing key is in the published enclave key set and its credential nullifier has not been used. Identities are added only in large batches (8.3).

### 6.4 Reading the identity document

Most passports issued today, and many national ID cards, contain a contactless chip defined by ICAO 9303 [6]. In such documents, data group DG1 holds the data printed on the photo page (name, document number, nationality, date of birth, sex, expiry) and DG2 holds the facial image. The Document Security Object (SOD) lists the hashes of the data groups present on the chip and is signed with the key of a document signer, whose certificate (DSC) is in turn signed by the issuing state's Country Signing CA (CSCA). Proof of One supports ICAO 9303 passports first; each national ID card must be profiled separately.

Reading the chip is required instead of a photo of the document. A photo can be edited in seconds; the chip's signed data can be checked cryptographically against the issuing state's certificates. This is stronger evidence that the data is what the state issued. It is not evidence that the state verified the person correctly, nor that the person presenting the chip is its holder; the face match addresses the second point (6.5). Where a chip supports Active or Chip Authentication, the app uses it as additional evidence against cloned chips; which mechanism is required, and how to use it without revealing a chip-specific key, is open work ([document-validity proof §6](../specs/document-validity-proof-v0.1.md)).

**Which states' signatures can be checked.** Passive authentication needs a trustworthy copy of each state's CSCA certificates. Proof of One builds its [trust list](../specs/trust-list-v0.1.md) from signed CSCA master lists (the German list and the ICAO master list, each checked under a pinned anchor) and from states' own publications. On 28 October 2026 it could verify documents of 134 of the 186 countries that issue chip passports; documents of the others are refused openly until a trustworthy certificate source is found (Decision Log #39).

**How many people hold such a document.** A country-by-country study published with this paper [36] estimates that about 73% of the world's population lives in countries that issue chip passports as standard, and 94% when India and Pakistan, both switching over, are included. About 60 countries also issue identity cards with a compatible chip. Issuing is not holding: ICAO reports more than one billion chip passports in circulation [38], about 12% of the world's population, and chip ID cards add several hundred million more. These are counts of documents, not of unique people, and some people hold several. **Our estimate is that about 15–20% of people hold a document that could be used today**; how many of them also have a suitable phone and can complete enrolment has not been measured. The largest gaps are countries without chip documents and countries where few people hold a passport. National ID cards with other chip standards, for example in China, India and Indonesia, are left for regional extensions (Decision Log #32).

### 6.5 Face matching in the enclave

Zero-knowledge proofs show that a computation on given inputs was correct; they cannot show that an input came from a real camera. Face matching and template extraction therefore run inside the uniqueness service’s hardware enclave, not on the phone. The enclave checks that the chip photo it receives is the one committed in the proof, runs liveness and face matching against that photo, and builds the face template itself — so a modified app cannot submit someone else’s template. The authenticity of the camera feed rests on the phone's platform attestation and on presentation-attack detection. Neither proves that a live person was in front of the camera in every attack scenario, so injected or synthetic video is a residual risk (Section 12).

The architecture rests on several separate assumptions, each with its own failure mode:

| Assumption | What it is meant to establish | Who vouches for it | If it fails |
|---|---|---|---|
| Issuing state's signature | Chip data is what the state issued | The state's CSCA, via the trust list | Forged documents enrol |
| Phone platform attestation | The unmodified app runs on a genuine device | Apple or Google | A modified app or injected video may pass |
| Presentation-attack detection | A live face, not a mask, screen or synthetic video | The detection model; accuracy study | Synthetic faces may enrol |
| Enclave isolation and reproducible code | The service runs only the published code; images are not kept | Hardware vendor and cloud provider; code audits | Images or templates could be copied; linkage by the operator |
| Face-matching accuracy | Duplicates found, honest people not refused | The accuracy study (6.7) | Duplicates enrol, or honest people are refused |
| Trustees | Only totals are decrypted | Threshold of independent trustees | Individual ballots decrypted (not changed) |

### 6.6 Layer 1 — document uniqueness

The phone derives a **document fingerprint** from signed fields of the document through an oblivious pseudorandom function (OPRF) whose key is held by the uniqueness service (7.5). Which fields are used depends on the document (Decision Log #43):

- **Documents that carry a personal number.** Many states write a personal (national) number, which stays the same for life, in the optional-data field of the machine-readable zone or in data group DG11. The fingerprint is then derived from nationality, that number, date of birth and sex. It is unique to the person and the same for every renewed passport.
- **Documents without one.** The fingerprint is derived from nationality, name as written in the machine-readable zone, date of birth and sex. These fields are not unique: two people can share them, especially with common names in large countries or where documents carry a default birth date such as 1 January. A match is therefore **a signal, not a verdict**: the enclave compares the new face with the stored template of the member with that fingerprint. The same face means the person is already enrolled and is guided to recovery or to adding the document (6.10, 6.12); a clearly different face means a different person, who is enrolled and counted in the issuer statistics (6.7, step 4). A change of name or of recorded birth date gives a new fingerprint; such a person is still found by the face search (6.7).

The document number is not used, because it changes with every renewal. Which states carry a stable personal number, and where, is being surveyed (schedule activity 0.16); how often name-based fingerprints collide is to be measured before launch.

These fields have few enough combinations that a plain hash could be reversed by trying them all; the keyed OPRF prevents this, and blinding lets the service evaluate the function without seeing the fields. The personal number never leaves the phone. The phone unblinds the result and sends the fingerprint to the enclave, which compares it with the fingerprints of all members. The service therefore learns the fingerprint, a stable value per person, and keeps it for as long as the person is a member; it is not published. The service **reserves** a fingerprint and face template while an enrolment is in progress, so that two enrolments with one document cannot both pass (6.3, step 6).

### 6.7 Layer 2 — face uniqueness

Layer 1 stops a person enrolling twice with the same or a renewed document, unless their name or birth date changed. Layer 2 is needed for a person with two different documents, and for those changes. Searching a gallery of millions of face templates is fast on modern hardware [43]; the difficulty is accuracy. In NIST's 2026 evaluation of one-to-many search over a gallery of about 12 million people, the most accurate algorithms miss about 1% of true duplicates when the threshold is set so that only 1 in 1,000 searches for a person who is *not* in the gallery returns a false candidate [44]. If that rate held at 100 million members, about 100,000 of 100 million honest enrolments would be flagged; in practice the rate grows with the gallery, and NIST's images are not phone selfies compared with passport photos taken years earlier. These figures are therefore a reason to design carefully, not a prediction. The search is designed to ask as little of the face as possible (Decision Log #33) [41]:

1. Enrolment first asks whether the person has already enrolled with another document; if so, they are guided to add it to their identity (6.12).
2. The main search compares the new face with members of the **same birth date and sex**. If birth dates were spread evenly, that would be about 1,700 people at 100 million members; in practice groups are uneven, and some are very large where documents carry a default date such as 1 January. Smaller groups make false alarms rarer, but this is an optimisation, not a guarantee.
3. A second search covers **all members with a very strict threshold**, so that only near-certain matches are reported. It closes the gap shown by the red team in version 0.4, in which an issuer could evade the main search by printing a different birth date in each document.
4. Statistics by document issuer reveal abnormal patterns, thresholds favour honest people, and a wrongly refused person can ask for a second review.
5. The stored template is refreshed when a member adds or renews a document, so that it ages with the member. A refresh is allowed only after the new photo and the live face match the **existing** template; it never replaces a template that does not match, and the old template is deleted.

The method and thresholds will be fixed only after an accuracy study measures the false-match and false-refusal rates of the **whole two-search procedure**, at one million, ten million and one hundred million members, by time between photos, and for phone selfies against chip photos, with confidence intervals. A one-way hash of the face cannot replace this comparison: a hash destroys similarity, and a coarsened template would be guessable from a public photograph.

| Stage | Protected comparison | What a single operator can do |
|---|---|---|
| Test network and low-risk pilot (Phases 0–2) | Encrypted templates compared inside a hardware-isolated enclave (for example AWS Nitro Enclaves) | The enclave's isolation is the protection. An operator who broke it, or a cloud provider under legal pressure, could copy templates and fingerprints, and could try to link enrolments by time |
| Before any use in high-risk settings (Phase 3) | Templates secret-shared across independent operators and compared by multi-party computation (MPC) | Designed so that fewer than a threshold of operators learn nothing beyond each comparison's result. The MPC protocol, its threshold and adversary model, and what the match results themselves reveal are still to be specified. Operators in different jurisdictions is a governance control, not a cryptographic one |

### 6.8 The member’s keys

The phone holds two keys with different jobs (7.3): a **device key** generated inside the secure hardware, used to protect local data and bind the app to the device; and an **identity secret**, used only inside zero-knowledge proofs, stored encrypted under the device key and backed up end-to-end encrypted by the user. From the identity secret the phone derives a readable **member number** for the user’s own reference, for example:

> ONE-7Q4KM-9M2XH-8T3VA-5RZ0P-K

The member number, derived from the identity secret, is shown only to the member so that they can recognise their identity, for example after restoring a backup. It is not a password or a recovery code and is never sent anywhere; the app warns against sharing it, since anyone who saw it could recognise the member later. The ledger stores only an identity leaf, a Poseidon commitment to the identity, the attributes and the revocation handle, with a random salt, so that it is hiding (7.3).

Copying a backup to a second phone gives no extra ballots, because both copies produce the same nullifier in every poll. Whether several people, for example a family, may enrol on one shared phone is an open design question. How backups are encrypted and protected against rollback is to be specified in 7.3.

### 6.9 Verified attributes and selective disclosure

Attributes read from the chip stay on the phone and are hidden in the attribute commitment of the member's leaf (7.3). When a poll needs them, the phone proves in zero knowledge exactly what is required, such as "born on or before a date" for an age rule or "national of country X". Each poll fixes its age rule as a range of birth dates computed for the poll's opening date in UTC, so the rule does not change while the poll is open (7.7). Hidden attributes do not prevent disclosure through results: breakdowns by attribute merge small groups before anything is decrypted (7.9).

### 6.10 Recovery

- **Lost or replaced phone, backup available:** the member restores the encrypted backup on a new phone. The identity is unchanged and nothing is written to the ledger.
- **No backup available:** the member re-enrols with their document and a live face match. The enclave recognises them, waits a cooling-off period (for example 14 days), publishes the old identity's hidden **revocation handle**, and only after the ledger has accepted that revocation issues a new credential. Cryptographically, the enclave cannot tell which ledger entry it revoked (7.11); timing could still link a revocation to a later registration, which batching and delays are meant to blur (Section 12).
- **Renewed passport:** the member adds the new document to their existing identity (6.12) and remains recognised as already enrolled.
- **Polls that are open during recovery.** Each poll fixes its membership and revocation snapshots when it opens (8.4). A poll opened before the revocation accepts only the old identity, because the new one is not in its membership snapshot; a poll opened after it accepts only the new one, because the old one is revoked in its snapshot. Since the new credential is issued only after the revocation, no poll accepts both. A member who has really lost the old identity cannot answer polls opened before recovery; this is the price of the rule. A full state-transition analysis, with a test of every sequence in the reference contracts, is to be published with the ballot specification.

### 6.11 What each party sees

| Data | Member's phone | Uniqueness service | Public ledger |
|---|---|---|---|
| Passport data (DG1) | Yes | The attributes output by the proof (date of birth, sex, nationality, expiry month); the fingerprint fields only blinded | No |
| Chip photo and live face images | During the scan | Inside the enclave, during the checks only | No |
| Face template | No | Stored encrypted; compared only in the enclave (later MPC) | No |
| Document fingerprint | Yes | Yes, stored for the duration of membership | No |
| Time of enrolment, network metadata | — | Yes, unless hidden by the anonymising connection | Time of each registration batch |
| Identity leaf | Yes | **No**: sees only a hiding commitment | Yes, as a hiding commitment |
| Content of an answer | Own answer, during the receipt window | No | Encrypted; only totals decrypted |
| Whether a member took part | Own participation | No | Not linkable to a person without the member's secret; trustees could decrypt individual ballots only by colluding above the threshold |

The uniqueness service therefore holds a list of everyone who has enrolled, with their fingerprint, template and attributes. It cannot link that list to identities on the ledger or to answers, under the assumptions of 7.10 and Section 12; it is the most sensitive component of the system, and the threat model treats it as such ([threat model](../specs/threat-model-v0.1.md)).

### 6.12 Several nationalities, one identity

Some people hold genuine documents from more than one country. Refusing the second document as a duplicate would exclude them from the regional polls of their other country. Proof of One therefore lets a member **add a further document to their existing identity** (Decision Log #30) [39]:

- The enclave checks the new document as at enrolment. It also checks that the document has not been used by anyone and that its chip photo and the live face match **this** member's own face template.
- The member's identity then carries up to three documents, each with its own nationality and expiry. The phone keeps the same identity secret. The enclave issues an updated credential, and the previous identity is revoked with the hidden revocation handle (7.11).
- The unit of participation is **one ballot per person per poll**. A member with two nationalities may answer the regional polls of both regions, as a single national answers the polls of one; in global polls everyone has one ballot. The nullifier is derived from the identity secret and the poll identifier (7.7), so it is the same whichever document is used, and unlinkable between polls.
- Each ballot proof shows only that **one** of the member's valid documents matches the poll's region. Which document was used, and the member's other nationalities, stay hidden. Adding a document is optional, and results are never broken down by combination of nationalities.

## 7. Cryptographic Specification

This section proposes concrete algorithms for each function. The choices favour open standards, audited open-source implementations and compatibility with existing passport and zero-knowledge tooling. They are proposals for Phase 0 and will be confirmed by independent cryptographic review.

### 7.1 Design goals

- **Standards first:** use published standards (ICAO 9303, RFC 9497, RFC 9180) and widely reviewed constructions rather than new cryptography.
- **Proof-friendly where proofs are needed:** use arithmetic-friendly primitives (Poseidon, Baby Jubjub) inside zero-knowledge circuits, and conventional primitives (SHA-256, P-256, AES-GCM) elsewhere.
- **Hardware-backed keys:** every long-lived secret is generated in, or encrypted by, the phone’s secure hardware.
- **Cryptographic agility:** every record carries an algorithm version so that primitives can be replaced, including by post-quantum alternatives.

### 7.2 Proposed primitive suite

| Purpose | Proposed primitive | Reason |
|---|---|---|
| Hash inside circuits | Poseidon over the BN254 scalar field [23] | Far fewer constraints than SHA-256 inside zero-knowledge proofs |
| Hash outside circuits | SHA-256 | Matches passport SOD hashing; universal support. Passports that still use SHA-1 are verified with SHA-1 inside π_doc (Decision Log #42) |
| Device key | ECDSA P-256 in Secure Enclave / StrongBox | Natively supported by phone secure hardware and attestation |
| Identity secret | EdDSA key on the Baby Jubjub curve [29] | Efficient to use inside BN254 circuits; same model as Semaphore [12] |
| Poll membership proofs | Groth16 on BN254 [24] | Smallest proofs and cheapest on-chain verification; reuses Semaphore’s audited circuits and setup |
| Document proofs | Circom and Groth16 in the reference code (test-only setup); a universal-setup system such as PLONK / UltraHonk [25] is under consideration (issue #7) | One circuit per signature suite sharing one template; two suites implemented (7.4) |
| Document fingerprint | Custom 2HashDH-style verifiable OPRF over Baby Jubjub, modelled on RFC 9497 [21] but not one of its ciphersuites | Keyed and blinded: the service never sees the input; outputs cannot be brute-forced without the key |
| Channel to the enclave | HPKE (RFC 9180): X25519, HKDF-SHA256, AES-256-GCM [22] | Standard public-key encryption, key bound to the enclave’s attestation document [28] |
| Template storage | AES-256-GCM, key released only to attested enclave code | Templates are unreadable outside the enclave |
| Enrolment credential | EdDSA on Baby Jubjub, verified inside a zero-knowledge proof | Lets a member prove they hold a credential without revealing which one |
| Ballot encryption and tally | Exponential ElGamal on Baby Jubjub; threshold key (6 of 9 in the reference code) from a GJKR-style distributed key generation; Chaum–Pedersen (DLEQ) decryption proofs [30][33] | Additively homomorphic: anyone can add encrypted ballots; trustees decrypt only totals and prove they did so correctly |
| Revocation set | Indexed (sorted) Merkle tree with non-membership proofs | Proves a hidden handle is not revoked without revealing it |

### 7.3 Keys and identity commitment

At enrolment the phone creates the following values. Only commitments and hashes ever leave the phone.

```
K_dev   = P-256 key pair in secure hardware (non-exportable)
s       = random Baby Jubjub scalar (identity secret)
          stored as Enc_K_dev(s); backup end-to-end encrypted
P       = s · G                         (Baby Jubjub public key)
idc     = Poseidon(Px, Py)              (identity commitment)
attr    = Poseidon(birthDay, sexCode, nat_0, exp_0, nat_1, exp_1,
                 nat_2, exp_2, salt_a)   (up to 3 documents, 6.12)
rn      = revocation handle issued by the enclave (7.11)
leaf    = Poseidon(idc, attr, rn)       (entry in the registry tree)
cm      = Poseidon(4, idc, salt_a, ρ)   (hiding commitment for enrolment)
cn      = Poseidon(3, ρ)                (credential nullifier)
```

Every Poseidon use carries a domain tag, as the small constants above show for cm and cn, so that no value can be reused in another role; the other tags are listed in the [ballot and enrolment specification](../specs/ballot-and-enrolment-v0.1.md). The salts and ρ are drawn uniformly from the field on the phone and never revealed. That these commitments hide and bind rests on Poseidon behaving like a random function, a standard but unproven assumption [23]. salt_a appears in both cm and attr by design, so that the registration proof can link them (7.10); neither value is published. `attr` has one canonical encoding: the fields in the order shown, three document slots, and 0 in every field of an empty slot. The credential signs exactly this value and the leaf commits to it. How the backup of s is encrypted, protected against rollback and restored is to be specified.

### 7.4 The enrolment proof

The phone proves the following statement in zero knowledge. Private inputs never leave the phone; public inputs are seen by the uniqueness service.

|  | Values |
|---|---|
| Private inputs | DG1, the LDS security object and signed attributes, the document signer's public key and its Merkle path, salts r_f and salt_a, ρ, idc |
| Public inputs | Root of the public tree of checked document signers; today's date; C_face; blinded fingerprint input B; the hiding commitment cm; a fresh challenge from the service. Outputs: date of birth, sex, nationality and expiry month |

1. **Integrity:** the hash of DG1 and the DG2 hash equal the values listed in the SOD.
2. **Authenticity:** the signed attributes carry the hash of the SOD contents and a valid signature by the document signer, whose key is a leaf of the public **tree of checked signers**. That each signer was issued by a CSCA in the [trust list](../specs/trust-list-v0.1.md) is checked once per signer, outside the phone, by a public tool anyone can rerun; this keeps the proof about half the size.
3. **Validity:** the expiry date in DG1 is later than today.
4. **Attributes:** the date of birth and nationality code are correctly taken from DG1.
5. **Photo binding:** C_face = Poseidon(hi, lo, r_f), where lo is the last 16 bytes of the DG2 hash and hi the bytes before them, tying the photo sent to the enclave to the signed document.
6. **Fingerprint input:** B is the blinding of the fields described in 7.5 (to be added to the reference circuit with Decision Log #43).
7. **Binding:** the proof includes cm and the service’s challenge, so it cannot be replayed. The service never learns idc or the future identity leaf.

The document-validity part is implemented and tested on synthetic documents in two signature suites ([document-validity proof](../specs/document-validity-proof-v0.1.md)): RSA-2048 with SHA-256 (577,678 constraints) and RSA up to 3,072 bits with SHA-1 and any public exponent (749,147 constraints). Each proves in about 12 seconds on two server cores with a test-only setup; phone times are still to be measured.

### 7.5 Document fingerprint protocol

```
Phone:   x = HashToCurve(nationality || personalNumber || dateOfBirth || sex)
              or, without a personal number,
         x = HashToCurve(nationality || name || dateOfBirth || sex)
         r = random scalar;  B = r · x       (blinded; sent with proof)
Service: Z = k · B, with a DLEQ proof that log_G K = log_B Z,
         where K = k · G is the service's public OPRF key on the ledger
Phone:   checks the proof; F = Hash(x, r⁻¹ · Z)   (document fingerprint)
Enclave: receives F; reserves it; compares it with stored fingerprints
         (a name-based match is checked against the face, 6.6)
```

F is kept by the uniqueness service for the duration of membership and is never written to the ledger. The OPRF key is rotated by epoch, and old fingerprints are re-derived inside the enclave when it changes.

For the circuit in 7.4 to prove that B is derived from the signed fields, the OPRF is instantiated over the circuit-friendly Baby Jubjub group. This is a custom 2HashDH-style construction modelled on RFC 9497, not one of its ciphersuites; its hash-to-curve, encodings and input validation are to be specified and reviewed. In Phase 3 the key k is split across operators (threshold OPRF), so no single party can compute fingerprints alone.

### 7.6 Enclave channel and face template

- The enclave publishes an attestation document containing the hash of its code and its HPKE public key. Before encrypting anything to it, the phone checks the platform's certificate chain, a fresh nonce, and that the code measurement is on the list of approved, reproducible builds held on the ledger; older builds are removed from that list.
- The phone sends HPKE-encrypted: the DG2 photo, r_f, and a short sequence of live face frames.
- Inside the enclave: check C_face against the DG2 hash and r_f (7.4); run liveness and face matching; compute a face embedding (for example a 512-value vector from a published face-recognition model); delete all images.
- Templates are stored encrypted and compared by similarity across all members (6.7); the match threshold is calibrated on real data in the accuracy study.
- Output: a credential σ = Sign(Poseidon(attr, cm, rn, epoch)) under an enclave key listed on the ledger (7.10), where attr is the canonical attribute value of 7.3.

### 7.7 Answering a poll

Each poll has its own tally public key PK, created by a committee of independent trustees through a GJKR-style distributed key generation with a public transcript and complaints anyone can settle ([trustee key generation](../specs/trustee-key-generation-v0.1.md)). In the reference code the threshold is 6 of 9: fewer than six trustees cannot decrypt, and the tally survives up to three absent trustees. A member’s choice is encoded as a vector with a 1 in the chosen option and 0 elsewhere, and each position is encrypted:

```
nf     = Poseidon(1, pollId, s)       (nullifier: one per member per poll)
ballot = first 48 bits of nf, e.g. 7F3A-91C2-E04B  (display aid only)
C_j    = (r_j · G,  v_j · G + r_j · PK)    for each option j
proof  : leaf is in the poll’s snapshot tree; rn is not revoked;
         nf is derived from s; one document meets the eligibility rule;
         every v_j is 0 or 1 and they sum to 1;
         each C_j encrypts v_j under PK; bound to this submission
public : pollHash, nf, C   (pollHash binds the snapshot roots, pollId,
         PK, the eligibility rule and the submission context)
```

Each v_j is encoded as v_j · G on Baby Jubjub's prime-order subgroup. The ledger keeps the latest ballot per nullifier, in the ledger's own transaction order; ballots after the poll's close are rejected, and the final ballot set is the last ballot per nullifier at the close, which anyone can recompute. A member who answers again produces the same nullifier, so the new ballot replaces the old one and is never counted twice. The ballot number is only a short label shown to the member; all lookups and checks use the full nullifier, since 48-bit labels would collide at large scale. Because nf depends on the poll identifier, a member’s nullifiers in different polls cannot be linked. All per-poll values — the two snapshot roots, the poll identifier, the tally key, the eligibility rule and the submission context — are bound into a single public value, **pollHash**, which the contract computes once when the poll is created. The proof therefore has only 18 public field elements: pollHash, the nullifier and the 16 ciphertext coordinates (four options, two points each, x and y). The identity holds the member's **date of birth**, hidden, rather than an age band fixed at enrolment, which would go out of date as people age (Decision Log #37) [45]. A poll's age rule is a range of birth dates computed for the poll's opening date in UTC, so “at least 18” is always measured on the day the poll runs; the proof reveals only that the date lies in the range. In the reference implementation (Section 8.11) the proof for four options, trees of depth 32 and up to three documents has **32,607 constraints**. The first measurement on a phone took **3.5 seconds per proof on an iPhone 14, inside its web browser**, without a native prover. A public benchmark page lets anyone repeat the measurement. Results from low-cost phones are still needed.

### 7.8 Verifying one’s own vote and recounting

- **Own vote (recorded as cast).** The phone keeps the choice and the random values r_j for a receipt window chosen by the member for each vote — none, 7 or 30 days after the poll closes. During that window it recomputes the ciphertexts and checks that they match the ledger, reading it from more than one independent source (to be specified). Afterwards the record is deleted automatically. While they are kept, these values prove the member's answer to anyone who sees the phone; this is why the window can be set to none (9.3).
- **Cast as intended (partial).** Checking the ledger shows that the ballot the phone sent was recorded; it does not show that the phone encrypted the choice the member meant. A cheating app could display one choice and encrypt another.
- **Counted as recorded.** After publication, the phone checks that its ballot is the last one for its nullifier in the final ballot set, recomputes the totals and checks the decryption proofs.
- **Auditing the app (optional).** Before submitting, a member may choose to audit a ballot: the app reveals its random values so that anyone can check it encrypts the displayed choice; that ballot is discarded and a new one prepared [32]. This catches a cheating app only with some probability, and only if members use it.
- **Public recount.** Anyone can take every last ballot per nullifier, add the ciphertexts per option, combine the trustees’ published partial decryptions, verify their proofs and recover each total by a bounded discrete-logarithm search (the bound is the number of identities in the poll's snapshot). Because ballots are one-hot, the sum of the option totals equals the number of counted ballots; an abstention is counted only if the poll offers it as an option, and audited ballots are never submitted. The recount verifies the tally over the final ballot set on the ledger. That the set is complete rests on the ledger accepting every valid ballot (forced inclusion, 8.1) and on each member's own check.

### 7.9 Verified breakdowns without exposing small groups

When a poll reports results by a verified attribute (for example an age group computed for the poll's date), the ballot vector is indexed by option and by the member’s cell, and the proof shows that the cell matches the attribute hidden in the member’s identity. Trustees first decrypt only the number of participants per cell; cells below the minimum size (for example 50) are merged by a rule fixed in advance, and only then are option totals decrypted. No individual ballot is ever decrypted. This still publishes the exact size of small cells, and comparing overlapping breakdowns across polls could reveal more. Coarse cells fixed in advance, revealing only whether a cell reaches the minimum instead of its size, and limits on overlapping breakdowns are being considered (Section 17).

### 7.10 Unlinkable registration

To keep the uniqueness service from linking a person to their identity on the ledger, the enclave signs only the hiding commitment cm. Later, the phone submits (leaf, cn) with a zero-knowledge proof of the following statement:

```
leaf = Poseidon(idc, Poseidon(attrs, salt_a), rn),  idc derived from s
cm   = Poseidon(idc, salt_a, ρ),   cn = Poseidon(ρ)
σ is a valid enclave signature on Poseidon(attrs, cm, rn, epoch)
      under a key in the published enclave key-set root
```

The enclave knows cm but not ρ or idc, so it cannot recognise leaf or cn; the proof reveals neither cm nor σ. The registry stores every credential nullifier and rejects a repeat, so one credential cannot be used twice. The ledger accepts a registration only if the signing key is in the published enclave key set. A random delay, an anonymising network, a minimum batch size for insertion and hiding the signing epoch protect against matching by timing.

### 7.11 Revocation without linking

At each enrolment the enclave derives a revocation handle rn from the person’s document fingerprint and an enrolment counter, and includes it in the credential. rn is hidden inside the leaf. When a person re-enrols, the enclave publishes the old rn to a public revocation list. Every ballot proof shows that the member’s hidden rn is not on that list. The enclave knows rn but not the leaf, so publishing it revokes the old identity without revealing which ledger entry it was. Every revocation is logged publicly with a reason code, and revocation counts are public, so unusual activity is visible.

### 7.12 Cryptographic agility and the quantum horizon

Every registry entry, poll and ballot records an algorithm version. The elliptic-curve primitives used here are not resistant to future large quantum computers: encrypted ballots kept on a public ledger could in principle be decrypted by such a computer in the future (“harvest now, decrypt later”). The design limits exposure by keeping personal data off the ledger, by trustees deleting their key shares after each tally — an operational measure that depends on secure erasure and on no earlier copy, and that cannot be proven — and by planning migration to post-quantum encryption, signatures and proof systems as they mature. This remains an open question (Section 17).

## 8. Ledger Design

### 8.1 Choice of network

| Option | Strengths | Weaknesses | Use |
|---|---|---|---|
| Ethereum mainnet | Highest security and neutrality | High and variable fees per answer | Periodic anchoring of state roots |
| Ethereum Layer-2 rollup | Low fees; inherits Ethereum security; EVM tooling and audited contracts | Sequencer operated by a company; data costs at very large scale | **Proposed for Phases 0–3** |
| Dedicated application chain | Full control of fees and validators | Must build its own validator security and neutrality | Option for later phases |
| Private or permissioned ledger | Simple to operate | Not publicly verifiable — defeats the purpose | Not used |

Contracts use standard EVM interfaces so that they can be deployed on any EVM network. The chosen rollup must offer a working forced-inclusion path to Ethereum, so that no sequencer can permanently censor ballots. Forced inclusion differs between rollups, so the selection compares the worst-case forced-inclusion delay, the operator's powers to pause or upgrade, and fees, checked against independent assessments such as L2BEAT [35]. Every poll stays open for at least that delay plus a margin.

**Long-term availability.** Rollups post their data to Ethereum as blobs that ordinary nodes keep for only about 18 days [26]; this is temporary availability, not an archive. Recounting must remain possible for years, so after each poll the full ballot set is archived by several independent archivers on content-addressed storage, and the archive’s hash is recorded on the ledger. The hash proves that a copy is complete and unaltered; it does not keep anyone serving it. The archivers' duties, regular checks that copies are still served, and recovery if copies are lost are to be defined.

### 8.2 Contracts

| Contract | Holds | Key functions |
|---|---|---|
| IdentityRegistry | Merkle tree of identity leaves (depth 32); used credential nullifiers; queue of pending leaves; historical roots | register, insertBatch (with batch proof) |
| RevocationRegistry | Indexed Merkle tree of revoked handles; public revocation counters and reason codes | revoke (with revocation proof) |
| EnclaveKeyRegistry | Root of valid enclave signing keys; enclave image measurements matching reproducible builds | updateKeySet (time-locked) |
| PollRegistry | Poll parameters: content hash, options, eligibility rule, snapshot roots, eligible count, times, tally key, trustee set, verifier | createPoll (computes pollHash; checks the tally key), attachTallyKey |
| PollAnswers | Latest ballot per nullifier; re-vote counter; ordered ballot chain; count of distinct participants | vote |
| ResultsRegistry | Totals, decryption transcript hash, archive hash, challenge state | publish, challenge, finalize, markWithheld |

**Past polls cannot be changed.** Each poll fixes, at creation, the verifier it uses and its snapshot roots. No later upgrade can alter how an existing poll is checked or counted.

### 8.3 Registering a member

```
register(leaf, cn, keySetRoot, proof)
  require cn not used; keySetRoot is valid; proof verifies (7.10)
  mark cn used; append leaf to the pending queue
  extend the batch chain hash: h = Poseidon(h, leaf)
insertBatch(newRoot, batchProof)              (anyone may call)
  require a full batch of B leaves is waiting (e.g. B = 1,024)
  require batchProof shows: the next aligned subtree of old root was
    empty, and newRoot = old root with exactly those B leaves, in order,
    matching the recorded chain hash h
  update root; record newRoot as a valid historical root
```

The reference contracts measured both approaches. Hashing a depth-32 path on the ledger costs about **1,050,000 gas per leaf**. Verifying one zero-knowledge proof for a whole batch, an approach already used in production [31], costs about **294,000 gas per batch**, and this verification cost does not depend on the batch size — under 300 gas per leaf for a batch of 1,024. Making that proof does depend on the batch size (501,947 constraints for 1,024 leaves, 8.11). Revocations use the same idea: a revocation proof shows the new handle fits a gap in the sorted list and is appended at the next free slot, which cut the cost of one revocation from about 4,000,000 to about **295,000 gas**. A minimum batch size helps against matching registrations by time; it is not an anonymity guarantee. On the ledger, each registration's leaf and credential nullifier and its position in the pending queue are public.

### 8.4 Creating a poll and the membership snapshot

When a poll is created, the current identity root and revocation root are stored as its **snapshots**, together with the number of eligible identities. Only members in the snapshot whose handle is not revoked can answer. Trustees then attach the poll’s tally key with their signatures; ballots are accepted only after that. A poll stays open for at least 48 hours so that forced inclusion remains usable if a sequencer censors. The poll text and options are stored on content-addressed storage with their hash on the ledger, so the wording cannot be changed after publication.

### 8.5 Recording a ballot

```
vote(pollId, nf, C, ctxHash, proof)
  require poll open; C has the expected length
  rebuild public inputs from the poll’s own pollHash, nf and C
  require proof verifies (never trust inputs from the submitter)
  require re-votes for nf below the cap (e.g. 10)
  if first ballot for nf: distinctVoters += 1
  latest[pollId][nf] = hash(C);  extend ballotChain[pollId]
  emit Ballot(pollId, nf, C, count)
```

**Batched submission.** A relay may submit many ballots of one poll in one transaction (voteBatch). All their proofs are checked together with random weights, which needs n + 3 pairing operations instead of 4n. The weights are derived from a hash of the complete call data, after every proof is fixed, so a submitter cannot choose invalid proofs that cancel out (the hash is modelled as a random oracle). Each ballot is then recorded exactly as if it had been sent alone, in the order of the call data, so the ballot chain and the recount do not change. The contract is to reject a batch holding two ballots with the same nullifier, so that a relay cannot choose which of a member's answers counts. One invalid proof rejects the whole batch, so a relay checks each proof before batching. Members can always submit through another relay or directly.

### 8.6 Relay service: no cryptocurrency, no IP address

Members never need a crypto wallet or tokens, as long as someone pays the transaction fee: the phone sends its ballot through a relay service that pays it (an ERC-4337 paymaster or equivalent [27]). Because the proof is bound to the ballot, the relay cannot change it. The app connects through an anonymising network with censorship-circumvention transports [34], so relays and the ledger do not learn the member's IP address; the member's own network provider can see that the phone connects to the anonymising network, and a global observer correlating traffic is not prevented. Several independent relays operate. Submitting directly means sending the transaction to any node with a fee paid by any sponsor; if no sponsor were left, a member would need a funded account.

**Access under network restrictions** (Decision Log #34) [42]. Using an ordinary VPN or circumvention tool must never break enrolment or voting. No Proof of One service blocks VPN, Tor or proxy users or checks where a connection comes from. The app includes circumvention transports of its own and also works through the member's own VPN. Core functions need no account, phone number or SMS. On Android, device integrity is checked with hardware key attestation, verified against Google's published root certificates without contacting Google; revocation lists are fetched by the service, not by the member. On iOS, App Attest needs Apple's servers at enrolment. The app is available from several independent sources, and the addresses of its services come from a signed list that is updated when an address is blocked. Ballots can be prepared offline and sent when a connection is available.

### 8.7 Closing, tallying and publishing

1. At the close time no further ballots are accepted. The last ballot per nullifier counts.
2. Anyone adds the ciphertexts per option. Trustees publish partial decryptions of these totals with proofs of correctness (7.8).
3. The trustees publish the result. The contract checks that the ballot chain matches, that the totals add up exactly to the number of distinct participants, and that this number does not exceed the eligible identities in the snapshot. **These checks do not show that each option's total is correct.** In the reference contracts that rests on the public recount; checking the decryption proofs and the aggregate on chain is specified but not yet implemented (Section 17).
4. A public challenge period (for example 7 days) follows. Challenges are to cover an invalid decryption proof, a wrong aggregate and a valid ballot missing from the final set, each with an on-chain check where possible; their exact form is still to be specified. If no valid challenge arrives, the result becomes final.
5. If no result is published within a deadline (for example 14 days after closing), anyone can mark the poll as “result withheld”; the number of participants and the ballot chain remain public facts.
6. After the challenge period, trustees delete their key shares and publish signed statements, so that a later compromise of their systems cannot decrypt individual ballots. Deletion cannot be proven; it is an operational measure.

### 8.8 On-chain and off-chain data

| Data | Where | Visible to |
|---|---|---|
| Identity leaf, credential nullifier, revoked handles | Ledger | Everyone (reveal nothing about persons) |
| Poll definition hash, snapshot roots, tally key, times | Ledger | Everyone |
| Encrypted ballots, nullifiers, ballot chain | Ledger and long-term archives | Everyone (content encrypted) |
| Totals, decryption transcript, archive hash | Ledger and archives | Everyone |
| Poll text and options | Content-addressed storage | Everyone |
| Document fingerprints and face templates | Encrypted store, readable only in the enclave (later MPC) | No one outside the enclave |
| Passport data, identity secret, receipt | Member’s phone only | The member |

### 8.9 Scale and cost

| Operation | Measured gas (reference contracts) |
|---|---|
| Register an identity (proof check, storage, batch chain hash) | about 335,000 |
| Insert a batch of identities (one proof, any batch size) | about 294,000 per batch |
| Revoke an identity (one proof) | about 295,000 |
| Create a poll (tally-key check, pollHash; once per poll) | about 922,000 |
| Cast a ballot, four options, sent alone | about 392,000 (about 426,000 for a poll’s first) |
| Cast a ballot in a batch (per ballot, large batches) | about 101,000 |
| Change a ballot (re-vote) | about 378,000 |
| Publish a result | about 158,000 |

*Measured on an in-process EVM with real Groth16 proofs; contracts are unoptimised reference code. Figures vary by a few dozen gas between runs because proof bytes differ.*

Gas is now measured; the price of gas is not. At assumed Layer-2 prices, a ballot sent alone costs roughly one to fifteen US cents. In batches, at about 101,000 gas, it costs roughly a quarter of a cent to four cents, so a poll with one million participants could cost roughly 2,500 to 40,000 dollars. Because participation is free and paid from a common fund (Section 10), cost reduction is a priority [40]. Batched verification already makes ballots about 3.8 times cheaper. Recursive aggregation, in which one proof covers many ballots, is estimated to reach about 8–10 times. Moving the latest-ballot record off-chain as well would reach about 25–35 times ([ballot aggregation](../specs/ballot-aggregation-v0.1.md) shows the calculation). An earlier version of this paper expected 10 to 100 times. **Under the current design 100 times is not reachable**, because every ballot's ciphertexts (16 field elements) must stay available on the ledger so that voters can check their own vote and anyone can recount; their data cost alone sets the floor. Aggregators cannot censor, because members can always submit directly. Money figures remain estimates until measured on a public test network.

### 8.10 Contract governance

The contracts are deployed without proxies and have no upgrade path; a new version means new contracts. A time-locked multi-signature group of independent, pseudonymous signers can update the enclave key set, which affects only future registrations, and deploy new verifier versions and defaults for future polls. Because each poll fixes its verifier and snapshots at creation and there is no cancel or pause function, the group cannot alter an existing poll, ballot, result or root, and cannot revoke identities. In the reference contracts a single governance address stands in for this group.

### 8.11 Reference implementation

A working reference implementation of the voting core is published with this paper at **github.com/NemoUnus/proof-of-one**, under reference/. It is written to be read and attacked, not deployed: it is not audited, and all proofs use a **test-only trusted setup** made by a single contributor.

| Package | What it contains | Tests |
|---|---|---|
| tally | Encrypted one-hot ballots, nullifiers, trustee key generation, voter self-verification, homomorphic tally, threshold decryption with proofs, independent recount tool | 25 |
| ballot-circuit | Ballot proof π_vote (Circom, Groth16): membership, non-revocation, nullifier, eligibility with up to three nationalities and an age range on the poll date, well-formed encrypted ballot, pollHash | 18 |
| enrolment-circuit | Registration proof π_reg, batch insertion proof π_batch, revocation proof π_revoke, enclave credential issuance including added documents | 21 |
| contracts | Identity and revocation registries, polls, ballots and results in Solidity; single and batched ballot submission; full on-chain flow with real proofs | 9 |
| document-circuit | Document-validity proof π_doc in two signature suites; synthetic ICAO documents; the trust-list tool that reads signed CSCA master lists under pinned anchors | 34 |
| android-prototype | An Android app that reads a passport chip by NFC, checks its data against its signature on the phone and exports the public signer certificate; no network access | — |
| phone-bench | A public web page that makes the ballot proof on the visitor's phone and reports the time | — |
| aggregation-prototype | The ballot proof and an aggregator in Noir (UltraHonk, universal setup), for size measurements of recursive aggregation | check script |

The 107 tests include attack cases: two-hot, empty and vote-shifting ballots; ciphertexts that do not match the proven choice; replay in another poll; a proof attached to someone else’s ballot; a revoked member with a forged low leaf; wrong totals and a wrong ballot chain at publication. Both founding properties are exercised in code: the voter’s phone checks its recorded and counted ballot, and a recount tool rebuilds every result from public data alone.

| Proof | Constraints |
|---|---|
| Ballot proof π_vote (4 options, trees of depth 32, up to 3 documents, birth-date range) | 32,607 |
| Registration proof π_reg (key-set depth 8) | 9,369 |
| Batch insertion proof π_batch | 16,227 (4 leaves); 501,947 (1,024 leaves) |
| Revocation proof π_revoke (depth 32) | 32,521 |
| Document-validity proof π_doc (RSA-2048, SHA-256 / RSA-3072, SHA-1, any exponent) | 577,678 / 749,147 |

Building the code also produced details the specifications must now state explicitly, recorded in the published implementation notes. The most important are:

- **The verifier rebuilds every public input** from the poll’s own state and the submitted ciphertexts; nothing is accepted from the submitter.
- **Ballot ciphertexts need no on-chain curve check**, because the proof computes them from the generator and the tally key; the tally key is checked once, when the poll is created.
- **Every hash use carries a domain tag** (nullifier, commitment, credential, revocation handle, poll hash and others), so no value can be reused in another role.
- **The ballot chain is fixed byte for byte**, and the reference tally and the contract produce identical chains.
- **Snapshots are fixed at poll creation.** A revocation applies to polls created afterwards, not to polls already open.
- **Without the ballot proof, tally checks alone cannot detect a vote-shifting ballot** such as (+2, −1, 0, 0); every path that accepts ballots must verify the proof.
- **A failed elliptic-curve operation on the ledger consumes all the gas given to it**, so the batch verifier gives each one a fixed allowance; otherwise one invalid point would exhaust a whole transaction.
- **The choice of hash and curve decides the cost in other proof systems.** In the recursion-friendly system tested, the ballot proof needs about 147,000 gates with the current Poseidon and Baby Jubjub, but about 20,000 with that system's native primitives. Verifying one ballot proof inside an aggregation proof costs about 750,000 gates, on servers. Whether to redesign the primitives is left open until proving times are measured [40].

## 9. Core Product: Verifiable Polling

### 9.1 Poll lifecycle

1. **Propose and select.** Sponsored polls are proposed and selected by participants (Section 10). Commissioned polls are ordered and paid for by organisations (10.4).
2. **Participate.** An eligible member answers in the app. The phone proves eligibility in zero knowledge and submits an encrypted ballot under a private ballot number.
3. **Review and change.** Until the poll closes, the member can check their recorded ballot and change their answer; only the last answer counts.
4. **Close, publish and verify.** Totals are decrypted with public proofs, published with verified breakdowns and opened for a public challenge period. Anyone can recount.

### 9.2 The private ballot number

For each poll, the participant’s phone — not the network — generates a private ballot number and a poll-specific **nullifier** derived from the member’s secret. The nullifier prevents the same person from being counted twice in that poll but cannot be linked to the person or to their ballots in other polls. The encrypted ballot is recorded on the public ledger under the nullifier, with a zero-knowledge proof that it comes from an eligible member [12]. No operator holds the link between members and nullifiers, so by design no operator can tell who answered what, even if compelled to, under the assumptions of Section 12; a phone inside its receipt window is the known exception.

### 9.3 Protecting participants

- **Receipt window.** The member chooses for each vote how long their phone keeps the information needed to verify it: none, 7 or 30 days after the close. After that, nothing on the phone reveals the answer.
- **Duress PIN.** A second PIN opens the app in a state with no records. This is a limited emergency feature; it does not make standard polls resistant to coercion, which is not claimed for them (9.4).
- **No history.** The app keeps no list of polls answered beyond the active receipt windows.
- **Anonymous network access.** All connections go through an anonymising network; enrolment and voting never happen in the same session.
- **Verifying the app.** Builds are reproducible and the signing-key fingerprint is published in several independent places, so members can detect counterfeit apps.

### 9.4 Assurance modes

| Mode | Typical use | Ballot | Protection |
|---|---|---|---|
| Standard (default) | All public-opinion polls | Encrypted; only totals decrypted | Re-answer until close; receipt window; trustee share deletion |
| Open (opt-in) | Non-sensitive questions where individual answers are useful to publish | Plain text under the nullifier, which is unique per poll and unlinkable across polls | Creator must confirm the poll is non-sensitive; clear warning to members that free text can identify its author |
| Binding vote (future) | Elections and referendums where legally authorised | Encrypted | Receipt-free design with key change [13][14]; required before any binding use |

### 9.5 Verified demographic results

- **Breakdowns by verified attributes.** Results can be reported by age group, nationality and other attributes proven at enrolment — not self-declared.
- **Minimum group size.** A breakdown is shown only when its group contains at least a set number of participants (for example 50), so that small groups cannot reveal individual answers [20].
- **Honest presentation.** People who choose to answer a poll are not a random sample of the population, and weighting by verified attributes does not make them one. Results are published without a margin of sampling error; if an uncertainty measure is shown, it is named and its model stated (for example a credibility interval), as professional guidance for opt-in polls requires. Every result states its method and the self-selection caveat.

## 10. Community Agenda and Free Participation

Participation in Proof of One is **free**. Charging participants would sharply reduce participation and would exclude people who cannot reach the global financial system. The cost of sponsored polls is therefore paid from a common fund supported by voluntary contributions (Section 16). Because the fund is limited, the topics it pays for are chosen by participants themselves, not by the project.

### 10.1 Regions and the global track

- **Regions** are defined by the nationality attribute proven from the identity document. At launch there is one region per nationality; the list is public and changes only by a recorded decision. The network does not know or need members’ locations, and members living abroad take part in their own country’s track. A member with several verified nationalities takes part in the track of each (6.12).
- **The global track** holds polls on questions that concern people everywhere, regardless of borders, open to all members.

### 10.2 Monthly topic selection

1. **Proposals.** Each member may propose one topic per month in each track they belong to: each of their regions, and the global track.
2. **Endorsement.** Members endorse proposals anonymously, one endorsement per person per proposal, using the same nullifier technique as ballots. To make totals recountable, endorsements are to be recorded like ballots, with a proof of membership and a per-proposal nullifier; until that is designed, endorsement totals cannot be checked independently.
3. **Selection vote.** The ten most-endorsed proposals in each track go to an approval vote, in which members may approve several. The winners, up to the number the track’s budget allows, become that month’s sponsored polls.

### 10.3 Budget rule

The fund’s monthly budget is divided by a public formula fixed in advance: a fixed share for the global track, then an equal base share for each region plus a share proportional to its number of members. The same formula applies to every region; its parameters and the region list still shape the outcome, so they are published and changed only by recorded decisions.

A member with several nationalities counts in each of their regions, and the number of such members is published with the budget.

### 10.4 Neutral wording and visible manipulation

- **Wording guideline.** A public guideline defines neutral question wording. Any edit made to a selected proposal is published next to the original text. Who applies the guideline, how reasons are published and how proposers can appeal are to be set in a written governance procedure.
- **Flooding signals.** Endorsement and selection statistics are published by document issuer. An unusual pattern is a signal that triggers review, not proof of manipulation, and no one is excluded on statistics alone.
- **Commissioned polls.** Universities, researchers, media and other organisations may commission polls and pay for them (Decision Log #35). The same cryptography, anonymity and verifiability apply, and the sponsor receives no individual data. Results are decrypted by the trustees and published to everyone at the same time when the poll closes; the contracts have no function to cancel a poll, so a sponsor cannot suppress the result or see it early. Each poll shows its sponsor and method, wording passes the neutrality guideline, and polls that could endanger a group of participants are refused, with criteria, published reasons and appeal set in the governance procedure. One public price applies to everyone: the actual cost plus a fixed share for the common fund. Commissioned polls run in a separate track, never displace polls chosen by members, and are capped per member.

## 11. Further Applications

The same identity layer supports other uses once the polling platform has established a member base:

- **Verifiable petitions** in which every signature comes from a unique, verified person.
- **Private sign-in** to websites and apps without passwords, revealing only what the user chooses.
- **Age checks** that reveal only a yes-or-no answer.
- **Fair allocation** of anything limited to one per person, such as tickets, quotas or rewards.
- **Human authorship** labels for content, reviews and comments in an era of AI-generated material.

**Proof of personhood and age verification for other services** are also the project's main planned source of sustainable funding (Decision Log #36). Many services need to know that a user is a real, unique person or is over a legal age, and today's methods either expose identity documents or guess age from a face. With Proof of One, a member's phone proves only the one statement asked, such as "over 18 today", and nothing else. Three rules protect members [45]. Each service sees a **different identifier** for the same member, derived from the identity secret and the service's identifier with its own domain tag, so services cannot link a member across sites through it; services that collude can still link members through other data they share. Verification happens **at the service or on the public ledger, never through Proof of One servers**, so the project cannot learn which services a member uses. And members always use it free of charge, while businesses pay published prices into the common fund. Which categories of services may use it is an open question for legal and ethical review.

## 12. Security and Threat Model

The threat model assumes an adversary with the resources of a state: able to issue genuine identity documents, monitor and block networks, seize phones, coerce individuals, pressure app stores and service providers, run many real devices, contribute code under false identities and run discrediting campaigns. Threats are ranked by their impact on participant safety first, integrity second and availability third.

### 12.1 The fundamental limit

> An authority that issues identity documents can create genuine-looking identities from its own documents. Proof of One cannot prevent this. It can make such fraud costly and give signals of it — not impossible, and not bounded.

- Each fake identity still needs a distinct face that passes the duplicate search and liveness, which makes mass fraud costly. Duplicate faces are searched across all members to detect the same person enrolling twice under different documents and birth dates (6.7); the measured miss rate of that search is a security limit.
- Enrolment counts per document issuer and per document-signing certificate are published in aggregate, so unusual surges are visible; counts are compared with public population figures.
- A poll may count only identities enrolled before it was announced, and the network checks that the number of ballots never exceeds the number of eligible identities.
- Results can be shown with and without the documents of a given issuer. Once a pattern is suspected this limits the damage, but it does not prove fraud.

### 12.2 Main threats

| Threat | Mitigation | Residual risk |
|---|---|---|
| Seized phone reveals past answers | Encrypted ballots; receipt window chosen per vote; automatic deletion; duress PIN | Answer in a poll still inside its receipt window; fact of participation |
| Uniqueness service links people to identities | Unlinkable registration with a hiding commitment; random delay; minimum batch of 1,000; hidden signing epoch | The service knows that a person enrolled |
| Face database as a list of participants | Encrypted templates in an enclave; MPC across jurisdictions before any high-risk use | Enclave or provider compromise until MPC is in place |
| Network surveillance of app use | Anonymising network with circumvention transports; distribution outside app stores; reproducible builds | Presence of the app on a seized phone |
| Counterfeit app collecting data | Published signing fingerprint; enclave accepts only attested genuine apps; user guidance | Data harvested before the counterfeit fails |
| Document issuer creates identities | Section 12.1 | Costly and signalled, not prevented |
| Injected camera feed or deepfake | Presentation-attack detection [18]; hardware attestation; limit per attested device | Well-resourced attacks on device hardware |
| Lost phone used to create a second identity | Re-enrolment revokes the old identity after a cooling-off period | Window of the cooling-off period |
| Forged proofs from a compromised setup | Universal setup, or a multi-party ceremony in which one honest participant suffices (issue #7) | If the setup is compromised, forged ballots can fill places up to the eligible count and change the result; the count check limits only their number |
| Wrong or withheld result | Public recount; decryption proofs; challenge period; “result withheld” state | Delay of publication; until on-chain checks of the totals exist (8.7), a wrong result is caught only by people who recount |
| Trustee collusion | At least 9 trustees, threshold about two-thirds, different jurisdictions; share deletion | A colluding threshold before deletion could decrypt ballots, though not change results |
| Coercion to vote in front of someone | Re-answer until close; receipt window of zero | Coercion just before closing |
| Censorship by sequencer or relay | Independent relays; direct submission; forced inclusion; polls open longer than the chain's worst-case forced-inclusion delay | Missed ballots or an unusable poll if forced inclusion fails or is too slow |
| Malicious update of the trust list (CSCA certificates and signer tree) | Pinned anchors; public tool anyone can rerun; changes published with reasons ([trust list](../specs/trust-list-v0.1.md)) | Forged documents accepted until a reviewer notices; governance of changes is open work |
| Malicious update of the enclave key set or approved builds | Time-locked multi-signature; reproducible builds; changes affect only future enrolments | Credentials issued by a rogue enclave until noticed |
| Malicious or captured trustees at onboarding | Public trustee list; independence criteria (Section 14) | A threshold sharing an owner or jurisdiction |
| Malicious code contribution | Two independent reviews of security-critical code; signed commits; pinned dependencies; audit before each stage | Subtle flaws missed by reviewers |

## 13. Open Source and the Human–AI Team

### 13.1 Open-source practice

- **Everything public from the first line.** Code, circuits, contracts and specifications are published as they are written, with the security assumption of each component stated in comments and tests published alongside the code.
- **Licences.** Copyleft (AGPL-3.0) for the app, relay and enclave services, so that modified versions stay open; permissive (Apache-2.0) for reusable libraries and circuits.
- **Reproducible builds.** The phone app and the enclave image build bit-for-bit from the public source, so anyone can check that the published code is the code that runs. Enclave attestation is only meaningful with this.
- **Staged release.** Public code, then a public test network and bug bounty, then an independent human audit, and only then use with real people. Code is never shipped to real participants on the assumption that reviewers will find problems later.
- **Responsible disclosure.** Every repository has a private channel for reporting vulnerabilities, with published response times.

### 13.2 The team

Proof of One is led by its pseudonymous founder, **Nemo Unus**, and developed with a team of AI agents. Each agent is an AI system working in a defined role. They are disclosed as AI, name themselves as AI agents in document bylines and commit messages, and never present their work as audited. Human review is recorded by the founder in PROVENANCE.md; commits made through GitHub's web interface carry GitHub's signature, which shows only which account made them. Every safety-critical design, circuit, contract and piece of mobile code they produce must be reviewed by independent human experts, who may themselves be pseudonymous. The project welcomes such contributors.

![](fig/team_en.png)

*Figure 3 — The Proof of One AI agent team. Each agent carries a Greek name chosen for its role.*

**Kryptos — Cryptography Architect.** Greek for “hidden”. Kryptos chooses and justifies every cryptographic primitive and keeps the design consistent. Its rule: never invent new cryptography, and state the assumption behind every choice. In version 0.5 it set the primitive suite (7.2) and designed the hidden revocation handle that revokes a lost identity without revealing which one it was (7.11).

**Psephos — Zero-Knowledge and Voting Protocol Engineer.** The psephos was the pebble Athenians dropped into an urn to vote. Psephos writes the zero-knowledge circuits and the ballot protocol, always separating what is proven from what is trusted. In version 0.5 it designed encrypted ballots that keep both founding promises — every voter can check their own vote and anyone can recount — and the unlinkable registration proof (7.7–7.10).

**Ostrakon — Ledger and Smart-Contract Engineer.** The ostrakon was the pottery shard on which Athenians wrote a name to vote. Ostrakon specifies what lives on the ledger and assumes that sequencers and relays may misbehave. In version 0.5 it wrote the contract design (Section 8), found that ledger data would vanish after about 18 days unless archived, and produced the first cost estimates.

**Prosopon — Mobile Identity Engineer.** Greek for “face”, and also “mask”. Prosopon makes enrolment on an ordinary phone accurate, private and hard to spoof, and insists on measuring accuracy across diverse populations. In version 0.5 it showed that an issuer of documents could defeat face checks grouped by birth date, which led to searching across all members (6.7).

**Argus — Security Red Team.** The hundred-eyed watchman of Greek myth. Argus attacks every proposal, assuming an adversary with the resources of a state. In version 0.5 it led the threat model, found that a seized phone could reveal every past answer in the earlier design, and in its review of the new protocol found eleven further issues, all now addressed (Section 12).

**Themis — Privacy, Ethics and Legal Analyst.** The Greek personification of justice and law. Themis puts participant safety above every feature and flags legal risk plainly, always recommending qualified human legal advice. In version 0.5 it set the participant-safety gates for the roadmap and required that contributions to the fund be kept apart from voting (Sections 14 and 16).

**Metron — Survey Methodology and Statistics.** Greek for “measure”. Metron makes results meaningful, not only verifiable, and never lets a self-selected sample be presented as more than it is. In version 0.5 it set the rules for neutral question wording, small-group protection and honest presentation of results (9.5, 10.4).

**Hermes — Documentation and Community.** The messenger of the gods. Hermes explains the project to every audience and keeps every document consistent with the decisions taken. It drafted this paper, keeps the public decision log and coordinates translations.

> Each agent signs its work as “— Name (AI agent, Proof of One)”. None of their work is described as audited or proven secure until independent human experts have reviewed it.

Version 0.9 adds a step: until human reviewers join, every public document is also checked by a second, independent AI model, at the founder's proposal. For this version that review raised 137 points on version 0.8; none was rejected, and each change is listed in the [review record](../review/second-model-review-whitepaper-v0.8.md). Version 0.8 was itself the product of this process: a threat model led by Argus, protocol specifications by Psephos and Ostrakon, a red-team review of those specifications, decisions taken by the founder, reference code written by Psephos, Ostrakon and Kryptos whose measurements replaced the earlier estimates, a study of document coverage proposed by the founder, and the first phone measurement made by him. All of it is published alongside this paper.

### 13.3 Growing the human part of the work

A project that asks people to trust it must be checked by people. The founder has therefore set a rule (Decision Log #28): the human share of the work should grow over time, and the AI agents' share remains fully credited.

- **The founder reviews every change** before it is published, helped by a plain-language explanation of each technical change, and writes key parts himself.
- **A public provenance record** (PROVENANCE.md in the repository) states, for every part of the project, who wrote it and which humans have reviewed it.
- **Work only people can do is published as open invitations:** measuring the ballot proof on real low-cost phones, line-by-line review of the circuits and contracts, an independent recount tool written by people, and a legal review of licences and AI authorship.
- **Security-critical parts** — circuits, contracts, enrolment and the recount tool — are reviewed line by line by independent human experts, or reimplemented independently, before the first public pilot with real participants. The test network may run on reference code before that review, with test data and clear warnings.

The first human measurement was made by the founder: the ballot proof on a phone, in 3.5 seconds (7.7). Several design changes in recent versions also came from him: several nationalities on one identity (6.12), asking about earlier enrolment, birth-date grouping and template refresh in the face search (6.7), access under network restrictions (8.6), and age verification for other services as a source of funding (Section 11).

## 14. Governance, Legal and Ethical Considerations

- **Stewardship.** The protocol is stewarded by its founder and open contributors. Operational roles — enclave and later MPC operators, tally trustees, relays, archivers and multi-signature signers — are to be held by independent parties in different jurisdictions, and listed publicly by their pseudonymous or organisational identities. Different jurisdictions do not by themselves make parties independent: no shared owners, infrastructure or legal control is required, and how this is checked is disclosed for each operator.
- **Participant safety gates.** No participants from high-risk settings until encrypted ballots, unlinkable registration, anonymous network access and MPC template storage are implemented and independently audited, and until the network has a large existing anonymity set.
- **Informed consent.** Enrolment shows a plain-language statement of what is stored, where, what a seized phone can reveal, and what the system cannot protect against.
- **No overstatement.** Public material never promises complete anonymity or fraud-proof results; people may take risks based on such words.
- **Data protection.** Face templates processed to identify a person uniquely are special-category biometric data under the EU GDPR (Article 9) [17] and comparable laws; the other document data, such as name, date of birth and nationality, is ordinary personal data. Both need a lawful basis under Article 6, and the biometric data also an Article 9 condition; which apply is for qualified lawyers to assess, together with a data-protection impact assessment and the operators' jurisdictions.
- **Right to erasure.** Personal data is not written to the ledger. When a member leaves, their template and fingerprint are deleted and their identity revoked; past encrypted ballots stay on the ledger. Whether the remaining on-ledger records can still count as personal data must be assessed field by field in the impact assessment [17][46]; the design aims for them not to be.
- **Inclusion.** Chip-based national ID cards are accepted alongside passports. People without suitable documents or phones remain a known gap.
- **Neutrality.** The project does not choose sponsored topics, publishes its wording guideline and every edit, and labels the mode and method of each poll.
- **Interoperability.** W3C Decentralized Identifiers and Verifiable Credentials [19] allow national digital wallets to issue attributes to a member’s identity in the future.

## 15. Roadmap

| Phase | Scope | Gate to the next phase |
|---|---|---|
| 0. Open specification and code (in progress) | Done: whitepaper, specifications, threat model, document coverage study, landscape review, reference circuits, contracts and tally with 107 tests, robust trustee key generation, the document-validity proof in two signature suites, a trust list built from signed master lists, an Android chip reader, batched ballot verification, several nationalities, birth date instead of age band, phone benchmarks (3.0–3.5 s). Remaining: results from low-cost phones, proving times for recursive aggregation and for π_doc on phones, the enrolment service, on-chain checks of the tally | Specifications and reference code reviewed by independent human experts |
| 1. Test network and accuracy study | Full system on a public test network with volunteers in low-risk settings; face-accuracy study; ballot aggregation; public bug bounty | Measured error rates; bounty findings fixed; independent audit. The accuracy study starts from public benchmark data; no member's face is used for research without separate consent; its data source, demographic coverage, retention, evaluation protocol and independent oversight are part of this gate |
| 2. Low-risk public pilot | First real polls, community agenda and global track with participants in low-risk settings; first voluntary contributions after legal review | Second audit; stable operation; a minimum anonymity set. Measurable thresholds for each of these are to be fixed before Phase 1 ends |
| 3. Decentralisation and high-risk readiness | Face templates moved to MPC across jurisdictions; threshold enclave keys; independent trustees and relays | All participant-safety gates met (Section 14) |
| 4. Binding votes (vision) | Receipt-free binding votes where legally authorised | Adoption by a public body |

## 16. Funding Principles

- **Non-commercial.** There is no token, no sale and no investor, and no person profits. Proof of One never sells data or insights about members. Non-commercial does not mean that no money changes hands: organisations pay published prices for services, and all income goes to the common fund.
- **A common fund** pays for sponsored polls and essential infrastructure, divided by public rules (Section 10.3).
- **Voluntary contributions** may come from anyone who supports the purpose. Members may contribute too, but only through a separate screen and session that has no connection to their identity or ballots.
- **Anonymity** of contributors and of the team is a principle of the network. The structure of the fund will be designed separately and published before any contribution is accepted, after review by qualified lawyers of sanctions, anti-money-laundering and charity rules in the relevant jurisdictions.
- **Sustainable sources, in order** (Decision Log #36): proof of personhood and age verification for other services, paid by businesses and always free for members (Section 11); commissioned polls at published prices (10.4); grants from foundations; and voluntary contributions.
- **No advertising in the app.** Nothing is ever shown beside a poll. If advertising is ever used, it appears only on the public results website, untargeted and without tracking, never political or related to an open poll, and with a public list of advertisers and amounts.
- **Transparency.** Income and spending of the fund will be published in aggregate.

## 17. Known Limitations and Open Questions

1. **Document issuers.** An authority that issues identity documents can create genuine-looking identities (12.1).
2. **Trust at launch.** Until MPC is in place, template comparison relies on enclave hardware and a cloud provider; the template store is the system’s largest single point of harm.
3. **Face accuracy at scale.** Global duplicate search must be measured on diverse real populations before the method is fixed.
4. **Trustees.** Ballot secrecy relies on fewer than a threshold of trustees colluding; deletion of key shares cannot be proven cryptographically.
5. **Tally checks on chain.** The reference contracts accept a result after checking the ballot chain and the sum of the totals; checking each total on chain is specified but not yet implemented (8.7). Small-cell sizes in breakdowns are published exactly (7.9).
6. **Cast as intended and formal proofs.** The member can check that their ballot was recorded and counted, not that the phone encrypted what they meant, except by the optional audit (7.8). R1 and R2 have no formal proof yet.
7. **Document fingerprints.** Name-based fingerprints can collide and change with a person's name; documents without a personal number rely on the face check (6.6). No source tells the system that a document was reported lost or stolen.
8. **Participation.** A member’s secret always reveals whether they took part in a poll, though not how they answered after the receipt window. Hiding participation is open research.
9. **Early anonymity sets.** Early in the network’s life few people enrol; insertion waits for a minimum batch, which delays early members.
10. **Long-term secrecy.** Encrypted ballots on a public ledger may become readable by future quantum computers.
11. **Coercion.** Re-answering reduces but does not remove coercion, and during the receipt window the phone holds proof of the answer; binding votes need a receipt-free design. Vocdoni's DAVINCI re-encrypts stored ballots to approach receipt-freeness; such designs sit in tension with each member checking their own ballot (R1), and this trade-off is open.
12. **Reach.** Today only about one person in six holds a chip document that a phone can read, with large gaps in South Asia and Africa (6.4). Results describe those who can and do take part.
13. **Cost.** Ballot gas is measured and batching cuts it by about 3.8 times, but free participation still depends on voluntary funding and gas prices. Recursive aggregation would need substantial server capacity (8.11).
14. **Reference code status.** All proofs use test-only trusted setups; a real deployment needs a large public ceremony or a universal-setup proof system. The generated verifier contracts carry a licence that must be resolved before release.
15. **Document coverage and platform dependence.** Not every country issues chip documents, and the signing certificates of 52 of the 186 countries that issue chip passports could not yet be obtained from a trustworthy source; NFC, camera access and attestation depend on Apple and Google policies, and distribution outside app stores is limited on iOS.
16. **Network restrictions.** Where app stores or services are blocked, access depends on circumvention tools that may stop working; on iOS, distribution depends on the app store in each region. Having the app installed may itself carry risk in some places, which needs human expert review before any high-risk use.
17. **Camera authenticity.** The live face feed is trusted on the basis of attestation and presentation-attack detection, not cryptographic proof.
18. **Representativeness.** Weighting improves estimates but cannot fully correct for who chooses to join.
19. **Governance procedures.** Who decides on wording edits and on refusing a poll for safety, and how decisions are appealed, is not yet written down (10.4).
20. **Legal.** No lawyer has yet reviewed the data-protection, sanctions or licence questions in this paper.
21. **Name.** “Proof of One” must be checked for trademark and domain conflicts before launch.

## 18. Conclusion

Proof of One combines a government-signed identity document, a live face match and privacy-preserving cryptography with one aim: one identity per person and one ballot per poll, while keeping who answered what private, subject to the limits of issuers' honesty and of measured matching errors (Section 17). It is designed so that every participant can check their own ballot and anyone can recount every result. Participation is free, topics are chosen by participants, and all code is open. The project commits to one rule above the others: nothing will reach real participants before independent human experts have tested and audited it. The specifications and a working reference implementation are public, and the first phone measurements are encouraging. Today about one person in six can take part, and that share grows each year. The next steps are independent review by human experts, and measurements on low-cost phones.

## References

- [1] World Foundation announcements, 2026 — about 18 million Orb-verified people (figure reported by the project).
- [2] Humanity Protocol — palm-based proof of humanity.
- [3] Human Passport (human.tech, Holonym Foundation) — formerly Gitcoin Passport.
- [4] Self Protocol — passport-based zero-knowledge identity verification (Celo developer documentation).
- [5] ZKPassport — private, unforgeable identity from passport chips; acquired by Aztec Labs.
- [6] ICAO Doc 9303, Machine Readable Travel Documents — electronic passports, passive and active authentication.
- [7] Regulation (EU) 2024/1183 (eIDAS 2.0) — European Digital Identity Wallet.
- [8] Bhutan National Digital Identity integration with Ethereum, 2025.
- [9] Republic of Estonia, Internet Voting (i-Voting), in use since 2005.
- [10] Specter, Koppel and Weitzner, “The Ballot is Busted Before the Blockchain: A Security Analysis of Voatz”, MIT, 2020.
- [11] Gaudry, P., analysis of the encryption used in the Moscow 2019 blockchain voting system, 2019.
- [12] Semaphore — zero-knowledge group membership and signalling protocol.
- [13] Vocdoni open voting protocol; MACI (Minimal Anti-Collusion Infrastructure).
- [14] Juels, Catalano and Jakobsson, “Coercion-Resistant Electronic Elections”, 2005.
- [15] Freedman, Ishai, Pinkas and Reingold, “Keyword Search and Oblivious Pseudorandom Functions”, TCC 2005.
- [16] Dodis, Reyzin and Smith, “Fuzzy Extractors: How to Generate Strong Keys from Biometrics and Other Noisy Data”, EUROCRYPT 2004.
- [17] EU General Data Protection Regulation (GDPR), Articles 9 and 17.
- [18] ISO/IEC 30107-3, “Biometric presentation attack detection — Part 3: Testing and reporting”.
- [19] W3C Decentralized Identifiers (DID) v1.0; W3C Verifiable Credentials Data Model 2.0.
- [20] Sweeney, L., “k-Anonymity: A Model for Protecting Privacy”, 2002.
- [21] Davidson, Faz-Hernández, Sullivan and Wood, RFC 9497, “Oblivious Pseudorandom Functions (OPRFs) Using Prime-Order Groups”, IETF, 2023.
- [22] Barnes, Bhargavan, Lipp and Wood, RFC 9180, “Hybrid Public Key Encryption”, IETF, 2022.
- [23] Grassi, Khovratovich, Rechberger, Roy and Schofnegger, “Poseidon: A New Hash Function for Zero-Knowledge Proof Systems”, USENIX Security 2021.
- [24] Groth, J., “On the Size of Pairing-Based Non-interactive Arguments”, EUROCRYPT 2016.
- [25] Gabizon, Williamson and Ciobotaru, “PLONK: Permutations over Lagrange-bases for Oecumenical Noninteractive arguments of Knowledge”, 2019.
- [26] Ethereum Improvement Proposal 4844, “Shard Blob Transactions”.
- [27] Ethereum Request for Comments 4337, “Account Abstraction Using Alt Mempool”.
- [28] Amazon Web Services, AWS Nitro Enclaves — cryptographic attestation documentation.
- [29] Ethereum Improvement Proposal 2494, “Baby Jubjub Elliptic Curve”.
- [30] ElGamal, T., “A Public Key Cryptosystem and a Signature Scheme Based on Discrete Logarithms”, 1985; Chaum and Pedersen, “Wallet Databases with Observers”, CRYPTO 1992.
- [31] Worldcoin, semaphore-mtb — batch insertion of identity commitments verified by a single zero-knowledge proof.
- [32] Benaloh, J., “Simple Verifiable Elections”, USENIX EVT 2006.
- [33] Pedersen, T. P., “A Threshold Cryptosystem without a Trusted Party”, EUROCRYPT 1991.
- [34] The Tor Project — Tor and pluggable transports (including Snowflake and obfs4).
- [35] L2BEAT — independent risk assessment and maturity stages of Ethereum Layer-2 networks.
- [36] Proof of One, “Who can enrol? Chip identity documents worldwide, v0.1”, October 2026 — docs/research in the project repository; based on Inverid, ReadID Supported Identity Documents (2023), national announcements and World Bank population data.
- [37] ICAO PKD Board, Annual Report 2025 (B-Pub/79): 107 participants at the end of 2025.
- [38] ICAO, “ePassport basics” — more than 140 issuing States and over one billion ePassports in circulation.
- [39] Proof of One, “Several nationalities, one identity — specification v0.1”, October 2026 — docs/specs in the project repository.
- [40] Proof of One, “Ballot aggregation v0.1 — design and first measurements”, October 2026 — docs/specs in the project repository.
- [41] Proof of One, “Face uniqueness at scale — specification v0.1”, October 2026 — docs/specs in the project repository.
- [42] Proof of One, “Access under network restrictions — specification v0.1”, October 2026 — docs/specs in the project repository.
- [43] NIST IR 8271, “Face Recognition Vendor Test (FRVT) Part 2: Identification”, 2019.
- [44] NIST Face Recognition Technology Evaluation (FRTE) 1:N, results reported August 2026.
- [45] Proof of One, “Date of birth and private verification for other services — specification v0.1”, October 2026 — docs/specs in the project repository.
- [46] European Data Protection Board, Guidelines 02/2025 on processing of personal data through blockchain technologies.

## Glossary

| Term | Definition |
|---|---|
| Document fingerprint | A keyed one-way value derived from fields of an identity document that stay the same on renewal (the personal number where present), used to detect the same person enrolling twice |
| OPRF | Oblivious pseudorandom function — lets a service compute a keyed fingerprint of data it never sees |
| Face template | A mathematical description of facial features, not an image |
| Enclave | A hardware-isolated area of a server where data is processed without being visible to the server’s operators |
| MPC | Secure multi-party computation — several parties compute on data that none of them can see |
| Zero-knowledge proof | A proof that a statement is true without revealing the underlying data |
| Nullifier | A poll-specific value that prevents double participation without revealing identity |
| Liveness detection | Checking that a live person, not a photo, mask or video, is in front of the camera |
| Poseidon | A hash function designed to be efficient inside zero-knowledge proofs |
| Groth16 | A zero-knowledge proof system with very small proofs and fast verification |
| Merkle tree | A tree of hashes that lets anyone prove an entry belongs to a set using one short root value |
| Layer-2 rollup | A network that executes transactions cheaply and posts its data and results to Ethereum |
| Relay service | A service that submits members’ transactions and pays the fees, without being able to change them |
| HPKE | Hybrid Public Key Encryption, an IETF standard for encrypting data to a public key |
| Snapshot root | The registry’s Merkle root fixed when a poll opens; it defines who may answer |
| Exponential ElGamal | Public-key encryption in which encrypted numbers can be added together without decrypting them |
| Trustees | Independent parties who jointly hold a poll’s decryption key; a threshold of them is needed to decrypt totals |
| DLEQ proof | A short proof that a trustee’s partial decryption was computed with its real key share |
| Credential nullifier | A value that stops one enrolment credential being used to register twice |
| Revocation handle | A hidden value inside each identity that can be published to revoke it without revealing which identity it was |
| Receipt window | The period, chosen by the member, during which the phone keeps what is needed to verify their own vote |
| Ballot chain | A running hash over all ballots of a poll in order, fixing the exact set that must be counted |
| Challenge period | Time after publication during which anyone can submit evidence that a result is wrong |
| Anonymous identity | A member's identity on the ledger: it cannot be linked to the person, and its nullifiers cannot be linked across polls |
| Pseudonym | A stable name not linked to a legal identity, such as Nemo Unus |
| Unlinkability | The property that two records cannot be shown to belong to the same person |
| Tree of checked signers | A public Merkle tree of document-signer keys, each checked by a public tool against the trust list of state CSCAs |
