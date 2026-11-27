# Whitepaper §6.8, §6.10 and §13.2, draft text for the next version (Decisions #59, #62, #64, #67, #68)

*Draft v0.1, 27 November 2026, for the founder's approval. Replaces whitepaper v1.2, §6.8 (the member's keys), §6.10 (recovery) and §13.2 (the team), and the lines in other sections listed after §6.10. Whitepaper v1.2 still describes the design before Decision #59 (a member number derived from the identity secret, a backup "to be specified", a PIN for each profile) and before Decision #67 (one password per member, a face template kept on the phone). The pilot's app (v0.17) implements what is described here, except where marked.*

---

### 6.8 The member's keys, number and password

The phone holds two kinds of secret (7.3). A **device key**, generated inside the phone's secure hardware and never exported, protects local data and binds it to this phone. The **identity secret** s is used only inside zero-knowledge proofs.

**Password.** At enrolment the member chooses one password, at least 8 characters, and is asked to make it hard to guess. It does two jobs (Decision Log #67):

- it opens the member on this phone each time: the member's file (identity secret, credential, face template, receipts) is encrypted under a key derived from the password with Argon2id (64 MiB of memory, 3 passes) and then again under the device key, so that a copy of the file taken off the phone cannot be attacked without that phone's hardware;
- it protects the member's **encrypted backup** (below).

A second, shorter PIN for daily use was considered and set aside: two secrets are harder to remember than one. The cost is accepted: whoever sees the password typed can open the member on that phone and also knows the backup password; restoring elsewhere still needs the passport's chip and a matching face.

**Member number** (Decision Log #59). After enrolment the phone shows a readable member number, for example:

> ONE-7Q4KM-9M2XH-8T3VA-5RZ0P-K

It is derived, under its own domain tag, from the value k·x that only the phone obtains in the fingerprint OPRF of the person (7.5): x comes from the person's signed document fields and k is the service's key. It therefore depends only on the person and the key: the same person gets the same number on any phone, after re-enrolment and after renewing the passport. The service, which sees only the blinded input and the fingerprint, cannot compute it from what it stores. It has a random form, never a sequence, which would show the order of enrolment. It is shown after enrolment, and when a further enrolment with the same passport is refused ("this passport is already enrolled as ONE-…; each person enrols once"), so that the one-person rule can be seen at work. It is never sent anywhere. It is not a password and not a recovery code, but it is stable and tied to a person, so the app warns against sharing it: whoever holds the OPRF key and a person's document data could recompute it.

**Encrypted backup.** At enrolment the phone encrypts the member's file under a key derived with Argon2id from the password and a backup seed, itself derived from k·x under another domain tag, and the enrolment service keeps the ciphertext beside the person's fingerprint. The service cannot open it: it does not know the seed, because it never sees x, and even with the seed a password would still have to be guessed through Argon2. The backup does not contain the face template (below).

**Several members on one phone** (Decision Log #54, as built under #67). So that people without a suitable phone, or without the skills to use one, can take part, a phone holds up to four members. Each is a separate member with their own identity, enrolled with their own passport and live face.

- Each member opens with **their own password**, and each member's file is encrypted separately. The first screen lists the members by a label each chooses; labels and the day each member was added are visible to anyone who opens the app, so the app asks for a nickname, not a real name.
- An open member **closes by itself** after five minutes without use. From the third wrong password, the app makes the next try wait: 30 seconds, doubling each time, up to an hour. The wait is kept per member on the phone's storage and measured on the phone's running clock; a restart of the phone starts the full wait again.
- **Face check before each ballot.** At enrolment and at restore, the face template of the chip photo (a list of 512 numbers, not the photo) is kept in the member's encrypted file. It is never sent and is not in the backup; uninstalling the app deletes it. Before each ballot, a selfie is compared with it on the phone, and the ballot is sent only if they match. This is a **deterrent only**: a modified app can skip it, a good photo of the member may pass it, and a face shows that the member was present, not that the choice was theirs. A face check by the enclave at each ballot was rejected, because it would tell the service who votes and when (Decision Log #52).
- **Receipts** are kept in each member's own encrypted file, so people sharing a phone cannot see each other's answers (Decision Log #54, amended 11 November 2026).
- Anyone holding the phone can remove a member from it, as they could uninstall the app; the membership itself can then be restored with the passport and the password.
- The number of phones with several members is to be published in aggregate, so that mass enrolment on a few devices is visible (not yet implemented).

Someone who shares a phone with a member may still answer for them, as with assisted or postal voting; this is accepted while polls are not binding (Decision Log #9) and is to be reviewed before any binding use. Copying a member's data to a second phone gives no extra ballots, because both copies produce the same nullifier in every poll; the app's data is in any case excluded from cloud backups and phone-to-phone transfers.

### 6.10 Recovery

The member's identity is restored, not replaced, whenever the password is still known. Which case applies is decided by what the member still has (Decision Log #59, #62):

| The member has | What happens | Identity and number | Polls already open |
|---|---|---|---|
| The phone | Nothing to recover | Unchanged | Unchanged |
| A new phone and the password | **Restore**: the member reads the passport on the new phone and proves it again (a fresh π_doc and live face). The service finds the person already enrolled and returns the encrypted backup to that phone only; the password opens it. Nothing is written to the ledger | Same identity, same number | The phone finds and opens its own ballots in every open poll, because each ballot's random values are derived from the member's secret, the poll and the choice; the member may keep or change them |
| The password, but the old phone may be in someone else's hands | Restore as above, then **renew**: the identity is restored, a new identity is issued and the old one revoked (7.11) | New identity; same number | A **recovery ballot** replaces whatever the old identity recorded in each open poll; the app shows any ballot this membership did not make (designed, not yet implemented) |
| Neither the phone nor the password | **Re-enrolment**: the enclave recognises the person, waits a cooling-off period (for example 14 days), publishes the old identity's hidden revocation handle, and only after the ledger has accepted it issues a new credential | New identity | The new identity may answer only polls opened after it was issued; the old identity's ballots, if any, stay as they are |

- **Why the last case cannot do more.** Voiding the old identity's ballots would need a power to find any member's ballots. That power would let the service see who took part, and would leave the secrecy of every answer resting on one layer of protection instead of two (Decision Log #52, #62). The app explains this when the password is chosen. Voiding through several independent key holders is recorded as research.
- **Restoring does not disable the old phone.** Two phones holding one identity give no extra ballots, but whoever holds the old phone can still answer with it. If it may be in someone else's hands, the member renews or re-enrols, so that the old identity is revoked.
- **Revocation and open polls.** A ballot proves that its identity is not revoked at the time it is sent, so a revocation reaches polls that are already open, with a grace of 10 minutes for ballots in flight (8.4, 8.5). Until the revocation is recorded, after the cooling-off period, whoever holds a stolen phone can vote with it. A pending recovery is to be announced on every device of the member, and a member who still holds the old identity can confirm it at once; both are to be specified before real use.
- **Renewed passport:** the member adds the new document to the existing identity (6.12) and stays recognised.
- **The pilot.** In the pilot with about 100 volunteers, the restore path (with the password) is implemented and tested. Renewal, recovery ballots and re-enrolment after a cooling-off period are not: a volunteer who forgets the password cannot enrol again with the same passport during the pilot, and the consent text says so.
- Participation itself stays anonymous: making public who took part, with only the answers encrypted, was considered and rejected (Decision Log #52).

---

### 13.2 The team

Proof of One is led by its pseudonymous founder, **Nemo Unus**, and developed with a team of AI agents. Each agent is an AI system working in a defined role. They are disclosed as AI, name themselves as AI agents in document bylines and commit messages, and never present their work as audited. Human review is recorded by the founder in PROVENANCE.md; commits made through GitHub's web interface carry GitHub's signature, which shows only which account made them. Every safety-critical design, circuit, contract and piece of mobile code they produce must be reviewed by independent human experts, who may themselves be pseudonymous. The project welcomes such contributors.

**Names** (Decision Log #64). Since 24 November 2026 the agents are named after historical figures of science and art whose work fits their role, each from a different country, so that no single country or culture stands out. Only historical figures of science and art are used, never political or religious leaders or living people. Earlier documents, including earlier versions of this paper, use their former Greek names.

![](fig/team_v2_en.png)

*Figure 3 — The Proof of One AI agent team: the nine agents and the eight translators.*

| Agent | Named after | Role | Former name |
|---|---|---|---|
| **Al-Kindi** | Al-Kindi (Iraq, 9th century), who founded cryptanalysis by counting letter frequencies | Cryptography architect | Kryptos |
| **Condorcet** | Nicolas de Condorcet (France, 18th century), a founder of the theory of voting | Zero-knowledge and voting protocol engineer | Psephos |
| **Cai Lun** | Cai Lun (China, 1st–2nd century), credited with making paper | Ledger and smart-contract engineer | Ostrakon |
| **Leonardo** | Leonardo da Vinci (Italy, 15th–16th century), who studied the human face | Mobile identity engineer | Prosopon |
| **Kautilya** | Kautilya (India, 4th century BCE), author of the *Arthashastra* on statecraft and security | Security red team | Argus |
| **Ibn Rushd** | Ibn Rushd (Spain, 12th century), judge and philosopher of al-Andalus | Privacy, ethics and legal analyst | Themis |
| **Khayyam** | Omar Khayyam (Iran, 11th–12th century), mathematician and astronomer | Survey methodology and statistics | Metron |
| **Hypatia** | Hypatia (Egypt, 4th–5th century), teacher of mathematics in Alexandria | Documentation and community | Hermes |
| **Hokusai** | Katsushika Hokusai (Japan, 18th–19th century), painter and designer | Interface and visual design | (new) |

**Al-Kindi — cryptography architect.** Chooses and justifies every cryptographic primitive and keeps the design consistent. Its rule: never invent new cryptography, and state the assumption behind every choice. It set the primitive suite (7.2) and designed the hidden revocation handle that revokes a lost identity without revealing which one it was (7.11).

**Condorcet — zero-knowledge and voting protocol engineer.** Writes the zero-knowledge circuits and the ballot protocol, always separating what is proven from what is trusted. It designed encrypted ballots that keep both founding requirements (every voter can check their own vote, anyone can recount) and the unlinkable registration proof (7.7–7.10).

**Cai Lun — ledger and smart-contract engineer.** Specifies what lives on the ledger and assumes that sequencers and relays may misbehave. It wrote the contract design (Section 8), found that ledger data would vanish after about 18 days unless archived, and runs the deployments on the test network.

**Leonardo — mobile identity engineer.** Makes enrolment on an ordinary phone accurate, private and hard to spoof, and insists on measuring accuracy across diverse populations. It showed that an issuer of documents could defeat face checks grouped by birth date, which led to searching across all members (6.7), and builds the Android app.

**Kautilya — security red team.** Attacks every proposal, assuming an adversary with the resources of a state. It led the threat model, found that a seized phone could reveal every past answer in an earlier design, and found eleven further issues in its review of the protocol (Section 12).

**Ibn Rushd — privacy, ethics and legal analyst.** Puts participant safety above every feature and flags legal risk plainly, always recommending qualified human legal advice. It set the participant-safety gates (Section 14), required that contributions be kept apart from voting (Section 16), and writes the pilot's consent text.

**Khayyam — survey methodology and statistics.** Makes results meaningful, not only verifiable, and never lets a self-selected sample be presented as more than it is. It set the rules for neutral question wording, small-group protection and honest presentation of results (9.5, 10.4).

**Hypatia — documentation and community.** Explains the project to every audience and keeps every document consistent with the decisions taken. It drafts this paper and keeps the public decision log.

**Hokusai — interface and visual design.** Designs the app's step-by-step flow and look, drawing on several visual traditions rather than one (Decision Log #55); Leonardo checks that the steps match what the phone must do, and Ibn Rushd checks consent, safety and wording.

**Translators** (Decision Log #68). Eight further agents translate everything the app and the pilot show, each named after a writer or translator known for clear language: **Johnson** (Samuel Johnson, England) edits the English source into plain English, and **Ferdowsi** (Iran; Persian), **Gibran** (Lebanon; Arabic), **Simenon** (Belgium; French), **Borges** (Argentina; Spanish), **Goethe** (Germany; German), **Chekhov** (Russia; Russian) and **Yan Fu** (China; Chinese) translate from it, never from another translation, each with a glossary of fixed terms. A translation by an AI agent does not replace a native reader: before volunteers use a language, at least one native speaker reads its texts.

> Each agent signs its work as "— Name (AI agent, Proof of One)". None of their work is described as audited or proven secure until independent human experts have reviewed it.

**Reviews by an agent that did not write the code.** Before volunteers used the app, its code was reviewed adversarially by an agent of the team that had not written it, and the fixes were checked again in two further rounds ([reviews](../../reviews/)). Such reviews help, but they are not independent review and do not count towards Gate 0.

The paragraph that follows in v1.2 (reviews by a second AI model) stays, with the agents' former names replaced by the new ones.

---

## Other lines to change in the same version

- **§6.1, table, Ownership:** "Identity secret held on the phone, protected by secure hardware and the member's password (6.8)". **Recovery:** "Restoring with the passport and the password; otherwise a new identity after a cooling-off period, with automatic revocation of the old one (6.10)".
- **§6.3, step 1:** "creates a PIN" becomes "chooses a password (6.8)".
- **§6.11, table:** row "Face template": member's phone **Yes, encrypted, for the face check before each ballot (6.8)**. New row "Encrypted backup": phone Yes; uniqueness service **stored, cannot open it**; ledger No.
- **§7.3:** replace "How the backup of s is encrypted, protected against rollback and restored is to be specified" with "The backup is described in 6.8; protection against an old backup being served again (rollback) is still to be specified."
- **§12.2, row "Someone answers for a member who shares their phone":** "Separate password and encryption per member; face check before each ballot as a deterrent; receipts encrypted per member; wait after wrong passwords; aggregate count of multi-member phones (6.8)".
- **§17, item 26:** "whoever controls the phone and a member's password can answer for them; the face check may also pass a good photo (6.8)."
- **§9.3, Duress PIN:** to be reconsidered, since members now open with a password; until then, "a duress password" with the same limits.

- **§13.3, last paragraph:** unchanged, but "Argus", "Psephos", "Ostrakon", "Kryptos" and "Hermes" wherever they appear in §13 become Kautilya, Condorcet, Cai Lun, Al-Kindi and Hypatia.
- **Figure 3** has been redrawn as `fig/team_v2_en.png`; `fig/team_en.png` stays for earlier versions. It was redrawn with the new names (Hokusai, 27 November 2026), and is in this update.

## Points for the founder to confirm

1. Decision #59, point 3, says that a forgotten password leads to "a new identity and a new number". The number as built depends only on the person's document data and the service's key, so re-enrolment gives a **new identity but the same number**. This draft says so; the decision log's wording should be corrected, or the number changed to include an enrolment counter.
2. Whether "duress PIN" (§9.3) becomes a duress password, or is dropped for now.
3. The reviews of app v0.16 and v0.17 were signed by Hypatia, whose role is documentation; by role they belong to Kautilya (red team). The published reports stay as they are; later code reviews are made by Kautilya, or by another agent that did not write the code.

— Hypatia (AI agent, Proof of One)
