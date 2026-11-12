# Voter app — first pieces: vote from your phone, and "show my recorded answer"

> **Test network, synthetic voters only. Not audited.** (Decision Log #45, #49; schedule 1.4-00 and 1.4-08)

When a phone sends a ballot, it keeps a private **receipt**: the poll, the ballot's nullifier, the poll key and the four random numbers used to encrypt the four positions of the ballot. This page uses the receipt to show which answer the public ledger holds for that ballot.

**Open them:**
- Vote from your phone (test poll 2): `https://nemounus.github.io/proof-of-one/reference/app/web/vote.html`
- Show my recorded answer (test poll 1): `https://nemounus.github.io/proof-of-one/reference/app/web/`

## Vote from your phone (`web/vote.html`)

1. Choose one of four **published synthetic member kits** (members 5–8 of the test registry). A kit is what a phone holds after enrolment, plus the poll's public values: the member secret, attributes, Merkle paths, nullifier and poll key.
2. Choose an answer. The phone encrypts it (one-hot exponential ElGamal, in `check.js`) and makes the ballot proof π_vote in the browser with snarkjs and the proof files of `../phone-bench/`. It verifies the proof on the phone before anything is sent.
3. **Send** submits `vote()` either **through the relay** ([`../relay/`](../relay/), no wallet needed; its address is in `web/config.json`) or from a wallet in the browser (for example MetaMask's), on the test network. A re-vote names the ballot it replaces: from this phone's own receipt, or else from the ledger's `Ballot` event, since ballots are public ciphertexts.
4. **Show my recorded answer** runs the check below against the ledger.

The kits are shared, so anyone can replace a kit's ballot (up to 50 ballots per kit); the latest counts. With a real identity only its holder could. With the relay, sending needs nothing; with a wallet, a little test ETH.

## The integrated prototype (`web/app.html`)

`https://nemounus.github.io/proof-of-one/reference/app/web/app.html` joins the pieces: add up to four people on one phone (synthetic documents, each person with their own PIN, Decision Log #54), see each person's open polls, answer, change the answer, and see results.

- **Receipts.** Each ballot's receipt is kept on the phone, encrypted with that person's PIN key (AES-GCM, PBKDF2), until 30 days after the poll closes (Decision Log #54, amended). A changed answer uses it to name the ballot it replaces.
- **Without a receipt** (for example after reinstalling), the replaced ballot is read from the public record: first an explorer's log index, then several public nodes, every node asked before a window counts as empty (implementation note N34).
- **Revocations in open polls.** If someone has been revoked since a kit was made, the app reads the public list of revoked handles, rebuilds the revocation tree, checks its root against the registry's, and proves against it ([`web/revocation.js`](web/revocation.js), implementation note N33). It uses Poseidon from [poseidon-lite](https://github.com/vimwitch/poseidon-lite) 0.3.0 (MIT), bundled as `web/poseidon.min.js` (`poseidon2`, `poseidon3`, `poseidon5`; esbuild 0.21.5, IIFE, minified).

## How it works

1. Each option j of a ballot is encrypted as C_j = (r_j·G, v_j·G + r_j·PK), with v_j = 1 for the chosen option and 0 for the others.
2. With the r_j from the receipt, the page rebuilds the ballot that each possible answer would have produced.
3. It hashes each one as the contract does (`_ctHash`) and compares with the hash stored in `ballots(pollId, nf)`.
4. The answer whose hash matches is the recorded answer. If none matches, the ledger holds a ballot that is not the one this receipt made.

Nothing is decrypted, and no other ballot is read. The code is [`web/check.js`](web/check.js): about 100 lines of Baby Jubjub arithmetic, encryption included, with JavaScript BigInt, and ethers 6.13.4 (shared with `../testnet/web/`) to read the ledger.

## Receipts

- The four receipts on the page belong to the **synthetic** voters of the Phase 1a test poll and are published in `../testnet/web/plan.json` on purpose.
- A real receipt reveals its owner's answer to anyone who holds it. In the app it stays on the phone and is deleted when the receipt window ends (30 days by default, Decision #45).

## Tests

```bash
node test/check.test.js                       # check.js against the reference implementation (tally/)
node test/e2e.js ../testnet/web/plan.json      # local chain + headless browser: each synthetic voter sees their answer; a tampered receipt is rejected
node test/e2e-vote.js ../testnet/web/plan.json ../testnet/web/plan2.json
#   local chain + headless browser with a test wallet: vote, re-vote from the same browser and from
#   another one, check the recorded answer each time; with SECRETS=<trustee shares file> it also
#   publishes and finalizes poll 2 and checks the totals
node test/revocation.test.js                  # revocation.js against the reference trees (ballot-circuit/); needs poseidon-lite
node test/app.e2e.js ../testnet/web/plan.json ../testnet/web/plan2.json <plan3.json> <poll3-secrets.json>
#   the integrated prototype on a local chain: profiles, votes, changed answers from the receipt,
#   from public nodes and from an explorer, a changed answer after a revocation, and the result
```

The end-to-end tests need Playwright with Chromium.

## Limits

- The page trusts the node it reads from. By default it reads from the test network's public node; `?rpc=` selects another node and the page then shows a warning. The app should compare two independent nodes or verify a state proof (implementation note N28).
- It checks that the ballot is **recorded**. That it is also **counted** follows from the contract's own checks at publication (on-chain tally verification), which anyone can re-run with the recount tool in `../tally/`.

Written by the Proof of One AI agents Psephos and Ostrakon (see [AGENTS.md](../../AGENTS.md)). Licence: Apache-2.0.
