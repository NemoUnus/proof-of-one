# Second-model review of whitepaper v1.0: findings and handling

*Review by a second AI model (ChatGPT), received 8 November 2026, of whitepaper v1.0 (47 pages). It is not an independent human review and does not count towards Gate 0. Every finding below was checked against the v1.0 text; all quoted passages were found as cited.*

**Summary.** 25 findings: 6 high, 13 medium, 6 low. None is rejected. Four needed a design decision by the founder; all four are now decided (Decision Log #52 and #53); the rest are corrections of wording or status and go into v1.1.

## Findings that need a decision

| # | Finding | Severity | Handling proposed |
|---|---|---|---|
| 1 | The OPRF does not stop the service that holds its key from trying all likely name/birth-date combinations (§6.6 says "the keyed OPRF prevents this") | High | **Accepted; error in v1.0.** Fix the text now: the OPRF protects against outsiders and against a stolen fingerprint database without the key, not against the key holder or a compromised enclave. **Decided (#53):** split the OPRF key among several operators (threshold OPRF, for example 2 of 3), so that no single operator can evaluate guesses; keep the key inside attested enclave code with rate limits and a public count of evaluations until then. |
| 2 | Fingerprints cannot be "re-derived inside the enclave" after key rotation, because the inputs are not stored (§7.5) | High | **Accepted; error in v1.0.** Remove the sentence. **Decided (#53):** no scheduled rotation, since fingerprints must stay stable; the key is replaced only if compromise is suspected, with old and new keys side by side until each member next proves their document, after which the old key is destroyed. |
| 3 | A wrong tally becomes final if nobody challenges it within 7 days (§8.7, §17.5) | High | **Accepted.** **Decided (#53):** verify all decryption proofs when the result is published, not on challenge. The check costs about 2 million gas, a few cents to about a dollar on a rollup, once per poll. The challenge path then disappears and "anyone can recount" becomes a check the contract always makes. Until changed, §1, §8.7, §12.2 and §17 say plainly that the result check is optimistic. |
| 6 | Revoking a stolen identity does not remove it from polls already open (§6.10, §8.11) | High | **Accepted.** Add the exposure (up to the length of the longest open poll) to §6.10, §12.2 and §17. **Decided (Decision Log #52):** open polls refuse a revoked identity's ballots from the moment of revocation (an on-chain, append-only revocation list keeps the snapshot reproducible); a member who restores the old secret from a backup can have that identity's ballots in open polls removed and answer again; the app encourages a key backup. Making participation public was considered and rejected. |

## Findings fixed in the text (v1.1)

| # | Finding | Severity | Handling |
|---|---|---|---|
| 4 | Transparency-log polls have no defined single set of ballots across two logs | High | Accepted. §8.12 states that the log mode is not specified for use; the rule for one set (union of both logs, one ballot per nullifier, highest revision, close-time cutoff, missing-inclusion handling) is written before any log poll. Already a pending task. |
| 5 | A mirror's cosignature does not ensure lasting availability | Medium | Accepted. Narrow to "had the data when it signed"; ongoing checks and archives listed as open. |
| 7 | "Unique to the person" is too categorical for the number path | Medium | Accepted. Qualify: treated as stable only for series where uniqueness, non-reuse and form are documented. |
| 8 | "An error can only move an issuer to the name path" is not supported | Medium | Accepted; error in v1.0. Replace by fail-closed rules: signed, versioned issuer rules with test vectors; an unrecognised field rejects enrolment. |
| 9 | Document-key namespace and number reuse are undefined | Medium | Accepted. Key includes issuer, document type and number; a known key is a strong signal, checked with the face before refusal. |
| 10 | Re-vote revisions under concurrent or split submissions | Medium | Accepted with #4. Each revision binds the hash of the previous ballot; superseded ciphertexts stay public, stated in §7.8. |
| 11 | §1 status mixes done and pending | Medium | Accepted. Poll 1's result has since been published through the contract's checks (7–8 Nov); §1 and §8.11 updated with dates. |
| 12 | Name-path face decision has no defined bands or appeal | Medium | Accepted. Match / non-match / undecided, with human appeal; to be measured. |
| 13 | NIST figures need exact table and conditions | Medium | Accepted. Cite the report and table; mark the 100-million figure illustrative. |
| 14 | The 15–20% coverage estimate is not reproducible from the paper | Low | Accepted. Short method note and distinction between documents, people and people with compatible phones. |
| 15 | Minimum group size does not prevent disclosure | Medium | Accepted; overclaim. "Reduces", plus controls on overlapping breakdowns. |
| 16, 21 | "Verified random sample" with a block-hash seed | Medium | Accepted. "Invitation lottery with a known bias risk" until a beacon is used; non-response noted. |
| 17 | Receipt expiry cannot erase copies made earlier | Medium | Accepted. Narrow to the app's own copy. |
| 18 | Anonymity statements omit participation and metadata exposure | Medium | Accepted. Conditional wording next to the broad claims; a plain-language high-risk warning before enrolment. |
| 19 | Phone timings too broad | Low | Accepted. Each figure labelled with device, cold/warm, witness source, memory, sample size; "not too slow" removed. |
| 20 | Cost estimate omits fees, relay and archive costs | Low | Accepted. Assumptions listed; a fuller cost table later. |
| 22 | Forced inclusion is conditional | Medium | Accepted. Phrase as conditional on the parent chain and the member's ability to use it. |
| 23 | Log mode must not read as working | Medium | Accepted. Every summary distinguishes the rollup path (tested) from the log path (designed). |
| 24 | Phase 0 "done" versus review | Low | Accepted. "Published, awaiting independent review". |
| 25 | Custom OPRF must not borrow RFC 9497's assurance | Low | Accepted. Byte-level specification and test vectors required before implementation. |

## Disposition

Real-participant gates are unchanged: Phase 1a stays synthetic. Findings 1–3, 6 and 8 correct statements that v1.0 made too strongly; they are fixed in v1.1 whatever the decisions D1–D4.
