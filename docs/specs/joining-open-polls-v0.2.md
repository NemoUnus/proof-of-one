# Joining polls that are already open — design note v0.2

*24 November 2026. Adopted as Decision #62 on the founder's two principles; amends Decision #61. v0.1 proposed the root history and the rule for re-issued identities; v0.2 adds the founder's principles, the 30-minute limit and the recovered member's view of their own ballots.*

## 1. The principles

1. **Everyone takes part in every open poll as soon as they are a member**, at most about 30 minutes after enrolment.
2. **A member who gets their identity back** sees, in every open poll, the answer recorded for them, and may keep it or change it.

One exception, unavoidable under one person, one answer: a member who has lost **both** the phone and the password (§4).

## 2. Today's rule and why it existed

A poll stores the identity root at its creation, and every ballot proves membership in that tree. The snapshot stops a re-issued identity from answering a poll in which the identity it replaces has already answered (Decision #43, point 3): the old ballot cannot be found, so the person would have two answers. It also fixes a sampled poll's population (Decision #44) and the eligible count.

## 3. Principle 1: joining at once

- **Any past root.** The ballot proof makes `idRoot` a public input; the contract accepts it if the identity registry has held it (`isHistoricalRoot`). The app proves against the newest root, read from the registry on chain (app v0.14; review of deployment 5), so every voter's anonymity set is the whole membership at that moment.
- **Within 30 minutes.** After enrolment the app waits a random 1–10 minutes and registers (π_reg through the relay). *As implemented (Decision #63):* the registration enters the identity tree in the same transaction, about 1.6 million gas on the test network; there are no batches, no filler members and no scheduled job. *(This note first proposed batches of 4, with a single insertion after 15 minutes.)*
- **Sampled polls** keep their creation-time root. **The eligible count** is taken at closing.
- **Cost, stated to volunteers (amends Decision #61):** with a short delay, the service's operator can more easily tell which ledger entry came from which enrolment. Answers stay secret: a ballot never shows which entry voted.

## 4. Principle 2: a member who gets their identity back

| Situation | What happens |
|---|---|
| Lost phone, password kept | The same identity is restored (Decision #59). For each open poll the phone computes its nullifier, reads its ballot from the ledger, and opens it: the random values of each ballot are derived from the member's secret, the poll and a revision number, so no stored receipt is needed. It shows the recorded answer and offers to keep or change it. |
| Stolen phone, password kept | As above, then the identity is renewed: the old one is revoked and a new one, linked to it through the hidden handle, is issued. In each open poll the app shows what the old identity recorded, says plainly if that ballot was not made by this membership (for example by the thief), and replaces it with a recovery ballot (Decision #52). |
| Lost phone and lost password (the exception) | A new identity is issued. It may answer only polls opened after it was issued; the old identity's ballots, if any, stay as they are. The app explains this, simply, when the password is chosen. |

**Why the exception cannot be removed today.** Voiding the old identity's ballots would need someone to find them. Only the member's secret can, and it is lost. A power for the service to find any member's ballots would let it see who took part in every poll, and the secrecy of every answer would then rest on one layer (encryption and the tally key) instead of two. Voiding through several independent key holders, none of whom can do it alone, is recorded as research.

**How the exception is enforced.** The enrolment service writes the issue time into the credential's signed attributes as `notBefore`: 0 for a first identity, the issue time for a re-issued one. It is part of the hidden leaf, like the birth date. The ballot proof shows `notBefore ≤ poll.openTime`; the opening time enters `pollHash`. No ballot reveals whether its member was ever re-enrolled.

## 5. What could go wrong, and why it does not

| Concern | Answer |
|---|---|
| Two answers through a re-issued identity | Its `notBefore` is later than the poll's opening, so its proof fails. |
| A proof against a root that never existed | The contract accepts only roots the registry has held. |
| An old root chosen on purpose | It only shrinks the voter's own anonymity set. |
| Mass registration during a poll | Each registration still needs a genuine passport, the one-person check and the face check; registrations per day are published (Decision #21). |
| Deterministic ballot randomness | The values come from the member's secret, which already allows the member, and whoever holds the unlocked phone, to read the answer (Decision #45); no one else can. A revision number makes every changed answer use fresh values. |
| Thief re-votes after the owner restores | Restoring alone does not disable the stolen phone; renewal does (§4, second row). |

## 6. What changes

| Part | Change |
|---|---|
| Ballot and recovery circuits | `idRoot` public; `notBefore` in the attributes; `openTime` in `pollHash`; new TEST-ONLY keys |
| Registration circuit, credential, attribute hash | `notBefore` among the signed attributes (9 instead of 8) |
| Identity registry | every registration inserted at once (Decision #63); new deployment, as its registration verifier changes |
| Polls contract | root through the registry's history; sampled polls keep the snapshot; eligible count at closing; `openTime` in `pollHash`; new deployment |
| Enrolment service | signs `notBefore` (0 in the pilot, which issues no replacement identities) |
| Relay | asks the registry for a single insertion |
| Phone | registration 1–10 minutes after enrolment; newest root; ballot randomness from the secret; "your recorded answer" in each open poll after a restore |
| Consent text | §7 step 6 and §4 updated to the 30-minute wait and its cost |

The 13 test registrations are made again on the new registry; the founder's phone re-registers by itself.
