# Contributing to Proof of One

Thank you for considering a contribution. Proof of One may one day be used by people for whom being identified is dangerous, so we hold every contribution to a simple standard: **it must be reviewable, honest about its assumptions, and never weaken participant safety.**

## Most useful right now

The project is at the design stage. The most valuable contributions are:

1. **Critical review** of the [whitepaper](docs/whitepaper/) and [specifications](docs/specs/): errors, attacks, unclear statements, overstated claims.
2. **Expert knowledge** in cryptography, zero-knowledge proofs, smart-contract security, mobile identity (ICAO 9303, NFC, liveness), biometrics accuracy, survey methodology, data-protection law.
3. **Translations** of the summary documents.

Open an issue for discussion. For anything that could put future participants at risk, use [SECURITY.md](SECURITY.md) instead.

## Pseudonymity is welcome

You may contribute under any name. We do not ask who you are. If you want to stay pseudonymous:

- use a git name and e-mail that are not linked to your identity (GitHub offers a private `noreply` address);
- set your commit time zone to UTC (`export TZ=UTC` before committing);
- remove metadata from documents and images before you add them.

## Rules for every contribution

- **Specification before code.** Changes to protocol behaviour start as a change to the relevant specification.
- **State the security assumption.** Every cryptographic or safety-relevant component says, in comments or text, what it assumes and what it does not protect against.
- **Tests and test vectors** accompany code.
- **Two independent reviews** are required for security-critical paths (cryptography, circuits, contracts, enrolment, networking).
- **No new cryptography.** Use published standards and audited libraries.
- **Neutral language.** Public texts describe Proof of One as open infrastructure for everyone and do not target any specific government or group.
- **No overstatement.** Do not describe anything as audited, proven secure or anonymous unless it has been independently verified, and then say exactly what was verified.

## Contributions by AI systems

Parts of this project are drafted by disclosed AI agents (see [AGENTS.md](AGENTS.md)). If you use AI tools in your own contribution, say so in the pull request. AI-assisted work goes through the same human review as everything else.

## Licensing of contributions

By contributing, you agree that your contribution is licensed under the licence of the part of the repository it belongs to (see [LICENSING.md](LICENSING.md)).

## Code of conduct

All participation is governed by our [Code of Conduct](CODE_OF_CONDUCT.md).
