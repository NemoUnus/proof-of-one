# Several nationalities, one identity — specification v0.1

*Authors: Psephos and Prosopon (AI agents), with red-team notes by Argus and Themis (AI agents). Implements Decision Log #30. Status: implemented in the reference code ([`reference/`](../../reference/)). Not audited.*

A person with genuine chip documents from more than one country keeps **one** identity, and that identity carries each verified nationality. The member may vote once in the regional polls of each of their nationalities. In global polls, as in every poll, they cast one ballot. This amends [ballot-and-enrolment-v0.1](ballot-and-enrolment-v0.1.md) §2–§4.

## 1. Attributes

| Field | Meaning |
|---|---|
| `ageBand`, `sexCode` | As before |
| `nat_d`, `exp_d` for d = 0, 1, 2 | Nationality code and expiry month of document d. Unused slots are (0, 0). One document per nationality. |

```
attr = Poseidon(ageBand, sexCode, nat_0, exp_0, nat_1, exp_1, nat_2, exp_2, salt)
leaf = Poseidon(idc, attr, rn)
msg  = Poseidon(5, ageBand, sexCode, nat_0, exp_0, nat_1, exp_1, nat_2, exp_2, cm, rn, epoch)
```

The enclave signs `msg`, and π_reg proves the leaf and the signature as before. Three documents are enough for almost all people. A larger number would only make every proof larger.

## 2. Adding or renewing a document

1. The member chooses **Add a document** in the app. The phone reads the new document's chip and takes a live face capture.
2. The enclave runs the usual checks on the new document: chip validity, liveness, and a match between the chip photo and the live face. It also checks two things:
   - the document has not been used by anyone, for a first enrolment or as an added document;
   - the face matches **this** member's existing face template, the one found by the duplicate search.
3. The phone creates a fresh commitment `cm = Poseidon(4, idc, salt', ρ')`. It keeps the same identity secret `s` but uses new `salt'` and `ρ'`, so the enclave cannot link the new commitment to the old leaf.
4. The enclave issues a credential carrying all of the member's documents. A document of a nationality already present replaces the older one, which is how a renewed passport is handled. The enclave also releases the old revocation handle, which is then published (revocation proof π_revoke).
5. The phone registers the new leaf with π_reg. The old identity is revoked for polls created afterwards.

Because `s` is unchanged, the member's nullifier in every poll is unchanged. In a poll that was already open with the old snapshot, the member therefore still has only one ballot.

## 3. Eligibility in the ballot proof

The phone selects one document privately with a one-hot vector `docSel`. π_vote proves:

```
Σ docSel_d = 1, each docSel_d ∈ {0, 1}
natSel = Σ docSel_d · nat_d,   expSel = Σ docSel_d · exp_d
natSel ≠ 0                              (an empty slot cannot be used)
expSel ≥ minExpiryMonth
requiredNat = 0  or  natSel = requiredNat
```

Nothing about the other documents, or about which one was used, appears in the public inputs. The public inputs are unchanged: pollHash, nullifier and ciphertexts. The ballot proof grows by 106 constraints, to **32,535**. The registration proof grows to **9,369**.

## 4. Red-team notes

| # | Point | Handling |
|---|---|---|
| M1 | Dual nationality is sensitive, and some states forbid it | Adding a document is optional. The list stays on the phone and inside the leaf, and each proof reveals only that one nationality matches the poll. |
| M2 | Rare combinations of nationalities could identify a person in breakdowns | Results are never broken down by combination. Breakdown cells use one attribute at a time and the minimum group size. |
| M3 | A state issuing passports to non-nationals could bring them into its regional polls | Same issuer threat as before (whitepaper §12.1). Statistics by document issuer make it visible (Decision #21). |
| M4 | Someone else's document | The enclave requires the chip photo and the live face to match the member's own face template, and each document can be used only once. |
| M5 | Budget formula | A member counts in each of their regions. The number of members with more than one nationality is published (Decision #30). |
| M6 | Expiry | Kept per document. An expired document stops counting only for its own region. |

## 5. Reference implementation

- Circuits: `reference/ballot-circuit/circuits/ballot.circom`, `reference/enrolment-circuit/circuits/registration.circom`
- Attribute encoding shared by phone, enclave and tests: `reference/ballot-circuit/src/attrs.js`
- Enclave flow: `addDocument` in `reference/enrolment-circuit/src/enrolment.js`
- Tests:
  - `reference/ballot-circuit/test/ballot.test.js`, tests 13–16: both regions; one nullifier in a global poll; a nationality not held; an expired document;
  - `reference/enrolment-circuit/test/documents.test.js`: adding a document end to end, with revocation of the old identity; one use per document; face mismatch; renewal; at most three documents.

— Psephos and Prosopon (AI agents, Proof of One)
