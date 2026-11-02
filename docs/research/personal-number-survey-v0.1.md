# Personal numbers in passports: survey v0.1

*Proof of One research note, schedule activity 0.16. Status: first pass, 2 November 2026. Drafted by the project's AI agents; not yet checked by a human expert. Corrections are welcome as GitHub issues.*

## 1. Why this matters

Whitepaper v0.9 (6.6, 7.5; Decision Log #43) derives the **document fingerprint** from a personal (national) number when the passport carries one, and otherwise from nationality, name, date of birth and sex, with a face check. Two questions decide how well this works:

1. **Coverage.** Which issuers put a personal number into the *signed* data of the chip, that is into DG1 (the machine-readable zone, MRZ) or DG11 (additional personal details)?
2. **Stability.** Does the number stay the same for the person's whole life?

A number that is printed on the data page but not in DG1 or DG11 cannot be used: the circuit can only use fields covered by the issuer's signature.

## 2. What the standard allows

ICAO Doc 9303 reserves positions 29–42 of MRZ line 2 (14 characters, letters, digits and `<`) as an optional field that "may be used by the issuing country as it desires", with a check digit at position 43 [1]. DG11 is an optional data group that can hold a personal number, place of birth, address and other details [2]. Neither is mandatory, and neither has a fixed format across issuers.

## 3. Findings so far

### 3.1 Confirmed from sources

| Issuer | Printed on data page | In MRZ (DG1) | Note | Source |
|---|---|---|---|---|
| Netherlands | Yes (BSN, holder page) | **No, removed from 2 August 2021**; moved to a QR code | Removed to reduce fraud risk [4] and to stop automatic reading without the holder's knowledge [3] | [3][4] |
| Republic of Korea | Back digits of the resident registration number **no longer shown** from 21 December 2020 (national Passport Act change, as reported in a local notice) | — | Removed to protect personal information; ICAO does not require it | [5] |
| Sweden | Yes ("personal identity number") | Not stated by the source | | [6] |
| Romania | Yes ("Personal No. (CNP)") | Not stated by the source | | [7] |
| Lithuania | Yes ("Personal No.") | Not stated by the source | | [8] |
| Portugal | Yes ("Personal number") | Not stated by the source | | [9] |
| Türkiye | Number used in passports since 2003; where it is printed is not stated | Not stated by the source | | [10] |
| Switzerland | No personal number listed | — | | [11] |

### 3.2 Not yet confirmed

The team's working list of issuers *believed* to write a personal number into the MRZ optional field includes several Nordic and Baltic states, several Central and South-East European states, Spain, Belgium, Iceland, Türkiye, Chile, Colombia, Kazakhstan, Ukraine, Pakistan, Malaysia and Thailand. **None of these is confirmed yet for the MRZ**; the list is a starting point for checking, not a finding, and is not used anywhere in the design.

### 3.3 Stability: personal numbers do change

The whitepaper says the number "stays the same for life". Sources show this is not always true:

- **Sweden**: a person whose legal gender changes is issued a new number; numbers are also corrected when a birth date or sex was registered in error [12].
- **Estonia**: in 2018, 295 people received new personal codes after a register review found birth dates that did not match birth certificates [13].
- **Republic of Korea**: since 2017 a committee can change a person's number after harm from a leaked number; 3,045 of 4,403 applications had been approved (reported December 2021), with harms cited including voice phishing, identity theft and domestic violence [14].

Numbers that encode birth date or sex will change whenever those are corrected or changed.

### 3.4 Some issuers are removing the number

Two examples suggest a possible trend: two issuers removed the number from the passport or its MRZ for privacy and anti-fraud reasons (Netherlands 2021, Korea 2020). Coverage measured today may shrink over time, so the design must not depend on it.

## 4. What this means for the design

1. **The face search stays the backstop for everyone.** A changed personal number gives a new fingerprint, so a person could look new to Layer 1. The whitepaper already runs the face search (6.7) for every enrolment, including the strict all-member search, so a changed number is likely to be caught there, as a changed name is. Where the birth date or sex also changed, only the strict all-member search applies, so detection is not guaranteed. The text of 6.6 should say so explicitly.
2. **Correct the wording.** 6.6 should say the number is "usually stable", not "the same for life", and name the known reasons for change.
3. **Use only signed fields.** The fingerprint input must come from DG1 or DG11 bytes whose hashes are checked against the document security object. Reading DG11 adds one more data-group hash to the circuit; its cost is to be measured.
4. **Per-issuer rules in the trust list.** Where the number sits (MRZ positions or DG11 tag), its format and its normalisation (for example dropping separators) must be recorded per issuer and per document series in the trust list, versioned, so that a renewed passport of a new series gives the same fingerprint.
5. **Sensitivity.** Some numbers encode sex or birth date. The number never leaves the phone and enters only the blinded OPRF input (7.5), so this adds no exposure; the trust-list entries contain formats only, never numbers.
6. **No default to "number present".** If an issuer's rule is unknown, the document takes the name-based path with the face check.

## 5. How to finish the survey

1. **Specimen documents.** The EU's public register of identity documents (PRADO) and issuers' own brochures show specimen MRZs. Our automated tools cannot reach PRADO, so this step needs a person to read the specimens and record, per issuer and series: optional-field content, DG11 presence if documented, and the source page.
2. **Test data.** Open-source passport-reading projects publish test vectors and issuer notes; these can confirm MRZ layouts but not real chips.
3. **Pilot measurement.** In the pilot, the app could report per issuer only whether the optional field is non-empty, aggregated and without any document data. Whether even that is acceptable is a question for the impact assessment.
4. **Collision study.** For the name-based path, measure how often (nationality, name, birth date, sex) collide, especially with default birth dates; this is already listed as a pre-launch requirement in 6.6.

## Sources

1. [Machine-readable passport](https://en.wikipedia.org/wiki/Machine-readable_passport), Wikipedia (summarising ICAO Doc 9303).
2. [RFID chip logical data structure](https://regulaforensics.com/blog/rfid-chip-logical-data-structure/), Regula.
3. [Kamerstuk 25764-121](https://zoek.officielebekendmakingen.nl/kst-25764-121.pdf), Dutch House of Representatives: BSN removed from the MRZ of passports and identity cards from 2 August 2021; it stays visible on the passport holder page.
4. [BSN verdwijnt uit MRZ op paspoort](https://privacy-web.nl/en/nieuws/bsn-verdwijnt-uit-mrz-op-paspoort/), privacy-web.nl, 2018.
5. [Resident Registration Number's back digits will disappear from passports](https://www.asiae.co.kr/en/article/2020122105551473341), Asia Economy, December 2020.
6. [Swedish passport](https://en.wikipedia.org/wiki/Swedish_passport), Wikipedia.
7. [Romanian passport](https://en.wikipedia.org/wiki/Romanian_passport), Wikipedia.
8. [Lithuanian passport](https://en.wikipedia.org/wiki/Lithuanian_passport), Wikipedia.
9. [Portuguese passport](https://en.wikipedia.org/wiki/Portuguese_passport), Wikipedia.
10. [Turkish Identification Number](https://en.wikipedia.org/wiki/Turkish_Identification_Number), Wikipedia.
11. [Swiss passport](https://en.wikipedia.org/wiki/Swiss_passport), Wikipedia.
12. [Personal identity number (Sweden)](https://en.wikipedia.org/wiki/Personal_identity_number_(Sweden)), Wikipedia.
13. [Birth date mismatches mean nearly 300 getting new ID code](https://news.err.ee/875268/birth-date-mismatches-mean-nearly-300-getting-new-id-code), ERR News, November 2018.
14. [Over 3,000 people have been approved for resident registration number changes](https://www.asiae.co.kr/en/article/2021122109200865273), Asia Economy, December 2021.
