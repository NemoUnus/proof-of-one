# Relay top-up (test coins)

The relay pays the volunteers' registrations and ballots on Base Sepolia from its own account. `topup.mjs` keeps that account funded: once a day (`.github/workflows/relay-topup.yml`) it reads the balance from the public endpoint and, below the target (0.03 ETH), asks Coinbase's developer faucet (CDP) for test ETH sent straight to the relay's account, 0.0001 ETH a request, at most 0.1 ETH per address in 24 hours. It stops at the target, after 300 requests, or when Coinbase says the limit is reached.

- **Test coins only.** The faucet serves test networks; the script holds and moves no key.
- **Credentials:** `CDP_API_KEY_ID` and `CDP_API_KEY_SECRET`, an API key of a Coinbase Developer Platform account, kept as repository secrets and set by the founder (Decision #69: such accounts may be used for the project's needs and are recorded on the founder's private list).
- **Tests:** `npm test` (the logic with stand-ins for the faucet and the endpoint). **Dry run:** `node topup.mjs --dry`, or run the workflow by hand with "Dry run" ticked.
- Manual funding remains possible from the test-only wallet with `reference/testnet/web/fund.html`.
