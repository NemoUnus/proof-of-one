# Transparency-log witnesses: who runs them and how to join v0.1

*Proof of One research note, schedule item 0.17-09, following Decision Log #46. Status: first pass, 4 November 2026. Drafted by the project's AI agents.*

## 1. Why witnesses matter here

In a poll recorded in transparency logs ([specification](../specs/transparency-log-ballots-v0.1.md)), witnesses guarantee that everyone sees the same log. A witness cosigns a log's checkpoint only if it extends the last one it cosigned. A log therefore cannot show one version to a voter and another to the public, unless a quorum of witnesses colludes with it.

Witnesses see only checkpoints: a tree size, a root hash and a signature. They see no ballots, no voters and no network addresses of voters, and voters never contact them. They are also cheap to run. A witness keeps only the latest checkpoint per log, and checks a short consistency proof for each new one [w1].

## 2. Who runs witnesses today (4 November 2026)

| Operator | What | Status | Source |
|---|---|---|---|
| TrustFabric team at Google (transparency.dev) | A development witness and a staging witness ("Ring any bells?") that follow the Witness Network's testing and staging lists | Production witness "in the process of productionising"; no service-level agreement yet | [w2] |
| TrustFabric and custodians | 15 ArmoredWitness hardware devices held by "trusted custodians around the world" | Running as of the November 2024 report | [w3] |
| Geomys | "Navigli" staging witness; follows all staging and testing lists | Staging, may have bugs; run for the foreseeable future | [w4] |
| Mullvad, Geomys, TrustFabric | Used together as the 2-of-3 witness policy of a public keyserver in December 2025 | In use | [w1] |
| Glasklar Teknik, Mullvad VPN, Tillitis | Witnesses in Sigsum's first built-in named policy | In use. All three share a parent company, which limits their independence, as Glasklar itself notes | [w5] |

**The Witness Network** (witness-network.org) is a community-maintained list of approved logs and witnesses, with separate testing, staging and production lists [w6].
- Witnesses that take part pull the lists and configure themselves to cosign every approved log.
- A log joins by a request to the network's maintainers that gives its origin, its verification key, its maximum number of checkpoints per day ("qpd") and a contact; a maintainer adds it to a list. *Update, 10 November 2026:* the network now asks for these requests by e-mail to its participation list, whose archive is public, and says that maintainers may ignore requests from AI agents and prefer human-to-human contact. Our request was therefore written and sent by the founder. An example is a recent test log with a qpd of 2,880, one checkpoint every 30 seconds [w7].
- The service describes itself as experimental and a work in progress.

## 3. What this means for Proof of One

1. **Joining is open and simple.** A test log can join the testing list with one pull request and be cosigned by several witnesses within minutes. No organisation needs to be asked first.
2. **Production witnesses are still few.** The production lists and production-grade witnesses are only now being set up. A large poll in 2027 would depend on a young network.
3. **Independence is the hard part.** Today's witnesses come from a handful of organisations, several of them linked. The log specification requires a quorum such as 5 of 7 witnesses, from at least three unrelated organisations in at least three jurisdictions, none of them a log operator or the project. Meeting that may require asking organisations with a public-interest mission to run a witness. A witness costs little and sees no personal data, which makes it an easy request.
4. **Neutrality.** A witness run by a large company or by any one government's agency could be used to cast doubt on a poll. That would not be technical, because a witness cannot change or read anything. A policy that mixes companies, foundations and civil-society operators across regions answers this better than any single operator.
5. **A ballot cadence fits.** A poll log needs checkpoints every 30 to 60 seconds while open, which is within what logs already request today. One log per poll, or per region, keeps each list entry simple.

## 4. Plan

| Step | When | Who |
|---|---|---|
| 1. Finish the red-team review of the log specification | Now | AI team |
| 2. Run a test ballot log (Tessera) with synthetic ballots | With the test network (activity 1.6) | AI team |
| 3. Add it to the Witness Network **testing** list (request below) | Sent 10 November 2026 | Founder, as Nemo Unus |
| 4. Measure latency, checkpoint rate and failure handling with real witnesses | After step 3 | AI team |
| 5. Ask independent organisations to run production witnesses, enough for a 5-of-7 policy | Before the first large open poll | Founder, with the sponsor (0.14) |

## 5. Request (step 3)

*Sent by e-mail on 10 November 2026, in the founder's words, with: origin `nemounus.github.io/proof-of-one/test-log/1`; key `nemounus.github.io/proof-of-one/test-log/1+6c8de921+AVO8MnBSYew20E2zE5lwIGQ4WGOk7BVE5fFVFfwynAUV`; qpd 24 (the log is appended by hand-started runs); testing list; a statement that the project is written with AI coding agents and that the founder reviews the work and is the contact. The earlier draft follows for reference.*

> **Add Proof of One test ballot log to the testing list**
>
> This adds `<origin>` to the testing log list.
>
> - Verification key: `<vkey>` (also published at `<url>`)
> - qpd: 2880 (a checkpoint at most every 30 seconds while a test poll is open, every 5 minutes when idle)
> - Contact: NemoUnus@proton.me
> - Implementation: Tessera, c2sp.org/tlog-tiles
> - Purpose: test log for Proof of One, an open-source polling project in which encrypted ballots are recorded in transparency logs and voters check their own ballot ([specification](https://github.com/NemoUnus/proof-of-one/blob/main/docs/specs/transparency-log-ballots-v0.1.md)). Entries are synthetic test ballots only. Expected lifetime: months; staging and production would be requested separately.
>
> *Drafted with the project's AI agents and reviewed by me. — Nemo Unus*

## Sources

- [w1] Filippo Valsorda, "Building a Transparent Keyserver", 19 December 2025: https://words.filippo.io/keyserver-tlog/
- [w2] transparency.dev witnesses page: https://transparency.dev/witnesses
- [w3] "Can I get a witness network?", transparency.dev blog, 7 November 2024: https://blog.transparency.dev/can-i-get-a-witness-network
- [w4] Geomys, The Navigli Staging Witness: https://geomys.org/witness/navigli
- [w5] Glasklar Teknik, "Named policies for Sigsum", 4 February 2026: https://www.glasklarteknik.se/post/named-policies-for-sigsum/
- [w6] Witness Network: https://witness-network.org/ ; repository: https://github.com/transparency-dev/witness-network
- [w7] Pull request adding a test log to the testing list: https://github.com/transparency-dev/witness-network/pull/67
