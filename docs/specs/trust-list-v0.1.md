# Trust list of country signing certificates — specification v0.1

*Authors: Prosopon and Themis (AI agents), with Kryptos (AI agent). Schedule activity 0.7; review request [issue #14](https://github.com/NemoUnus/proof-of-one/issues/14). Status: reference tool in [`reference/document-circuit/src/trustlist.js`](../../reference/document-circuit/src/trustlist.js), tested on synthetic lists and run on the real German and ICAO master lists. **Revised on 28 October 2026** after a second-model review (§9); published lists: [`trust-list-2026-10-26.json`](../research/trust-list-2026-10-26.json) (German list) and [`trust-list-2026-10-28.json`](../research/trust-list-2026-10-28.json) (German and ICAO lists, Decision Log #40). Not audited.*

## 1. Why

The data on a passport chip is authenticated by a signature chain: the document signer (DSC) signs the chip data, and the issuing state's country signing CA (CSCA) signs the DSC. A valid chain establishes the authenticity and integrity of the signed chip data under the accepted trust policy. It does not establish that the person presenting the passport is its rightful holder, alive, unique or eligible; those are separate checks in the enrolment design. Proof of One's chip check can only be as trustworthy as its list of accepted CSCA certificates, and a trust list is the result of a **trust policy applied to authenticated evidence**, not merely a collection of certificates. A field test by the founder showed that this is not a detail: a commercial verifier read a real passport chip correctly but could not build the chain, because it did not hold the issuing country's CSCA certificate, although that country takes part in the ICAO PKD ([document coverage §4](../research/document-coverage-v0.1.md#4-other-limits)).

## 2. Sources and their terms

| Source | What it holds | Terms (as published, October 2026) | Use in Proof of One |
|---|---|---|---|
| **German CSCA master list** (BSI) | 609 CSCA and link certificates from 119 countries or issuers, version of 1 October 2026; a signed ICAO master list | Use is permitted, including commercial use, on two conditions: the list may not be used for advertising, and its use may not suggest cooperation with the BSI | **Primary source.** Read and verified by the tool. Proof of One states that it uses the list and has no relationship with the BSI. |
| **ICAO PKD and ICAO master list** | CSCAs of PKD participants (the ICAO master list holds 604 certificates, version of 13 October 2026); DSCs and CRLs | Free to download by hand. Use is limited to "own personal/organizational non-commercial use"; republishing and repackaging of its content are not allowed, and the site's terms also restrict automated tools (to be quoted exactly; §9). ICAO describes the list as one distribution channel for PKD participants' CSCAs and leaves each receiving party to set its own trust policy, and warns that it may contain certificates that do not conform to the standards | Each operator or reviewer may download it to **check** the list. Proof of One does **not** republish its contents. The ICAO PKD team replied (27 October 2026) that, while the project is non-commercial with no financial exchange, its current use "could be within the Terms and Conditions" (§7.1). |
| **States' own publications** | Many states publish their CSCA certificates on official websites | Varies by state | Supplementary source; each entry names the page |

### 2.1 Measured on the German master list (version of 1 October 2026)

The founder downloaded the list from the BSI website, and the tool read it:

| Item | Result |
|---|---|
| Certificates in the list | 609. The list's signature is valid, and its signer was issued by the German CSCA, whose SHA-256 fingerprint `2084aed7…91ada8` matches the one the BSI publishes |
| CA certificates valid on 26 October 2026 | 602, from 117 country codes |
| Coverage | **113 of the 186 countries that issue chip passports**: 81% of their population, about 59% of the world's |
| Not covered | The largest gaps are Nigeria, Ethiopia and DR Congo. 16 ICAO PKD participants, about 8% of the world population, are not in this list; their certificates must come from the PKD (§7) or from the states themselves |
| CSCA and link certificates by public-key type (certificates, not unique keys) | RSA-4096 362; RSA-3072 58; ECDSA brainpoolP384r1 54, P-384 38, P-256 23, brainpoolP256r1 22, P-521 22, brainpoolP512r1 16; RSA-6144 6; RSA-2048 1 |

The CSCA key types matter for the public tool, which handles all of them. π_doc proves the **document signer's** signature, and DSC keys are usually smaller and differ from the CSCA's. Which DSC suites to support next is measured on DSC certificates (§4), not on this table.

### 2.2 Measured with the ICAO master list added (27 October 2026)

The founder downloaded the ICAO master list of 13 October 2026 by hand, under the public terms (§7.1), and the tool read it together with the German list:

| Item | Result |
|---|---|
| ICAO master list | 604 certificates. The list's signature is valid. Its signer, the ICAO Master List Signer, was issued by the **United Nations CSCA**. ICAO does not publish that certificate's fingerprint. The evidence used instead: a certificate with exactly the same SHA-256 fingerprint is an entry of the German master list, which is verified under the pinned German anchor. The full trust path is given in §3.2 |
| Both lists merged; certificates that are CA certificates (CSCA or link) and within their X.509 validity period on 27 October 2026, deduplicated by certificate fingerprint | 662 CA certificates from 129 country codes: 86 in both lists, 31 in the German list only, 12 in the ICAO list only |
| Coverage | **122 of the 186 countries that issue chip passports**, weighted by population: 91% of their population, about 67% of the world's. This is population-weighted issuer coverage, not the share of people who can enrol: that also depends on owning a chip passport, its signer being accepted, and the phone. The German list alone gives 112 (one certificate expired since §2.1). The ICAO list adds ten chip-passport countries, among them Nigeria, Ethiopia, Sudan and Ghana |
| Still missing | 64 chip-passport countries. Only 8 of them take part in the ICAO PKD (less than 1% of the world population); the rest must come from the states' own publications (§2) |
| After two counting corrections (28 October) | **134 of 186** verifiable: Kosovo's certificates use the code `KS`, and eleven territories use their parent state's passport. 52 countries, about 6.5% of the world population, remain; see the [survey of missing countries](../research/missing-countries-survey-v0.1.md) and the [coverage by country](../research/coverage-by-country-2026-10-28.csv) |

The merged list is published as [`trust-list-2026-10-28.json`](../research/trust-list-2026-10-28.json), in the form ICAO suggested (§3.1, Decision Log #40): the ICAO list appears as one reference to the whole file, and only entries carried by the German list are itemised (602 of 662). Anyone who downloads both files, checks their SHA-256 against the published values and runs the tool gets the same `listHash` (`a1684c94…6fc561b`).

## 3. References, not copies

The published trust list contains **no certificates**, only references:

```
{ country, sha256 (fingerprint of the certificate), subject, key type and size,
  notBefore, notAfter, sources: ["German master list 2026-10-01", ...] }
listHash = SHA-256 of the sorted fingerprints
```

Anyone can download the same sources, run the same tool and compare `listHash`. This gives **reproducibility of the computation**: with the same source files, tool version, policy and exclusions, the same list results. It does not by itself show that the sources were authentic, that the anchors and policy are right, or that the sources stay available; those are covered by §3.2 and the open work in §9. It avoids redistributing certificates, but derived metadata (fingerprints, subjects, validity) is still published; for the ICAO list even that is withheld (§3.1).

**`listHash`, exactly:** the entries are ordered by country code, then by fingerprint, comparing plain ASCII strings; `listHash` is the SHA-256 of their lowercase hexadecimal SHA-256 certificate fingerprints, in that order, joined by a line feed with no trailing line feed. It commits to the set of certificates only, not to the sources, policy or exclusions; a versioned build manifest that commits to those is open work (§9).

**Rules for an entry:**

1. The certificate is a CA certificate and has not expired. A CSCA must stay in the list for as long as documents it signed are valid, so only expired CSCAs leave the list on their own.
2. It comes from a signed master list whose signer was issued by that list's own country CSCA (the **anchor**), or from the issuing state's official website.
3. The anchor of each master list is pinned by fingerprint in the tool (`PINNED`), checked against the issuing authority's own website or, where the authority publishes none, against another list already verified (§2.2), and published with the list. A list signed under any other anchor is refused.
4. Entries with a single source are marked. A second independent source is sought for each of them.

### 3.1 Sources referenced as a whole (Decision Log #40)

The ICAO PKD team was asked whether publishing per-certificate references would be acceptable. It answered (28 October 2026) that this might contravene the Terms and Conditions' ban on republishing "any portion" of the list, and suggested referencing the use of the whole list instead, since anyone can download it from the ICAO website. The project follows that suggestion:

- A source whose terms do not allow itemising (marked `itemise: false` in `PINNED`) is published as **one reference**: file name and version, SHA-256 of the file, signer and anchor, number of certificates.
- Entries carried only by such a source are **not itemised**. Entries also carried by an itemised source are listed, naming only the itemised source.
- `listHash` still covers every entry, so the whole list stays reproducible from the public files.
- If a certificate known only from a whole-list source must be excluded (§5), the exclusion is agreed with the source's owner before anything about it is published.

### 3.2 The two trust paths, in full

Both paths authenticate a **distribution file** (a master list); a separate chain (SOD → DSC → CSCA) authenticates document data.

| Step | German master list | ICAO master list |
|---|---|---|
| File (SHA-256 of the downloaded bytes) | `DE_ML_2026-10-01-11-50-52.ml`: `2bc0f28b35d83f2fc2d1495b1c715add358dfb9ba343e9788bc27a19ced13a9f` | `ICAO_ML_20261013112327.ml`: `fcb9cce9fb738b9c8c9af69ed1f8cd2203aa1212dffaccdce2fea2b3295ab31f` |
| CMS signature over the list | verified | verified |
| List signer | `C=DE, O=bund, OU=bsi, serialNumber=0039, CN=CSCA Master List Signer`, SHA-256 `3305905a014daeb0eabd8449875508f4611a992db331c08117f35654a6e4fc81` | `C=UN, O=United Nations, OU=Master List Signers, CN=ICAO Master List Signer`, SHA-256 `087828b1397883672896eed2188090eae2b32c48b9d8ce3c3a1d7f9a1a850db3` |
| Signer certificate verified under | `C=DE, O=bund, OU=bsi, CN=csca-germany` (valid 2024-10-01 to 2039-01-01) | `C=UN, O=United Nations, OU=Certification Authorities, CN=United Nations CSCA` (valid 2022-06-14 to 2032-06-14) |
| Anchor fingerprint (SHA-256) | `2084aed7a991b3158e63ad750d3dc38bc6c9dcf5958f28d1162f49884e91ada8` | `920693cd1283824ffdf48a3579fc35528122f3de46bab2ecdaef402db6d92e4e` |
| Why the anchor is accepted | The BSI publishes this fingerprint on its own website; compared on 26 October 2026 by the AI team (fetching the BSI page once) and again on 29 October 2026 by the founder, from a different network and browser: the page lists it for "CSCA-Certificate (Certificate 10/24, self-signed)" | ICAO states that its list signer is issued by the United Nations CSCA but does not publish the fingerprint. A certificate with this exact fingerprint is a CSCA entry of the German list (the UN issues travel documents), so the German path vouches for it. This makes the ICAO path **depend on the German one** |

What this establishes and what it does not:

- It establishes that each file is unaltered and was signed by a key that chains to the stated anchor.
- It does not establish that every certificate in either list should be accepted for every document. List membership is evidence, not a policy; a full CSCA acceptance profile is open work (§9).
- The German anchor rests on two checks of the BSI website, by different people over different networks (26 and 29 October 2026). Both read the same website, so they protect against a fault in one fetch, not against a compromise of the website itself; checks by independent human reviewers are still wanted. A governance rule for changes to `PINNED` (who approves, how changes are reviewed and recorded) are open work (§9).

## 4. Document signers

π_doc proves membership of the DSC key in a public **tree of checked signers** ([document-validity proof §2](document-validity-proof-v0.1.md)). DSC certificates are needed to build it:

- **From documents themselves.** Every passport carries its DSC certificate in its security object. The certificate is public and carries no personal data. If a phone finds that its DSC is not yet in the tree, it submits the certificate in a separate session and well before enrolment. Anyone can check that the DSC's signature verifies under a CSCA in the trust list (`checkDsc`), and it enters the tree at the next update. One DSC signs the documents of many people, but a submission can still reveal the issuer and period of a document, and timing can link it to a later enrolment; the transport (batching, delay, relay) is open work in the threat model (§9). The tree leaf commits to the signature algorithm and the full public key ([document-validity proof §2](document-validity-proof-v0.1.md)).
- **From the ICAO PKD**, for checking only, subject to §7.

The tree is rebuilt on a fixed schedule, for example weekly. Each build publishes its root, the list of leaves and the tool version. The enrolment service accepts roots from a published recent window. Its length, root expiry, and how users detect a forked or withheld tree are open work (§9).

## 5. Removal

- Certificate revocation lists (CRLs) published by states are applied at each build.
- A certificate found to be compromised is added to a public **exclusion list** with a reason code and date. The next build drops it and every DSC it issued.
- Identities enrolled under an excluded certificate are revoked through the normal revocation registry, and the count is published.

## 6. Documents that cannot be verified (Decision Log #39: option A)

When a person's document is genuine but its CSCA is not in the list, three answers are possible:

| Option | What happens | Assessment |
|---|---|---|
| **A. Refuse openly (decided, #39)** | The app says the document cannot be verified yet, explains why, lets the person ask to be notified, and the public coverage page shows the country as "not yet verifiable" | Keeps the rule that enrolment requires a signer chain accepted by the current trust policy; honest; creates pressure to find a source |
| B. Provisional identity | Enrol with an "unverified" flag, excluded from polls by default | Weakens the core guarantee; a forged document could enter this way |
| C. Manual review | A person checks the document | Impossible without seeing the document; contradicts anonymity |

## 7. Open points

- **Legal:** may the enrolment service rely on ICAO PKD downloads once businesses pay for verification (Decision Log #36)? See §7.1. Until that is settled, PKD material is used by reviewers to check the list and by the test network, never by a paid service.
- **Coverage of document signers:** which key types and signature suites DSCs use. This decides which suites π_doc supports next. It needs DSC certificates (§4).
- **Missing countries:** a source for the CSCAs of chip-passport countries that are not in the German list.
- **Anchors:** how the anchor fingerprints are confirmed (several independent fetches of the authority's website; human reviewers).

### 7.1 Reply from the ICAO PKD team (27 October 2026)

The project asked the ICAO PKD team for written permission to use PKD certificates for verification and to publish fingerprints only. The reply, in summary:

- The only route to written permission today is a free **pilot for private-sector use**, limited to **travel-related** use cases. Proof of One is outside its scope.
- A **paid licensing programme** is planned, expected in 2027. Its use-case limits are not yet set.
- Because Proof of One is non-commercial and no money changes hands at this stage, its current use **could be within the public Terms and Conditions**. ICAO could not say whether or when that might change.
- The team will keep the project's contact for notices about the licensing programme.

What follows for the project:

1. During the specification and test-network phases (to Gate 1), operators and reviewers may download the ICAO master list by hand and use it to check and extend the trust list, under the public terms. The rule against republishing still applies: the published list holds references only (§3).
2. Before any paid service begins (Decision Log #36), the project must either join the licensing programme or rely only on sources whose terms allow it, such as the German master list and states' own publications. This is recorded as a condition of Phase 2.
3. Whether publishing fingerprints alone is acceptable was asked again. ICAO answered on 28 October 2026 that it might contravene the ban on republishing "any portion" and suggested referencing the whole list instead. The project accepted (§3.1, Decision Log #40).

**Status of this correspondence.** The replies are helpful guidance from the ICAO PKD team, not a licence, waiver or formal legal interpretation. The project does not rely on them as legal authorisation; written permission or qualified legal advice is required before any production or paid use.

## 8. Reference implementation

- `reference/document-circuit/src/trustlist.js`:
  - `readMasterList`: CMS parsing, message digest, list signature, signer issued by the anchor;
  - `buildTrustList`: merging, expiry, exclusions, `listHash`;
  - `publishable`: references only;
  - `checkDsc`, `keySummary`.
- Verification uses OpenSSL through Node.js, so RSA, RSA-PSS and ECDSA (including brainpool curves) are supported.
- Tests (`reference/document-circuit/test/trustlist.test.js`):
  - reading a signed list;
  - refusing an altered list, a foreign signature or an untrusted anchor;
  - merging with a stable hash;
  - exclusion and expiry;
  - document signers only from a CSCA of their own country;
  - a run on the real German master list against the pinned anchor (skipped when the file is absent; the list itself is not committed).
- Command-line tool: `node bin/trust-list.js <master list files>` prints the published list and its `listHash`.

— Prosopon, Themis and Kryptos (AI agents, Proof of One)

## 9. Second-model review (28 October 2026) and open work

The founder gave this specification to a second AI model (ChatGPT) for a strict review focused on the trust anchors, reproducibility and the ICAO terms. It returned 41 points. This revision corrects the text where it overstated or was imprecise: what a signature chain proves (§1), the ICAO list's role and terms (§2), the counting definitions (§2), the reproducibility claim and the exact `listHash` construction (§3), the full trust paths (§3.2), the DSC submission and tree window (§4), the option-A wording (§6) and the status of the ICAO correspondence (§7.1). The ordering in the tool was also made independent of locale settings; the published `listHash` is unchanged.

One point in the review rests on a misreading: it treated the certificate found in the German list as the ICAO list signer. It is the **United Nations CSCA** that issued the signer, which is the normal structure of a master list (§3.2). The review is right that this makes the ICAO path depend on the German one, and that this must be said.

Open work raised by the review:

| Topic | What is needed |
|---|---|
| CSCA acceptance profile | Certificate classes (CSCA, link), key usage and extensions, algorithms, non-conforming certificates and a published exceptions report |
| Revocation | CRL authentication, freshness, behaviour when a CRL is missing or stale (fail safe, not "no revocation") |
| Historical verification | Separate the active list from an archive of sources, CRLs and timestamps needed to reproduce past decisions |
| Incidents | Compromise interval versus discovery date; affected enrolments; appeals |
| Anchor governance | Checks of each anchor by independent human reviewers (the German anchor has two checks, §3.2); approval and review of changes to `PINNED`; key rollover |
| Build manifest | A versioned manifest committing to sources, tool version, policy and exclusions, in addition to `listHash` |
| Tree consistency | Root publication and expiry, fork and withholding detection, revocation deadlines |
| Source independence | When two sources count as independent |
| DSC submission privacy | Transport model against the operator and network observers |
| ICAO terms | Exact quotations for redistribution and automated retrieval; legal advice before production |
| Tests | Malformed CMS and ASN.1, certificate substitution, conflicting entries, rollover; a tested algorithm matrix |
