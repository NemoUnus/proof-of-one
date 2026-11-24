*Review by a second AI model (ChatGPT), given the [review brief](deployment-5-review-brief.md) on 24 November 2026; kept as received, with link icons removed. What was done about each finding: [outcome](deployment-5-review-outcome.md).*

# **Independent Security Review — Proof of One, Deployment 5**

**Review target:** `NemoUnus/proof-of-one`, branch `main`\
**Review brief:** Deployment 5, Decisions #62 and #63, dated 24 November 2026\
**Scope:** Identity registry, voting and recovery contracts, ballot and registration circuits, native prover, relay, Android application, and deployment configuration.

I will use the seven questions in the brief as the review structure, with additional findings where relevant. I will distinguish confirmed security issues from design concerns and unverified suspicions.

## **Initial security observation**

The first issue requiring particular attention is **deterministic ballot randomness combined with identity restoration across multiple devices**.

The scenario described in Question 1 is cryptographically meaningful. If two devices reconstruct the same randomness \\(r\\) but encrypt different plaintexts, the relationship between their ElGamal ciphertexts can expose information about the difference between those plaintexts.

The fact that the contract accepts only one ballot does not, by itself, protect confidentiality: a rejected transaction can still expose its calldata.

This is potentially a ballot-secrecy vulnerability, not merely a transaction-consistency problem. Its actual exploitability and severity depend on the precise encryption construction, proof constraints, and transaction-submission path.

## **1. Code observations confirmed so far**

I have verified several important implementation details against the current raw source files.

| Component         | Confirmed implementation                                                                      |
| ----------------- | --------------------------------------------------------------------------------------------- |
| Identity registry | Inserts leaves immediately and records historical roots.                                      |
| Ordinary voting   | Accepts historical identity roots for open, non-sampled polls.                                |
| Sampled voting    | Requires the identity root fixed at poll creation.                                            |
| Recovery voting   | Checks both the old and new identity roots and verifies the old identity's `notBefore` value. |
| Ballot circuit    | Enforces `notBefore ≤ openTime` in the ordinary voting proof.                                 |
| Recovery circuit  | Enforces the same condition on the old identity.                                              |
| Batch voting      | Uses the same root-validation policy as ordinary voting.                                      |

Relevant source locations:

- `Registries.sol`, lines 66–87: registration and historical-root recording.
- `ProofOfOnePolls.sol`, lines 227–253: poll creation and snapshot.
- `ProofOfOnePolls.sol`, lines 313–344: ordinary voting.
- `ProofOfOnePolls.sol`, lines 353–389: recovery voting.
- `ProofOfOnePolls.sol`, lines 396–431: batch voting.
- `ProofOfOnePolls.sol`, lines 451–455: `_checkIdRoot`.
- `ballot.circom`, lines 195–199: `notBefore` constraint.
- `recovery.circom`, lines 117–121: old-identity constraint.

These observations establish that the main architectural changes described in the brief are present in the source. They do not yet establish that all associated security properties hold.

## **2. Findings — Questions 1–3**

### **Finding F-01: Deterministic randomness can be reused by two restored devices**

Critical — ballot secrecy

Confirmed

**Files and locations**

- `reference/ballot-circuit/src/ballot.js`, lines 30–39 and 47–50.
- `reference/native-prover/src/ballot.rs`, lines 117–127 and 153–160.
- `reference/ballot-circuit/circuits/ballot.circom`, lines 137–138 and 234–265.
- `reference/contracts/src/ProofOfOnePolls.sol`, lines 313–344 and 487–514.
- `reference/native-prover/src/ballot.rs`, lines 241–260.

**What is wrong**

The randomness is derived from:

\\[ r_j=H(15,s,pollId,revision,j)\bmod \ell \\]

The implementation has no device-specific or attempt-specific value.

The circuit proves that the ciphertexts use the supplied randomness, but does not expose or constrain the revision as a public input. The contract consequently has no way to establish that the submitted ballot was generated using the current revision.

More importantly, the contract does not reject a second submission merely because it was constructed using a stale revision. `_record()` increments the ballot count and accepts another ballot, subject to the revote limit.

**Concrete attack scenario**

1. Device A and Device B hold the same restored identity.
2. Both read the ballot count as zero.
3. Both calculate revision zero.
4. Device A selects option 1; Device B selects option 2.
5. Both generate valid proofs using identical \\(r_j\\).
6. Both submit their transactions.
7. The first transaction is recorded. The second is accepted as a re-vote, not rejected for using a stale revision.

For exponential ElGamal:

\\[ A_j=r_jG \\]

\\[ B_j=v_jG+r_jPK \\]

When two ciphertexts have the same \\(r_j\\):

\\[ A_j^{(1)}=A_j^{(2)} \\]

and:

\\[ B_j^{(1)}-B_j^{(2)} =(v_j^{(1)}-v_j^{(2)})G \\]

Because the ballot is one-hot, an observer can identify the option that differs between the two ballots. In fact, the signed difference identifies the two distinct choices.

This is a direct confidentiality failure. The attacker does not need to decrypt the threshold ElGamal ciphertexts or compromise a trustee.

The ballot events also publish the ciphertexts, and a reverted transaction would expose its calldata as well. Therefore, simply rejecting stale revisions would not completely solve the problem.

**Recommended fix**

I recommend two separate protections:

1. Introduce a fresh, cryptographically random ballot salt for every ballot attempt. Derive randomness using the member's secret, poll ID, salt and option index. Publish the salt with the ballot so a restored phone can reconstruct the randomness and recover the recorded answer.
2. Bind an explicit revision to the proof and enforce that it equals the current on-chain ballot count. This prevents stale submissions from being accepted as valid new revisions.

The first protection addresses confidentiality. The second addresses concurrent-update consistency.

A unique random salt should be generated independently on each device. It must not be reused when retrying a ballot with a different choice.

**Severity:** Critical for ballot secrecy. The described attack is feasible under the stated multi-device restoration model.

### **Finding F-02: The application does not authenticate poll text against**`metadataHash`

High — ballot integrity

Confirmed

**Files and locations**

- `reference/relay/src/index.js`, lines 129–162.
- `reference/android-prototype/app/src/main/java/io/github/nemounus/proofofone/reader/VoteActivity.kt`, lines 126–145.
- `reference/contracts/src/ProofOfOnePolls.sol`, lines 89–92 and 247–250.

**What is wrong**

The relay returns poll text from its locally maintained `pilot-polls.json`.

The contract stores a `metadataHash`, but the Android application does not verify that the received poll text hashes to this value.

The application directly displays the question and options received from the relay.

This means the cryptographic proof can correctly establish that a voter selected option number 2 while the application has shown the voter a misleading description of option 2.

**Concrete attack scenario**

Suppose the real poll contains:

- Option 1: Approve the proposal.
- Option 2: Reject the proposal.

A malicious relay returns:

- Option 1: Approve the proposal.
- Option 2: Abstain.

The user selects what they believe is abstention. The application constructs a perfectly valid proof for option 2.

The contract has no knowledge that the user was shown a different description.

This is more serious than a denial of service: it can manipulate the meaning of an accepted vote.

**Recommended fix**

The application must:

1. Canonicalize the received poll metadata using an explicitly specified serialization format.
2. Calculate its Keccak-256 hash.
3. Compare it with the on-chain `metadataHash`.
4. Refuse to display an actionable voting interface if verification fails.

Ideally, the metadata should also be independently retrievable from a content-addressed source.

**Severity:** High. Potentially breaks ballot integrity and the correspondence between the voter's intention and the recorded choice.

### **Finding F-03: The relay controls the identity root selected by the application**

Medium — anonymity and availability

Confirmed

**Files and locations**

- `reference/relay/src/index.js`, lines 135–161.
- `reference/android-prototype/app/src/main/java/io/github/nemounus/proofofone/reader/VoteActivity.kt`, lines 191–209.
- `reference/native-prover/src/ballot.rs`, lines 73–90.
- `reference/contracts/src/ProofOfOnePolls.sol`, lines 451–455.

**What is wrong**

The application rebuilds the identity tree and checks that its calculated root matches the root returned by the relay.

However, it does not independently compare that root with the identity registry on-chain.

The contract checks that the submitted root is historical, which prevents an arbitrary fabricated root from being accepted. But it deliberately accepts *any* historical root for an open, non-sampled poll.

Consequently, a dishonest relay can return a genuine older prefix of the identity tree rather than the newest tree.

**Concrete scenario**

Suppose the registry has 10,000 members.

A voter was registered as member 500.

The relay supplies the first 500 leaves and the corresponding historical root.

The application can reconstruct that root and generate a valid proof. The contract accepts it.

The effective anonymity population is now 500 rather than 10,000.

The relay can therefore reduce the anonymity set without breaking a cryptographic primitive or fabricating a Merkle proof.

**Recommended fix**

The application should obtain the latest identity root and leaf count independently from the configured chain and registry contract.

It should normally use the newest root.

An alternative is to establish a public minimum anonymity threshold and refuse to vote using a root whose population is below that threshold.

**Severity:** Medium. The relay cannot manufacture membership in an arbitrary root, but it can deliberately select a smaller valid population and cause denial of service.

### **Question 3 — What does publishing the historical root reveal?**

There is an inherent information disclosure here.

Each identity registration creates a new prefix of the identity tree. The root used in a ballot therefore identifies the population size at the time that root existed.

An observer can reconstruct the prefix corresponding to the root and establish that the voter's leaf must be among those registered by that point.

This does not reveal the exact identity leaf because the leaf is hidden by the membership proof. However, it reveals an upper bound on the voter's registration index.

**My recommendation: use the newest root, not an older shared root.**

The reason is straightforward:

- Newest root: maximum available registered population.
- Older root: smaller potential anonymity set.
- Root rounding: deliberately discards members from the anonymity population and provides no inherent privacy benefit.

There is one qualification: the effective anonymity set may be smaller than the registered population because of poll eligibility requirements, nationality restrictions, age restrictions and revocation.

The relevant implementation is `identity_path()` in `reference/native-prover/src/ballot.rs`, lines 73–90. It explicitly supports historical prefixes and documents that the application normally uses the newest root.

## **3. Findings — Questions 4–7**

### **Question 4 — Can a re-issued identity bypass**`notBefore`**?**

No direct bypass found

I checked all three voting paths separately.

| Path             | `notBefore` protection                       | Assessment                     |
| ---------------- | -------------------------------------------- | ------------------------------ |
| `vote()`         | Ballot circuit checks `notBefore ≤ openTime` | Protected                      |
| `voteBatch()`    | Uses the same ballot verifier                | Protected                      |
| `recoveryVote()` | Checks the old identity's `notBefore`        | Protected for the old identity |

Sources: `ballot.circom`, lines 195–199; `recovery.circom`, lines 117–127; `ProofOfOnePolls.sol`, lines 313–344, 353–389 and 396–412.

**Important qualification: recovery is an intentional exception.**

The recovery circuit does not require the new identity to have existed when the poll opened. Instead, it requires:

- The old identity to belong to a historical root.
- The old identity to satisfy the opening-time restriction.
- The old nullifier to be the one being replaced.
- The new identity to belong to a historical root.
- The new revocation handle to be cryptographically linked to the old handle.

This is the intended mechanism for recovering an existing ballot.

**There is, however, a timing issue.**

The contract accepts the previous revocation root for ten minutes after a revocation:

`ProofOfOnePolls.sol`, lines 433–440.

Therefore, an old identity can still submit using the previous revocation root during this grace period. It can also vote before the revocation transaction has been accepted.

This is not a bypass of `notBefore`; it is a revocation-ordering and grace-period consideration.

**Recommendation:** Document this explicitly in the threat model. If the intention is that an old identity must become unusable immediately upon recovery, the ten-minute grace period is inconsistent with that requirement. If the grace period is intentional, the recovery ballot must remain capable of replacing a ballot submitted during that period.

**Lost both phone and password:** A person with only the newly issued identity cannot use `recoveryVote()` to recover an old poll. The circuit requires the old secret `sOld` and the old identity's membership witness. The person can answer polls opened after the new identity was issued, as intended.

### **Question 5 — Can sampled polls use a different identity root?**

Protected, with a recovery qualification

The ordinary voting paths are correctly restricted.

The implementation is:

`ProofOfOnePolls.sol`, lines 451–455:

- If the poll is sampled, `idRoot` must equal `p.idRoot`.
- Otherwise, any historical root is accepted.

This check is called in both `vote()` and every element of `voteBatch()`.

However, there is an important distinction in `recoveryVote()`.

At lines 364–366, the contract checks:

- `idRoot`: through `_checkIdRoot()`.
- `idRootNow`: only through `identity.isHistoricalRoot()`.

Consequently, for a sampled poll:

- The old identity must belong to the creation-time root.
- The new identity can belong to a later historical root.

This is a deliberate recovery mechanism, not an ordinary sampled-poll membership bypass. The sample invitation is still checked against the old identity's nullifier.

The sampled invitation is enforced in `invited()` at lines 480–485, and recovery voting checks it at lines 379–385.

**My conclusion:** The sampled population remains fixed for ordinary voting and for the old identity in recovery. However, the statement that every identity root used by every proof in a sampled poll must equal the creation root is technically inaccurate. The recovery proof has a second, later root.

I would retain this design, but explicitly document the distinction in the specification and tests.

### **Question 6 — Registry growth and historical-root storage**

Medium — scalability and gas

**Confirmed observations**

`reference/contracts/src/Registries.sol`:

- Lines 25–37: depth-32 tree and historical-root mappings.
- Lines 66–87: immediate insertion and root recording.
- Lines 93–100: public leaf retrieval.

Each registration performs 32 Poseidon operations and updates the tree.

The relay itself documents an estimated registration cost of approximately 1,580,000 gas and sets a 2,500,000 gas cap (`reference/relay/src/index.js`, lines 72–73).

**Risks**

1. Every registration adds permanent state.
2. Every distinct root is retained.
3. `rootTime` is also stored for each root, although I have not found a security-critical consumer of that mapping in the voting implementation.
4. The relay retrieves the complete identity-leaf list for `/state`.
5. The native application rebuilds the tree from that list.

There is also a performance concern in `reference/native-prover/src/ballot.rs`, lines 73–90.

`identity_path()` tries different prefix lengths and reconstructs a tree for each candidate until it finds the requested root.

With an honest relay returning the newest root, it finds the answer on its first attempt. But if a relay supplies an older root together with the complete leaf list, the repeated reconstruction can become quadratic in the number of leaves.

This is an avoidable client-side denial-of-service opportunity.

**Recommended fixes**

- Retain only roots that are still needed by open polls, where protocol semantics permit.
- Remove or justify the permanent `rootTime` mapping if it is not needed.
- Make the native tree reconstruction incremental, calculating prefix roots once rather than rebuilding the entire tree repeatedly.
- Introduce a scalable state-retrieval mechanism for large registries.
- Benchmark registration and phone-side proof preparation at realistic registry sizes.

I do not consider the permanent historical-root mapping a cryptographic vulnerability. It is a long-term cost and scalability concern.

### **Question 7 — Is the modulo bias acceptable?**

Acceptable

The implementation is:

`reference/ballot-circuit/src/ballot.js`, lines 33–39:

\\[ r_j=H(15,s,pollId,revision,j)\bmod \ell \\]

The Rust implementation uses reduction modulo the Baby Jubjub scalar order:

`reference/native-prover/src/ballot.rs`, lines 121–127.

The relevant moduli are approximately:

\\[ p\approx 2^{254} \\]

\\[ \ell\approx 2^{251} \\]

More precisely, for the BN254 scalar field modulus \\(p\\) and Baby Jubjub subgroup order \\(\ell\\):

\\[ p=8\ell-\delta \\]

where:

\\[ \frac{\delta}{\ell}\approx 2.42\times10^{-38} \\]

This is unusually favourable for modulo reduction: almost every residue has exactly eight preimages, with only an extremely small fraction having seven.

The resulting statistical bias is approximately:

\\[ 3.0\times10^{-39} \\]

assuming a uniform Poseidon output.

Zero is explicitly rejected in both implementations.

**Conclusion:** The modulo bias is negligible and does not warrant changing this construction.

I would not classify Question 7 as a finding.

One important distinction: the modulo bias is not the problem with deterministic randomness. The problem is the reuse of the same randomness when two devices generate different ballots for the same revision.

## **4. Additional finding — Threshold trustee-key consistency**

High — threshold availability

Confirmed design limitation

**Location:** `reference/contracts/src/ProofOfOnePolls.sol`, lines 274–296.

The `_checkTrustees()` function verifies:

1. Every trustee key is a valid subgroup point.
2. The Lagrange combination of the first `t` trustee keys equals the published tally public key.

However, the contract explicitly acknowledges that consistency of every possible `t`-subset requires key-generation commitments and is not checked.

**Why this matters**

Consider a configuration with four trustees and threshold three.

The first three keys can be consistent with the tally key, while the fourth key is unrelated.

The contract accepts the configuration.

A subset containing the fourth trustee may then fail to produce a valid decryption under the poll's tally public key.

The result is that the advertised 3-of-4 threshold may not provide genuine 3-of-4 availability.

This is not, by itself, proof of incorrect counting: the tally proof still has to validate the aggregate decryption. The immediate confirmed concern is reduced trustee redundancy and availability.

**Recommendation**

Verify the trustee public keys against a common polynomial commitment or an equivalent DKG transcript, rather than checking only the first threshold-sized subset.

All valid threshold subsets should be guaranteed to interpolate to the same tally public key.

This deserves attention before any production deployment.

### **Finding F-04: Revocation grace period permits voting with an old identity**

High — revocation enforcement

Confirmed

**Location**

`reference/contracts/src/ProofOfOnePolls.sol`:

- Lines 108–112: `REVOCATION_GRACE`.
- Lines 433–440: `_pollHashes()`.
- Lines 327–334: acceptance of the previous revocation-root proof.
- Lines 139–150 of `reference/contracts/src/Registries.sol`: revocation transaction.

**What is wrong**

The contract explicitly accepts a proof against the previous revocation root for ten minutes after a revocation.

This means an old identity can still submit a fresh ballot after its revocation has been recorded, provided the ballot uses the previous root.

This is not merely acceptance of a transaction prepared before revocation. The previous root remains an accepted proof input for the entire grace period.

There is also an ordering concern in the enrolment simulation:

`reference/enrolment-circuit/src/enrolment.js`, lines 82–90 and 106–125.

The simulation issues and signs the replacement credential and returns `revokeOld` to the caller. It does not itself establish that the old identity's revocation has already been accepted on-chain.

This differs from Decision #43, which explicitly requires revocation before re-issuance (`docs/decisions/DECISION_LOG.md`, line 64).

**Concrete scenario**

1. An identity is compromised.
2. A replacement identity is issued.
3. The old identity is revoked.
4. During the next ten minutes, somebody holding the old secret constructs a new ballot against the previous revocation root.
5. The contract can accept that ballot.

The owner can subsequently replace the old ballot using the recovery mechanism, provided they retained the old secret.

However, if the owner lost both phone and password, they cannot perform that recovery.

**Recommendation**

I recommend:

- Requiring the old identity's revocation to be confirmed before issuing its replacement credential.
- Reviewing whether the ten-minute grace period is necessary.
- If grace is retained, explicitly accepting that a compromised old identity can still vote during that period.
- Adding tests that construct a fresh proof against the previous root after revocation and demonstrate exactly when it becomes invalid.

**Severity:** High if immediate revocation is a security requirement. Otherwise, it is a documented and bounded compromise that needs explicit acceptance.

## **5. Other security observations — Question 8**

### **Finding F-05: Registration governance is a powerful identity-issuance authority**

High — identity integrity

Confirmed trust assumption

**Location:** `reference/contracts/src/Registries.sol`, lines 23–23 and 61–70.

The identity registry allows the governance address to change `keySetRoot` without a timelock.

A registration is accepted if its proof verifies against the current key-set root.

**Attack scenario**

If governance is compromised:

1. The attacker replaces the legitimate key-set root.
2. The attacker introduces a signing key under their control.
3. They generate credentials and valid registration proofs using that key.
4. They can register fabricated identities.

This would undermine the one-person-one-identity property.

This is not a cryptographic break. It is a trust and governance weakness.

**Recommendation**

- Multisignature governance.
- Timelocked key-set updates.
- Publicly announced key-set changes.
- An independently verifiable history of issuer-key additions and removals.
- Emergency procedures for compromised issuer keys.

The same concern applies to the revocation registry, where `enclaveOperator` is a privileged address. `Registries.sol`, lines 106–113 and 139–150, explicitly acknowledges that the specification requires an enclave signature rather than relying solely on a trusted operator address.

A compromised operator can cause arbitrary valid revocation updates, creating a denial-of-service risk for legitimate members.

### **Finding F-06: The relay's state response is not independently authenticated by the application**

Medium — application integrity

Confirmed

This is related to F-02 and F-03, but deserves a separate observation.

**Location**

- `reference/relay/src/index.js`, lines 135–162.
- `reference/android-prototype/app/src/main/java/io/github/nemounus/proofofone/reader/VoteActivity.kt`, lines 99–123 and 191–213.

The application receives the ballot hash and count from `/state` and uses those values to determine whether it has already voted and what answer was recorded.

The application then reconstructs the answer locally.

The native code does a good job of checking whether the supplied ballot hash corresponds to a ballot it can reconstruct. However, this does not establish that the supplied hash and count are the actual current on-chain values.

**Possible consequences of a dishonest relay**

- Showing that the member has not voted when they have.
- Showing that the member's answer cannot be recovered.
- Supplying an incorrect ballot count.
- Causing a new submission to fail because the previous ciphertext supplied for subtraction is incorrect.
- Preventing the user from accessing an otherwise valid poll.

The contract protects the actual tally against incorrect replacement data through `_subtract()`, particularly lines 516–520 of `ProofOfOnePolls.sol`.

Therefore, I see no demonstrated way for this particular attack to modify the aggregate tally.

**Recommendation**

The phone should independently query a trusted RPC endpoint or verify the relevant contract state through an authenticated light-client mechanism.

At a minimum, the app should distinguish between:

- Data authenticated by the chain.
- Data supplied by the relay.
- Data locally reconstructed and verified.

The relay should be a convenience service, not an authority for the application's understanding of the recorded ballot.

### **Finding F-07: Test-only trusted setups are still embedded in the Android voting workflow**

Production blocker

Confirmed

**Locations**

- `reference/android-prototype/app/src/main/java/io/github/nemounus/proofofone/reader/Registration.kt`, lines 66–69.
- `reference/android-prototype/app/src/main/java/io/github/nemounus/proofofone/reader/VoteActivity.kt`, lines 224–227.
- `reference/testnet/plan7.js`, lines 77–87 and 110–114.

The application loads:

- `registration_test.zkey`
- `ballot_test.zkey`

The deployment plan explicitly describes the trusted setups as test-only.

This is entirely acceptable for the stated testnet phase.

However, the application must not be promoted to a production environment with these proving keys and their associated test verification keys.

**Recommendation**

Before production:

1. Conduct a properly documented multi-party Groth16 ceremony.
2. Verify the ceremony transcript independently.
3. Rebuild the verification contracts from the resulting verification keys.
4. Publish reproducible build artifacts and hashes.
5. Ensure the Android application cannot accidentally use test proving artifacts in a production configuration.

This is a release requirement, not a defect in the intended test-only deployment.

### **Finding F-08: Nullifier domain separation does not include the deployment context**

Low — conditional privacy issue

**Locations**

- `reference/ballot-circuit/circuits/ballot.circom`, lines 188–193.
- `reference/native-prover/src/ballot.rs`, lines 197–201.
- `reference/contracts/src/ProofOfOnePolls.sol`, lines 301–304.

The nullifier is calculated as:

\\[ nf=H(1,pollId,s) \\]

The ballot's `pollHash`, however, includes a context hash incorporating:

- Chain ID.
- Contract address.
- Poll ID.

This is good protection against cross-contract proof replay.

But the nullifier itself does not incorporate that context.

**Potential scenario**

Suppose the same identity participates in poll ID 1 on two different deployments.

The same nullifier is generated in both deployments.

An observer can correlate the two participation events.

This does not reveal the ballot choices, and it requires identity reuse across deployments. Nevertheless, it creates unnecessary cross-deployment linkability.

**Recommendation**

Consider:

\\[ nf=H(TAG\_{\text{NULLIFIER}},ctxHash,pollId,s) \\]

This would retain the one-vote-per-poll property while providing deployment-specific nullifiers.

I classify this as a conditional privacy improvement rather than a demonstrated vulnerability in the current single-deployment pilot.

### **Additional issue: Sampled-poll randomness**

**Location:** `reference/contracts/src/ProofOfOnePolls.sol`, lines 463–477.

The current reference implementation derives the sample seed from a future block hash.

The source itself acknowledges that a block producer can influence this randomness by withholding a block.

This is not a problem with the historical-root logic, but it is relevant to the security of sampled polls.

The implementation should use a verifiable, unbiasable randomness beacon before sampled polls are used for consequential decisions.

The source already identifies drand as a possible solution.

### **Additional issue: Outdated design documentation**

There is a small but important documentation inconsistency.

`docs/specs/joining-open-polls-v0.2.md`, line 14, still describes batch insertion of four registrations and individual insertion after fifteen minutes.

Decision #63, `docs/decisions/DECISION_LOG.md`, lines 129–130, supersedes that design with immediate insertion in the registration transaction.

The contract correctly implements immediate insertion.

**Recommendation:** Update the design note so future reviewers and developers do not implement the superseded batching model.

## **6. Review of the existing tests**

I inspected `reference/relay/test/pilot.test.mjs`.

The test covers several important scenarios:

- Registration after poll creation.
- Immediate tree insertion.
- Duplicate credential rejection.
- Historical-root validation.
- Recovering the recorded answer.
- Sequential revision 0 and revision 1 voting.

In particular, lines 138–165 demonstrate the intended sequential restoration and answer-changing workflow.

However, the tests do not cover the most important concurrency scenario discovered in F-01.

I recommend adding the following tests:

| Test                                                          | Expected result                                                           |
| ------------------------------------------------------------- | ------------------------------------------------------------------------- |
| Two devices, same secret, same revision, different choices    | Must never publish ciphertexts with reused randomness                     |
| Two concurrent submissions with the same revision             | Only one should be accepted, with no nonce-reuse confidentiality exposure |
| New identity voting in an older poll through `vote()`         | Rejected                                                                  |
| New identity voting in an older poll through `voteBatch()`    | Rejected                                                                  |
| New identity alone using `recoveryVote()`                     | Rejected                                                                  |
| Recovery using a valid old identity and linked new identity   | Accepted                                                                  |
| Old identity voting immediately after revocation              | Must match the explicitly chosen revocation policy                        |
| Old identity voting using the previous root after ten minutes | Rejected                                                                  |
| Sampled poll using a later root in ordinary voting            | Rejected                                                                  |
| Sampled poll recovery with a later new-identity root          | Accepted only when the old sampled identity is invited                    |
| Malicious relay returning false poll text                     | Application must reject it                                                |
| Malicious relay returning an older valid identity root        | Application must enforce its anonymity policy                             |
| Malicious relay returning a false ballot count                | Application must detect the discrepancy                                   |

The existing metadata test checks that the honest relay's returned text matches the metadata hash. It does not demonstrate that the Android application independently verifies the hash. This distinction is important.

## **7. Consolidated findings and priorities**

Severity is my assessment of the reviewed implementation, not a formal CVSS score.

| ID   | Finding                                                   | Severity           | Main impact                          |
| ---- | --------------------------------------------------------- | ------------------ | ------------------------------------ |
| F-01 | Deterministic randomness reused across concurrent devices | Critical           | Ballot secrecy                       |
| F-02 | Poll metadata not authenticated by the app                | High               | Ballot integrity                     |
| F-03 | Relay can select an older historical identity root        | Medium             | Anonymity                            |
| F-04 | Previous revocation root accepted for ten minutes         | High               | Revocation enforcement               |
| F-05 | Governance and issuer-key trust                           | High               | Identity integrity                   |
| F-06 | Relay state not independently authenticated               | Medium             | Availability / application integrity |
| F-07 | Test-only trusted setup                                   | Production blocker | Proof-system integrity               |
| F-08 | Nullifier lacks deployment domain separation              | Low                | Cross-deployment privacy             |
| A-01 | Sampled-poll blockhash bias                               | Medium             | Sampling integrity                   |
| A-02 | Registry and native-tree scalability                      | Medium             | Availability                         |
| A-03 | Documentation inconsistent with Decision #63              | Low                | Maintenance                          |

## **8. Final assessment**

My overall assessment is that Deployment 5 implements the principal architectural changes of Decisions #62 and #63 correctly at the level of the reviewed Solidity and circuit source.

In particular:

- Historical identity-root membership is implemented correctly for ordinary open polls.
- The `notBefore` constraint is present in the ordinary and recovery circuits.
- The old identity's membership is retained in the recovery proof.
- Sampled polls retain their creation-time root for ordinary voting.
- The registry inserts new leaves immediately.
- The recorded-answer reconstruction mechanism is implemented consistently across the JavaScript and Rust implementations.

However, I would not approve this implementation for a production pilot in its current form.

**Three issues should be addressed first:**

1. **F-01 — Deterministic randomness reuse.** This is the most important finding. It directly threatens ballot confidentiality under a scenario explicitly supported by the project's identity-restoration design.
2. **F-02 — Poll metadata authentication.** A valid cryptographic proof does not guarantee that the user voted for the option they were actually shown.
3. **F-04 — Revocation grace and ordering.** The implementation needs a clearly defined and consistently enforced revocation policy.

F-03 and F-06 should also be addressed before relying on the relay as the normal voting interface.

### **Review limitations**

This is a static source review of the files retrieved from the repository's `main` branch. I inspected the relevant test source but did not execute the npm test suites, compile the Circom circuits, or run the Rust test suite. I also have not independently verified deployed bytecode against the deployment plan or audited the Groth16 setup artifacts.

The findings should therefore be treated as a technical review requiring reproduction and confirmation in an executable test environment, rather than a completed formal audit.

**My recommendation:** Fix F-01 before any further multi-device testing involving real participants. It is a fundamental cryptographic design issue, not just an implementation inconvenience.

The most valuable next step would be to turn F-01, F-02 and F-04 into executable adversarial tests, including the exact two-device concurrency scenario, and then review the fixes against the existing ballot and recovery circuits.