# Phase 1a: a synthetic poll on a public test network

> **Synthetic identities only. TEST-ONLY trusted setups. Not audited.** Never use with real people, real documents or real funds (Decision Log #49).

This package runs one complete poll on a public Layer-2 test network, from start to finish. The test network chosen first is Base Sepolia ([choice](../../docs/research/l2-test-network-choice-v0.1.md)). The poll has four synthetic members, each with a synthetic credential from a simulated enclave, and four answer options. Its keys come from three of five synthetic trustees.

| Step | Transactions |
|---|---|
| Deploy the reference contracts | 11 |
| Register the 4 members with registration proofs; insert them as one batch | 5 |
| Create the poll | 1 |
| Submit 4 encrypted ballots with ballot proofs, in one batch | 1 |
| After the 48-hour poll closes: publish the result, which the contract checks against its own encrypted totals | 1 |
| After the 7-day challenge period: finalize | 1 |

**Status:** deployed on Base Sepolia on 5 November 2026; the poll is open. See [DEPLOYMENT.md](DEPLOYMENT.md).

## How it works

- **`plan.js`** prepares every transaction in advance for one wallet on one chain, starting at the wallet's current nonce (0 for a fresh wallet; a third argument gives another, for example after a bridging transaction). Contract addresses follow from the wallet address and its nonce, so the ballot proofs, which are bound to this chain and this contract, can be made beforehand. The output is `web/plan.json`.
- **`verify-plan.js`** replays the plan on a local EVM, with the same chain id and wallet, and checks every address, the totals and the final state.
- **`web/index.html`** sends the plan's transactions from the founder's browser wallet, one step per click. It reads progress from the chain, never from the browser. Before sending, it simulates each transaction, so one that would fail is not sent. It refuses to deploy if the wallet's nonce does not match the plan.

The page is served by GitHub Pages at `https://nemounus.github.io/proof-of-one/reference/testnet/web/`. It uses ethers 6.13.4, copied into `web/` (MIT licence), and loads nothing from other sites.

## Run the checks locally

```bash
# needs ../contracts (built), ../tally, ../ballot-circuit and ../enrolment-circuit (with their TEST-ONLY setups)
node plan.js 84532 0xYourTestWalletAddress [startNonce] > web/plan.json
node verify-plan.js web/plan.json impersonate   # replays as the deployer without its key (local EVM only)
```

Measured locally: the whole plan uses about 25 million gas, most of it for deploying the contracts. The page was also tested end to end in a headless browser against a local chain, ending in the state "Final" with totals 1, 2, 0, 1.

The plan also publishes the receipts of the four synthetic voters. With them, anyone can try the "show my recorded answer" page in [`../app/`](../app/) against the test poll. `verify-plan.js` runs the same check after the ballots.

## Poll 2: vote from your phone

- **`plan2.js`** prepares 7 more transactions for the same wallet and contracts (no deployments): a new synthetic enclave key set (`setKeySetRoot`, by the registry's governance, which is the deployer), 4 more synthetic members whose kits are **published** in `web/plan2.json`, their batch insertion, and poll 2, open for 7 days. The page sends them with `?plan=plan2.json`.
- Anyone can then vote from a phone with the app prototype, [`../app/web/app.html`](../app/web/app.html) (first with [`../app/web/vote.html`](../app/web/vote.html), which it replaces).
- After the close, the page shows the encrypted totals and the ballot chain as one line to copy. **`publish.js`** turns them into the "publish" transaction: three of the five synthetic trustees decrypt the totals with DLEQ proofs, which the contract checks. The trustee shares are kept privately by the AI team.

## Deployment 3: a recovery ballot

- **`plan4.js`** prepares deployment 3 and test poll 4: the polls contract with recovery ballots, a re-enrolment of member 7 with a handle linked to the old one, and the revocation of member 7's old identity after "a thief" has voted with it. Member 7 then sends a recovery ballot from the app prototype. See [`DEPLOYMENT.md`](DEPLOYMENT.md).
- **`plan3.js`** now takes the polls contract of deployment 2 from the published `web/plan3.json`, since the reference contract has since gained recovery ballots.

## The pilot's registrations (Decision #61)

- `plan6.js` makes the one transaction that sets the identity registry's key set for the pilot (the enrolment service's key and a TEST-ONLY filler key), and writes `web/keyset.json` (published to the phone through the enrolment service's `KEY_SET`) and `web/identity-tree.json` (the 12 leaves registered so far).
- `batch-job.js` (**not used since deployment 5**, whose registry inserts each registration at once; kept for the record, and it needs the relay's `/batch`, which was removed) ran every hour in the workflow "Registry batches": it read new registrations, inserts each full batch of 4 through the relay with a batch-insertion proof, completes a batch left incomplete for 48 hours with filler members, and commits the updated `web/identity-tree.json`, from which phones find their path in the tree.
- `node test/batch-job.e2e.js web/plan.json` ran the whole path on a local chain: phones register through the relay, the full batch is inserted, an incomplete batch gets its fillers once its wait is over and is inserted, and the published tree gives the registry's root throughout.

## Deployment 5: every member answers every open poll (Decision #62)

- **`plan7.js`** prepares deployment 5 and the pilot's first poll: a new RegistrationVerifier (π_reg with the identity's `notBefore`), an IdentityRegistry that inserts each registration into the tree at once and keeps its leaves and every root it has held, a RevocationRegistry whose revoked handles are readable, the ballot, batch and recovery verifiers with the identity root public, and a ProofOfOnePolls that accepts any root the registry has held; then the poll (4 options, 14 days). Poseidon, RevokeVerifier and the TallyVerifier of deployment 3 are reused (the same bytecode). It also writes the poll's text in six languages to [`../relay/src/pilot-polls.json`](../relay/src/pilot-polls.json) (the poll holds its Keccak-256 as `metadataHash`) and the poll's synthetic trustee shares to a private file.
- Phones read everything they need from the relay's `GET /state` (leaves, revoked handles, roots, the poll and its text, the ballot recorded for their nullifier); no published tree file and no batch job.
- `node ../relay/test/pilot.test.mjs web/plan7.json` replays the plan on a local chain at the planned addresses and runs registration, answering, finding the recorded answer and changing it through the relay.

## Limits

- The poll's members, documents, enclave keys and trustee keys are generated by `plan.js` and kept by the AI team. This shows that the contracts and proofs work on a public network; it does not show anything about real enrolment.
- The test network's sequencer is operated by one company, as is its production network's.
