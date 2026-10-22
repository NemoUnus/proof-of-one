# Proof of One — Decision Log

*Maintained by Hermes (AI agent). Records the decisions approved by the founder, Nemo Unus. Newest at the bottom.*

| # | Decision | Source |
|---|---|---|
| 1 | Project is non-commercial and open source, led pseudonymously by Nemo Unus with disclosed AI agents. | Founder |
| 2 | Public framing is neutral: open infrastructure for anyone to run a poll. No named governments. | Founder |
| 3 | Any funding comes later through a voluntary contribution network; anonymity of contributors and team is a principle. | Founder |
| 4 | Staged release: public code → testnet + bug bounty → independent human audit → real users. | Founder + team |
| 5 | **R1:** every voter can verify what was recorded for their own vote. **R2:** anyone can recount the totals from public data. These two are non-negotiable. | Founder |
| 6 | Answers are encrypted by default (exponential ElGamal, threshold tally key). Only totals are decrypted, with public decryption proofs (D1 revised). | Threat Model v0.1 + founder |
| 7 | The local vote record is kept only for a limited window after the poll closes. The user chooses 0, 7 or 30 days per vote. | Founder + Red-Team C7 |
| 8 | Unlinkable enrolment: the enclave certifies a commitment and never sees the identity leaf (D2). | Spec v0.1 |
| 9 | Vote buying is not the main design driver in early phases, because results are not legally binding. MACI-style anti-coercion is deferred until any binding-vote mode. | Founder |
| 10 | ~~Phase 1 recovery by backup only; revocation deferred.~~ **Superseded by #13.** | — |
| 11 | Protections against *involuntary* exposure stay in scope: receipt window, duress PIN, minimum anonymity batch, mandatory Tor/pluggable transports, anti-clone measures, public bound checks on ballot counts, trustee set rules. | Founder + team |
| 12 | Re-vote cap is kept, mainly as relay-cost / denial-of-service protection. | Team |
| 13 | **All Red-Team changes C1–C9 are adopted**, including the hidden revocation handle (C1). Recovery: restore from the encrypted backup when possible; otherwise re-enrol after a cooling-off period, and the old identity is revoked automatically. | Founder |
| 14 | **Participation is free for users.** Poll costs are paid by the common fund. Users in some countries cannot reach the global financial system, and fees would sharply reduce participation. | Founder |
| 15 | **Community agenda-setting.** Each month, users in each region propose topics. Users of that region then select a limited number by vote, according to the available budget. A global track of monthly polls covers issues that concern everyone, regardless of borders. The project itself does not choose topics. | Founder |
| 16 | Optional voluntary contribution to the fund is offered to users, **separated from voting** (different screen and session, no link to identity or ballot). Accepting contributions needs legal review before launch (sanctions/AML). | Founder + Themis/Argus |
| 17 | "Region" = nationality attribute from the document (single country or group of countries). Diaspora participates in their country's track. (P1) | Founder |
| 18 | Two-stage topic selection: anonymous one-per-person endorsements (off-chain, with on-chain summary) → top 10 → approval vote → winners within budget. (P2) | Founder |
| 19 | Budget split across regions by a public formula (equal base share + share proportional to members), plus a fixed global quota. (P3) | Founder |
| 20 | Public question-wording guideline (Metron); any edit is published alongside the original text. (P4) | Founder |
| 21 | Endorsement and selection statistics published by document issuer, to make agenda flooding visible. (P5) | Founder |
| 22 | Self-funded polls remain available alongside the fund-sponsored track. (P6) | Founder |
| 23 | Ballot aggregation (recursive proofs) brought forward to Phase 1 to cut fund costs. (P7) | Founder |
| 24 | Public project contact: **NemoUnus@proton.me** (Proton Mail). Used for git identity, SECURITY.md and public correspondence. | Founder |
| 25 | Code hosting: account created on Codeberg. GitHub is the primary public repository; Codeberg is a mirror. | Founder + team |
| 26 | First public release contains English documents only. Translations will be published later in several languages at once, to keep the project neutral. | Founder + team |
| 27 | Codeberg mirror removed (2026-10-22): Codeberg's revised Terms of Use exclude projects mostly written by AI tools, and this project discloses that its code is written by AI agents. GitHub remains the primary repository; independent long-term copies are kept in the Software Heritage archive. | Founder + team |

## Open
- Universal setup vs Groth16 ceremony for π_vote.
- Minimum batch size K for leaf insertion.
- Which L2.
- Donation network design and legal review.
