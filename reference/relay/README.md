# Test ballot relay

> **Synthetic test polls only. Not audited.** (activity 1.6-04, Phase 1a)

A phone sends its ballot to the relay instead of to the network, and the relay submits it with its own test coins. Voters then need no wallet and no coins. It runs as a [Cloudflare Worker](https://developers.cloudflare.com/workers/) (free plan: 100,000 requests a day).

## What it does

1. **GET** returns the relay's address, the poll ids it accepts and its balance; the voting page shows this.
2. **POST** takes one ballot as JSON: `pollId`, `nf`, `ct` (16 words), `prev` (16 words, zeros for a first ballot), and the proof `a`, `b`, `c`.
   - It checks the shape of the request and that the poll is one it accepts.
   - It simulates `vote()` with `eth_call`. The contract verifies the proof there, so a ballot that would fail is refused and costs nothing.
   - It submits the ballot and returns the transaction hash. The page then waits for the transaction and checks the recorded answer itself.

## What the relay can and cannot do

| | |
|---|---|
| Change a ballot | **No.** The proof binds the ciphertexts, the nullifier and the poll. |
| Read a ballot | **No.** It sees only ciphertexts, as everyone does on the ledger. |
| Refuse or delay a ballot | **Yes.** The page can always send the same ballot with a wallet instead; on a production network, forced inclusion through Ethereum remains (whitepaper §8). |
| See who sends | **Yes**: the relay operator and Cloudflare see the voter's network address. This code keeps no logs, and Worker logs are turned off in `wrangler.toml`. Network privacy (Tor, OHTTP) is a later design step. |
| Lose more than test coins | **No.** It holds a test-only key, sends only `vote()` to the configured contract, and caps the gas per ballot. |

## Deploy (Cloudflare dashboard, from this repository)

The project's relay runs at `https://proof-of-one-relay.nemounus.workers.dev` (see [DEPLOYMENT.md](../testnet/DEPLOYMENT.md)).

1. Workers & Pages → Create → **Import a repository** → this repository; root directory `reference/relay`. Cloudflare builds and deploys it with Wrangler on every change.
2. Settings → **Runtime** variables and secrets (not the Build variables) → add the **secret** `RELAY_KEY`: the private key of a test-only account that holds only test coins. Never put it in a file.
3. Send the account a little test ETH. One ballot costs about 0.00001 test ETH on Base Sepolia.
4. Put the Worker's address in [`../app/web/config.json`](../app/web/config.json).

The other settings are in `wrangler.toml`: `RPC_URL`, `CHAIN_ID`, `POLLS` and `POLL_IDS`.

## Tests

```bash
npm install
node test/relay.test.mjs ../testnet/web/plan.json ../testnet/web/plan2.json
# local chain: a valid ballot is submitted and recorded; a malformed ballot, a ballot for another
# poll and a ballot whose proof does not match are refused, and a refused ballot costs nothing
```

The voting page's end-to-end test ([`../app/test/e2e-vote.js`](../app/test/e2e-vote.js), with `RELAY=src/index.js`) also votes and re-votes through the relay from a browser with no wallet.

## Open points

- The free plan allows 10 ms of CPU time per request. The first live ballot (5 November 2026) went through within it; the Worker's startup time was 8 ms. To be watched as ballots increase.
- One relay is one operator. Several independent relays, chosen by the phone at random, are the design for later phases.

Licence: AGPL-3.0-only. Written by the Proof of One AI agents Ostrakon and Argus (see [AGENTS.md](../../AGENTS.md)).
