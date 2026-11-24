# Phase 1a deployment on Base Sepolia

> **Synthetic identities only. TEST-ONLY trusted setups. Not audited.** (Decision Log #49)

First run of the plan in this folder on a public test network, sent by Nemo Unus from a test-only wallet.

**Contract version.** The contracts deployed here are the version with result challenges and a 7-day challenge period (bytecode in `web/plan.json`). Since 9 November 2026 the reference contracts accept a result only with a tally proof and have no challenge period (Decision Log #53; [tally-circuit](../tally-circuit/)). Polls 1 and 2 finish under the deployed version: `publish.js` makes their results with the keccak challenge that version checks. `plan.js` and `plan2.js` describe this deployment and will be updated for the next one.

| | |
|---|---|
| Network | Base Sepolia (chain id 84532) |
| Deployer | [`0x6FbCf03F4b89715df2c8F9cC77AF0D0C5a4b79dB`](https://sepolia.basescan.org/address/0x6FbCf03F4b89715df2c8F9cC77AF0D0C5a4b79dB) |
| Plan | [`web/plan.json`](web/plan.json), start nonce 0 |
| Steps 1–18 sent | 5 November 2026 |
| Poll 1 open | 5 to 7 November 2026, 48 hours and 5 minutes (exact times on chain) |
| Cost of steps 1–18 | about 0.0001 test ETH |

## Contracts

Every contract was created at the address the plan computed in advance from the deployer and its nonce.

| Step | Contract | Address |
|---|---|---|
| 1 | Poseidon(2) | [`0x9e36D27D0D0115D84843d8d011981bC6eA606143`](https://sepolia.basescan.org/address/0x9e36D27D0D0115D84843d8d011981bC6eA606143) |
| 2 | RegistrationVerifier | [`0xa6D84C4D8bc530B18Df96432611dfC59fbC1d074`](https://sepolia.basescan.org/address/0xa6D84C4D8bc530B18Df96432611dfC59fbC1d074) |
| 3 | BatchInsertVerifier | [`0xE7189a32CDA60b53A50AA7A8b4eB87A709a75b9A`](https://sepolia.basescan.org/address/0xE7189a32CDA60b53A50AA7A8b4eB87A709a75b9A) |
| 4 | IdentityRegistry | [`0xcb01c33b24b4CAC194B6eE6a649Aef413c307091`](https://sepolia.basescan.org/address/0xcb01c33b24b4CAC194B6eE6a649Aef413c307091) |
| 5 | RevokeVerifier | [`0x566AB619149E1c2042f7E110e87287E2998C957e`](https://sepolia.basescan.org/address/0x566AB619149E1c2042f7E110e87287E2998C957e) |
| 6 | RevocationRegistry | [`0x417f4eA3AB48BaCD0A4a2f5A803f38f7d1983f1D`](https://sepolia.basescan.org/address/0x417f4eA3AB48BaCD0A4a2f5A803f38f7d1983f1D) |
| 7 | Groth16Verifier | [`0x78A67338C3e88b14b96e8beC6e333BB341589a31`](https://sepolia.basescan.org/address/0x78A67338C3e88b14b96e8beC6e333BB341589a31) |
| 8 | BallotBatchVerifier | [`0x6Ee5a6318Bb624B550B2Eccee4F3DF88DAD55523`](https://sepolia.basescan.org/address/0x6Ee5a6318Bb624B550B2Eccee4F3DF88DAD55523) |
| 9 | Poseidon(3) | [`0xec0f50Db7f16fE55C0b5D9Ac46712Dba340364a2`](https://sepolia.basescan.org/address/0xec0f50Db7f16fE55C0b5D9Ac46712Dba340364a2) |
| 10 | Poseidon(5) | [`0x4Fa80650063584b60A5F3715C10CeA7b66221Ab8`](https://sepolia.basescan.org/address/0x4Fa80650063584b60A5F3715C10CeA7b66221Ab8) |
| 11 | ProofOfOnePolls | [`0x64Bf8A3db2D45a993304eBE228dcD7d81d6098CC`](https://sepolia.basescan.org/address/0x64Bf8A3db2D45a993304eBE228dcD7d81d6098CC) |

## What was checked on the network

- The 4 registration proofs, the batch-insertion proof and the 4 ballot proofs were verified by the contracts on chain (steps 12–18).
- The polls contract reports 4 distinct voters.
- The receipt check in [`../app/`](../app/) shows each synthetic voter their own recorded answer, read from this network.

## Result of poll 1 and what is still to do

| Step | When | Expected |
|---|---|---|
| 19. Publish the result | **done** (after the poll closed on 7 November 2026) | totals **1 · 2 · 0 · 1**, as expected from the synthetic choices; accepted by the contract after checking them against its own encrypted totals; 4 distinct voters |
| 20. Finalize | **done** (15 November 2026, after the 7-day challenge period, which nobody used) | state **Final**: totals 1 · 2 · 0 · 1, 4 distinct voters. Poll 1 is complete |

## Poll 2: vote from your phone

Sent from the same wallet on 5 November 2026 with [`web/plan2.json`](web/plan2.json) (7 steps, no new contracts):

- a new synthetic enclave key set, 4 published synthetic members (5–8) and their batch insertion;
- poll 2, open for 7 days, until 12 November 2026.

The first ballot was made and sent from a phone the same day with [`../app/web/vote.html`](../app/web/vote.html): the ballot proof took 4.0 s on the phone and was verified there, the contract accepted it, and the page then showed the recorded answer read back from the network.

The same day the [test relay](../relay/) went live at `https://proof-of-one-relay.nemounus.workers.dev` (relay account `0x3dB9d15202Bd291558889b42eb4291e288797fb9`, funded with 0.0003 test ETH). The first ballot through it was sent from a browser with no wallet: proved in 1.7 s, submitted and paid for by the relay, and its recorded answer read back.

After the close, the encrypted totals and ballot chain shown by the page go to [`publish.js`](publish.js), which prepares the "publish" step.

## Notes

- **Wallet warning.** MetaMask flagged the page (served from `github.io`) as possibly deceptive, and marked each transaction as a high-risk request. Each request was checked before it was confirmed: a contract deployment or a call, no change to the wallet’s assets, and a fee of a few cents at mainnet prices. The page is open source in this folder. The warning was no longer shown on 21 November 2026 (deployment 4), so no report was sent.
- **Test coins** came from a faucet that asks only for an address and a captcha.

## Deployment 2 and test poll 3 (from 10 November 2026)

The contracts changed since the first deployment go on the test network: results are accepted only with a tally proof and are final at once (Decision Log #53), and ballots prove non-revocation against the current revocation root, so a revocation reaches polls already open (Decision Log #52). The identity registry with its 8 synthetic members, the ballot verifiers and the Poseidon contracts of the first deployment are reused.

| Step | What | When |
|---|---|---|
| 1–3 | Deploy RevocationRegistry, TallyVerifier and ProofOfOnePolls | Now |
| 4 | Create test poll 3 (poll id 1 of the new polls contract; 4 options; 7 days), with published kits for members 5–8 | Now |
| — | Members 5–8 vote from phones: `reference/app/web/vote.html?plan=../../testnet/web/plan3.json` | While the poll is open |
| 5 | Revoke member 8. The page waits until member 8 has voted. After 10 minutes, member 8's ballots are refused | After member 8 has voted |
| — | Publish the result with the tally proof (`publish.js`, which now also handles `plan3.json`); final at once | After the close |

Open the page as `reference/testnet/web/index.html?plan=plan3.json`. The plan starts at the wallet's 13th transaction (12 sent before; the first guess, 26, was refused by the page before anything was sent, as designed).

Rehearsed on a local chain with deployment 1 and poll 2 replayed first (`node test/plan3.e2e.js web/plan.json web/plan2.json`). Results: deployment 397,258 + 1,628,104 + 3,753,741 gas; poll creation 3,704,914; ballots about 523,000 (557,000 for the first); member 8's re-vote accepted within the grace and refused after it; result 1 · 2 · 1 · 0 published with the tally proof for 853,284 gas, final at once.

Known limit: after the revocation, the other members' published kits still carry the revocation path of the old root, so their re-votes are refused after the grace. Since 12 November the app prototype (`reference/app/web/app.html`) rebuilds the revocation path from the public list of revocations, so re-votes from it work again; the voting page `vote.html` does not (implementation note N33).

### What happened on the test network (10 November 2026, times in UTC+4)

| Time | Event |
|---|---|
| 17:13–17:21 | Steps 1–4 sent: contracts deployed and poll 3 created; members 5–8 voted from a phone with the wallet (options 1, 2, 2 and 4) |
| 17:21 | Step 5 sent: member 8 revoked while poll 3 was open |
| 17:24 | Member 8 changed its answer to option 3, proven against the previous root: **accepted**, within the 10-minute grace |
| 17:48 | Member 8 tried again: **refused** by the contract (`InvalidProof`) in the simulation before sending, so nothing was spent |

On 12 November (UTC+4):

| Time | Event |
|---|---|
| 12:22 | Poll 2 (first deployment) closed |
| 13:28 | Poll 2's result published: 0 · 0 · 1 · 1, 2 voters; challenge period until 19 November, 13:28 |
| 20 Nov, 15:59 | Poll 2 **finalized** after the challenge period, which nobody used: state **Final**, totals 0 · 0 · 1 · 1, 2 distinct voters. Poll 2 is complete |
| 13:36 | The relay switched to poll 3 on this deployment. Member 6 changed its answer to option 1 from the app prototype through the relay. Its kit was made for the revocation root before member 8's revocation; the app rebuilt the revocation path from the public list (N33) and the contract **accepted** the ballot |

Expected result when poll 3 closes on 17 November: 2 · 1 · 1 · 0. Since this run, `vote.html` explains the contract's refusals in plain words, instead of "unknown custom error".

### Poll 3's result cannot be recorded by its contract (17 November 2026)

Deployment 2 accepts a result only with a tally proof checked by its TallyVerifier. That verifier belongs to a TEST-ONLY proving key made with random entropy on 8 November and kept only in one working environment of the project's agents; the environment was replaced on 16 November and the key was lost with it. The contract cannot be changed, so **no result of poll 3 can be recorded on chain**. The ballots, the encrypted totals and the trustee shares are intact. The result is therefore published off chain with [`offchain-result.js`](offchain-result.js): the totals decrypted by three of the five synthetic trustees, each partial decryption with its DLEQ proof, and a tally proof made with the new, reproducible TEST-ONLY key (`tally-circuit/setup/vkey_tally_test.json`), checkable by anyone against the contract's `aggregate(1)`. Implementation note N37 records the lesson: since 17 November the test setup of π_tally is reproducible from the repository, and deployment 3 gets a TallyVerifier of that key.

**Result of poll 3 (closed 17 November 2026; computed off chain the same day): 2 · 1 · 1 · 0, 4 voters**, as expected (members 5 and 6 option 1, member 7 option 2, member 8 option 3). The file [`web/result3-offchain.json`](web/result3-offchain.json) holds the encrypted totals and ballot chain read from the contract, the three trustees' partial decryptions with their DLEQ proofs, and the tally proof, which verifies under `tally-circuit/setup/vkey_tally_test.json`. On chain, poll 3 stays closed without a recorded result.

## Deployment 3 and test poll 4: a recovery ballot (planned after 17 November 2026)

Puts on the test network the polls contract with recovery ballots (Decision Log #52, point 2) and plays the stolen-phone story. Prepared by `plan4.js`; the plan file `web/plan4.json` is made with the wallet's real nonce after poll 3. The registries, ballot verifiers and Poseidon contracts of deployment 2 are reused; the TallyVerifier is new, for the reproducible TEST-ONLY key (see poll 3 above).

| Step | What | When |
|---|---|---|
| 1–3 | Deploy TallyVerifier, RecoveryVerifier and ProofOfOnePolls (deployment 3) | After poll 3 |
| 4 | Create test poll 4 (poll id 1 of the new contract; 4 options; 7 days), with kits for members 5–7 | Then |
| — | Members 5 and 6 vote; someone holding **member 7's phone** votes with member 7's kit | While the poll is open |
| 5 | A new synthetic enclave key set | Any time before step 6 |
| 6–9 | Member 7 re-enrols: the new identity's revocation handle is linked to the old one; three filler members complete the batch | Then |
| 10 | Insert the four as one batch | Then |
| 11 | Revoke member 7's old identity. The page waits until member 7 has voted in poll 4 | After the "thief" has voted |
| — | Member 7 opens the app: it makes a **recovery ballot** with the new identity and the backup of the old secret, and sends it with a test wallet | After step 11 |
| — | Publish the result with the tally proof | After the close |

Rehearsed on a local chain with deployments 1 and 2 replayed first (`node test/plan4.e2e.js web/plan.json web/plan2.json`), again on 17 November with the new TallyVerifier: deployment 1,627,528 + 945,888 + 4,013,440 gas; poll creation 3,704,894; registrations about 300,000–320,000 each; batch 276,448; revocation 287,685; the recovery proof made in 5.2 s on a server; the recovery ballot accepted for 753,273 gas (the first ballot after a revocation also computes the new `pollHash`); the "thief's" ballot within the revocation grace, after the recovery, refused (`Recovered`); result 1 · 1 · 1 · 0 published with the tally proof, final at once, counting member 7's own answer and not the thief's. The same story also runs in the app prototype in a headless browser (`reference/app/test/app.e2e.js`).

### What happened on the test network (17 November 2026, times in UTC+4)

| Time | Event |
|---|---|
| 21:53–21:56 | Steps 1–4 sent from `web/plan4.json` (deployer nonce 15): new TallyVerifier, RecoveryVerifier and ProofOfOnePolls deployed at the planned addresses; poll 4 created (7 days) |
| 21:56–22:12 | Members 5 and 6 answered from the app prototype with the wallet (options 1 and 2); "the thief" answered with member 7's kit (option 4). Steps 5–11 sent: new enclave key set, member 7 re-enrolled with a linked handle, three filler members, one batch, and member 7's old identity revoked |
| 22:13–22:16 | Member 7's **recovery ballot** (option 3), made on the phone and sent with the wallet: **accepted**. Member 7 then changed its answer with a second recovery ballot (option 1, made in 6.9 s): **accepted** as a re-vote; the app read the public record back and confirmed "Counted: option 1". A recovery ballot needs the new identity's secret, so the owner can keep changing its answer, while ordinary ballots with the old identity are refused (`Recovered`, rehearsed locally) |

Expected result when poll 4 closes on 24 November: 2 · 1 · 0 · 0 (the thief's ballot replaced).

Note on the deployer's nonce: the test wallet was upgraded to MetaMask's EIP-7702 smart account (MetaMask's EIP7702StatelessDeleGator), and the explorer's list of the account's own transactions shows only the contract creations and the funding transfer. The nonce matched the count of those creations plus one (the upgrade); the plans were made for it and the page's nonce check passed. Our reading, not confirmed by MetaMask: the calls were sent through the smart account without raising the account's own nonce.

## Deployment 4: π_doc's verifier for the pilot's enrolment service (21 November 2026)

One contract, `DocVerifier` (`reference/contracts/src/DocVerifier.sol`), generated with snarkjs's template from the verifying key of the TEST-ONLY suite-2 proving key that the app uses (`reference/enrol-service/keys/doc_s2_vkey.json`, SHA-256 `ba10096069…`; reproducible with `prove-mem`, seed 1; the Android workflow checks that the app's key gives exactly this one). The enrolment service only reads it with `eth_call`; it holds no state. Plan `web/plan5.json` (`plan5.js`), start nonce 18.

| Contract | Address |
|---|---|
| DocVerifier | `0x78657778ee5C48Fd4FB792884b9C660D48D31de8` |

| Time (UTC+4) | Event |
|---|---|
| 09:35 | Step 1 sent from `web/plan5.json` (deployer nonce 18): DocVerifier deployed at the planned address |

Checked before deployment: on a local chain it accepts a real π_doc of a synthetic passport and refuses changed signals or proofs (`reference/contracts/test/doc-verifier.test.js`); `verifyProof` costs 375,678 gas, paid by nobody since it is called with `eth_call`.

## The pilot's enrolment service (live since 21 November 2026)

Cloudflare Worker `proof-of-one-enrol` (`reference/enrol-service`), deployed from this repository, with its D1 database and three secrets set in the dashboard. Address: `https://proof-of-one-enrol.nemounus.workers.dev`. Its public keys, as `/info` showed them at 10:34 (UTC+4); anyone can compare them with `/info` at any time, and a change would show that the secrets were replaced:

| Key | Value |
|---|---|
| OPRF key `K` (keyed fingerprints) | `[6980439750498880740579680557353155876392361572102500773805716699205309031723, 14307108981324500470809436760785395615033201903704883441614035457239063522377]` |
| Credential key `A` (EdDSA-Poseidon) | `[1789806763578855624814564503625149664414764811393647758203574245690431266832, 21766186518416066398502677487649986943960760084080257540850053389998548290076]` |
| Its leaf `H(A)` | `9973527310186799711322196578667569713052864781320094708470015773211842834432` |

At that time: no signers in the tree (root `19217088…593251`, the empty depth-16 tree), 0 evaluations, 0 enrolments. The secrets were made in the founder's browser with `web/enrol-secrets.html` and pasted straight into the dashboard; nobody else has seen them.

### First real enrolment (21 November 2026, 19:20 UTC+4)

The first enrolment of a real passport with the live service, from the Android app v0.8 (Decision #57; the founder's own passport, no other volunteer yet). The signer's certificate was first refused: the Workers runtime will not import RSA keys whose public exponent is not 3 or 65537, and the issuing state's CSCA uses another one; RSA signatures are now checked with BigInt arithmetic (update 150). Then, in 70 s: the signer was checked against its CSCA and added to the tree (position 0); the issuing state's rule (person key from the personal number in DG13) was applied; both fingerprints were computed through `/evaluate` and their DLEQ proofs verified on the phone; π_doc was made and verified on the phone in 3.7 s with the real tree path, then verified by `DocVerifier` through `eth_call`; the credential was signed and kept on the phone. Registration on the ledger (π_reg) is the next step. As for every pilot record, this enrolment is deleted with the service's store after the pilot.

### App v0.9: member number, backup and restore (21 November 2026, 22:05–22:12 UTC+4)

Before testing v0.9, the store was migrated (`sessions.fp`, `members.backup`) and the v0.8 test enrolment above was deleted (`DELETE FROM members`); the running counters were kept, which is why the service later reported "1" and "2 enrolments before this one".

- **Enrolment** (same passport, app v0.9, Persian interface, with a password): the signer was already in the tree (position 0); both fingerprints' DLEQ proofs verified on the phone; π_doc made and verified on the phone in 3.5 s; the credential was signed, its key equals the published key, and the encrypted backup (Argon2id + AES-256-GCM, Decision #59) was stored. 70 s in all after the files.
- **Restore** (app uninstalled and installed again, same passport, same password): π_doc made again in 3.8 s; the service recognised the person and refused a second enrolment (409, `alreadyEnrolled`) and returned the encrypted backup; the app opened it with the password and the membership was back on the phone. The member number shown was the same as after the enrolment (checked by the founder on the phone; the number itself is never sent).

### App v0.10: face check before enrolment, and a wrong password (21 November 2026, 23:20 UTC+4)

The app was uninstalled and v0.10 installed; the same passport was read again.

- **Face check:** passed on the phone with the first selfie (similarity 0.69, threshold 0.40); nothing about the face was sent.
- **Wrong password:** π_doc made again in 3.5 s; the service refused a second enrolment and returned the encrypted backup; the app could not open it with the wrong password, said so, and offered **Restore**.
- **Restore:** with the right password typed in, Restore opened the backup and the membership was back on the phone ("Restored").
- Found and fixed (v0.10.1): a retried restore was not added to the shared result; each retry now adds a line.
- Learned: the app blocks screenshots, but a photo of the screen taken with another device shows the member number. The volunteers' guide says to share the result text only, never a picture of the screen.


## The pilot's key set: registration on the ledger opens (Decision #61)

One transaction from the test wallet (the identity registry's governance), from `web/plan6.json` (`plan6.js`): `setKeySetRoot` on the IdentityRegistry of deployment 1 (`0xcb01c33b24b4CAC194B6eE6a649Aef413c307091`). From then on, only credentials signed by these two keys can register, and those signed by the earlier synthetic keys no longer can.

| Index | Key | Leaf |
|---|---|---|
| 0 | the pilot's enrolment service (credential key `A`) | `9973527310186799711322196578667569713052864781320094708470015773211842834432` |
| 1 | TEST-ONLY filler key (repository secret `FILLER_KEY`, made in the browser with `web/enrol-secrets.html`; public leaf printed by the workflow "Registry batches" in mode `key-leaf`) | `9459323648882575124428597641484282618789115045989124024858543596374578381006` |

Key-set root: `3472063742960412377469484366739866747510628411572475512648978653190708911550` (`web/keyset.json`; also the enrolment service's `KEY_SET`, so that phones get their path from `/info`). The identity tree's 12 leaves registered so far (plans 1, 2 and 4) are in `web/identity-tree.json`; the batch job checks them against the registry's root on its first run and keeps the file up to date.

### The first real registration (23 November 2026, 23:26 UTC+4)

After the key set was set (one transaction, checked on the plan page) and the batch job's first run had confirmed the 12 leaves registered so far against the registry's root, the founder installed app v0.11 and restored his membership (the enrolment service's eth_call to DocVerifier had first failed once with "the test network did not answer", HTTP 502, and passed on a retry a minute later). The app picked a random registration time about 8.5 hours later. The first time the app was opened after it, the phone built π_reg's inputs from `member.json` and the key set from `/info`, proved and verified π_reg in 920 ms, and sent it through the relay: **position 12** in the identity registry, the first membership from a real passport on the public ledger. It waits in the next batch of 4; if no one else registers within 48 hours, the batch job completes it with filler members.


## Deployment 5: every member answers every open poll (Decision #62)

Prepared by `plan7.js` (`web/plan7.json`, start nonce 19, deployer `0x6FbCf03F4b89715df2c8F9cC77AF0D0C5a4b79dB`): seven contracts and the pilot's first poll.

| Step | What | Planned address |
|---|---|---|
| 1 | RegistrationVerifier (π_reg with notBefore; TEST-ONLY key) | `0xBddD70613128B2630Bb95F5Cb477adabF999700f` |
| 2 | IdentityRegistry (insertion at once; Decision #62) | `0x945cBfd04c6Bda5E2eC3Ce48d0Ce52cDFbA3784b` |
| 3 | RevocationRegistry (revoked handles readable) | `0xb89Eff017fd6d29276937546E91aa267D65250B5` |
| 4 | Groth16Verifier (π_vote with the identity root public; TEST-ONLY key) | `0xBb9E341C50f5195b331E53887cF73aad0E82887d` |
| 5 | BallotBatchVerifier (19 public inputs per ballot) | `0x24ac6065CdE8356b7095CD45a34c2db5214fAf8A` |
| 6 | RecoveryVerifier (π_recover with both identity roots public; TEST-ONLY key) | `0x802Cc43CD7a9beD92F09C782dae7E78a0D1Dfda3` |
| 7 | ProofOfOnePolls (any root the registry has held; Decision #62) | `0xaD174b869FD926c249AE6e9516e58D0901b9aD6E` |
| 8 | Create the pilot's first poll (poll id 1 of deployment 5; 4 options, open for 14 days) | `0xaD174b869FD926c249AE6e9516e58D0901b9aD6E` |

Reused: Poseidon(2), Poseidon(3), Poseidon(5), RevokeVerifier (deployment 1) and the TallyVerifier of deployment 3 (byte-for-byte the contracts the reference builds today). The identity registry starts empty, with the key set of plan 6; members enrol again with app v0.12, whose credentials carry `notBefore`, and register within minutes. The relay (`wrangler.toml`) points at the new polls contract and registry, and the workflow "Registry batches" is no longer needed.

The poll: *"Pilot test poll: which part of the app should we improve first?"* (text in six languages in `../relay/src/pilot-polls.json`), adults on 24 November 2026, any document valid in November 2026 or later, up to 20 changes of answer, 3 of 5 synthetic trustees. Not yet sent.


## Deployment 6: fixes from the review of deployment 5 (Decision #65)

Deployment 5 was sent on 24 November 2026: all 8 steps of `web/plan7.json` (start nonce 19) are done, at the planned addresses above. Its poll (poll 1 of `0xaD174b869FD926c249AE6e9516e58D0901b9aD6E`) is not used for the pilot: the two reviews of deployment 5 (`docs/review/`) found flaws to fix first.

Prepared by `plan8.js` (`web/plan8.json`, start nonce 27):

| Step | What | Planned address |
|---|---|---|
| 1 | ProofOfOnePolls (review fixes B2, C5; registries and verifiers of deployment 5) | `0x5DcBFaA0111d75047AACa970bbb429e2e6fD396d` |
| 2 | Create the pilot's poll (poll id 1 of deployment 6; 4 options, open for 14 days, text in eight languages) | `0x5DcBFaA0111d75047AACa970bbb429e2e6fD396d` |

Reused from deployment 5: IdentityRegistry, RevocationRegistry, RegistrationVerifier, Groth16Verifier, BallotBatchVerifier, RecoveryVerifier; and Poseidon, RevokeVerifier, TallyVerifier from earlier deployments. The relay (`wrangler.toml`) and app v0.14 (`Chain.kt`) point at the new polls contract. Not yet sent.
