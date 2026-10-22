# Proof of One — Threat Model v0.1: State-Level Adversary

*Team session. Lead: Argus. Contributors: Kryptos, Prosopon, Themis. Summary: Hermes.*
*All contributors are AI agents. Nothing in this document has been reviewed by human experts. It is a working draft for discussion, not a security claim.*
*Baseline: Proof of One whitepaper v0.4.*

---

## 0. Scope and verdict

**Question.** What can an adversary with the resources of a state do against Proof of One v0.4, and what must change?

**Verdict (Argus).** Integrity is not the most serious problem. **User safety is.** v0.4 has three design-level weaknesses that could expose participants. All three can be fixed before any code is written:

1. Answers in open polls are stored in plaintext, keyed by a nullifier that the phone can recompute. Anyone who seizes a phone can therefore read all of that user's past answers.
2. The enrolment enclave may be able to link a real face and passport to an on-chain identity leaf.
3. The face-template database is a single, high-value list of every participant.

On integrity, one limit is fundamental: **an adversary that issues genuine passports can create genuine-looking identities.** Proof of One cannot prevent this. It can make it costly, bounded, visible, and reported per issuer. The whitepaper must say so plainly.

---

## 1. Adversary profile (Argus)

The adversary has the resources of a state and can:

| # | Capability |
|---|---|
| C1 | Issue genuine identity documents signed by its own CSCA/DSC keys, with any data and any face |
| C2 | Monitor and block national network traffic; see who connects to which services |
| C3 | Seize phones and compel people to unlock them; detain and coerce individuals |
| C4 | Pressure app stores, cloud providers, hosting companies and operators within its reach |
| C5 | Run large numbers of real devices and people (employees, conscripts) |
| C6 | Contribute code to open-source projects under false identities |
| C7 | Run disinformation campaigns against the project and its results |
| C8 | Try to identify the founder and contributors |

Threats are ranked by impact: **user safety first**, then integrity, then availability.

---

## 2. Threats to user safety (highest priority)

### T1 — Phone seizure reveals all past answers ⚠ CRITICAL
**Attack.** In v0.4 the nullifier is `nf = Poseidon(pollId, s)`, and in open polls PollAnswers stores the answer in plaintext under `nf`. An adversary who extracts `s` from a seized phone (or forces the user to export the backup) can compute `nf` for every poll and read every answer that user ever gave, retroactively. The design meant to protect anonymity becomes a permanent, public record of that person's opinions.

**Mitigations (Kryptos).**
- **D1: encrypt every answer by default.** Every answer is encrypted to the poll's threshold tally key (exponential ElGamal, as already used for attribute bands). Only homomorphic totals are ever decrypted. The plaintext "open" mode becomes opt-in, for non-sensitive polls only, with a clear warning to the poll creator.
- The app keeps no local history of answers and no list of polls answered.
- Optional duress PIN or wipe that destroys `s` (the user can re-enrol after a waiting period).

**Residual risk.** With `s`, the adversary can still see **that** the user took part in a poll, though not how they answered. Hiding participation needs further research; see T7.

### T2 — The enrolment enclave links a real person to an on-chain identity ⚠ CRITICAL
**Attack.** During enrolment the enclave sees DG1/DG2 (name, document number, face). If it also receives or can derive `idc`, or the leaf inserted into IdentityRegistry, the enrolment logs link a real person to an anonymous identity. Compromising the enclave, the cloud provider or the operator would then de-anonymise users. Combined with T1, it would expose every vote.

**Mitigation (Kryptos + Psephos).**
- **D2: blind issuance.** The enclave checks uniqueness and returns a blind signature or anonymous credential over a value it never sees. The phone then inserts its leaf with a ZK proof that it holds a valid credential. Even a fully compromised enclave learns who enrolled, not which leaf belongs to them.
- Insert leaves in batches on a delay, so enrolment time cannot be matched to insertion time.

**Residual risk.** The fact that a person enrolled is still known to the enclave (see T3).

### T3 — The face-template database as a list of participants ⚠ HIGH
**Attack.** To detect duplicates, the enclave must keep face templates and document fingerprints for every enrolled person. That database is effectively a list of everyone who has joined. Through C4 (pressure on the cloud provider) or a flaw in the enclave, the adversary could get it.

**Mitigations.**
- **D6: move from a single enclave to threshold or MPC storage early.** Templates are secret-shared across operators in several jurisdictions, so no single provider or court order can expose them.
- Use template protection where accuracy allows (cancellable or encrypted templates).
- Publish the operators and their jurisdictions; no operator inside the reach of an adversary under study.

**Residual risk.** Until MPC is in place, this is the system's largest single point of harm. **Themis: no participants from high-risk settings before D6 ships.**

### T4 — Network surveillance reveals app usage ⚠ HIGH
**Attack (C2).** Traffic to the relay, enrolment server or RPC endpoints marks the person as a user. App-store download records do the same.

**Mitigations.**
- **D5: built-in censorship-resistant transport.** Tor with pluggable transports (Snowflake, obfs4) and multiple relays behind large shared infrastructure.
- Fixed-size messages, random delays, and no enrolment and voting in the same session.
- Distribution outside app stores (signed APK, F-Droid) with reproducible builds.

**Residual risk.** The app's presence on the phone at the moment of seizure. On iOS, sideloading is limited and App Attest ties the app to the App Store. This conflict is still open (see Q3).

### T5 — Coercion and vote buying ⚠ MEDIUM (now) / HIGH (binding votes)
**Attack (C3).** A coercer watches the user vote, or demands proof of a particular answer.

**Current mitigation.** Re-voting is allowed (only the last answer counts), so a coerced vote can be replaced later in private.

**Residual risk.** Under encryption (D1), a voter can prove their answer by revealing the encryption randomness. That is a receipt. Real receipt-freeness needs a MACI-style key-change mechanism, which is required before any binding-vote mode exists.

### T6 — Small-group inference ⚠ MEDIUM
**Attack.** Narrow attribute filters plus public totals can reveal individual answers.

**Mitigation.** The existing minimum group size of 50, plus Metron's rule that no new filter may be combined with an existing one to isolate a group below the threshold. Consider adding differential-privacy noise to small cells.

### T7 — Participation analysis ⚠ MEDIUM
**Attack.** Nullifier activity on-chain plus relay timing lets an adversary estimate when and how many people take part, and, if combined with network data, who.

**Mitigation.** Relay batching and the T4 measures. **Open research:** hiding participation itself.

---

## 3. Threats to integrity

### T8 — Sybil identities from genuine documents (C1 + C5) ⚠ FUNDAMENTAL
**Attack (Prosopon).**
1. The issuer creates N passports with valid signatures. Each has a new document number, so Layer 1 (the OPRF document fingerprint) does not detect them.
2. **Weakness found:** Layer 2 compares faces only **within the same birth-date + sex group**. The issuer controls DG1, so it can give the same person a different birth date in each passport. Each copy lands in a different group and is never compared.
3. The face in DG2 can be a real person (one recruit per identity) or a synthetic face presented through camera injection.

**Mitigations.**
- **D4: remove birth date from bucketing.** Do duplicate detection globally (1:N across all users, with an approximate-nearest-neighbour index), or bucket only by sex. *Trade-off:* at very large N, false matches between real, different people increase. Prosopon must measure the error rates before choosing. Possible hybrid: a global ANN search, then a strict threshold only for candidates.
- **D3: per-issuer transparency and reporting.**
  - Publish aggregate enrolment counts per issuer and per DSC certificate (k-anonymous). Unusual spikes become visible to anyone.
  - Check enrolments per issuer and age band against public population figures.
  - Allow polls to use a **cohort cutoff**: only identities enrolled before the poll was announced, and optionally only documents signed by DSCs created before a set date. ICAO guidance gives DSC private keys a short usage period (about three months), so a rush of new documents signed by old DSCs is itself an anomaly. *To verify: exact ICAO 9303 Part 12 wording.*
  - Results pages show totals broken down by document issuer, so readers can judge how far each source can be trusted.
- Real people recruited one per identity (C5) are not a Sybil attack. They are real participants. No identity system can stop organised mobilisation; Metron's result presentation has to deal with it.

**Residual risk.** **An issuer can always create a limited number of convincing identities for its own document pool.** Proof of One's honest claim is: *fraud by a document issuer is costly, limited by detection thresholds, statistically visible, and separable in the results; it is not impossible.* This must replace any stronger wording in the whitepaper.

### T9 — Camera injection and deepfakes at scale ⚠ HIGH
**Attack.** Virtual cameras, rooted devices, or hardware-level camera interception feed synthetic video that matches the DG2 face.

**Mitigations.** Device attestation (App Attest / Play Integrity), certified presentation-attack detection (ISO/IEC 30107-3), and a cap on enrolments per attested device.

**Residual risk.** A state can buy many real devices and attack camera hardware. This is a cost increase, not a guarantee.

### T10 — Malicious code contributions (C6) ⚠ HIGH
**Mitigations.** Two independent maintainer reviews for security-critical paths, signed commits, reproducible builds, pinned dependencies, and a public audit before each release stage.

### T11 — Censorship by sequencer or relay (C4) ⚠ MEDIUM
**Mitigations.** Several independent relays, the option for users to submit directly, and forced inclusion through Layer 1. Prefer an L2 with a working forced-inclusion path.

---

## 4. Threats to availability and legitimacy

### T12 — Removal from app stores and blocking (C4) ⚠ MEDIUM
Mitigations as in T4, plus mirrors and a website that cannot be taken down by a single provider.

### T13 — Discrediting campaigns (C7) ⚠ MEDIUM
**Attack.** The adversary floods a poll, then claims the system is fraudulent. Or it calls the whole project foreign interference.

**Mitigations.**
- Neutral framing.
- Per-issuer reporting, so a flood is visible and separable.
- Metron's rule that every result carries its method and the self-selection caveat.
- No claim stronger than the design supports.

### T14 — Identifying the founder and team (C8) ⚠ HIGH (personal)
**Mitigations.**
- Pseudonymous keys.
- UTC timestamps in git.
- Watch for writing style (stylometry) and activity times.
- No payment trails.
- Separate devices and networks for project work.

---

## 5. Harm assessment (Themis)

- **The most serious possible harm is not a wrong poll result. It is a person being identified as a participant.** The design must treat participation itself as potentially dangerous.
- **Release gating:** no real participants from high-risk settings until D1, D2, D5 and D6 are implemented and independently audited. Earlier phases (testnet, accuracy study) use only volunteers in low-risk settings who have given informed consent.
- **Informed consent:** enrolment shows a plain-language risk statement, covering what is stored, where, what a seized phone reveals, and what remains possible against a state.
- **No overstatement:** public text must not promise "complete anonymity" or "fraud-proof". People may make risky choices based on those words.
- **Legal:** biometric processing falls under special-category rules (for example GDPR Article 9). Enclave operator jurisdictions need human legal review.

---

## 6. Decision log (Hermes)

**Proposed design changes for v0.5.** Each needs founder approval.

| ID | Change | Owner | Fixes |
|---|---|---|---|
| D1 | All answers encrypted by default; plaintext only for opt-in non-sensitive polls; no answer history on the phone | Kryptos, Psephos | T1 |
| D2 | Blind issuance: the enclave never learns the identity leaf; leaves inserted in delayed batches | Kryptos, Psephos | T2 |
| D3 | Per-issuer and per-DSC transparency, cohort cutoff, results broken down by issuer | Ostrakon, Metron | T8, T13 |
| D4 | Remove birth date from face bucketing; global or sex-only duplicate search, chosen after accuracy measurement | Prosopon | T8 |
| D5 | Built-in censorship-resistant transport; distribution outside app stores; cover traffic | Prosopon, Ostrakon | T4, T7, T12 |
| D6 | Threshold/MPC template storage across jurisdictions before any high-risk use | Kryptos | T3 |
| D7 | Whitepaper states the fundamental limit against document issuers in plain words | Hermes | T8, T13 |

**Open questions**
- Q1. Can participation itself be hidden (T7), for example with cover votes or a shared mixing layer?
- Q2. What are the false-match rates of global 1:N face search at 10⁶, 10⁷ and 10⁸ users? This decides D4.
- Q3. On iOS, how can distribution outside the App Store be reconciled with device attestation?
- Q4. Is an optional social-vouching layer worth studying? It adds resistance to issuer fraud, but it exposes social graphs. Themis's initial view is negative.

**Needs human review**
- The whole threat model, by independent security researchers with experience of state-level adversaries.
- The blind-issuance construction (D2) and the encryption scheme (D1): cryptographers.
- The face-accuracy study design (D4): biometrics experts.
- Enclave and MPC operator jurisdictions, and biometric data law: qualified lawyers.

**Hand-off to Psephos:** specify the blind-issuance enrolment (D2) and the encrypted-answer poll protocol (D1) as circuit statements, with public and private inputs, and estimated proving cost on phones.

— Argus, Kryptos, Prosopon, Themis, Hermes (AI agents, Proof of One)
