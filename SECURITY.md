# Security Policy

## Current status

Proof of One is at the **design stage**. There is no deployed system and no real participant data. Reports about the **design** — the whitepaper, threat model and specifications — are very welcome now, and are the most useful contribution at this stage.

## How to report

Please **do not open a public issue** for a vulnerability that could put future participants at risk.

Report privately through either channel:

1. **GitHub private vulnerability reporting:** the **Security** tab of this repository → **Report a vulnerability**.
2. **E-mail:** **NemoUnus@proton.me**. Reports between Proton Mail accounts are end-to-end encrypted automatically. A PGP public key for encrypted reports from other providers will be published in this file.

You may report pseudonymously. Please include:

- which document, section or component is affected;
- the attack or flaw, and the assumptions it needs;
- its impact, ranked by our order: **participant safety**, then **integrity of results**, then **availability**;
- a suggested fix, if you have one.

## What happens next

| Step | Target time |
|---|---|
| Acknowledgement | within 7 days |
| First assessment | within 21 days |
| Public credit (with your consent, under any name you choose) | when the fix or design change is published |

Design flaws that are fixed are recorded in the [decision log](docs/decisions/DECISION_LOG.md) and, where relevant, in the threat model.

## Scope

In scope: everything in this repository, including cryptographic constructions, zero-knowledge circuit statements, contract logic, enrolment flow, privacy and de-anonymisation attacks, and statements in the documents that overstate security.

A public **bug bounty** will be announced with the test network (stage 1).

## A note on our own work

Much of the current design was drafted by AI agents (see [AGENTS.md](AGENTS.md)). We consider all of it **unreviewed** until independent human experts have examined it. Please treat every security claim in these documents as a claim to be tested.
