# Test ballot relay

> **Synthetic test polls only. Not audited.** (activity 1.6-04, Phase 1a)

A phone sends its ballot to the relay instead of to the network, and the relay submits it with its own test coins. Voters then need no wallet and no coins. It runs as a [Cloudflare Worker](https://developers.cloudflare.com/workers/) (free plan: 100,000 requests a day).

## What it does

1. **GET** returns the relay's address, the poll ids it accepts and its balance; the voting page shows this.
2. **POST** takes one ballot as JSON: `pollId`, `nf`, `ct` (16 words), `prev` (16 words, zeros for a first ballot), and the proof `a`, `b`, `c`.
   - It checks the shape of the request and that the poll is one it accepts.
   - It simulates `vote()` with `eth_call`. The contract verifies the proof there, so a ballot that would fail is refused and costs nothing.
   - It submits the ballot and returns the transaction hash. The page then waits for the transaction and checks the recorded answer itself.

## Registrations (Decisions #61 and #62)

**POST `/register`** takes a phone's registration on the identity registry: `leaf`, `cn` and the π_reg proof `a`, `b`, `c`. The phone sends it a few minutes after enrolment (a random delay of 1–10 minutes, Decision #62). The relay asks the registry whether the credential `cn` is already used (then it answers 409 with `alreadyRegistered`, so that a phone restored from a backup knows it is done), simulates `register()` (the registry checks the proof there), submits it under a gas cap, and waits up to 20 seconds for the block so that the phone learns its position. The registry inserts the membership into the identity tree in the same transaction, so the member can answer every open poll at once. Accepted only when the variable `REGISTRY` is set.

The relay sees a registration's network address, as it does for ballots. In the pilot the same operator also runs the enrolment service. With a delay of minutes instead of hours, and no batches, linking a person to their registry entry is easier for that operator than under Decision #61; what it learns is that a person is a member, never how they answer (Decision #62).

## What the relay can and cannot do

| | |
|---|---|
| Change a ballot | **No.** The proof binds the ciphertexts, the nullifier and the poll. |
| Read a ballot | **No.** It sees only ciphertexts, as everyone does on the ledger. |
| Refuse or delay a ballot | **Yes.** The page can always send the same ballot with a wallet instead; on a production network, forced inclusion through Ethereum remains (whitepaper §8). |
| See who sends | **Yes**: the relay operator and Cloudflare see the voter's network address. This code keeps no logs, and Worker logs are turned off in `wrangler.toml`. Network privacy (Tor, OHTTP) is a later design step. |
| Lose more than test coins | **No.** It holds a test-only key, sends only `vote()` and `register()` to the configured contracts, and caps the gas per transaction. |

## Deploy (Cloudflare dashboard, from this repository)

The project's relay runs at `https://proof-of-one-relay.nemounus.workers.dev` (see [DEPLOYMENT.md](../testnet/DEPLOYMENT.md)).

1. Workers & Pages → Create → **Import a repository** → this repository; root directory `reference/relay`. Cloudflare builds and deploys it with Wrangler on every change.
2. Settings → **Runtime** variables and secrets (not the Build variables) → add the **secret** `RELAY_KEY`: the private key of a test-only account that holds only test coins. Never put it in a file.
3. Send the account a little test ETH. One ballot costs about 0.00001 test ETH on Base Sepolia.
4. Put the Worker's address in [`../app/web/config.json`](../app/web/config.json).

The other settings are in `wrangler.toml`: `RPC_URL`, `CHAIN_ID`, `POLLS`, `POLL_IDS` and `REGISTRY`.

## Routes

| Route | What it does |
|---|---|
| `POST /` | a ballot `{pollId, nf, idRoot, ct, prev, a, b, c}`: checked against the registry's roots, simulated, then sent with `vote()` |
| `POST /register` | a phone's π_reg `{leaf, cn, a, b, c}`: simulated, then sent with `register()`; the membership enters the identity tree at once (Decision #62) |
| `GET /state?poll=<id>[&nf=<nullifier>]` | everything a phone needs to answer a poll, read from the contracts at that moment: the identity leaves and root, the revoked handles and root, the poll's public values, its text ([`src/pilot-polls.json`](src/pilot-polls.json), whose hash the poll holds) and, with `nf`, the ballot recorded for it (hash and count), so that a phone can show the recorded answer |
| `GET /` | the relay's account, balance and configuration |

Every value `/state` returns is public on the ledger. From app v0.14 the phone uses only the two lists and the text from it, and checks them against values it reads from the contracts itself (the newest identity root and leaf count, the revocation root, `metadataHash`); the poll's key, times, policy and the recorded ballot come from the contracts, never from the relay (review of deployment 5, Decision #65).

## Tests

```bash
npm install
CHAINCHECK_JAR=/path/to/chaincheck.jar node test/pilot.test.mjs ../testnet/web/plan7.json ../testnet/web/plan8.json
# local chain with deployment 5 replayed at the planned addresses: a π_reg is registered and
# enters the tree at once; /state gives the trees, the poll and its text; a member registered
# after the poll opened answers it; the recorded answer is found from the ballot hash and
# changed; two ballots built from one state with different answers share no random values
# and the stale one is refused; the app's chain reader (CHAINCHECK_JAR, built from
# android-prototype/test/ChainCheck.kt and Chain.kt) reads what ethers reads; an unknown
# identity root and another poll are refused
```

The tests of the earlier deployments (ballots without the identity root, batch insertion) were removed with deployment 5; they are in the repository's history. The voting page in [`../app/web`](../app/web) still makes ballots for deployments 1–3 and does not work with this relay any more.

## Open points

- The free plan allows 10 ms of CPU time per request. The first live ballot (5 November 2026) went through within it; the Worker's startup time was 8 ms. To be watched as ballots increase.
- One relay is one operator. Several independent relays, chosen by the phone at random, are the design for later phases.

Licence: AGPL-3.0-only. Written by the Proof of One AI agents Ostrakon and Argus (see [AGENTS.md](../../AGENTS.md)).
