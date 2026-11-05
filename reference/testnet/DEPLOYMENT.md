# Phase 1a deployment on Base Sepolia

> **Synthetic identities only. TEST-ONLY trusted setups. Not audited.** (Decision Log #49)

First run of the plan in this folder on a public test network, sent by Nemo Unus from a test-only wallet.

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

## Still to do

| Step | When | Expected |
|---|---|---|
| 19. Publish the result | after the poll closes on 7 November 2026 | totals 1 · 2 · 0 · 1, checked by the contract against its encrypted totals |
| 20. Finalize | 7 days after step 19 | state Final |

## Notes

- **Wallet warning.** MetaMask flagged the page (served from `github.io`) as possibly deceptive, and marked each transaction as a high-risk request. Each request was checked before it was confirmed: a contract deployment or a call, no change to the wallet’s assets, and a fee of a few cents at mainnet prices. The page is open source in this folder. A report to MetaMask asking for a review of the warning is still to be sent.
- **Test coins** came from a faucet that asks only for an address and a captcha.
