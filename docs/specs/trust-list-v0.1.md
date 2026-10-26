# Trust list of country signing certificates — specification v0.1

*Authors: Prosopon and Themis (AI agents), with Kryptos (AI agent). Schedule activity 0.7; review request [issue #14](https://github.com/NemoUnus/proof-of-one/issues/14). Status: reference tool in [`reference/document-circuit/src/trustlist.js`](../../reference/document-circuit/src/trustlist.js), tested on synthetic lists and run on the real German master list; first published list: [`trust-list-2026-10-26.json`](../research/trust-list-2026-10-26.json). Not audited.*

## 1. Why

A passport is proven genuine by its signature chain: the document signer (DSC) signs the chip data, and the issuing state's country signing CA (CSCA) signs the DSC. Proof of One can only be as trustworthy as its list of CSCA certificates. A field test by the founder showed that this is not a detail: a commercial verifier read a real passport chip correctly but could not build the chain, because it did not hold the issuing country's CSCA certificate, although that country takes part in the ICAO PKD ([document coverage §4](../research/document-coverage-v0.1.md#4-other-limits)).

## 2. Sources and their terms

| Source | What it holds | Terms (as published, October 2026) | Use in Proof of One |
|---|---|---|---|
| **German CSCA master list** (BSI) | 609 CSCA and link certificates from 119 countries or issuers, version of 1 October 2026; a signed ICAO master list | Use is permitted, including commercial use, on two conditions: the list may not be used for advertising, and its use may not suggest cooperation with the BSI | **Primary source.** Read and verified by the tool. Proof of One states that it uses the list and has no relationship with the BSI. |
| **ICAO PKD and ICAO master list** | CSCAs of PKD participants (the ICAO master list holds 450 certificates, July 2024 version); DSCs and CRLs | Free to download by hand. Use is limited to "own personal/organizational non-commercial use"; republishing, repackaging and automated download are not allowed | Each operator or reviewer may download it to **check** the list. Proof of One does **not** republish its contents. Whether the enrolment service may rely on it needs legal review (§7). |
| **States' own publications** | Many states publish their CSCA certificates on official websites | Varies by state | Supplementary source; each entry names the page |

### 2.1 Measured on the German master list (version of 1 October 2026)

The founder downloaded the list from the BSI website, and the tool read it:

| Item | Result |
|---|---|
| Certificates in the list | 609. The list's signature is valid, and its signer was issued by the German CSCA, whose SHA-256 fingerprint `2084aed7…91ada8` matches the one the BSI publishes |
| CA certificates valid on 26 October 2026 | 602, from 117 country codes |
| Coverage | **113 of the 186 countries that issue chip passports**: 81% of their population, about 59% of the world's |
| Not covered | The largest gaps are Nigeria, Ethiopia and DR Congo. 16 ICAO PKD participants, about 8% of the world population, are not in this list; their certificates must come from the PKD (§7) or from the states themselves |
| CSCA key types | RSA-4096 362; RSA-3072 58; ECDSA brainpoolP384r1 54, P-384 38, P-256 23, brainpoolP256r1 22, P-521 22, brainpoolP512r1 16; RSA-6144 6; RSA-2048 1 |

The CSCA key types matter for the public tool, which handles all of them. π_doc proves the **document signer's** signature, and DSC keys are usually smaller and differ from the CSCA's. Which DSC suites to support next is measured on DSC certificates (§4), not on this table.

## 3. References, not copies

The published trust list contains **no certificates**, only references:

```
{ country, sha256 (fingerprint of the certificate), subject, key type and size,
  notBefore, notAfter, sources: ["German master list 2026-10-01", ...] }
listHash = SHA-256 of the sorted fingerprints
```

Anyone can download the same sources, run the same tool and compare `listHash`. This keeps the list auditable (founding property R2) without redistributing material whose terms do not allow it.

**Rules for an entry:**

1. The certificate is a CA certificate and has not expired. A CSCA must stay in the list for as long as documents it signed are valid, so only expired CSCAs leave the list on their own.
2. It comes from a signed master list whose signer was issued by that list's own country CSCA (the **anchor**), or from the issuing state's official website.
3. The anchor of each master list is pinned by fingerprint in the tool (`PINNED`), checked against the issuing authority's own website, and published with the list. A list signed under any other anchor is refused.
4. Entries with a single source are marked. A second independent source is sought for each of them.

## 4. Document signers

π_doc proves membership of the DSC key in a public **tree of checked signers** ([document-validity proof §2](document-validity-proof-v0.1.md)). DSC certificates are needed to build it:

- **From documents themselves.** Every passport carries its DSC certificate in its security object. The certificate is public and carries no personal data. If a phone finds that its DSC is not yet in the tree, it submits the certificate anonymously, in a separate session and well before enrolment. Anyone can check it against the trust list, and it enters the tree at the next update. One DSC signs the documents of many people, so a submission reveals little.
- **From the ICAO PKD**, for checking only, subject to §7.

The tree is rebuilt on a fixed schedule, for example weekly. Each build publishes its root, the list of leaves and the tool version. The enrolment service accepts roots from a published recent window.

## 5. Removal

- Certificate revocation lists (CRLs) published by states are applied at each build.
- A certificate found to be compromised is added to a public **exclusion list** with a reason code and date. The next build drops it and every DSC it issued.
- Identities enrolled under an excluded certificate are revoked through the normal revocation registry, and the count is published.

## 6. Documents that cannot be verified (decision needed)

When a person's document is genuine but its CSCA is not in the list, three answers are possible:

| Option | What happens | Assessment |
|---|---|---|
| **A. Refuse openly (proposed)** | The app says the document cannot be verified yet, explains why, lets the person ask to be notified, and the public coverage page shows the country as "not yet verifiable" | Keeps the guarantee intact; honest; creates pressure to find a source |
| B. Provisional identity | Enrol with an "unverified" flag, excluded from polls by default | Weakens the core guarantee; a forged document could enter this way |
| C. Manual review | A person checks the document | Impossible without seeing the document; contradicts anonymity |

## 7. Open points

- **Legal:** may the enrolment service rely on ICAO PKD downloads under "organizational non-commercial use", given that businesses will pay for verification (Decision Log #36)? Until answered, PKD material is used only by reviewers to check the list, never by the service.
- **Coverage of document signers:** which key types and signature suites DSCs use. This decides which suites π_doc supports next. It needs DSC certificates (§4).
- **Missing countries:** a source for the CSCAs of chip-passport countries that are not in the German list.
- **Anchors:** how the anchor fingerprints are confirmed (several independent fetches of the authority's website; human reviewers).

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
