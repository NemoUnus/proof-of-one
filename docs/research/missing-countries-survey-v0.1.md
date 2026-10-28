# Chip-passport countries not yet verifiable: survey v0.1

*Authors: Prosopon and Metron (AI agents). Schedule tasks 0.12-03 and 0.12-05. Status: first pass, 28 October 2026. Based on the trust list built from the German and ICAO master lists ([trust list §2.2](../specs/trust-list-v0.1.md)) and on web searches for official publications. Data: [`coverage-by-country-2026-10-28.csv`](coverage-by-country-2026-10-28.csv).*

## 1. Two corrections to the coverage count

Re-checking the 64 "missing" countries found two counting errors. Both make coverage higher, not lower.

- **Kosovo.** Its certificates carry the country code `KS`, which is not an ISO code, so they were not matched. Kosovo is covered.
- **Territories whose residents hold the parent state's passport.** For eleven territories the coverage study already noted this: Puerto Rico, Guam, American Samoa, the US Virgin Islands and the Northern Mariana Islands (United States); New Caledonia, French Polynesia and Saint Martin (France); Curaçao, Aruba and Sint Maarten (Netherlands). Their parent states are covered, so they are too.

| | Before | After the corrections |
|---|---|---|
| Chip-passport countries verifiable now | 122 of 186 | **134 of 186** |
| Share of the population of those countries | 91% | 91% |
| Share of the world population | 67% | 67% |
| Not yet verifiable | 64 countries | **52 countries, about 6.5% of the world population** |

The corrections add many places but few people, so the population shares barely move.

## 2. The 52 countries not yet verifiable

| Group | Countries | Population | Likely route |
|---|---|---|---|
| **ICAO PKD participants missing from the ICAO master list** | Mali, Malawi, Hong Kong (China), Lesotho, Guyana, Macao (China), Brunei, Vanuatu | about 0.7% of the world | Their certificates are in the PKD but not in the master list. Ask each state, or wait for a later master list |
| **Largest gaps** | DR Congo, Madagascar, Venezuela, Niger, Syria, Burkina Faso, Chad, Somalia, Senegal, Cambodia, Guinea, Burundi, Bolivia, South Sudan, Haiti, Honduras, Sierra Leone, Laos, Kyrgyzstan, Republic of the Congo, Liberia, Central African Republic, Palestine, Mauritania, Armenia | about 5.6% | No official publication found in this pass. Ask the issuing authority directly, or wait for PKD membership |
| **Small states** | Gambia, Gabon, Guinea-Bissau, Equatorial Guinea, Djibouti, Fiji, Comoros, Suriname, Cabo Verde, São Tomé and Príncipe, Grenada, Cayman Islands, Turks and Caicos Islands, British Virgin Islands | about 0.2% | As above |
| **Probably verifiable already, to be confirmed** | Channel Islands, Isle of Man, Gibraltar (British passports issued locally); Greenland, Faroe Islands (Danish passports) | under 0.1% | Check one sample document's signer against the UK or Danish certificates. These are not counted as covered until then |

Most of the people still excluded live in countries that have issued chip passports only recently, or whose authorities publish nothing. This matches the design's stated limit: Proof of One can include only people whose state makes its signing certificates verifiable. The public coverage page shows these countries as "not yet verifiable" (Decision Log #39).

## 3. Official publications by states

Some states publish their own CSCA certificates. They serve two purposes:

- They make a country itemisable when its certificate is otherwise known only from the ICAO list (§3.1 of the trust list).
- They give a second independent source for entries that have only one (trust list §3, rule 4).

Found in this pass:

| State | Page | What it offers | Use |
|---|---|---|---|
| Nigeria | [immigration.gov.ng/pki-pkd](https://immigration.gov.ng/pki-pkd/) | Links to the CSCA certificate as .crt and .pem; no fingerprint published. **On 28 October 2026 both files could not be downloaded** | Would make Nigeria itemisable; to be retried later |
| Australia | [passports.gov.au](https://www.passports.gov.au/australian-country-signing-certificate-authority-csca) | CSCA page | Second source |
| Austria | [bmi.gv.at](https://bmi.gv.at/Downloads/csca.aspx) | CSCA downloads | Second source |
| Bosnia and Herzegovina | [iddeea.gov.ba](https://www.iddeea.gov.ba/en/pki-system-for-digital-signing-of-travel-documents-and-e-ids/) | PKI page | Second source |
| Bulgaria | [mvr.bg](https://mvr.bg/en/ministry/about-ministry-of-internals/usefull-for-you/certificates-for-verification-of-e-documents) | Certificates for verifying e-documents | Second source |
| Iceland | [skra.is](https://www.skra.is/english/people/passport-and-id-card/various-information-on-passports/security-of-icelandic-passports/) | Passport security page | Second source |
| Japan | [mofa.go.jp](https://www.mofa.go.jp/ca/pss/page23e_000598.html) | Consular page on passport certificates | Second source, to be checked |
| Malaysia | [imi.gov.my](https://www.imi.gov.my/index.php/en/main-services/passport/the-malaysian-country-signing-ca-csca-en/) | CSCA page | Second source |
| Malta | [repository.csca.gov.mt](https://repository.csca.gov.mt/pages/services) | CSCA repository | Second source |
| Monaco | [monservicepublic.gouv.mc](https://monservicepublic.gouv.mc/en/themes/nationality-and-residency/monegasque-nationality/identity-documents/country-signer-certificate-authority-csca) | CSCA page | Second source |
| Sweden | [polisen.se](https://polisen.se/fr/service/passeport-et-carte-nationale/swedish-certificates-and-crls/country-signing-certificate-authority-csca-sweden/) | CSCA certificates and CRLs | Second source |
| Switzerland | [bit.admin.ch](https://www.bit.admin.ch/en/sg-pki-csca-production-en) | CSCA production certificates | Second source |
| European Union (laissez-passer) | [eu-csca.jrc.ec.europa.eu](https://eu-csca.jrc.ec.europa.eu/) | CSCA of the EU laissez-passer | Second source |

The agents' machine cannot download files from these sites. The founder downloads them by hand, as with the master lists, and the tool adds each as a source named after its page (task 0.12-04).

## 4. Next steps

1. Retry the Nigerian CSCA files from time to time; download the second sources above (0.12-04).
2. Ask the eight PKD participants missing from the ICAO master list for their CSCA certificates, starting with Mali, Malawi and Hong Kong. Draft letters are prepared by the AI team.
3. Confirm the five "probably verifiable" territories with one sample document each.
4. Repeat this survey with each new ICAO or German master list.

— Prosopon and Metron (AI agents, Proof of One)
