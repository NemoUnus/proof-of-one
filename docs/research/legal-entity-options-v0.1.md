# A legal entity for publishing the apps: options in Europe

*Research note v0.1, 11 November 2026. Schedule activity 1.14 (Decision Log #56, as confirmed on 11 November). Prepared by the project's AI agents for the founder; sources at the end. This is not legal advice. It prepares the questions for a lawyer, who must confirm every point before anything is founded.*

## Why the project needs one

- **Apple.** App Store guideline 5.1.1(ix) says that apps that require sensitive user information "should be submitted by a legal entity that provides the services, and not by an individual developer" ([iPhone research note](iphone-app-v0.1.md), §2). An organisation account needs a legal entity with a D-U-N-S number; sole proprietorships, trade names and branches are not accepted [1].
- **Google.** From 30 September 2026 in some countries, and worldwide from 2027, apps installed on certified Android devices must be registered by a verified developer, also outside Google Play. Exceptions remain: an advanced installation flow, ADB, and free "student and hobbyist" accounts limited to 20 devices [2].
- **Later needs.** Receiving grants, holding the domain names and trademarks, and contracts with auditors or relays. Any money still waits for the legal review (Decision Log #16).

## The constraint that matters most

The founder works under a pseudonym and wishes to stay so. In every own-entity option below, the people who **represent** the entity, usually the board, are named in a public register. The founder's name can therefore stay out of public records only if:

1. the board consists of other people, named in public, whom the founder trusts, and the founder is an ordinary member or has no formal role, or
2. an existing organisation acts as the provider of the service, so that its officers are the named ones.

Both depend on people or organisations willing to stand behind the project in public. This is the same need as Decision Log #41 (a named person or organisation), now with a legal form.

## Options

### A. An existing host organisation in Europe

Some non-profits act as a legal home for free-software projects. For example, the Center for the Cultivation of Technology describes itself as a "charitable non-profit host organization for international Free Software projects", handling donations, budgets, assets such as domain names and trademarks, and accounting [3].

- **For:** no new entity; experience with internet-freedom projects; its officers, not the founder, are named.
- **Against:** under guideline 5.1.1(ix) the host would have to be the provider of the service in Apple's eyes, not only hold the account, so it would carry real responsibility for an identity and polling app. Few hosts may accept that. The project would depend on the host's continued support.
- **To ask:** whether a host would publish and be responsible for the apps; what control the project keeps; what happens if the host withdraws.

### B. An association in Switzerland (Verein)

- An association with a non-commercial purpose acquires legal personality once its written statutes show the will to exist as a body and state its objects, resources and organisation (Civil Code, Art. 60) [4]. Registration in the commercial register is voluntary in most cases; it is compulsory if the association runs a commercial operation or must be audited (Art. 61) [4]. Since 1 January 2023 it is also compulsory for associations that mainly collect or distribute assets abroad for charitable and similar purposes. Such associations need a representative domiciled in Switzerland and a list of members kept in Switzerland. An exemption applies only if funds stay at or below CHF 100,000 a year over two years, distribution goes through a Swiss financial intermediary, and at least one representative is domiciled in Switzerland [5].
- Registered entries show the people with signing authority, with their town of residence and place of origin [6].
- **A close precedent:** the "Bitcoin Core Code Signing Association", a Swiss association whose purpose is to cover the yearly costs of publishing the software built by Bitcoin Core developers [6]. One of its signatories lives outside Switzerland.
- **For:** simple to found; neutral country; a close precedent.
- **To ask:** whether Dun & Bradstreet and Apple accept an unregistered association, or registration is needed; whether a board member or representative must live in Switzerland in our case; Switzerland was not on Apple's 2020 list of countries with a fee waiver for non-profits [7]; the current list must be checked.

### C. A registered association in Germany (eingetragener Verein, e.V.)

- The register entry lists the board with surname, first name, **place of residence and date of birth** (Vereinsregisterverordnung § 3) [8]. The register is public.
- Registration requires at least seven members (BGB § 56) [9].
- Germany was on Apple's 2020 list of countries where Apple waives the developer fee for non-profits [7]; charitable status (Gemeinnützigkeit) is a separate tax decision.
- **For:** well-known form; fee waiver possible; many internet-freedom organisations are e.V.s.
- **Against:** seven members; the board's town of residence is also published.

### D. A foundation in the Netherlands (stichting)

- A stichting has a board and no members. It can be set up by a single person, by notarial deed, and is registered with the Chamber of Commerce (KVK) [10]; its beneficial owners go into the UBO register.
- Public data for each board member: name, date of birth, title, authority, date of appointment and signature; home addresses are not public, unless the foundation's address is a board member's home [12].
- **To confirm:** costs.
- **For:** no members needed, so a small trusted board suffices.

### E. A non-profit association in Estonia (MTÜ)

- At least two founders, who need not be Estonian residents or e-residents; registration within five business days when the documents are in order; changes must be signed by all board members, so digital signatures are recommended; if the board is abroad, a service provider in Estonia must act as legal address and contact person [11].
- Board members' names and personal identification codes are public by law; personal addresses are not [13]. An Estonian personal code encodes the date of birth.
- **For:** fully online; fast; two founders suffice.

## Comparison

| | Host (A) | Switzerland (B) | Germany (C) | Netherlands (D) | Estonia (E) |
|---|---|---|---|---|---|
| New entity | no | yes | yes | yes | yes |
| Minimum founders | n/a | to confirm | 7 members | 1, by notary | 2 |
| Names in a public register | host's officers | signatories, with town, if registered | board, with town and birth date | board, with birth date | board, with personal ID code |
| Local presence needed | no | in some cases | no (to confirm) | to confirm | contact person, if board abroad |
| On Apple's 2020 fee-waiver list | depends on host | no | yes | no | no |
| Precedent for publishing open-source apps | yes (hosting) | yes (Bitcoin Core) | to find | to find | to find |

## Proposal

Two tracks in parallel, decided after a lawyer has answered the questions below:

1. **Ask European host organisations** whether one would act as provider and publisher of the apps.
2. **Find two or three people** who would serve, under their own names, on the board of a new association, most likely in Switzerland, the Netherlands or Germany, with the founder outside the board.

Until then nothing is founded and no money is received.

## Questions for a lawyer

1. Which form and country fit a non-commercial project that publishes free apps worldwide and later may receive grants?
2. Can the founder be a member, or have no formal role, without being named in any public register, including beneficial-ownership registers and bank checks?
3. Are board members' home addresses or birth dates published, and can they be withheld for safety reasons?
4. Is a resident board member or representative required?
5. Does the entity accept liability for the service in a way that guideline 5.1.1(ix) requires, and what does that mean for its board?
6. Data protection: the entity would be responsible for the uniqueness service's data (the face template and document fingerprint); what does the GDPR require of it?
7. Sanctions and export rules for publishing free cryptographic software worldwide, and for taking part from any country.
8. Can a project with pseudonymous contributors open a bank account in that country?

## Sources

1. Apple, D-U-N-S Number (Account Help): https://developer.apple.com/support/D-U-N-S/
2. Android Developers Blog, "Android developer verification", March 2026 (updated): https://android-developers.googleblog.com/2026/03/android-developer-verification-rolling-out-to-all-developers.html
3. Center for the Cultivation of Technology: https://techcultivation.org/
4. Swiss Civil Code, Art. 60 ff.: https://www.droit-bilingue.ch/en-de/2/21/210-61-80.html
5. MLL News, "New registration and transparency requirements for Swiss-based associations": https://www.mll-news.com/new-registration-and-transparency-requirements-for-swiss-based-associations/?lang=en
6. Register extract (data from Zefix and SHAB), Bitcoin Core Code Signing Association, CHE-306.497.793: https://onlineinfo.ch/company/bitcoin-core-code-signing-association---che-306-497-793/pdf
7. MacRumors, "Apple expands free developer program memberships for eligible organizations to additional countries", 3 February 2020 (the current list is on Apple's fee-waiver page): https://www.macrumors.com/2020/02/03/apple-developer-program-memberships-free-new-countries/
8. Vereinsregisterverordnung (VRV), § 3: https://www.gesetze-im-internet.de/vrv/BJNR014710999.html
9. Bürgerliches Gesetzbuch (BGB), § 56: https://www.gesetze-im-internet.de/bgb/__56.html
10. KVK, "The stichting": https://www.kvk.nl/en/rules-and-laws/the-stichting/
11. e-Residency of Estonia, "How to start a non-profit organisation in Estonia": https://www.e-resident.gov.ee/en/blog/posts/how-to-start-a-non-profit-organisation-in-estonia
12. KVK, privacy FAQ for the business register: https://www.kvk.nl/over-kvk/veelgestelde-vragen-over-privacy-en-het-handelsregister/
13. Estonian Centre of Registers and Information Systems (RIK), help page on public data: https://abiinfo.rik.ee/en/node/300/

— Themis and Hermes (AI agents, Proof of One)
