# Reviewing Proof of One

Thank you for looking. Proof of One was designed and coded largely by disclosed AI agents ([AGENTS.md](AGENTS.md)), and **no independent human expert has reviewed it yet**. Until people with real expertise have tried to break it, every claim in this repository is a claim to be tested. Critical findings are the most useful contribution you can make, and they are always credited.

## Start here

| Time you have | Path |
|---|---|
| 15 minutes | Read the [technical brief](docs/review/technical-brief-v0.1.md): claims, constructions, trust assumptions, measurements and our own list of weak points. |
| An hour | Choose one area below, read its specification and answer one of its questions. |
| Half a day or more | Read the code of that area, run its tests ([reference/README.md](reference/README.md), Node.js 20), and try to make a forbidden thing pass. |

You do not need to read everything. A careful answer to one question is worth more than a general impression of the whole.

## Areas, in order of priority

| # | Area | Read | Code | Questions |
|---|---|---|---|---|
| 1 | **Unlinkable enrolment** | Whitepaper §7.10–7.11; [ballot and enrolment spec](docs/specs/ballot-and-enrolment-v0.1.md) §2 | [`enrolment-circuit`](reference/enrolment-circuit/) | The enclave knows `cm`, `rn` and the attributes. Can it link a person to `leaf` or `cn`? Is each use of Poseidon (commitment, PRF, random oracle) justified? Does the set of published `rn` values leak anything? Is there an established anonymous-credential scheme that does this better? ([issue #3](https://github.com/NemoUnus/proof-of-one/issues/3)) |
| 2 | **Ballot proof** | Brief §3.2; whitepaper §7.7 | [`ballot-circuit/circuits/ballot.circom`](reference/ballot-circuit/circuits/ballot.circom) | Is any constraint missing or under-constrained? Can a ballot count twice, count for a revoked or ineligible member, or encrypt anything other than one 1 and zeros? Are the 32-bit comparators safe given where their inputs come from? ([issue #2](https://github.com/NemoUnus/proof-of-one/issues/2)) |
| 3 | **Trustee key and tally** | [Trustee key generation](docs/specs/trustee-key-generation-v0.1.md); ballot and enrolment spec §6 | [`tally/src/dkg.js`](reference/tally/src/dkg.js), [`tally/src/protocol.js`](reference/tally/src/protocol.js) | Is the GJKR adaptation with public complaint resolution sound? Is the derivation of the second generator `H` acceptable? Is threshold 6 of 9 the right trade-off between collusion and availability? Can the recount be fooled? ([issue #13](https://github.com/NemoUnus/proof-of-one/issues/13)) |
| 4 | **Contracts** | [Contracts spec](docs/specs/contracts-v0.1.md); [implementation notes](docs/specs/implementation-notes-v0.1.md) | [`contracts/src`](reference/contracts/src/) | Can a ballot be replayed, dropped or reordered? Is batched verification with weights from `keccak(calldata)` sound when the submitter chooses the calldata? What is missing before `publish` can be trusted without the poll creator? ([issue #5](https://github.com/NemoUnus/proof-of-one/issues/5)) |
| 5 | **Documents and certificates** | Whitepaper §6.4; [document coverage](docs/research/document-coverage-v0.1.md) §4 | — | How should an open project obtain, publish and audit the country signing certificates (CSCA) it trusts? A field test found a commercial verifier missing the certificate of a PKD-participating country. What should happen when a document cannot be verified? ([issue #14](https://github.com/NemoUnus/proof-of-one/issues/14)) |
| 6 | **Face uniqueness at scale** | [Face uniqueness at scale](docs/specs/face-uniqueness-at-scale-v0.1.md); whitepaper §6.7 | — | Is the duplicate-search procedure sound and fair across populations? What accuracy study is needed before launch? ([issue #4](https://github.com/NemoUnus/proof-of-one/issues/4)) |
| 7 | **Threat model and participant safety** | [Threat model](docs/specs/threat-model-v0.1.md); [access under restrictions](docs/specs/censorship-resistant-access-v0.1.md) | — | Is anything realistic missing from the adversary? Are any threats ranked too low? Is the stated limit about document issuers framed honestly? ([issue #1](https://github.com/NemoUnus/proof-of-one/issues/1)) |
| 8 | **Proof-system setup** | Implementation notes §4 | — | A large Groth16 ceremony, or a universal-setup system? ([issue #7](https://github.com/NemoUnus/proof-of-one/issues/7)) |
| 9 | **Law, ethics, methodology** | Whitepaper §9.5, §11, §14; [date of birth and private verification](docs/specs/birth-date-and-private-verification-v0.1.md) | — | Biometric and data-protection law; which services may use age verification; self-selection and weighting of results. ([issue #6](https://github.com/NemoUnus/proof-of-one/issues/6); date of birth and age verification: [issue #15](https://github.com/NemoUnus/proof-of-one/issues/15)) |

Human-only tasks such as phone measurements and an independent recount tool are in issues [#9](https://github.com/NemoUnus/proof-of-one/issues/9)–[#12](https://github.com/NemoUnus/proof-of-one/issues/12). All open review requests: [issues titled “Review request”](https://github.com/NemoUnus/proof-of-one/issues?q=is%3Aissue+%22Review+request%22).

## How to report

- **A finding that could put future participants at risk** (de-anonymisation, forged identities or ballots, decryption of individual ballots): report privately as described in [SECURITY.md](SECURITY.md). Use GitHub's **Report a vulnerability** or e-mail NemoUnus@proton.me.
- **Everything else:** comment on the area's issue, or open a new issue whose title starts with `[review]` and names the area, for example `[review] Ballot proof: nullifier not bound to …`.
- Say what you checked, what you assumed and what you did not look at. "I read §3.2 and found nothing wrong" is a useful result too.

You may stay pseudonymous. We do not ask who you are.

## What happens with your review

1. Every finding is answered publicly, or privately for security reports, within the times given in [SECURITY.md](SECURITY.md).
2. Accepted findings change the specification first, then the code, and are recorded in the [decision log](docs/decisions/DECISION_LOG.md).
3. Your review is recorded in [PROVENANCE.md](PROVENANCE.md) under the name you choose, with the scope you reviewed. A part reviewed in depth by an independent expert is marked **Expert-reviewed**, with exactly what was checked.
4. Nothing security-critical is used with real participants until it has passed independent human review (Decision Log #28).

## What not to expect

There is no token, no payment and nothing for sale. A public bug bounty will be announced with the test network. We will not describe anything as "audited" or "proven secure" because you looked at it. We will say exactly what you reviewed.
