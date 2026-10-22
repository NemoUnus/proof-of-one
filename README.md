<p align="center"><img src="docs/logo.png" width="120" alt="Proof of One logo"></p>

<h1 align="center">Proof of One</h1>
<p align="center"><b>One human · One identity · One voice</b><br>
An open, verifiable polling network built on one-person-one-identity.</p>

---

> **Status: design stage (pre-alpha).** This repository contains the whitepaper, protocol specifications and a reference implementation of the voting core. **Nothing here has been audited. Do not use any part of it with real participants.** See [Staged release](#staged-release).

## What is Proof of One?

Online opinion can no longer be trusted. Bots and AI agents can create thousands of convincing respondents, one person can answer many times, and nobody outside the organiser can check that a published result is the true count.

Proof of One is an **open-source, non-commercial protocol** for polls in which:

- **every participant is a real, unique human** who can register only once, by reading the chip of their passport or national ID card with an ordinary phone and matching their live face to the chip photo;
- **no one can see who answered what**, including the people who run the system;
- **every participant can verify their own vote** on a public ledger;
- **anyone can recount every result** from public data, without trusting any operator.

Participation is free. Topics of sponsored polls are chosen by participants themselves, region by region, with a global track for questions that concern everyone.

**Who can take part today.** Anyone with a chip passport or chip ID card that a phone can read. Today that is roughly **one person in six** worldwide, about one billion or more people, with large gaps in South Asia and Africa. The share grows every year as countries switch to chip documents. See the [country-by-country coverage research](docs/research/document-coverage-v0.1.md).

## Documents

| Document | Description |
|---|---|
| [One-page summary (PDF)](docs/summary/Proof_of_One_Summary_EN.pdf) · [Markdown](docs/summary/SUMMARY.en.md) | Plain-language overview — start here |
| [Whitepaper v0.6 (PDF)](docs/whitepaper/Proof_of_One_Whitepaper_v0.6_EN.pdf) · [Markdown](docs/whitepaper/Proof_of_One_Whitepaper_v0.6_EN.md) | Full design, with measured sizes and costs from the reference code: identity, cryptography, ledger, polling, governance, limits |
| [Threat model v0.1](docs/specs/threat-model-v0.1.md) | Adversary with the resources of a state |
| [Ballot and enrolment spec v0.1](docs/specs/ballot-and-enrolment-v0.1.md) | Encrypted ballots, public tally, unlinkable enrolment |
| [Red-team review v0.1](docs/specs/red-team-review-ballot-spec-v0.1.md) | Attacks on the ballot spec and accepted fixes |
| [Contracts spec v0.1](docs/specs/contracts-v0.1.md) | Smart-contract interfaces, checks and cost estimates |
| [Implementation notes v0.1](docs/specs/implementation-notes-v0.1.md) | Measured sizes and gas, and lessons from the reference code |
| [Ballot aggregation v0.1](docs/specs/ballot-aggregation-v0.1.md) | How to cut the cost per ballot: options, measurements and recommended path |
| [Who can enrol? Document coverage v0.1](docs/research/document-coverage-v0.1.md) · [data (CSV)](docs/research/document-coverage-v0.1.csv) | Which countries issue chip documents a phone can read, and what share of people can take part today |
| [Decision log](docs/decisions/DECISION_LOG.md) | Every design decision and why it was taken |

## Reference code

Runnable reference implementation of the voting core: [reference/](reference/). **Not for production use.**

| Package | Description |
|---|---|
| [reference/tally](reference/tally/) | Encrypted ballots, voter self-verification, threshold decryption with proofs, independent recount tool |
| [reference/ballot-circuit](reference/ballot-circuit/) | Zero-knowledge ballot proof (Circom/Groth16): only eligible, unique, non-revoked members can cast a well-formed ballot |
| [reference/enrolment-circuit](reference/enrolment-circuit/) | Unlinkable registration: the registration service cannot tell which registry entry belongs to whom; lost identities can be revoked without revealing which |
| [reference/contracts](reference/contracts/) | Solidity registries, polls, ballots and results — the full on-chain flow, tested with real proofs |

## Design in one paragraph

A member reads their passport chip over NFC; the phone proves in zero knowledge that the document is genuine. Inside an isolated enclave, the live face is matched to the chip photo and checked against all members for duplicates. The enclave signs only a hidden commitment, so it can never link the person to their anonymous identity on the ledger. To vote, the phone encrypts the answer under a key held jointly by independent trustees and proves it is a valid ballot from an eligible, unique member. Anyone can add the encrypted ballots; trustees decrypt only the totals and publish proofs that they did so correctly.

## Principles

1. **One human, one identity.**
2. **Verifiable by the voter and by everyone.**
3. **Participant safety first.** The threat model assumes an adversary with the resources of a state.
4. **Open source from the first line.** Code, circuits, contracts and specifications are public.
5. **Non-commercial and neutral.** No token, no sale, no investor; the project does not choose poll topics.
6. **Honest about limits.** For example: an authority that issues identity documents can create genuine-looking identities. The design makes this costly, bounded and visible, not impossible (whitepaper §12.1).

## Staged release

| Stage | Meaning |
|---|---|
| 0. Open specification ← **we are here** | Whitepaper and specs published for review |
| 1. Test network | Code on a public test network, volunteers in low-risk settings, public bug bounty |
| 2. Independent audit | Review by independent human experts |
| 3. Real participants | Only after the stages above, and participant-safety gates in whitepaper §14 |

Code is never shipped to real participants on the assumption that reviewers will find problems later.

## Team

Proof of One is led by its pseudonymous founder, **Nemo Unus**, and developed with a team of **openly disclosed AI agents**. See [AGENTS.md](AGENTS.md), and [PROVENANCE.md](PROVENANCE.md) for who wrote and who reviewed each part. Their work is a proposal until independent human experts review it. **We are looking for those experts**: cryptographers, zero-knowledge and smart-contract auditors, mobile identity and biometrics specialists, survey methodologists and lawyers. Pseudonymous contributors are welcome.

## Contributing

Read [CONTRIBUTING.md](CONTRIBUTING.md). The most valuable contribution right now is **critical review of the specifications**: open an issue for any error, attack or unclear statement.

## Security

Please report vulnerabilities privately, not in public issues. See [SECURITY.md](SECURITY.md).

## Licence

Code: AGPL-3.0 (apps and services) and Apache-2.0 (libraries and circuits). Documentation: CC BY-SA 4.0. See [LICENSING.md](LICENSING.md).

## Contact

**NemoUnus@proton.me**
