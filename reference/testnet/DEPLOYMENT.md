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
| 20. Finalize | 7 days after step 19 | state Final |

## Poll 2: vote from your phone

Sent from the same wallet on 5 November 2026 with [`web/plan2.json`](web/plan2.json) (7 steps, no new contracts):

- a new synthetic enclave key set, 4 published synthetic members (5–8) and their batch insertion;
- poll 2, open for 7 days, until 12 November 2026.

The first ballot was made and sent from a phone the same day with [`../app/web/vote.html`](../app/web/vote.html): the ballot proof took 4.0 s on the phone and was verified there, the contract accepted it, and the page then showed the recorded answer read back from the network.

The same day the [test relay](../relay/) went live at `https://proof-of-one-relay.nemounus.workers.dev` (relay account `0x3dB9d15202Bd291558889b42eb4291e288797fb9`, funded with 0.0003 test ETH). The first ballot through it was sent from a browser with no wallet: proved in 1.7 s, submitted and paid for by the relay, and its recorded answer read back.

After the close, the encrypted totals and ballot chain shown by the page go to [`publish.js`](publish.js), which prepares the "publish" step.

## Notes

- **Wallet warning.** MetaMask flagged the page (served from `github.io`) as possibly deceptive, and marked each transaction as a high-risk request. Each request was checked before it was confirmed: a contract deployment or a call, no change to the wallet’s assets, and a fee of a few cents at mainnet prices. The page is open source in this folder. A report to MetaMask asking for a review of the warning is still to be sent.
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

Known limit: after the revocation, the other members' published kits still carry the revocation path of the old root, so their re-votes are refused after the grace. The app does not yet rebuild the revocation path from the ledger (implementation note N33).
