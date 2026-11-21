# Proof of One: Grants and Funding Survey v0.1

Date of research: 21 November 2026. Scope: grant programmes that could fund open-source, non-commercial infrastructure for privacy-preserving, unique-human opinion polls (passport chip plus face check, zero-knowledge proofs, keyed OPRF fingerprints, threshold ElGamal, public recount; Ethereum L2 testnet; Rust/Circom/Android) in 2026–2027.

Project constraints that shape the assessment: the maintainer is pseudonymous, there is no legal entity, no money is taken before legal review, and the public framing is neutral.

Method: web search and fetches of the funders' own pages wherever possible. Where a page did not state something, this file says "not stated" or "not verified". No amounts or deadlines have been guessed. Check every deadline again before acting on it.

---

## 1. Summary table (sorted by fit)

| Fit | Programme | Status (21 Nov 2026) | Typical amount | Without an entity? | Pseudonymous? |
|---|---|---|---|---|---|
| High | NLnet Restack (EU, Horizon Europe) | Open, deadline 3 Jan 2027 12:00 CET | €5k–€50k | Yes, individuals | Yes in public; real name given to NLnet after a grant is awarded |
| Medium | OTF Internet Freedom Fund | Rolling concept notes | $50k–$200k ideal (min $10k, max $900k) | Individuals 18+ eligible | Not verified |
| Medium | OTF Security Lab (audits) | Not stated whether rolling | In kind (audit) | Non-OTF projects can apply | Not verified |
| Medium | Ethereum Foundation ESP (Wishlist/RFPs) | No open rounds; Wishlist and RFPs listed | Not stated | Not stated | No: KYC is mandatory |
| Medium | Gitcoin Grants (quadratic funding, GG25+) | GG25 planned for Q2 2026 (status not verified) | Small, set by donors | Not verified | Not verified |
| Low | NLnet CodeSupply | Open, deadline 3 Jan 2027 | €5k–€50k | Yes | Same as Restack (FAQ checked for Restack only) |
| Low | NGI Zero Commons Fund | Closed (final call ended 1 Jun 2026) | €5k–€50k | n/a | n/a |
| Low | Zcash Community Grants | Rolling (forum applications) | Not stated | Not stated | KYC if funded above $50k |
| Low | Kusama Proof-of-Personhood Bounty | Accepting proposals (Feb 2026 report) | Not stated | Not stated | Not stated |
| Low | Base Builder Grants | Season 2 launched 27 Oct 2026 | $5,000 | Not stated | Not stated |
| Low | Prototype Fund (Germany) | Class 03 window listed as 1 Oct–30 Nov 2026 | Up to €47.5k (individual) / €95k (team) | Individuals or a German GbR | No |
| Low | Sovereign Tech Fund (Germany) | Accepting applications through portal | Above €50k | People, companies, communities | Not stated |
| Low | OTF Rapid Response Fund | Rolling | $5k–$25k typical | Yes | Not verified |
| Low | Aztec / Noir grants | Not stated | $1k–$30k | Individuals or teams | Not stated |
| Low | FLOSS/fund (Zerodha) | Rolling (via funding.json) | Up to $1M a year in total | Worldwide projects | No: tax-residency papers needed |
| Low | Filecoin (ProPGF) | Requests go through ProPGF | Not stated | Self-managed teams | Not stated |
| Low | Access Now Grants | Not stated | $7k–$54k averages | Organisations | Not stated |
| Low | Mozilla Foundation | MOSS on hiatus; Democracy x AI cohort (2026) closed | $50k (cohort) | US 501(c)(3) only | n/a |
| Low | Ford Foundation / Open Society Foundations | Unsolicited proposals allowed but rarely funded / varies | Not stated | OSF: informal groups via fiscal sponsors | Not stated |
| Low | Digital Defenders Partnership | Most funds closed or invitation-only | Up to $5k / €15k | HRDs or organisations | Not stated |
| Low | ISOC Foundation Common Good Cyber Fund | Closed; next window 2027 | $100k–$300k | Nonprofits only | No |
| Low | HRF Bitcoin Development Fund | Not stated | Not stated | Individuals and projects | Not stated (some grantees are listed by handle) |
| Low | NED | Deadlines 27 Jan 2027, 28 Jun 2027 | Not stated | NGOs only | No |
| Low | US State Dept DRL internet freedom | Effectively halted (2025–26) | n/a | n/a | n/a |
| Low | Internews | No matching open call found | Not verified | Not verified | Not verified |
| Low | Optimism (Retro Funding / Grants Council) | Retro Funding paused; Year 5 forecast is 0 OP | n/a | n/a | n/a |
| Low | Protocol Guild | Membership-based | n/a | n/a | n/a |
| Low | Scroll / zkSync ecosystem grants | Community, event or token-focused | $200–$10k (Scroll) | Not stated | Not stated |
| Low | Vitalik Buterin personal grants / Kernel | No application process found | n/a | n/a | n/a |
| Closed | Web3 Foundation Grants Program | Discontinued | n/a | n/a | KYC was required |

---

## 2. Programme details

### 2.1 NLnet Foundation (Netherlands; EU-funded calls)

**NLnet Restack** ([page](https://nlnet.nl/restack/), [FAQ](https://nlnet.nl/restack/faq/))
- **What it funds:** R&D towards an "open internet stack". Named themes include privacy-friendly devices and services, trust-enhancing technologies and full-stack security. Results must be released under a recognised free or open source licence. Generative-AI projects are out of scope unless they meet strict conditions.
- **Amount:** €5,000–€50,000 per proposal, with possible scale-up later. About €7M is available in total through 2030. Practical support such as security audits is also offered.
- **Status:** The second call opened 3 Nov 2026 and closes **3 Jan 2027, 12:00 CET**. NLnet deadlines now fall every two months ([call news](https://nlnet.nl/news/2026/20260903-call.html)).
- **Who can apply:** "You can apply as an individual, or as a formal or informal organisation of any type." No company is needed ([FAQ](https://nlnet.nl/restack/faq/)).
- **Pseudonymity:** No identity documents are needed to apply, and the real name is not required until a grant is awarded. After that NLnet needs it for compliance but does not publish it, and an alias can be used publicly ([FAQ](https://nlnet.nl/restack/faq/)).
- **Payment:** Milestone-based donations paid directly to the persons or entities involved, with nothing paid upfront ([FAQ](https://nlnet.nl/restack/faq/)).
- **Restrictions:**
  - Each project must have a "European dimension". This is a knock-out criterion, typically met when at least 60% of the funds go to team members in Horizon Europe-eligible countries, or through a significantly unique contribution ([FAQ](https://nlnet.nl/restack/faq/)).
  - Funded by the European Commission (DG CONNECT) through Horizon Europe ([page](https://nlnet.nl/restack/)).
  - Sanctions rules are not stated on the pages read (not verified).
- **Fit: High.** It is the only open call found that funds privacy and trust technology, accepts individuals without an entity, and allows public pseudonymity. The "European dimension" test and disclosing a real name to NLnet after award are the points to resolve.

**NLnet CodeSupply** ([page](https://nlnet.nl/codesupply/))
- **What it funds:** Software supply-chain security for free and open source software.
- **Amount:** €5,000–€50,000, with about €400k reserved in total.
- **Status:** Open; deadline 3 Jan 2027, 12:00 CET.
- **Who can apply:** Independent researchers, developers and organisations.
- **Pseudonymity:** Presumably the same NLnet model as Restack; CodeSupply's own FAQ was not checked (not verified).
- **Restrictions:** Funded by Horizon Europe. FOSS licence required.
- **Fit: Low.** It fits only if a specific supply-chain piece is scoped as its own proposal, for example reproducible builds or verifiable releases of the Android app and circuits.

**NGI Zero Commons Fund** ([page](https://nlnet.nl/commonsfund/))
- **Status:** The thirteenth and final call closed 1 Jun 2026. It is not taking new applications. Amounts were €5k–€50k.
- **Fit: Low (closed).** Restack is effectively the successor route.

### 2.2 Open Technology Fund (OTF, USA)

**Internet Freedom Fund** ([IFF page](https://docs.opentech.fund/otf-application-guidebook/our-funds-and-fellowships/internet-freedom-fund.md), [FAQ](https://docs.opentech.fund/otf-application-guidebook/faq.md), [guidelines](https://docs.opentech.fund/otf-application-guidebook/general-funding-guidelines))
- **What it funds:** Tools for getting around censorship, communicating securely or reaching blocked information, plus applied research on censorship and surveillance.
- **Amount:** Ideal requests are $50k–$200k. The minimum is $10k, the target ceiling $300k, and requests can go up to $900k. Projects run 6–12 months ideally, up to 24.
- **Status:** Concept notes are rolling and reviewed monthly.
- **Who can apply:** "Individuals ages 18+" and organisations, "irrespective of nationality" ([FAQ](https://docs.opentech.fund/otf-application-guidebook/faq.md)). Requirements for a legal entity or fiscal sponsor are not stated.
- **Pseudonymity:** Not stated. OTF uses deliverable-based contracts with "standard provisions for U.S. Government funded agreements" ([guidelines](https://docs.opentech.fund/otf-application-guidebook/general-funding-guidelines)), so disclosing legal identity is likely, but this is not verified.
- **Restrictions:**
  - Funded by the US government through USAGM ([USAGM](https://www.usagm.gov/networks/otf/)).
  - In 2025–26 OTF sued over terminated funding. A court granted OTF summary judgment on 26 Mar 2026 and ordered the $43.5M to be paid ([Bloomberg Law](https://news.bloomberglaw.com/federal-contracting/open-technology-prevails-in-grant-dispute-with-us-media-agency)). A February 2026 report said the administration was appealing an earlier ruling ([Benton](https://www.benton.org/headlines/us-funding-global-internet-freedom-%E2%80%98effectively-gutted%E2%80%99)). Future funding is therefore uncertain.
  - US sanctions law (OFAC) applies to US-funded payments and contracts in general ([Linux Foundation on OFAC](https://www.linuxfoundation.org/blog/navigating-global-regulations-and-open-source-us-ofac-sanctions?hsLang=en)). OTF's own sanctions policy is not verified.
  - OTF prefers open source but names no specific licence ([FAQ](https://docs.opentech.fund/otf-application-guidebook/faq.md)).
- **Fit: Medium.** The topic fit is strong (access under restrictions, privacy), but the US-government source raises neutrality questions, identity disclosure is likely, and funding is unstable.

**Security Lab** (formerly known as the Red Team Lab; see the [Security Lab page](https://docs.opentech.fund/otf-application-guidebook/our-labs/security-lab.md))
- **What it provides:** Independent audits, including cryptographic design reviews and code reviews. Findings are published after responsible disclosure.
- **Status:** Not stated whether applications are rolling.
- **Who can apply:** All OTF-supported projects, and non-OTF projects relevant to internet freedom.
- **Money:** It is not stated whether money goes to the project. It is described as a service arranged with third-party auditors.
- **Fit: Medium.** An external audit of the circuits, OPRF and threshold ElGamal is exactly what the project needs. It is in kind, but it is still US-government-funded and will still need legal review.
- The page names the Security Lab. It does not say it is the same programme as the earlier "Red Team Lab" (not verified).

**Rapid Response Fund** ([page](https://docs.opentech.fund/otf-application-guidebook/our-funds-and-fellowships/rapid-response-fund.md))
- **What it funds:** Digital emergencies only, such as attacks or censorship events. Direct support ranges from $1 to $50k, typically $5k–$25k. Rolling.
- **Fit: Low.** It is not for planned development.

**Other OTF funds:** OTF also lists the FOSS Sustainability Fund, the Surge and Sustain Fund (for established circumvention tools with many users) and the Information Controls Research Program ([guidebook index](https://docs.opentech.fund/otf-application-guidebook/llms.txt)). None was assessed in detail.

### 2.3 Prototype Fund (Germany) ([apply](https://prototypefund.de/en/apply), [FAQ](https://prototypefund.de/en/faq))
- **What it funds:** Open source software in the areas of data security and software infrastructure.
- **Amount:** Up to €47,500 for an individual or €95,000 for a team over 6 months, plus an optional Second Stage.
- **Status:** The apply page lists a class 03 window of 1 Oct–30 Nov 2026, but the homepage banner still showed the 2025 call. Confirm before relying on it.
- **Who can apply:**
  - Individuals must live in Germany or pay taxes there as self-employed or freelance.
  - Teams must form a GbR with its seat in Germany, and the managing director must live in Germany.
  - Institutions cannot receive payments.
- **Pseudonymity:** No. The formal application needs postal addresses, bank details and sometimes SCHUFA credit information ([FAQ](https://prototypefund.de/en/faq)).
- **Restrictions:** Funded by the German Federal Ministry of Research, Technology and Space (BMFTR).
- **Fit: Low.** The residence and identity rules do not fit a pseudonymous maintainer with no entity.
- Swiss edition: its 2026–27 call closed on 6 Sep 2026 ([timeline](https://prototypefund.opendata.ch/en/application/timeline/)).

### 2.4 Ethereum Foundation, Ecosystem Support Program (ESP) ([applicants](https://esp.ethereum.foundation/applicants), [open rounds](https://esp.ethereum.foundation/applicants/open-rounds), [new structure](https://blog.ethereum.org/2025/11/03/new-esp-grants))
- **What it funds:** Open-source, non-commercial public goods aligned with CROPS (Censorship resistance, Open source, Privacy, Security). The named focus areas include cryptography and privacy.
- **Amount:** Set per project; no ranges are published. ESP gave $29.1M to 388 projects in 2025 ([ESP](https://esp.ethereum.foundation/pse-grants/apply)) and $9.856M in Q1 2026 ([KuCoin summary](https://www.kucoin.com/news/flash/ethereum-foundation-announces-9-85m-q1-2026-ecosystem-funding)).
- **Status:**
  - Open applications were paused in August 2025 ([EF blog](https://blog.ethereum.org/2025/08/29/esp-next-chapter)). ESP has since reopened through Wishlist and RFP pathways ([EF blog](https://blog.ethereum.org/2025/11/03/new-esp-grants)).
  - "There are no active grant rounds at this time" ([open rounds](https://esp.ethereum.foundation/applicants/open-rounds)).
  - Free Office Hours are available for feedback.
- **Who can apply:** Projects, including for-profits whose funded work is open source. Individuals are not stated.
- **Pseudonymity:** No. "All grant recipients must complete onboarding, which involves identity verification and a formal grant letter." Payment is in ETH by default ([applicants](https://esp.ethereum.foundation/applicants)).
- **Restrictions:** Country restrictions are not stated.
- **Fit: Medium.** The values match (privacy, censorship resistance, Ethereum L2), but KYC is required and there is no open round. Office Hours are a low-cost first contact.
- Related: EF's privacy team (Privacy Stewards of Ethereum, PSE) has a public roadmap ([PSE](https://pse.dev/about)). No separate open PSE grant call was verified.

### 2.5 Optimism (Retro Funding / Grants Council)
- **Status:**
  - Retro Funding is paused. After the Season 7 missions, "no new rounds or missions were initiated", and the Year 5 Retro forecast is 0 OP ([budget post, 6 Aug 2026](https://gov.optimism.io/t/collective-year-4-budget-update-and-year-5-budget-outlook/10796)).
  - A proposal to dissolve the Grants Council was posted on 25 Jun 2026 ([forum](https://gov.optimism.io/t/council-dissolution-proposal-dissolve-the-grants-council/10732)). Its outcome is not verified.
  - Year 5 spending focuses on OP Mainnet growth and OP Enterprise.
- **Fit: Low.** There is no open public-goods route.

### 2.6 Gitcoin Grants
- **What it funds:** Quadratic-funding rounds organised by "domains". GG24 (Oct 2025–Q1 2026) had a Privacy domain and required Ethereum-aligned open-source projects ([handbook](https://app.gitcoin.co/blog/your-handbook-to-gitcoin-grants-24), [GG24 page](https://grants.gitcoin.co)).
- **Status:**
  - GG25 was planned for Q2 2026 as a single-domain, coalition-funded round, "likely d/acc" ([2026 strategy](https://gov.gitcoin.co/t/gitcoin-2026-strategy-tl-dr/25049)).
  - Whether GG25 ran, and any later rounds, is not verified.
- **Amount:** Set by donor matching; per-round pools are not stated.
- **Who can apply / pseudonymity:** Projects create a public profile, on Giveth for GG24. KYC was not mentioned on the pages read (not verified).
- **Fit: Medium.** The d/acc and privacy domains match well and amounts are small, but the status is unverified. Receiving money also needs a wallet and an acceptance policy, so it waits for legal review.

### 2.7 Protocol Guild ([membership docs](https://protocol-guild.readthedocs.io/en/latest/01-membership.html))
- **What it is:** A membership mechanism for contributors "embedded in core protocol R&D" of Ethereum, such as clients and core research.
- **Fit: Low.** It covers L1 protocol work, not application-layer projects.

### 2.8 ZK and L2 ecosystem grants
- **Aztec / Noir** ([page](https://aztec.network/grants))
  - Funds Noir-based apps (identity and governance apps are named), libraries and tooling, with grants of $1k–$30k.
  - "Most grants are retroactive." Status and KYC are not stated.
  - **Fit: Low.** The project's circuits are written in Circom, not Noir.
- **Scroll Community Grants** ([page](https://grants.scroll.io/programs/community-grants))
  - Funds events, meetups and hackathons, with grants of $200–$10k.
  - **Fit: Low.**
- **zkSync / ZK Nation**
  - The current programmes found are token-holder and community-activation pilots ([Tally TPP-8](https://tally.xyz/gov/zksync/proposal/19993014537746296636853362219247192671631735482612670856590540039176244970638)). No matching open developer grant was verified.
  - **Fit: Low.**
- **Base Builder Grants** (Coinbase-run L2; the project already uses Base Sepolia)
  - Season 2 launched 27 Oct 2026 with $5,000 per grant ([report](https://coinalertnews.com/news/2026/10/27/base-grant-programs-ecosystem)). Criteria are not stated.
  - Base's other programmes are investment and accelerator tracks ([Base docs](https://docs.base.org/get-started/get-funded)).
  - **Fit: Low.** The amounts are small and geared towards commercial projects.
- **Mina zkIgnite** ([Mina grants](https://minaprotocol.com/grants)): current status not verified. **Fit: Low** (a different chain).

### 2.9 Zcash Community Grants (ZCG) ([example application with terms](https://forum.zcashcommunity.com/t/grant-application-zecret-ballots/55059))
- **What it funds:** Zcash-ecosystem work. Applications are posted on the public forum.
- **Relevant precedent:** "Zecret Ballots", an encrypted, threshold-decrypted voting app for ZEC holders, asked for $130k and was declined on 3 Apr 2026.
- **Pseudonymity:** The terms checkbox reads "Provide KYC information if funded above $50,000 USD". This suggests smaller grants may not need KYC, but it is not verified.
- **Fit: Low.** Applications must benefit Zcash, and this project is on Ethereum.

### 2.10 Filecoin / Protocol Labs ([Filecoin Foundation grants](https://fil.org/grants))
- **Status:** Funding requests "are being reviewed through ProPGF".
- **Licence:** Projects must be open source and dual-licensed under MIT and Apache 2.0.
- **Fit: Low.** The project has AGPL parts and no Filecoin use.

### 2.11 Sovereign Tech Fund / Agency (Germany) ([fund page](https://sovereign.tech/programs/fund), [FAQ](https://sovereign.tech/faq))
- **What it funds:** Open digital base technologies, such as libraries, protocol implementations and encryption. **Prototypes and user-facing apps are excluded.** The proposed work must exceed €50k.
- **Who can apply:** People, companies or FOSS communities, worldwide. Legal-entity and sanctions rules are not stated.
- **Process:** Contracts follow legal compliance review and procurement and transparency rules.
- **Pseudonymity:** Not stated. Invoices and contracts imply a legal identity (not verified).
- **Funding source:** Germany's Federal Ministry for Economic Affairs, through SPRIND ([STA](https://sovereign.tech/news/stf-part-of-new-sovereign-tech-agency)).
- **Fit: Low now.** Possibly later, for a mature, reusable library such as an OPRF or threshold-ElGamal crate.

### 2.12 Mozilla
- MOSS is "on indefinite hiatus and is not currently accepting applications" ([MOSS](https://www.mozilla.org/moss)).
- The 2026 Democracy x AI cohort gave $50k per project, was limited to US 501(c)(3) nonprofits, required AI as a core capability, and closed in spring 2026 ([summary](https://toolkit.science.ucsc.edu/2026/02/24/open-call-mozilla-foundation-democracy-x-ai-cohort/)).
- The Mozilla Technology Fund is listed among past programmes ([Mozilla programmes](https://www.mozillafoundation.org/nl/what-we-fund/programs/)).
- **Fit: Low.**

### 2.13 Digital Defenders Partnership (DDP) ([funds](https://www.digitaldefenders.org/funds/), [about](https://www.digitaldefenders.org/about-ddp/))
- **What it funds:** Digital protection for human-rights defenders, such as incident response (up to $5k) and community and network funds (up to €15k, invitation only). Most funds are closed. It does not fund software development.
- **Funding source:** Funded by multiple foreign ministries and the US State Department.
- **Fit: Low.**

### 2.14 Access Now Grants ([page](https://www.accessnow.org/grants/))
- **What it funds:** Grassroots and frontline organisations. Average grants are $29k (project), $54k (core) and $7k (discretionary).
- **Funding source:** Funders include Sida and the Dutch Ministry of Foreign Affairs.
- **Status:** Whether unsolicited applications are accepted is not stated.
- **Fit: Low.** It funds organisations, not software projects.

### 2.15 Ford Foundation / Open Society Foundations
- **Ford:** Accepts unsolicited applications, but "less than one percent ... receive a grant" ([Ford](https://fordfoundation.org/work/our-grants/how-we-make-grants)).
- **OSF:** The process varies by programme, and some programmes are invitation-only. OSF can fund informal groups "through intermediaries such as fiscal sponsors" ([OSF FAQ](https://www.opensocietyfoundations.org/grants/faq)).
- **Fit: Low.** These are relationship-driven funders; useful only later through a host organisation.

### 2.16 Internews
- No current open call for technology or software grants was found. Internews has documented the impact of US funding cuts on media development ([Internews report](https://internews.org/wp-content/uploads/2025/06/FINAL-Crisis-in-Journalism.pdf)).
- **Fit: Low (not verified).**

### 2.17 NED and DRL (US democracy funds)
- **NED** ([apply](https://ned.org/apply-for-grant/en))
  - Funds nongovernmental organisations only, not individuals. Applicants are asked for proof of registration or an explanation.
  - Remaining deadlines: 27 Jan 2027 and 28 Jun 2027 (21 Sep 2026 has passed).
  - NED says the US OMB proposed ending its funding in the FY2026 request ([NED fact sheet](https://www.ned.org/fact-sheet-ned-and-the-2026-discretionary-budget-request/)).
- **DRL / State Department internet freedom:**
  - In 2025 its main granting office "issued no money" and many programmes were cut ([Benton, Feb 2026](https://www.benton.org/headlines/us-funding-global-internet-freedom-%E2%80%98effectively-gutted%E2%80%99)).
- **Fit: Low.** Both require an entity, are politically sensitive (see section 4) and have uncertain funding.

### 2.18 Others found
- **ISOC Foundation Common Good Cyber Fund** ([page](https://www.isocfoundation.org/grant-programme/common-good-cyber-fund/))
  - Funds cybersecurity nonprofits only; $100k–$300k over two years.
  - The 2026 window closed 4 Aug 2026; the next opens in 2027.
  - Pooled funders include several governments.
  - **Fit: Low.**
- **FLOSS/fund (Zerodha)** ([F-Droid account](https://www.f-droid.org/en/2026/05/26/flossfund.html))
  - Up to $1M a year in total, applied for via a `funding.json` file.
  - Focuses on existing, widely used projects.
  - Accepted projects must provide residency tax documents and sign an agreement under Indian law.
  - **Fit: Low now** (the project has no users yet).
- **HRF Bitcoin Development Fund** ([April 2026 round](https://hrf.org/latest/hrfs-bitcoin-development-fund-announces-support-for-26-projects-worldwide/))
  - Funds Bitcoin "and related freedom technologies". Some grantees are listed by handle. How to apply is not stated.
  - **Fit: Low** (centred on Bitcoin).
- **Kusama Proof-of-Personhood Bounty** ([Feb 2026 report](https://kusama.subsquare.io/posts/47))
  - Funds "sybil-resilient, public good, privacy-preserving" proof-of-personhood work on Kusama. Amounts and KYC are not stated.
  - **Fit: Low.** It is the closest topic match among the bounties found, but it is tied to the Kusama chain.
- **Vitalik Buterin personal grants**
  - 256 ETH went to Session and SimpleX in late 2025 ([crypto.news](https://crypto.news/ethereum-co-founder-buterin-allocates-256-eth-to-privacy-messaging-projects/)).
  - 16,384 ETH was committed in Jan 2026 to an open, secure stack that includes "governance" ([The Block](https://www.theblock.co/amp/post/387804/vitalik-buterin-commits-roughly-45-million-in-eth-to-open-source-security-and-privacy-projects)).
  - No application process was found.
  - **Fit: Low** (not an open programme).
- **Kernel:** A fellowship or community programme rather than a grant ([Gitcoin blog](https://gitcoin.co/blog/announcing-kernel-block-2)). Current status not verified. **Fit: Low.**
- **Drips:** A funding-distribution platform and monthly bounty "Waves", the first for Stellar ([Drips](https://www.drips.network/blog/posts/the-monthly-wave)). **Fit: Low** as a funder, but possibly useful later as a payout tool.
- **Web3 Foundation Grants Program:** Discontinued; it had required KYC through Sumsub ([GitHub](https://github.com/w3f/Grants-Program)).

---

## 3. Pseudonymity and legal-entity findings

**Programmes that can realistically work without an entity, while staying pseudonymous in public:**
- **NLnet (Restack, CodeSupply):**
  - Individuals and informal groups can apply, and no entity is needed.
  - A real name is required only after a grant is awarded, it is kept private, and an alias may be used publicly ([FAQ](https://nlnet.nl/restack/faq/)).
  - This is the clearest fit. The main hurdle is the "European dimension" criterion.
  - Payments go directly to the persons involved, so the person paid will be known to NLnet.

**Programmes that accept individuals but where identity disclosure is required or likely:**
- **Ethereum Foundation ESP:** Identity verification is mandatory ([applicants](https://esp.ethereum.foundation/applicants)).
- **OTF:** Individuals 18+ may apply. US-government contract terms make identity disclosure likely (not verified).
- **Zcash Community Grants:** KYC above $50k.
- **FLOSS/fund:** Tax-residency documents.
- **Prototype Fund:** German residence or tax status, addresses and bank details.
- **Sovereign Tech Fund:** Contracts and invoices (identity not stated).

**Programmes that need a legal entity (or a fiscal sponsor) to apply:**
- NED (NGOs only)
- ISOC Common Good Cyber Fund (nonprofits only)
- Mozilla Democracy x AI (US 501(c)(3) only)
- Access Now (organisations)
- OSF (informal groups only via fiscal sponsors)

**Fiscal hosts and host organisations: what was verified**

| Host | Model and terms (verified) | Notes for this project |
|---|---|---|
| NLnet's own model | Grants paid directly to individuals or informal teams; milestone-based ([FAQ](https://nlnet.nl/restack/faq/)) | No host needed for NLnet money |
| The Commons Conservancy (NL) | The project becomes a "Programme" with statutes signed by its officials; an MoU with NLnet creates a thematic fund that can receive tax-deductible donations; Commons Caretakers BV can invoice ([how to join](https://commonsconservancy.org/how)) | Fees not stated. Officials sign statutes, so identity is probably disclosed to the Conservancy (not verified) |
| Open Collective Europe (Belgium; its page at opencollective.com/europe now uses the name "Open Source Europe") | 8% plus processor fees for online contributions, 10% for bank transfers and grants. The project must support the open source ecosystem; "cannot engage in political or religious campaigning" ([apply](https://opencollective.com/europe/apply)) | Neutral framing matters for that rule. It stated in 2024 that it was unaffected by the dissolution of Open Collective Foundation (US) ([update](https://opencollective.com/europe/updates/regarding-the-announcement-to-dissolve-open-collective-foundation-us)) |
| Open Source Collective (US) | 10% of funds raised; verification criteria ([apply](https://opencollective.com/opensource/apply/intro)) | US host, so US sanctions rules apply to payouts (general point: [LF](https://www.linuxfoundation.org/blog/navigating-global-regulations-and-open-source-us-ofac-sanctions?hsLang=en)) |
| Software Freedom Conservancy (US) | 10% of revenue; licence must be OSI-approved and DFSG-free; projects under a year old or that are proofs of concept are "generally ineligible" ([apply](https://sfconservancy.org/members/apply/)) | Not eligible at the current stage |
| Code for Science & Society (US) | Comprehensive fiscal sponsorship; 15% on non-governmental and 20% on governmental funds; needs an advisory group and a minimum budget ([directory](https://fiscalsponsordirectory.org/code-for-science-and-society/)) | International eligibility not verified |

The licence condition for Software Freedom Conservancy matters here: Apache-2.0 and AGPL are both OSI-approved, but check DFSG compatibility for every component.

Every host will need to know who controls the project's funds, even if the project stays pseudonymous in public. Fully anonymous receipt of grant money was not found anywhere in this survey.

---

## 4. Neutrality notes (funding sources, stated factually)

**United States government:**
- OTF is funded through USAGM, a US federal agency ([USAGM](https://www.usagm.gov/networks/otf/)).
- NED is a congressionally supported organisation using public funds ([NED](https://www.ned.org/fact-sheet-ned-and-the-2026-discretionary-budget-request/)).
- The State Department Internet Freedom/DRL programme is a US foreign-policy instrument ([Benton](https://www.benton.org/headlines/us-funding-global-internet-freedom-%E2%80%98effectively-gutted%E2%80%99)).
- Funding from these sources can be presented by critics as aligning a project with US foreign policy. All three were also politically contested inside the US in 2025–26.

**Other national governments:**
- Prototype Fund is funded by the German BMFTR ([FAQ](https://prototypefund.de/en/faq)).
- The Sovereign Tech Agency is funded by the German Federal Ministry for Economic Affairs, through SPRIND ([STA](https://sovereign.tech/news/stf-part-of-new-sovereign-tech-agency)).
- DDP is funded by multiple foreign ministries and the US State Department ([DDP](https://www.digitaldefenders.org/about-ddp/)).
- Access Now Grants is funded by Sida and the Dutch Ministry of Foreign Affairs ([Access Now](https://www.accessnow.org/grants/)).
- The ISOC Common Good Cyber Fund is pooled from several governments' foreign or development ministries ([ISOC](https://www.isocfoundation.org/grant-programme/common-good-cyber-fund/)).

**European Union:**
- NLnet Restack and CodeSupply are funded by the European Commission through Horizon Europe ([Restack](https://nlnet.nl/restack/), [CodeSupply](https://nlnet.nl/codesupply/)).
- This is a multilateral research programme rather than a foreign-policy fund. It is still public money and should be disclosed.

**Private and crypto-ecosystem funders:**
- Ethereum Foundation, Gitcoin, Zcash, Filecoin, Base (Coinbase), Ford, OSF, FLOSS/fund (Zerodha), HRF and Mozilla are not government funded.
- They carry their own perception risks:
  - Crypto funders can make a polling tool look token-driven.
  - Funders with known advocacy positions (for example OSF and HRF) can make it look aligned with those positions.
- These perception points are general observations, not taken from the funders' pages.

**Suggested rule:** Publish every funder and amount, prefer multilateral or private non-partisan sources, and be ready to decline any funder whose terms ask for country-specific targeting.

---

## 5. Recommended next steps

1. **Prepare an NLnet Restack proposal for the 3 Jan 2027 12:00 CET deadline.**
   - Scope it narrowly, for example one component (verifiable public recount tooling, or the OPRF/threshold-ElGamal library) for €5k–€50k.
   - Before submitting, get legal review of NLnet's post-award identity requirement and work out how the "European dimension" will be met ([FAQ](https://nlnet.nl/restack/faq/)).
   - NLnet pays individuals directly, so no fiscal host is needed for this route.
2. **Approach The Commons Conservancy and Open Source Europe first as host organisations.**
   - Both are European, non-profit and FOSS-focused.
   - The Conservancy has an MoU with NLnet that creates a thematic fund for donations ([Commons Conservancy](https://commonsconservancy.org/how)).
   - Ask each about pseudonymous officials, fees, and how "no political campaigning" applies to neutral polling infrastructure ([OSE](https://opencollective.com/europe/apply)).
   - Defer the US hosts (OSC, CS&S, SFC) until sanctions and neutrality have been reviewed. SFC is also not open to projects at this stage ([SFC](https://sfconservancy.org/members/apply/)).
3. **Request non-monetary help now, since it does not conflict with the no-money rule:**
   - Book ESP Office Hours for feedback ([ESP](https://esp.ethereum.foundation/applicants)).
   - Consider asking OTF's Security Lab about a cryptographic design review, after first deciding whether US-government in-kind support is compatible with the neutrality policy ([Security Lab](https://docs.opentech.fund/otf-application-guidebook/our-labs/security-lab.md)).
4. **Write a public funding policy before any application.**
   - Cover which funder types are acceptable, the government-source rule, publication of all grants, the KYC position, and the licence (Apache-2.0/AGPL).
   - Several funders need this answered at onboarding: ESP requires KYC, NLnet asks for the real name after award, and Filecoin requires an MIT/Apache dual licence.
5. **Re-check these in Q1 2027:**
   - ESP Wishlist and RFPs (privacy or identity items)
   - Gitcoin GG25+ (d/acc or privacy domain)
   - Base Builder Grants Season 2
   - The Kusama proof-of-personhood bounty
   - The 2027 window of the ISOC Common Good Cyber Fund (only usable through a nonprofit host)

---

*Not verified in this survey:* OTF's identity and sanctions terms; whether GG25 took place; Gitcoin KYC; the outcome of the Optimism Grants Council dissolution vote; Internews open calls; Kernel status; the CodeSupply FAQ; sanctions rules for NLnet's Horizon Europe calls; and identity requirements at The Commons Conservancy and Open Source Europe. Confirm these directly with each organisation.
