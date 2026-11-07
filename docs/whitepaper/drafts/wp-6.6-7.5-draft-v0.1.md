# Whitepaper §6.6 and §7.5, approved text for the next version (activity 0.16-02; approved 7 November 2026, Decision Log #51)

*Replaces the text of whitepaper v0.9, §6.6 and the protocol box of §7.5. Based on the [personal-number survey](../../research/personal-number-survey-v0.1.md) and the [checklist](../../research/personal-number-checklist-v0.1.md), with 30 specimens read on 3 November 2026.*

---

### 6.6 Layer 1 — document uniqueness

The phone derives a **document fingerprint** from signed fields of the document through an oblivious pseudorandom function (OPRF) whose key is held by the uniqueness service (7.5). There are two paths (Decision Log #43). The trust list decides, issuer by issuer, which path a document takes (7.3).

- **Number path.** Many states assign each person a national number. Some write it into the signed data of the passport chip, either in the optional field of the machine-readable zone or in data group DG11. For such issuers the fingerprint is derived from the issuing state, that number, date of birth and sex. It is unique to the person and stays the same when the passport is renewed. Of the 30 European states whose specimen passports are public, 15 put the number in the machine-readable zone and 14 do not; whether any of them use DG11 instead has not yet been confirmed.
- **Name path.** For all other documents the fingerprint is derived from the issuing state, the name as written in the machine-readable zone, date of birth and sex. These fields are not unique: two people can share them, especially with common names in large countries or where documents carry a default birth date such as 1 January. A match is therefore **a signal, not a verdict**: the enclave compares the new face with the stored template of the member with that fingerprint. The same face means the person is already enrolled and is guided to recovery or to adding the document (6.10, 6.12). A clearly different face means a different person, who is enrolled and counted in the issuer statistics (6.7, step 4).

**The name path is not an exception.** It covers about half of the European states read so far, including Germany, France, Italy and Poland, and most of the rest of the world. It must be designed, tested and measured to the same standard as the number path. How often name-based fingerprints collide is to be measured before launch.

**Rules for the number path.** An issuer uses the number path only if all four hold:

1. Where the number sits in the signed data, and in what form, is confirmed for **every series of its passports that is still valid**. A number printed on the data page is not enough: Poland prints it but leaves it out of the machine-readable zone.
2. The exact form of the number is fixed. Issuers write the same number differently: Sweden adds the century, and Finland, Denmark, Iceland and Latvia replace the separator with `<`. The trust-list rule states the normalisation, so that a renewed passport gives the same fingerprint.
3. The issuer has not removed the number from some of its valid passports. The Netherlands removed it from passports issued from August 2021, while older passports with it remain valid until 2031. If such an issuer used the number path, a member's fingerprint would change at renewal. Such issuers take the name path for all their documents.
4. An unclear field is not used. For example, Luxembourg's specimen holds a number that the data page does not show.

An error in these rules can only move an issuer to the name path, which is weaker; it cannot produce a wrong fingerprint.

**Document key (Decision Log #47).** Besides the fingerprint, which identifies the person, each enrolled document gets a **document key** derived from its issuing state and document number. The key is valid until the document expires. A new enrolment is handled as follows:

| Document key | Person fingerprint | Face | Meaning | Action |
|---|---|---|---|---|
| Known | — | — | The same document again | Refused at once, without a face comparison |
| New | Known, same issuer | Matches | A renewed passport | The document key is replaced |
| New | Known, another issuer | Matches | Another nationality | A document key is added (6.12) |
| New | Known | Clearly different | Another person who shares name-path fields | Enrolled; counted in issuer statistics |
| New | New | — | A new member, unless the face search finds them (6.7) | Face search, then enrolment |

The system works out which case applies and asks the member only to confirm. The app reminds the member before a document expires.

**Numbers can change.** A national number is usually stable, but not always. States issue new numbers when a registered birth date or sex is corrected or changed, and some allow a change after identity theft. A changed number, like a changed name, gives a new fingerprint. Such a person is still found by the face search, which runs for every enrolment (6.7). Where the birth date or sex also changed, only the strict search over all members applies, so detection is likely but not guaranteed.

The document number is not used, because it changes with every renewal.

These fields have few enough combinations that a plain hash could be reversed by trying them all; the keyed OPRF prevents this, and blinding lets the service evaluate the function without seeing the fields. The personal number never leaves the phone. The phone unblinds the result and sends the fingerprint to the enclave, which compares it with the fingerprints of all members. The service therefore learns the fingerprint, a stable value per person, and keeps it for as long as the person is a member; it is not published. The service **reserves** a fingerprint and face template while an enrolment is in progress, so that two enrolments with one document cannot both pass (6.3, step 6).

### 7.5 Document fingerprint protocol (box)

```
Phone:   rule = trust-list entry for (issuer, document series)
         if rule.path = NUMBER:
             n = normalise(signed field at rule.location, rule.form)
             x = HashToCurve(1 || issuer || n || dateOfBirth || sex)
         else:
             x = HashToCurve(2 || issuer || nameMRZ || dateOfBirth || sex)
         r = random scalar;  B = r · x       (blinded; sent with proof)
Service: Z = k · B, with a DLEQ proof that log_G K = log_B Z,
         where K = k · G is the service's public OPRF key on the ledger
Phone:   checks the proof; F = Hash(x, r⁻¹ · Z)   (document fingerprint)
Enclave: receives F and the path; reserves F; compares it with stored
         fingerprints (a name-path match is checked against the face, 6.6)

Document key (same OPRF, separate domain):
         y = HashToCurve(3 || issuer || documentNumber)
         B' = r' · y;  Z' = k · B' (with a DLEQ proof);  D = Hash(y, r'⁻¹ · Z')
Enclave: a known D is the same document; a new D with a known F is a
         renewal or another nationality (6.6)
```

The leading 1, 2 or 3 separates the two fingerprint paths and the document key, so that none can collide with another. The circuit of 7.4 proves that the fields used are the signed ones at the location the rule names, and that the rule is the one in the trust-list tree; the path is a public output of the proof.

---

## Notes (not part of the whitepaper text)

- The document key (Decision #47, the founder's proposal) is in the 6.6 table and the 7.5 box.

- Item 3 is new. The Netherlands shows that an issuer can remove the number while older passports still carry it. In that case the number path would give one person two fingerprints over time.
- **DG11:** no public source says which states put the national number in DG11. It can be checked only on real chips, for example in the pilot, by counting per issuer whether DG11 holds a number, without keeping any document data. This needs the impact assessment.
- **Uses "issuer", not "nationality":** the state that issued the passport and signed the data, which is what the trust list knows.
