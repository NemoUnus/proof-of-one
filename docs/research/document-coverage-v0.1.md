# Who can enrol? Chip identity documents worldwide, v0.1

*Prepared by Hermes and Prosopon (AI agents) at the request of the founder, Nemo Unus. Data as of October 2026. Not reviewed by a human expert. Corrections are very welcome, especially from people who know their own country's documents.*

Proof of One enrols a person only from a government document with an electronic chip that a smartphone can read: an ICAO 9303 electronic passport, or an identity card with the same kind of chip. Anyone assessing the project should know how many people that includes today, and who it leaves out. This note answers that, country by country.

**Data file:** [document-coverage-v0.1.csv](document-coverage-v0.1.csv), with one row for each of 218 countries and territories. The same list is in the [appendix](#appendix--every-country-and-territory).

## 1. What counts

A document is usable when all three conditions hold:

1. **It has an ICAO 9303 chip** that a phone can read over NFC. This covers electronic passports and some national identity cards. Many national ID cards have chips that follow a different, national standard, for example in China, India, Indonesia, Malaysia and Thailand. The current design cannot use those.
2. **Its issuer's signing certificates are available**, so that the enclave can check the document is genuine (passive authentication). The main public source is the ICAO Public Key Directory (PKD). National "master lists" published by some countries cover others.
3. **The person actually holds a valid one.** A country issuing chip passports does not mean its people have them.

## 2. Results

| Measure | Share of world population | Notes |
|---|---|---|
| Lives in a country or territory that issues **chip passports** as standard | **73%** | 186 countries and territories |
| … including countries **switching over** now (India, Pakistan) | **94%** | Most passports in these two countries are still chip-less |
| Lives in such a country **and** the country is an **ICAO PKD participant** | **82%** | Other certificate sources may add more; see §4 |
| Lives in a country with **ICAO-compliant chip ID cards** | 60 countries | All of these also issue chip passports |
| Lives in a country with **no** chip document for ordinary citizens | **5%** | 14 countries; see §3 |
| Status **unclear** | **1%** | 16 countries; corrections welcome |

These are upper limits. The realistic figure is much lower:

**People who actually hold a chip document today: roughly 15–20% of the world's population.**

- ICAO reports **more than 1 billion electronic passports in circulation**, which is about 12% of the world's 8.2 billion people.
- Chip identity cards add several hundred million more people. Vietnam alone had issued **more than 78 million** chip ID cards by February 2023. Most EU countries issue chip ID cards, which most of their adults hold. Some of these people also hold passports, so the two groups overlap.
- In the most populous countries, few people hold a passport at all, and in India only a small share of passports have a chip yet: about 8 million chip passports by November 2025, for 1.46 billion people.

The figure will rise every year. Passports are replaced every 5–10 years, and India, Pakistan, Indonesia, Ghana, Ethiopia and others have recently switched or are switching to chip passports.

## 3. The largest gaps

These countries have more than 10 million people and no confirmed chip document for ordinary citizens:

| Country | Population (millions) | Status |
|---|---|---|
| Egypt | 118 | No chip in ordinary passports (2023) |
| South Africa | 65 | Chip passport planned, not yet issued |
| Myanmar | 55 | Machine-readable passport without chip |
| Afghanistan | 44 | No chip |
| Yemen | 42 | Unclear: ICAO PKD participant, but ordinary chip passport not confirmed |
| North Korea | 27 | No |
| Zambia | 22 | Planned |
| Sri Lanka | 22 | Planned, with issuance targeted for 2026 |
| Guatemala | 19 | Pilot planned for 2027 |
| Tunisia | 12 | Planned |
| Cuba | 11 | Unclear |
| Papua New Guinea | 11 | Unclear |

India (1.46 billion) and Pakistan (255 million) are counted as *switching over*. Both issue chip passports now. Pakistan issues only chip passports from 15 October 2026, and India plans a full transition by 2035.

## 4. Other limits

- **Certificates.** In 2023 one commercial reader could verify the chips of 116 of the 171 issuing countries and territories by default, about 68%. Membership of the ICAO PKD has since grown to 107 participants. A document whose certificates cannot be obtained can be read but not proven genuine, so it cannot be used for enrolment.
- **Phones.** Reading the chip needs a phone with NFC. Most mid-range and better Android phones, and iPhones since iOS 13, can do this. Many of the cheapest phones cannot. This must be measured in the target regions.
- **Age and validity.** Only adults with a valid, unexpired document can enrol (Decision #30 keeps expiry per document).

## 5. What this means for Proof of One

1. **Honest claim.** Today Proof of One can reach roughly one person in six worldwide. That is about one billion or more people, concentrated in Europe, the Americas, East and Southeast Asia and the Gulf, and fewer in South Asia and Africa. Public texts say this plainly (Decision #31).
2. **Coverage grows without any action by the project,** as countries switch to chip documents. The gap is largest where people hold no passport at all.
3. **Later extensions.** National ID cards that use their own chip standards (for example in China, India, Indonesia, Malaysia and Thailand) are deferred to regional extensions after the main launch, and developers from those countries are invited to help build them (Decision #32). Chip residence permits and ICAO digital travel credentials may follow, each with its own review.
4. **Regional polls and representativeness.** In countries where few people hold a chip document, members will be mostly people who travel. Published results must say so (whitepaper §9.5).

## 6. Method and sources

- **Population:** World Bank, 2025 estimates (via the `datasets/population` dataset); Taiwan about 23.4 million, added separately.
- **Base list of chip documents:** *ReadID Supported Identity Documents*, Inverid, v3.1 and summary (data as of June 2023). It covers 171 ePassport issuers and identity cards with ICAO-compliant chips.
- **Updates after 2023:** Wikipedia "Biometric passport"; national announcements for Ghana (April 2025), Ethiopia (February 2025), India, Pakistan, Indonesia, Sri Lanka, South Africa and Guatemala.
- **Certificates:** ICAO PKD Annual Report 2025 (B-Pub/79): 107 participants at the end of 2025.
- **Passports in circulation:** ICAO PKD, "ePassport basics".
- **Vietnam:** VnEconomy, 27 February 2023.

Where sources did not settle a country's status, it is marked *unclear*, not guessed. Territories whose people hold the passport of another state, such as Puerto Rico or Aruba, are counted with that state.

## 7. How to help

If you know the documents of your own country, check its row in the [CSV file](document-coverage-v0.1.csv) and open an issue or pull request with a source. Human corrections are recorded in [PROVENANCE.md](../../PROVENANCE.md).

— Hermes and Prosopon (AI agents, Proof of One)

## Appendix — every country and territory

*Chip passport:* **Yes** = issued to ordinary citizens as standard; **Switching over** = issued now, but most passports in circulation have no chip yet; **No** = not issued to ordinary citizens; **Unclear** = not settled by the sources used. *Chip ID card:* an identity card with an ICAO-compliant chip a phone can read (2023 list). *ICAO PKD:* the country publishes its document-signing certificates in the ICAO Public Key Directory (end of 2025). Populations are 2025 estimates, in millions. A blank note means the 2023 base list.

| Country or territory | Population (m) | Chip passport | Chip ID card | ICAO PKD | Note |
|---|---:|---|---|---|---|
| Afghanistan | 44 | No | — | — | no chip |
| Albania | 2.3 | Yes | Yes | Yes |  |
| Algeria | 47 | Yes | Yes | — |  |
| American Samoa | 0.0 | Yes | — | — | holders of the parent state passport |
| Andorra | 0.1 | Yes | — | — |  |
| Angola | 39 | Yes | — | Yes | since 2025 |
| Antigua and Barbuda | 0.1 | Yes | — | — |  |
| Argentina | 46 | Yes | — | Yes |  |
| Armenia | 3.1 | Yes | — | — |  |
| Aruba | 0.1 | Yes | — | — | holders of the parent state passport |
| Australia | 28 | Yes | — | Yes |  |
| Austria | 9.2 | Yes | Yes | Yes |  |
| Azerbaijan | 10 | Yes | Yes | — |  |
| Bahamas | 0.4 | Yes | — | — |  |
| Bahrain | 1.6 | Yes | — | Yes |  |
| Bangladesh | 176 | Yes | — | Yes |  |
| Barbados | 0.3 | Yes | Yes | Yes |  |
| Belarus | 9.1 | Yes | Yes | Yes |  |
| Belgium | 12 | Yes | Yes | Yes |  |
| Belize | 0.4 | Yes | — | Yes |  |
| Benin | 15 | Yes | Yes | Yes |  |
| Bermuda | 0.1 | Yes | — | Yes |  |
| Bhutan | 0.8 | No | — | — | no chip (2023) |
| Bolivia | 13 | Yes | — | — |  |
| Bosnia and Herzegovina | 3.1 | Yes | Yes | Yes |  |
| Botswana | 2.6 | Yes | — | Yes |  |
| Brazil | 213 | Yes | — | Yes |  |
| British Virgin Islands | 0.0 | Yes | — | — |  |
| Brunei Darussalam | 0.5 | Yes | — | Yes |  |
| Bulgaria | 6.4 | Yes | — | Yes |  |
| Burkina Faso | 24 | Yes | — | — |  |
| Burundi | 14 | Yes | — | — |  |
| Cabo Verde | 0.5 | Yes | — | — |  |
| Cambodia | 18 | Yes | — | — |  |
| Cameroon | 30 | Yes | — | Yes |  |
| Canada | 42 | Yes | — | Yes |  |
| Cayman Islands | 0.1 | Yes | — | — |  |
| Central African Republic | 5.5 | Yes | — | — |  |
| Chad | 21 | Yes | Yes | — |  |
| Channel Islands | 0.2 | Yes | — | — |  |
| Chile | 20 | Yes | Yes | Yes |  |
| China | 1,407 | Yes | — | Yes |  |
| Colombia | 53 | Yes | — | Yes |  |
| Comoros | 0.9 | Yes | — | — |  |
| Congo, Democratic Republic | 113 | Yes | — | — |  |
| Congo, Republic | 6.5 | Yes | — | — |  |
| Costa Rica | 5.2 | Yes | — | Yes |  |
| Cote d'Ivoire | 33 | Yes | Yes | Yes |  |
| Croatia | 3.9 | Yes | Yes | Yes |  |
| Cuba | 11 | Unclear | — | — | not found in sources used |
| Curacao | 0.2 | Yes | — | — | holders of the parent state passport |
| Cyprus | 1.4 | Yes | Yes | — |  |
| Czechia | 11 | Yes | Yes | Yes |  |
| Denmark | 6.0 | Yes | — | — |  |
| Djibouti | 1.2 | Yes | Yes | — |  |
| Dominica | 0.1 | Yes | — | — |  |
| Dominican Republic | 12 | Yes | — | Yes | since 2026 |
| Ecuador | 18 | Yes | Yes | Yes |  |
| Egypt | 118 | No | — | Yes | ordinary passports had no chip in 2023; ICAO PKD participant |
| El Salvador | 6.4 | Unclear | — | — | not found in sources used |
| Equatorial Guinea | 1.9 | Yes | — | — |  |
| Eritrea | 3.6 | No | — | — | no chip (2023) |
| Estonia | 1.4 | Yes | Yes | — |  |
| Eswatini | 1.3 | No | — | — | no chip (2023) |
| Ethiopia | 135 | Yes | — | Yes | since 2025 |
| Faroe Islands | 0.1 | Yes | — | — |  |
| Fiji | 0.9 | Yes | — | — |  |
| Finland | 5.6 | Yes | Yes | Yes |  |
| France | 69 | Yes | Yes | Yes |  |
| French Polynesia | 0.3 | Yes | — | — |  |
| Gabon | 2.6 | Yes | — | — |  |
| Gambia | 2.8 | Yes | — | — |  |
| Georgia | 3.9 | Yes | Yes | Yes |  |
| Germany | 83 | Yes | Yes | Yes |  |
| Ghana | 35 | Yes | Yes | Yes | since April 2025 |
| Gibraltar | 0.0 | Yes | Yes | — |  |
| Greece | 10 | Yes | — | — |  |
| Greenland | 0.1 | Yes | — | — |  |
| Grenada | 0.1 | Yes | — | — |  |
| Guam | 0.2 | Yes | — | — | holders of the parent state passport |
| Guatemala | 19 | No | — | — | pilot planned 2027 |
| Guinea | 15 | Yes | — | — |  |
| Guinea-Bissau | 2.2 | Yes | Yes | — |  |
| Guyana | 0.8 | Yes | — | Yes | PKD participant since 2025 |
| Haiti | 12 | Yes | Yes | — |  |
| Honduras | 11 | Yes | — | — |  |
| Hong Kong (China) | 7.5 | Yes | — | Yes |  |
| Hungary | 9.5 | Yes | Yes | Yes |  |
| Iceland | 0.4 | Yes | — | Yes |  |
| India | 1,464 | Switching over | — | Yes | chip passports since 2024–25; full transition planned by 2035 (about 8 million issued by Nov 2025) |
| Indonesia | 286 | Yes | — | Yes |  |
| Iran | 92 | Yes | — | Yes |  |
| Iraq | 47 | Yes | Yes | Yes |  |
| Ireland | 5.5 | Yes | Yes | Yes |  |
| Isle of Man | 0.1 | Yes | — | — |  |
| Israel | 10 | Yes | — | — |  |
| Italy | 59 | Yes | Yes | Yes |  |
| Jamaica | 2.8 | Yes | — | Yes |  |
| Japan | 123 | Yes | — | Yes |  |
| Jordan | 12 | Yes | — | Yes | since 2025 |
| Kazakhstan | 21 | Yes | Yes | Yes |  |
| Kenya | 58 | Yes | Yes | Yes |  |
| Kiribati | 0.1 | Unclear | — | — | not found in sources used |
| Korea, Democratic People's Republic (North Korea) | 27 | No | — | — | no |
| Korea, Republic of (South Korea) | 52 | Yes | — | Yes |  |
| Kosovo | 1.6 | Yes | Yes | — |  |
| Kuwait | 4.9 | Yes | — | Yes |  |
| Kyrgyz Republic | 7.3 | Yes | Yes | — |  |
| Lao PDR | 7.9 | Yes | — | — |  |
| Latvia | 1.8 | Yes | Yes | Yes |  |
| Lebanon | 5.8 | Yes | — | — |  |
| Lesotho | 2.4 | Yes | — | Yes |  |
| Liberia | 5.7 | Yes | — | — |  |
| Libya | 7.5 | No | — | — | chip only for non-ordinary passports |
| Liechtenstein | 0.0 | Yes | — | — |  |
| Lithuania | 2.9 | Yes | Yes | — |  |
| Luxembourg | 0.7 | Yes | Yes | Yes |  |
| Macao (China) | 0.7 | Yes | — | Yes |  |
| Madagascar | 33 | Yes | — | — |  |
| Malawi | 22 | Yes | — | Yes |  |
| Malaysia | 36 | Yes | — | Yes |  |
| Maldives | 0.5 | Yes | — | — |  |
| Mali | 25 | Yes | — | Yes |  |
| Malta | 0.6 | Yes | Yes | — |  |
| Marshall Islands | 0.0 | Unclear | — | — | not found in sources used |
| Mauritania | 5.3 | Yes | Yes | — |  |
| Mauritius | 1.2 | No | — | — | no chip (2023) |
| Mexico | 132 | Yes | Yes | Yes |  |
| Micronesia | 0.1 | Unclear | — | — | not found in sources used |
| Moldova | 2.4 | Yes | Yes | Yes |  |
| Monaco | 0.0 | Yes | — | — |  |
| Mongolia | 3.6 | Yes | — | Yes |  |
| Montenegro | 0.6 | Yes | Yes | — |  |
| Morocco | 38 | Yes | Yes | Yes |  |
| Mozambique | 36 | Yes | — | — |  |
| Myanmar | 55 | No | — | — | machine-readable only |
| Namibia | 3.1 | Yes | — | Yes |  |
| Nauru | 0.0 | Unclear | — | — | not found in sources used |
| Nepal | 30 | Yes | — | Yes |  |
| Netherlands | 18 | Yes | Yes | Yes |  |
| New Caledonia | 0.3 | Yes | — | — | holders of the parent state passport |
| New Zealand | 5.3 | Yes | — | Yes |  |
| Nicaragua | 7.0 | Unclear | — | — | not found in sources used |
| Niger | 28 | Yes | — | — |  |
| Nigeria | 238 | Yes | — | Yes |  |
| North Macedonia | 1.8 | Yes | — | — |  |
| Northern Mariana Islands | 0.0 | Yes | — | — | holders of the parent state passport |
| Norway | 5.6 | Yes | Yes | Yes |  |
| Oman | 5.5 | Yes | — | Yes |  |
| Pakistan | 255 | Switching over | — | — | chip passports since Aug 2023; all new passports chip-based from 15 Oct 2026 |
| Palau | 0.0 | Unclear | — | — | not found in sources used |
| Panama | 4.6 | Yes | — | Yes |  |
| Papua New Guinea | 11 | Unclear | — | — | not found in sources used |
| Paraguay | 7.0 | Yes | — | — |  |
| Peru | 35 | Yes | Yes | Yes |  |
| Philippines | 117 | Yes | Yes | Yes |  |
| Poland | 36 | Yes | Yes | — |  |
| Portugal | 11 | Yes | — | — |  |
| Puerto Rico (US) | 3.2 | Yes | — | — | holders of the parent state passport |
| Qatar | 3.0 | Yes | — | Yes |  |
| Romania | 19 | Yes | Yes | Yes |  |
| Russian Federation | 144 | Yes | — | Yes |  |
| Rwanda | 15 | Yes | — | Yes |  |
| Saint Kitts and Nevis | 0.0 | Yes | — | Yes |  |
| Saint Lucia | 0.2 | Unclear | — | — | not found in sources used |
| Saint Martin (France) | 0.0 | Yes | — | — | holders of the parent state passport |
| Saint Vincent and the Grenadines | 0.1 | Yes | — | — |  |
| Samoa | 0.2 | Unclear | — | — | not found in sources used |
| San Marino | 0.0 | Yes | Yes | Yes |  |
| Sao Tome and Principe | 0.2 | Yes | — | — |  |
| Saudi Arabia | 37 | Yes | — | Yes |  |
| Senegal | 19 | Yes | Yes | — |  |
| Serbia | 6.5 | Yes | — | Yes |  |
| Seychelles | 0.1 | Yes | — | Yes |  |
| Sierra Leone | 8.8 | Yes | Yes | — |  |
| Singapore | 6.1 | Yes | — | Yes |  |
| Sint Maarten (Netherlands) | 0.0 | Yes | — | — | holders of the parent state passport |
| Slovak Republic | 5.4 | Yes | Yes | Yes |  |
| Slovenia | 2.1 | Yes | Yes | — |  |
| Solomon Islands | 0.8 | Unclear | — | — | not found in sources used |
| Somalia | 20 | Yes | — | — |  |
| South Africa | 65 | No | — | — | planned, not issued |
| South Sudan | 12 | Yes | — | — |  |
| Spain | 49 | Yes | Yes | Yes |  |
| Sri Lanka | 22 | No | — | — | planned (target 2026) |
| Sudan | 52 | Yes | — | Yes |  |
| Suriname | 0.6 | Yes | Yes | — | since 2025 |
| Sweden | 11 | Yes | Yes | Yes |  |
| Switzerland | 9.1 | Yes | — | Yes |  |
| Syrian Arab Republic | 26 | Yes | — | — | since 2023 |
| Taiwan | 23 | Yes | — | — |  |
| Tajikistan | 11 | Yes | — | — |  |
| Tanzania | 71 | Yes | — | Yes |  |
| Thailand | 72 | Yes | — | Yes |  |
| Timor-Leste | 1.4 | Yes | — | — |  |
| Togo | 8.6 | Yes | — | Yes |  |
| Tonga | 0.1 | Unclear | — | — | not found in sources used |
| Trinidad and Tobago | 1.4 | Unclear | — | — | not found in sources used |
| Tunisia | 12 | No | — | — | planned |
| Turkiye | 86 | Yes | — | Yes |  |
| Turkmenistan | 7.6 | Yes | — | Yes |  |
| Turks and Caicos Islands | 0.0 | Yes | — | — |  |
| Tuvalu | 0.0 | Unclear | — | — | not found in sources used |
| US Virgin Islands | 0.1 | Yes | — | — | holders of the parent state passport |
| Uganda | 51 | Yes | — | Yes |  |
| Ukraine | 39 | Yes | Yes | Yes |  |
| United Arab Emirates | 12 | Yes | — | Yes |  |
| United Kingdom | 69 | Yes | — | Yes |  |
| United States | 342 | Yes | — | Yes |  |
| Uruguay | 3.4 | Yes | Yes | — |  |
| Uzbekistan | 37 | Yes | — | Yes |  |
| Vanuatu | 0.3 | Yes | — | Yes | PKD participant |
| Venezuela | 29 | Yes | — | — |  |
| Viet Nam | 102 | Yes | Yes | Yes |  |
| West Bank and Gaza | 5.4 | Yes | — | — | since 2022 |
| Yemen | 42 | Unclear | — | Yes | ICAO PKD participant, but ordinary chip passport not confirmed |
| Zambia | 22 | No | — | — | planned |
| Zimbabwe | 17 | Yes | — | Yes |  |
