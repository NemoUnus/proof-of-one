# Personal-number checklist by country v0.1

*Proof of One research note, schedule item 0.16-06 (the founder's proposal, accepted 3 November 2026). Status: first draft. Most entries come from the AI team's general knowledge and are **unverified**; a second agent spot-checked a sample (section 4). Data: [personal-number-checklist-v0.1.csv](personal-number-checklist-v0.1.csv). Corrections are welcome as GitHub issues.*

## 1. Purpose

The document fingerprint uses a person's national personal number where the passport carries one (whitepaper 6.6, Decision Log #43; [survey v0.1](personal-number-survey-v0.1.md)). This checklist lists, for each of the 186 countries and territories in the [coverage list](coverage-by-country-2026-10-28.csv), the number each country assigns to its people, and whether it can be used. As the founder proposed, rare changes of a number (corrections, legal changes) are set aside here; the face search covers them (survey §4).

## 2. Columns

| Column | Meaning |
|---|---|
| `national_number` | The number the country assigns to each person, or "none" / "none known" |
| `format`, `encodes` | Its length and whether it encodes birth date, sex or place. Such numbers change when those details are corrected |
| `printed_on_passport` | Team belief whether the passport shows it. Not enough on its own: only signed chip data can be used |
| `in_MRZ_optional_field` | Whether it is in the machine-readable zone, positions 29–42 of line 2, and so in signed data group DG1. "to check" unless confirmed |
| `in_DG11` | Whether the chip's optional data group DG11 carries it. "to check" for all, since no source has been found yet |
| `passport_issuer` | For territories, the state whose passport residents carry |
| `status`, `source` | "confirmed" only with a cited source; otherwise "unverified" |

Rows are sorted by population, so the countries that matter most come first.

## 3. First picture (unverified)

| Group | Countries and territories |
|---|---|
| A national number exists and the team believes the passport shows it | 36 |
| A national number exists, but whether the passport shows it is unknown | 76 |
| A national number exists but is not on the passport (for example Brazil, Hungary, Philippines) | 4 |
| No general national number, or none on the passport (for example Germany, France, the United Kingdom, the United States) | 18 |
| No number found yet | 32 |
| Territories using another state's passport | 20 |

Countries with no usable number take the name-based path with the face check (whitepaper 6.6). Even where a number exists, it can be used only once its place in the signed chip data is confirmed (survey §4, point 3).

## 4. Checks so far

- **Read from specimen passports in PRADO (by the founder, 3 November 2026):** line 2 of the machine-readable zone, positions 29–42.

  | Country | Specimen issued | In the MRZ optional field |
  |---|---|---|
  | Sweden | 2022 | **Yes:** the personal identity number with the century, 12 digits without a hyphen. The data page shows 10 digits with a hyphen, so the rule must say which form is used |
  | Spain | 2015 | **Yes:** the personal number shown on the data page (9 characters) |
  | Romania | 2024 | **Yes:** the 13-digit CNP |
  | Lithuania | 2024 | **Yes:** the 11-digit personal code |
  | Poland | 2022 | **No:** the field is empty. The PESEL is printed on the data page, so it can only be used if the chip carries it in DG11 |

  Poland shows that a number printed on the data page is not necessarily in the signed MRZ. Specimens show the MRZ only; DG11 must be checked from issuer documentation or real chips.
- **Confirmed from other sources:**
  - Netherlands: the BSN was removed from the MRZ on 2 August 2021 and remains printed on the holder page.
  - Republic of Korea: the resident registration number was removed from passports in December 2020.
  - Sweden, Romania, Lithuania and Portugal: the number is printed on the data page.
  - Türkiye: the number has been used in passports since 2003.
  - Switzerland, Hungary and Italy: no personal number on the data page.
  - Thailand, Argentina, Malaysia and Uzbekistan: the number is printed on the data page. In Malaysia, children under 12 have their birth certificate number instead.
- **Spot check by a second agent:** see section 6.
- **Still needed:** the MRZ and DG11 columns for every country. The quickest source is specimen images: the founder is reading PRADO specimens for 15 European countries (0.16-04). After that, issuers' specimen brochures and, in the pilot, a privacy-preserving count per issuer of whether the optional field is filled (survey §5).

## 5. How the design uses the list

The trust list (7.3) will carry, per issuer and document series, a rule saying where the number is (MRZ positions or DG11 tag) and how it is normalised, for example by dropping separators. Only issuers with a **confirmed** rule use the number path. All others use the name path, so an error in this list can make the fingerprint weaker but never wrong.

## 6. Second-agent spot check

A second agent checked 15 of the "yes" rows, the "no" rows of 10 large countries, and the formats of several numbers.

- **Confirmed:** Thailand, Argentina, Malaysia, Uzbekistan (printed); Hungary, Italy (not printed). Kazakhstan has an "ID No." field, but no source says that it is the IIN.
- **Corrected:**
  - Mexico: the CURP is printed only where applicable, and it also encodes letters of the name.
  - Chile: the RUN was the passport number until August 2013, and no source shows it on later passports, so it is now "unknown".
  - Ukraine: the format is 13 digits (YYYYMMDD-NNNNC).
  - Iran: the first three digits of the national code encode the place of issue.
- **Not confirmed either way:** Colombia, Spain, Ukraine, Poland, Peru, Belgium and Finland. They stay "unverified" until a specimen data page is checked. The "no" rows for Germany, France, the United Kingdom, the United States, Russia, Japan and the Philippines were not contradicted, but have no positive source yet.
- **Caution:** a missing field in Wikipedia's lists is not evidence that the passport lacks the number. The Uzbek passport article omits the PINFL, which another source places on the data page.
