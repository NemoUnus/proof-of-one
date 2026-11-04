# Which public test network for Phase 1a v0.1

*Proof of One research note, task 1.0-02 (Decision Log #49). Status: recommendation for the founder, 4 November 2026. Drafted by the project's AI agents.*

## 1. What matters for Phase 1a

Phase 1a uses synthetic identities only, so the test network's own security matters less than four other things:

1. **Same software as the production network that would follow.** Contracts, proofs and gas figures should carry over.
2. **Forced inclusion.** The design sets a 48-hour minimum poll length so that a censored ballot can be forced in through Ethereum (whitepaper §8). The shorter the network's forced-inclusion delay, the larger the margin.
3. **Free test coins without an identity.** The founder's anonymity rules out faucets that need a company account, a phone number or a funded mainnet wallet.
4. **Maturity of the matching production network.** At least L2BEAT Stage 1.

## 2. Candidates

| | Base Sepolia | Arbitrum Sepolia |
|---|---|---|
| Stack | OP Stack (same as OP Mainnet) | Arbitrum Nitro |
| Production network's maturity | Stage 1 since January 2026, like Arbitrum One and OP Mainnet, as reported in a forum summary of L2BEAT [n1] | Stage 1 since January 2026 [n1] |
| Forced-inclusion delay | **12 hours**: the OP Stack sequencing window [n2] | **24 hours**: the default delay; a reduction was proposed in 2023, with no record found of a change [n3] |
| Fees on the production network | Usually lower: a median swap cost about $0.018 on Base against $0.024 on Arbitrum One in mid-2026 [n4] | Minimum base fee 0.02 gwei [n5] |
| Faucets without an account (checked by others on 13 October 2026) | Chainlink: connect a wallet. QuickNode: no account, no mainnet balance for the basic amount. Avoid Coinbase CDP, which needs an account, and Alchemy, which needs a funded mainnet wallet [n6] | Several faucets exist; their requirements were not checked |
| Sequencer operator | Coinbase | Offchain Labs |
| BN254 pairing precompile (Groth16) | Yes (EVM-equivalent) | Yes |

Both production networks have a single company running the sequencer, which can delay transactions up to the forced-inclusion limit. Neither is more neutral than the other in that respect.

## 3. Recommendation

1. **Deploy first to Base Sepolia.**
   - Its forced-inclusion delay is half of Arbitrum's, which leaves more margin inside a 48-hour poll.
   - Its fees are usually lower.
   - At least two of its faucets need no account and no mainnet funds.
2. **Then to Arbitrum Sepolia, as a portability test.** The deployment is the same, and running on two different rollup stacks shows the code does not depend on one of them.
3. **Leave the production choice (activity 1.6-02) open.** Base's single corporate sequencer must be weighed in the neutrality review. The production decision can come after Phase 1a's measurements.

## 4. How the deployment will be done

The project's tools cannot reach test-network nodes, so the deployment runs **in the founder's browser**:
- A single static page in the repository (served by GitHub Pages, like the phone benchmark) holds the compiled contracts.
- It deploys them through the founder's test-only wallet; the founder approves each transaction in the wallet.
- It shows the contract addresses, which are then published in the repository.

No software needs to be installed. The page is written in task 1.0-04.

## Sources

- [n1] Forum summary citing L2BEAT, 13 March 2026: https://blockeden.xyz/forum/t/only-3-l2s-reached-stage-1-decentralization-after-years-what-does-this-say-about-our-industry/2311 (secondary; check on L2BEAT before the production choice)
- [n2] OP Stack documentation, forced transactions: https://docs.optimism.io/stack/transactions/forced-transaction
- [n3] Arbitrum forum, proposal to decrease the censorship delay from 24 to 4 hours (2023): https://forum.arbitrum.foundation/t/proposal-decrease-censorship-delay-from-24-hours-to-4-hours/13047/1
- [n4] L2 fees in 2026: https://hoge.gg/l2-fees-fell-another-38-but-the-user-moved-to-base-not-arbitrum/
- [n5] Arbitrum proposal raising the minimum base fee to 0.02 gwei: https://forum.arbitrum.foundation/t/aip-raise-the-gas-target-min-l2-base-fee-implement-improvements-to-the-pricing-algorithm/30182
- [n6] Base Sepolia faucets 2026 (checked 13 October 2026): https://eco.com/support/en/articles/17593749-base-sepolia-faucets-2026-chain-id-84532-setup
