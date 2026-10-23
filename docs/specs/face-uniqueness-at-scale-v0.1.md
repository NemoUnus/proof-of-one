# Face uniqueness at scale — specification v0.1

*Authors: Prosopon (AI agent), with Argus and Metron (AI agents). Implements Decision Log #33, which grew out of questions and proposals from the founder, Nemo Unus. Status: design. Not audited.*

Layer 2 of enrolment (whitepaper §6.7) checks that a new member's face does not belong to someone already enrolled. This note sets out what large-scale face search can and cannot do, and the search procedure that follows from that.

## 1. What the evidence says

| Question | Evidence | Meaning for Proof of One |
|---|---|---|
| Speed | The most accurate algorithms search a gallery of 12 million in under a millisecond on one CPU core. Templates are about 250 bytes to 2 KB. [1] | Speed is not the limit. 100 million templates take roughly 25–200 GB. Searching inside an enclave on encrypted templates is slower, but seconds are acceptable for a one-time enrolment. |
| Accuracy at scale | Best result in 2026: with a 12-million gallery of controlled photos, about **1.1% of true duplicates are missed** when false alarms are held at **1 in 1,000** searches. [2] For webcam probes against official photos, the best miss rate is about 0.55%. | At 100 million members, a 1-in-1,000 false-alarm rate would wrongly flag about **100,000 honest people**. False alarms grow with gallery size. |
| Ageing | For the best algorithm in 2019, misses rose from 0.7% for photos taken 0–2 years apart to 2.7% for photos 14–18 years apart, at a false-alarm rate of 1 in 1,000. Mid-tier algorithms reached 26%. [1] Errors grow faster for young people. [3] | The algorithm must be chosen from the top tier, and stored templates should be refreshed over time. |
| Large national systems | Aadhaar deduplicates 1.3 billion people with ten fingerprints, both irises and the face. [3] | Face alone is the weakest link at very large scale, so this design reduces how much it has to do. |

## 2. Why face is needed at all

Layer 1, the document fingerprint, already stops anyone from enrolling twice with the same document or with a renewed document. Face search is needed only for a person who holds **two different genuine documents**. That covers:

- honest people with several nationalities, who now add the second document instead (Decision #30);
- people who lie about an earlier enrolment;
- an issuing state that gives the same people several genuine documents with different personal data. This is the most serious case, because it can inflate the regional polls of that state.

## 3. Search procedure (Decision #33)

1. **Ask first.** Enrolment begins with the question: *"Have you already enrolled in Proof of One with another document?"* A "yes" leads to the add-document flow (Decision #30). *(Proposed by the founder.)*
2. **Main search within the same birth date and sex**, with a normal threshold. At 100 million members, each group holds a few thousand people, so false alarms become negligible and the search is fast. *(Proposed by the founder.)* Very large groups, for example 1 January in countries that record unknown birth dates that way, are handled as normal groups.
3. **Second search across all members with a very strict threshold**, so that only near-certain matches are reported. The target false-alarm rate is in the order of one in a million searches. This catches an issuer that prints different birth dates for the same person, while honest people are almost never flagged. *(Added by the red team: birth-date blocking alone was removed in whitepaper v0.5 for this reason.)*
4. **Statistics by document issuer** (Decision #21), such as enrolment counts, age profiles and second-search hits, make abnormal patterns from an issuer visible.
5. **Template refresh.** Whenever a member adds or renews a document, the stored template is replaced by one taken from the new live capture. Templates therefore age with the member. *(Proposed by the founder.)*
6. **Thresholds favour honest people.** A wrongly refused honest person harms trust directly. A missed duplicate requires a second genuine document, which is rare and costly. Thresholds are set accordingly, and the measured error rates are published.
7. **Second review.** A person flagged as a possible duplicate can ask for a second review. The design of this path must not reveal who the other matched member is. *Open design question.*

## 4. Accuracy study requirements

Before the method is fixed, the accuracy study (roadmap phase 1) must measure:

- false alarms and misses for galleries of 1, 10 and 100 million;
- results by time between photos, for example under 2, 5 and 10 years;
- **phone selfies against chip photos**, under realistic lighting;
- differences across age, sex and population groups.

**Open question:** if face alone proves insufficient, should a second biometric be added, for example palm or iris captured with the phone camera? That would add complexity and new privacy risks, and is not proposed now.

## References

1. NIST IR 8271, *Face Recognition Vendor Test Part 2: Identification* (2019).
2. Biometric Update, "Idemia PS face biometrics score high accuracy at scale in latest NIST FRTE", August 2026, reporting NIST FRTE 1:N results.
3. Jain, Deb, Engelsma, "Biometrics: Trust, but Verify", arXiv:2105.06625.

— Prosopon, Argus and Metron (AI agents, Proof of One)
