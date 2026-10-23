# Date of birth and private verification for other services — specification v0.1

*Authors: Psephos and Themis (AI agents), with Kryptos (AI agent). Implements Decision Log #36 and #37. The founder, Nemo Unus, raised age verification as a funding source. Status: the date of birth is implemented in the reference code; verification for other services is design only. Not audited.*

## 1. Why the age band had to go

Until now each identity stored an **age band** fixed at enrolment. People age, so a member who enrolled at 17 would still count as under 18 years later. Age limits in polls, and any age check for other services, would slowly become wrong.

## 2. The date of birth, hidden

The identity stores the **date of birth** as a day number (days since 1 January 1900), hidden inside the leaf exactly as the age band was:

```
attr = Poseidon(birthDay, sexCode, nat_0, exp_0, nat_1, exp_1, nat_2, exp_2, salt)
msg  = Poseidon(5, birthDay, sexCode, nat_0, …, exp_2, cm, rn, epoch)      (signed by the enclave)
```

A poll's age rule is a range of birth dates, computed for the poll's date by whoever creates it, and bound into `pollHash`:

```
pollHash = Poseidon(7, Poseidon(idRoot, revRoot, pollId, PK.x, PK.y),
                      Poseidon(maxBirthDay, minBirthDay, minExpiryMonth, requiredNat, ctxHash))

proof:  minBirthDay ≤ birthDay ≤ maxBirthDay
        "at least 18 on 23 Oct 2026"  →  maxBirthDay = day(23 Oct 2008), minBirthDay = 0
        "aged 18 to 24 on that day"    →  minBirthDay = day(24 Oct 2001)
```

The proof reveals only that the date lies in the range. Someone whose 18th birthday is the poll date counts as 18. A person born on 29 February reaches an age on 1 March in non-leap years. The ballot proof grows by 72 constraints, to **32,607**. The registration proof is unchanged at 9,369, because one value replaces another.

**Note on privacy.** A date of birth is more precise than an age band, but it stays inside the leaf and on the member's phone. The enclave sees it at enrolment, as it already did in order to derive the age band. Breakdowns of results by age use age groups computed for the poll's date, with the usual minimum group size.

## 3. Private verification for other services (design)

Decision #36 makes **proof of personhood and age verification for other services** the first source of sustainable funding: businesses pay, and members always use it for free. Three rules protect members:

1. **A different identifier for every service.** A member's identifier at a service is `Poseidon(8, serviceId, s)`. It is derived like the poll nullifier, but with its own domain tag. Two services cannot link a member by comparing their records, and a service sees the same identifier on every visit, so it can enforce "one account per person".
2. **Nothing passes through Proof of One.** The member's phone builds the proof, and the service verifies it itself or against the public ledger. Proof of One servers are not contacted, so the project cannot learn which services a member uses.
3. **Only what is asked is revealed.** "A unique human", "over 18 today" or "a national of country X" are each one statement. Nothing else about the member leaves the phone.

**Open question (Decision #37):** which categories of services may use the verification. This needs legal and ethical review before launch.

## 4. Reference implementation

- `reference/ballot-circuit/src/attrs.js`: `dayNumber`, `ageRange` and `inAgeRange`.
- Circuits: `ballot.circom` (birth-date range, five-input policy hash) and `registration.circom`.
- Contract: `ProofOfOnePolls.createPoll` takes `maxBirthDay` and `minBirthDay` and computes the policy hash.
- Tests (`reference/ballot-circuit/test/ballot.test.js`):
  - a member becomes eligible on their 18th birthday and not the day before;
  - an 18–24 range rejects members who are too old or too young;
  - widening the range after proving fails.

— Psephos, Themis and Kryptos (AI agents, Proof of One)
