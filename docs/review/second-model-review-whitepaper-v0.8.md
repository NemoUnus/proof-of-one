# Second-model review of whitepaper v0.8

*Recorded by Hermes (AI agent). Review by ChatGPT (OpenAI) at the founder's request, 29 October 2026, in six parts. This is not an expert review: two AI models can share blind spots. Each point was checked against the paper, the specifications and the reference code before it was accepted or not. The changes are in [whitepaper v0.9](../whitepaper/Proof_of_One_Whitepaper_v0.9_EN.md).*

## Summary

| Part | Sections | Points | Rejected |
|---|---|---|---|
| 1 | 1–4 | 31 | 0 |
| 2 | 5–6 | 44 | 0 |
| 3 | 7 | 17 | 0 |
| 4 | 8 | 16 | 0 |
| 5 | 9–11 | 15 | 0 |
| 6 | 12–18 | 14 | 0 |
| **Total** | | **137** | **0** |

The common thread of all six parts: the paper's claims were stronger than its evidence. Version 0.9 states each property as a design goal with its assumption, and lists what is not yet done in Section 17. The review also found two real gaps (the reference contracts do not check decrypted totals on chain; small-cell sizes leak in breakdowns), three places where the paper had fallen behind the code, and led to Decision Log #43 (enrolment uniqueness rules).

## Part 1: Sections 1–4

Outcome: 31 points. Accepted 28 (4 with follow-up work in later sections), accepted in part 2, rejected 0, left for human experts 1. 

| # | Point | Decision | Change |
|---|---|---|---|
| 1.1 | "One in six" mixes documents, unique holders and people able to enrol | Accepted in part | Kept the estimate with its source (coverage research); stated that it counts documents in circulation, not unique people or people with a phone who can enrol, and that those shares are unmeasured |
| 1.2 | "Nobody outside the organiser can verify" too universal | Accepted | "Most online polls … give no independent means" |
| 1.3 | "Cannot tell people from machines" too broad | Accepted | Bot checks raise cost but do not establish distinct humans |
| 1.4 | §2.3 comparative claims unsupported | Accepted in part | Softened, points to §5 and landscape review v0.2 which compare on the same criteria; kept the fact that some document-based systems prove one document at a time without a cross-document check (documented in the landscape review) |
| 2.1 | Document + face ≠ unique human | Accepted | Claim now "one active identity, backed by a genuine document and a matching face"; limits pointed to §12.1 |
| 2.2 | Duplicate check stated as invariant | Accepted | Principle names the checks, error rates and limits |
| 2.3 | "No one can link" too broad | Accepted | "cannot be linked by the system's operators, under the trust assumptions of §7 and §12"; network metadata and participation stay in §12/§17 |
| 2.4 | Seized phone / stolen key claim | Accepted | Rewritten precisely: trustee collusion (6 of 9 before share deletion) and the member-chosen receipt window; participation still visible |
| 2.5 | R1/R2 ≠ full E2E verifiability | Accepted | R1/R2 described exactly; cast-as-intended and formal proofs named as open work |
| 2.6 | Receipt may be transferable / coercion | Accepted, follow-up | True during the receipt window (the stored randomness proves the answer). To state plainly in §9.3 and §12 when those sections are reviewed |
| 2.7 | State adversary used as blanket credential | Accepted | Principle now says which state capabilities are and are not withstood (§12) |
| 3.1 | "Fixed and non-negotiable" | Accepted | "Two requirements … targets, not results" |
| 3.2 | "Owned by the person, controlled by no single…" | Accepted | Design commitment reworded around authority spread across independent operators |
| 3.3 | Topic choice not shown neutral | Accepted | "through a published procedure" (§10) |
| 3.4 | Free ≠ accessible | Accepted | "free of any fee"; document, phone and connection still needed |
| 3.5 | "Use case that needs it most" | Accepted | "first application" |
| 3.6 | "Age or nationality cannot be checked" | Accepted | "without collecting their identity" |
| 4.1 | "Learns only" undefined | Accepted | Points to §6.11 table |
| 4.2 | "Private, not anonymous" / "anonymous identity" | Accepted, follow-up | Principle reworded; define anonymity, pseudonymity and unlinkability in the glossary |
| 4.3 | "Short verification window" | Accepted | Receipt window: none, 7 or 30 days, chosen by the member |
| 4.4 | "One active identity" lifecycle | Accepted | Points to §6.10 (renewal, loss, recovery) |
| 4.5 | "One human, one voice" ambiguous | Accepted | "one ballot per poll" |
| 4.6 | §2.2 "usually" unclear | Accepted | Scoped to consultations; distinguishes audited from unaudited |
| 5.1 | Competitors judged by our requirement | Accepted | §2.3 says they make different choices for good reasons; full fix in §5 review |
| 5.2 | "Strong demand" unsupported | Accepted | Removed |
| 5.3 | AI disclosure as assurance | Accepted | States that no independent expert has reviewed it yet |
| 5.4 | Release gates undefined | Accepted, follow-up | Pointer to §14–15; acceptance criteria to be written in §15 |
| 6.1 | "None for humans" | Accepted | "many ways to log in, no widely adopted way to prove one unique human privately" |
| 6.2 | "Almost no cost" | Accepted | "cheaper" |
| 6.3 | "Share of value created by AI" | Accepted | Labelled speculative; unique identity alone does not make allocation fair |
| — | Final judgment: chain document → person → unique → anonymous → verifiable → trustworthy | For experts | Each link is a separate claim; the revised text states each with its assumption. Whether the assumptions hold is for human reviewers |

Follow-ups for later parts: 2.6 (§9.3, §12), 4.2 (glossary), 5.4 (§15 acceptance criteria), 1.4/5.1 (§5).

## Part 2: Sections 5–6

Outcome: 44 points (the 10 reviewer questions at the end repeat findings and are not counted separately). Accepted 37 (3 of them as design changes, Decision #43), accepted in part 3, already answered by later sections 3, rejected 0, left for human experts 1. 

Inconsistencies in v0.8 found while answering (our own): §7.5 says the ledger stores the fingerprint F, §6.11 and the ballot spec say only the service stores it → fix §7.5. §7.4 still describes the CSCA check inside the proof; π_doc uses the tree of checked signers → fix §7.4. Threat model §(issuer attack) says Layer 1 uses the document number; it uses name, birth date, sex, nationality → fix wording.

| # | Point | Decision | Change |
|---|---|---|---|
| 1.1 | World ID figure, metric | Accepted | "about 18 million Orb-verified people reported by the project in 2026" |
| 1.2 | Humanity Protocol mainnet date | Accepted | Date removed from the table; source kept in the landscape review |
| 1.3 | ICAO description scope; SOD vs DSC | Accepted | "hashes of the data groups present"; signed with the document signer's key, certificate signed by CSCA; ID cards profiled separately |
| 1.4 | "Can only be checked with PKD certificates" | Accepted | Rewritten: we use master lists and states' own publications; 134 of 186 countries verifiable on 28 Oct |
| 1.5 | "Signature chain cannot be fabricated" | Accepted | Stronger evidence of what the state issued; not of correct issuance or holder |
| 1.6 | AA/CA wording | Accepted | "additional evidence against cloned chips"; mechanism choice open |
| 2.1 | "Closes both gaps" | Accepted | "intended to reduce both risks, not remove them" with the three limits |
| 2.2 | Fingerprint fields not unique / not stable | Accepted, design change proposed | Fields named; a fingerprint match is a signal checked against the face; name change caught by face search; collision rate to be measured (Decision #43) |
| 2.3 | OPRF: who learns output, lookup | Accepted | Phone unblinds and sends F to the enclave; the service learns and keeps F (stable per person), not published |
| 2.4 | Privacy table understates what the service sees | Accepted | Table extended (attributes, F retention, timing); paragraph: the service holds a list of all members, cannot link it to ledger or answers under stated assumptions |
| 2.5 | Recovery double vote | Accepted, answered | Invariant written: new credential only after the revocation is accepted on the ledger; snapshots fixed at opening → no poll accepts both identities. Full state-transition analysis + contract tests to be added (Decision #43) |
| 2.6 | NIST metric / 100,000 projection | Accepted | FPIR defined; projection labelled conditional; gallery growth and selfie-vs-passport caveat |
| 2.7 | Birth-date grouping not proof | Accepted | "optimisation, not a guarantee"; uneven groups and 1 January default dates; accuracy study covers the whole two-search procedure |
| 2.8 | Speed ≠ accuracy | Accepted | Speed sentence reduced; accuracy is the issue |
| 2.9 | "Uncompromised device" | Accepted | Precise attestation properties (App Attest / Android key attestation) |
| 2.10 | Enclave deletion | Accepted | Code discards images (checkable); absence of copies rests on isolation |
| 2.11 | Revocation unlinkability vs metadata | Accepted | Cryptographic vs timing linkage separated |
| 2.12 | MPC "no single operator" | Accepted | Per-phase table "what a single operator can do"; MPC model unspecified; jurisdiction = governance control |
| 3.1 | Concurrent enrolments / replay | Accepted, design change proposed | Atomic reservation of fingerprint and template before issuance (step 6) (Decision #43) |
| 3.2 | Registration acceptance predicate | Accepted in part | Step 8 states the ledger checks (key set, unused credential nullifier); revocation of credentials before registration and key compromise go to §7.10/§12 review |
| 3.3 | Lost/stolen documents | Accepted | Stated as a limitation: no source of document revocation available; to §17 |
| 3.4 | "Biometrics only for uniqueness" | Accepted | Four uses listed |
| 3.5 | Template refresh as takeover path | Accepted | Refresh only after match with the existing template; old template deleted |
| 3.6 | Separate trust assumptions | Accepted | New table in 6.5 |
| 3.7 | Backup and key lifecycle | Accepted in part | Copies give no extra ballots (same nullifier); backup encryption and rollback to be specified in 7.3 |
| 3.8 | "Hash that reveals nothing" | Accepted | "Poseidon commitment with a random salt, so that it is hiding" |
| 3.9 | Nullifier scope | Answered by §7.7 | nf = Poseidon(pollId, s): per poll, unlinkable across polls; 6.12 now points there |
| 3.10 | Multi-nationality participation | Accepted | Unit stated: one ballot per person per poll |
| 4.1 | "Ordinary polls cannot offer"; small groups | Accepted in part | Wording softened; small-group merging already in §7.9, now referenced |
| 4.2 | "Every answer can be checked" | Accepted | Recorded and counted; cast-as-intended open |
| 4.3 | "No proprietary hardware" | Accepted | "No dedicated scanning hardware", platform dependence stated |
| 4.4 | Phases vs present | Accepted | Per-phase table |
| 5.1 | Inconsistent comparison criteria | Accepted | New table: evidence, uniqueness, polling, trust assumptions |
| 5.2 | Self and ZKPassport merged | Accepted | Separate rows |
| 5.3 | World ID "Iris" | Accepted | Encrypted iris codes, uniqueness against all |
| 5.4 | Human Passport "not guaranteed" | Accepted | "Sybil resistance by cost and evidence; deliberate design choice" |
| 5.5 | Vocdoni and MACI merged | Accepted | Separate rows |
| 5.6 | Survey panels "not verifiable" | Accepted | Methods often published; inclusion not verifiable by participants |
| 6.1 | Leaf vs attribute commitment | Answered by §7.3 | Leaf = Poseidon(idc, attr, rn); 6.8 now says so |
| 6.2 | Age-rule date convention | Accepted | Range computed for the poll's opening date in UTC (to confirm in §7.7 review) |
| 6.3 | Disclosure through results | Answered by §7.9 | Now referenced from 6.9 |
| 6.4 | Member number purpose | Accepted | Purpose and risk stated |
| 6.5 | Shared devices | Accepted, open question | Copies give no extra ballots; shared family phone = open design question |
| — | Chain valid document → … → correct tally | For experts | Each step now has its own assumption; validity is for human reviewers |

## Part 3: Section 7

Outcome: 17 points. Accepted 12, accepted in part 2, already answered by the reference code (text to be aligned) 2, no issue 1. Rejected 0.

Checked against the reference code before deciding:
- the contract rejects a reused credential nullifier globally (`credentialUsed[cn]`, reference/contracts/src/Registries.sol);
- the tally recovers totals by baby-step giant-step with an explicit bound (reference/tally/src/protocol.js);
- the circuit's nullifier is `Poseidon(1, pollId, s)`, with a domain tag; the whitepaper omits the tag (text error);
- the registration circuit already uses domain tags: `cm = Poseidon(4, idc, salt, ρ)`, `cn = Poseidon(3, ρ)`; the whitepaper omits them (text error);
- trustee key generation is GJKR-style, threshold 6 of 9, with a public transcript and complaints ([trustee key generation spec](../specs/trustee-key-generation-v0.1.md)).

| # | Point | Decision | v0.9 change |
|---|---|---|---|
| 1 | Baby Jubjub OPRF is not an RFC 9497 ciphersuite | Accepted | 7.5: "a custom 2HashDH-style verifiable OPRF over Baby Jubjub, modelled on RFC 9497 but not one of its ciphersuites; its hash-to-curve, encodings and input validation are to be specified and reviewed" |
| 2 | Recorded-as-cast ≠ cast-as-intended | Accepted | 7.8: two separate bullets; the optional audit detects a cheating app only with some probability, and only if members use it; "independent data sources" to be specified (for example two ledger providers and the public archive) |
| 3 | Small-cell counts are exposed by decrypting cell counts | Accepted | 7.9: stated as a known leak. Options recorded: cells fixed in advance and coarse; decrypting only "count ≥ minimum" by threshold comparison instead of the count; limits on overlapping breakdowns across polls. Open design question (0.5-09, demographic disclosure) |
| 4 | "Latest ballot" needs ordering and finality | Accepted | 7.7: the ledger's transaction order is the canonical order; ballots after the close block are rejected by the contract; the final ballot set is the last ballot per nullifier at the close block, which anyone can recompute. Censorship by a sequencer: forced inclusion (8.4) |
| 5 | DKG threshold, verification, failure handling | Answered by spec; text aligned | 7.7: "threshold 6 of 9; GJKR-style key generation with a public transcript, complaints anyone can settle, and Chaum–Pedersen proofs for each partial decryption; up to 3 trustees may be absent; an invalid partial decryption is rejected and the trustee excluded" |
| 6 | "Totals = number of distinct participants" | Accepted | 7.8: "the sum of option totals equals the number of counted ballots (one per nullifier); audited ballots are never submitted; an abstention is an explicit option if the poll offers one" |
| 7 | 48-bit ballot number collides at scale | Accepted | 7.7: the ballot number is a local display aid only; lookup and checks use the full nullifier. (Expected collisions at 10^8 ballots: about 18 pairs, as stated) |
| 8 | `attributes` vs `attrs` | Accepted | 7.3/7.6/7.10: one canonical encoding `attr` (fixed order, three document slots, empty slot = 0), signed in the credential and committed in the leaf; the registration proof shows they are equal |
| 9 | cn uniqueness and scope | Answered by code; text aligned | 7.10: "the registry stores every cn and rejects a repeat"; the whitepaper shows the domain tags the code already uses (`cn = Poseidon(3, ρ)`, `cm = Poseidon(4, …)`, `nf = Poseidon(1, pollId, s)`) |
| 10 | Exponential ElGamal decoding bound | Accepted | 7.7: v_j encoded as v_j·G on Baby Jubjub's prime-order subgroup, points checked to be in it; totals recovered by baby-step giant-step, bounded by the number of identities in the poll's snapshot |
| 11 | Recount ≠ completeness | Accepted | 7.8: "verifies the tally over the final ballot set on the ledger; completeness rests on the ledger accepting every valid ballot (forced inclusion, 8.4) and on each member's own check" |
| 12 | Share deletion is operational, not cryptographic | Accepted | 7.12 and 1: "share deletion is an operational measure that depends on trustees erasing their shares and on no earlier copy; it cannot be proven" (already in the §1 redraft) |
| 13 | Commitment assumptions, ρ entropy, shared salt_a | Accepted in part | 7.3: ρ and salts sampled uniformly from the field on the phone and never revealed; domain tags for every Poseidon use; hiding and binding rest on Poseidon behaving as a random oracle (a standard but unproven assumption). salt_a appears in cm and attr by design (the registration proof links them); neither is published, so no cross-commitment linkage, but this is stated |
| 14 | The OPRF's key proof unspecified | Accepted | 7.5: per-response DLEQ (Chaum–Pedersen) proof against a public OPRF key published on the ledger; key rotation by epoch |
| 15 | Attestation verification path | Accepted in part | 7.6: phone checks the platform's certificate chain, the code measurement against the list of approved builds published on the ledger, and a fresh nonce; older builds are removed from the list. Detail in the enrolment-service work (1.2a) |
| 16 | "18 public inputs" counting | Accepted | 7.7: "18 field elements: pollHash, nf, and 16 ciphertext coordinates (4 options × 2 points × x, y)"; check against the reference circuit |
| 17 | Other projects | No issue | — |

Code follow-ups: none found; the 18 public signals match `component main {public [pollHash, nf, CA, CB]} = Ballot(32, 32, 4)` (CA, CB: 4 points each, x and y).

## Part 4: Section 8

Outcome: 16 points. Accepted 11, accepted in part 2, answered by the reference code (text to be aligned) 2, no issue 1. Rejected 0.

Checked against reference/contracts/src before deciding:
- batch weights come from keccak256 of the complete call data, after all proofs are fixed (implementation note N14);
- `publish` checks only that the final ballot chain matches and that the totals add up to the number of distinct voters (and do not exceed the eligible count). It does **not** check the aggregate ciphertext or the decryption proofs on chain; the spec's DLEQ and aggregate fraud proofs are marked NOT IMPLEMENTED in the contract. Correctness of the totals therefore rests today on the public recount off chain, and the on-chain challenge is still to be built;
- the contracts have no proxy or upgrade path; `governance` can only replace the enclave key-set root, which affects future registrations;
- the order of ballots inside `voteBatch` is the order in the call data, chosen by the relay.

| # | Point | Decision | v0.9 change |
|---|---|---|---|
| 1 | Blob retention ≠ archive | Accepted | 8.1: blobs give about 18 days of availability; long-term availability is the archivers' job, a separate obligation |
| 2 | Gas figures are implementation measurements | Accepted | 8.3: "measured in the reference contracts with batches of 1,024 leaves; verification gas does not depend on batch size, proving time does" |
| 3 | Batch-verification weights | Answered by code; text aligned | 8.5: weights derived from keccak256 of the full call data after every proof is fixed, so a prover cannot choose proofs that cancel under them (Fiat–Shamir; hash modelled as a random oracle) |
| 4 | Contract does not tie the final ballot set to the decrypted totals | **Accepted — real gap** | 8.7: say plainly that in the reference contracts the totals are accepted after the ballot-chain and sum checks only; correctness is checked by the public recount, and the on-chain challenge (DLEQ proofs, recomputed aggregate) is not yet implemented. Add to Section 17 and to the task list |
| 5 | Forced inclusion is chain-specific | Accepted | 8.1: L2 selection criteria list the forced-inclusion delay, pause and upgrade powers and fees; a poll stays open at least the chain's worst-case forced-inclusion delay plus a margin |
| 6 | Archive availability | Accepted | 8.1: hash = integrity, not availability; archivers' duties, replication checks and recovery to be defined |
| 7 | Batch size ≠ anonymity set | Accepted | 8.3: "a minimum batch size helps against timing correlation; it is not an anonymity guarantee"; what is public (leaf, cn, arrival order in the pending queue) is listed |
| 8 | Anonymising network claim too strong | Accepted | 8.6: the member's own network sees a connection to the anonymising network; relays and the ledger do not learn the IP; traffic correlation by a global observer is not prevented |
| 9 | "Direct submission without a wallet" | Accepted in part | 8.6: direct submission means sending the transaction through any relay or any node, with a fee sponsored by the project's paymaster or by anyone; with no sponsor at all, a member would need a funded account. Stated as a limitation |
| 10 | Immutability of poll state | Answered by code; text aligned | 8.10: contracts are deployed without a proxy and have no upgrade path; governance can change only the enclave key set, which affects future registrations; a new version means new contracts |
| 11 | Registration queue and relay data flows | Accepted | 8.3/8.6: table of what each service sees (relay: transaction content, timing; queue: leaves and cn in arrival order) |
| 12 | "100× not reachable" | Accepted in part | 8.9: "under the current design" with the calculation shown (ciphertext bytes per ballot × ballots ÷ data cost) |
| 13 | Attestation without platform services | Accepted | 8.6: scope to Android key attestation verified against Google's published root certificates; revocation status needs Google's published list, fetched by the service, not by the member; iOS App Attest needs Apple's servers at enrolment. Claim narrowed to "no account, phone number or SMS" |
| 14 | Challenge types undefined | Accepted | 8.7: list the challenge types (invalid DLEQ proof, wrong aggregate, ballot missing from the final set) and say which can be verified on chain; to be specified with point 4 |
| 15 | Order inside a batch | Accepted, small design change | 8.5: the contract will reject a batch that holds two ballots with the same nullifier, so a relay cannot choose which of a member's re-votes counts; across transactions, ledger order decides (7.7) |
| 16 | Other projects | No issue | — |

New tasks: on-chain challenge for the tally (DLEQ verification and aggregate recomputation, or a succinct proof of the aggregate); reject duplicate nullifiers inside one batch in `voteBatch`.

## Part 5: Sections 9–11

Outcome: 15 points. Accepted 12, accepted in part 2, no issue 1. Rejected 0. Four points (6, 7, 8, 12) show that the agenda and sponsor rules need a written governance procedure: who decides, published reasons, appeal. That procedure is a founder decision and is added as a task.

| # | Point | Decision | v0.9 change |
|---|---|---|---|
| 1 | Residency is not verified | Accepted | §11: "residency" removed; only age, nationality and uniqueness |
| 2 | "Margin" misleading for self-selected polls | Accepted | 9.5: no margin of sampling error; if an uncertainty measure is shown it is named (for example a credibility interval under a stated model); weighting by verified attributes does not make a self-selected sample representative |
| 3 | Duress PIN ≠ coercion resistance | Accepted | 9.3: duress PIN described as a limited emergency feature; coercion resistance is not claimed for standard polls; required before binding votes (9.4, [threat model T5]) |
| 4 | Endorsement totals not verifiable | Accepted | 10.2: endorsements to be cast like ballots (per-proposal nullifier, proof of membership), so totals are recountable; until designed, stated as open |
| 5 | Region list and base shares | Accepted | 10.1/10.3: a fixed public region list (one region per nationality at launch), changed only by a recorded decision; a member with several nationalities counts in each of their regions' member numbers — stated, with its effect on shares |
| 6 | Wording guideline: who decides, appeal | Accepted in part | 10.4: decisions and reasons published; appeal procedure to be written (governance task) |
| 7 | Issuer statistics as proof of flooding | Accepted | 10.4: "a monitoring signal that triggers review, not proof"; no exclusion on statistics alone |
| 8 | "Polls that could endanger a group are refused" | Accepted in part | 10.4: criteria, decision-maker, published reasons and appeal to be defined (governance task) |
| 9 | Per-service identifiers | Accepted | §11: identifier = Poseidon(tag, serviceId, s), distinct per service; collusion through shared metadata remains possible |
| 10 | "No operator can tell who answered what, even if compelled" | Accepted | 9.2: scoped to the cryptographic design, under the assumptions of §12; the phone during the receipt window is the known exception |
| 11 | "Fund cannot favour any region or topic" | Accepted | 10.3: "applies the same published formula to every region"; its inputs and parameters still shape the result |
| 12 | Sponsor controls | Accepted | 10.4: sponsors cannot cancel after opening (the reference contract has no way to cancel a poll); results are decrypted by trustees for everyone at once; sponsor influence on wording and targeting follows the guideline; procedure in the governance task |
| 13 | Proposal and endorsement limits with several nationalities | Accepted | 10.2: one proposal per month per track the member belongs to (each of their regions, and global); one endorsement per proposal |
| 14 | Open mode and ballot numbers | Accepted | 9.4: in open mode the answer is public under the ballot number, which is part of the public nullifier and unique per poll; free text can identify its author; the app warns |
| 15 | Other projects | No issue | — |

New task: written governance procedure for the agenda and sponsored polls (wording edits, refusals for safety, appeals, decision-makers, published reasons).

## Part 6: Sections 12–18

Outcome: 14 points. Accepted 11, accepted in part 2, no issue 1. Rejected 0.

| # | Point | Decision | v0.9 change |
|---|---|---|---|
| 1 | GDPR Art. 9 covers biometrics for unique identification, not all document data | Accepted | §14: face templates processed to identify a person uniquely are Art. 9 data; other document data (name, birth date, nationality) is ordinary personal data; Art. 6 lawful basis and Art. 9 condition to be assessed with counsel |
| 2 | Erasure does not make on-ledger records "meaningless" | Accepted | §14: design goal, subject to a data-protection impact assessment and an identifiability analysis of every on-chain field and its metadata (EDPB Guidelines 02/2025 on blockchain) |
| 3 | "Same person cannot enrol twice" | Accepted | 12.1: "the system tries to detect duplicate enrolments; its measured miss rate is a security limit" |
| 4 | Compromised setup "bounded by eligible identities" | Accepted | 12.2: a compromised setup breaks soundness: forged ballots can fill places up to the cap and change the result; mitigations are the multi-party ceremony (any one honest participant suffices) or a universal setup (issue #7) |
| 5 | Issuer fraud "bounded and separable" | Accepted in part | 12.1: keep the limit; "costly" stays (each fake identity still needs a distinct face that passes the duplicate search and liveness); "bounded" removed; issuer statistics are a detection signal; results can be shown with and without a given issuer's documents, which limits the damage once a pattern is suspected but does not prove fraud |
| 6 | Censorship residual risk is more than delay | Accepted | 12.2: residual risk "missed ballots or an unusable poll"; poll length ≥ the chain's worst-case forced-inclusion delay plus margin (also 8.1) |
| 7 | Threat model misses malicious updates of trust inputs | Accepted | 12.2: new rows: trust list (CSCA and signer tree), enclave key set and attestation measurements, trustee onboarding; for each, who can change it, how changes are reviewed and published, and the effect of a malicious update (links to trust-list §9 governance and Decision #42) |
| 8 | §18 "real person … only once" | Accepted | §18 aligned with §1: one identity per person, one ballot per poll, subject to issuer fraud and measured detection errors |
| 9 | Audit promise and vague gates | Accepted | §18 states it as a release commitment; §15 gates get measurable criteria (minimum anonymity set, audit scope, pilot conditions) — draft numbers to be agreed with the founder |
| 10 | Jurisdiction ≠ independence | Accepted | §14: independence criteria (no shared owners, infrastructure or legal control), disclosed per operator |
| 11 | Consent as legal basis unclear | Accepted in part | §14: which basis applies (Art. 6 and Art. 9) is for legal review; withdrawal: the member's off-chain template and fingerprint are deleted and the identity revoked; past encrypted ballots stay on the ledger and cannot be linked to the person — to be confirmed in the impact assessment |
| 12 | Face-accuracy study ethics | Accepted | §15: the study's data source, consent, demographic coverage, retention, evaluation protocol and independent oversight become part of the gate; public benchmark data first, no collection of members' faces for research without separate consent |
| 13 | What "sign as AI agents" means | Accepted | 13.2: bylines in documents and commit messages; human review recorded in PROVENANCE.md by the founder; commits made through GitHub's web interface carry GitHub's signature, which shows only which account made them, not who wrote the content |
| 14 | Other projects | No issue | — |

New tasks: measurable gate criteria in §15 (with the founder); threat-model rows for malicious updates of trust inputs; data-protection impact assessment as a legal-review item (needs counsel).
