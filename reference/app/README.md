# Voter app — first piece: "show my recorded answer"

> **Test network, synthetic voters only. Not audited.** (Decision Log #45, #49; schedule 1.4-00 and 1.4-08)

When a phone sends a ballot, it keeps a private **receipt**: the poll, the ballot's nullifier, the poll key and the four random numbers used to encrypt the four positions of the ballot. This page uses the receipt to show which answer the public ledger holds for that ballot.

**Open it:** `https://nemounus.github.io/proof-of-one/reference/app/web/`

## How it works

1. Each option j of a ballot is encrypted as C_j = (r_j·G, v_j·G + r_j·PK), with v_j = 1 for the chosen option and 0 for the others.
2. With the r_j from the receipt, the page rebuilds the ballot that each possible answer would have produced.
3. It hashes each one as the contract does (`_ctHash`) and compares with the hash stored in `ballots(pollId, nf)`.
4. The answer whose hash matches is the recorded answer. If none matches, the ledger holds a ballot that is not the one this receipt made.

Nothing is decrypted, and no other ballot is read. The code is [`web/check.js`](web/check.js): about 70 lines of Baby Jubjub arithmetic with JavaScript BigInt, and ethers 6.13.4 (shared with `../testnet/web/`) to read the ledger.

## Receipts

- The four receipts on the page belong to the **synthetic** voters of the Phase 1a test poll and are published in `../testnet/web/plan.json` on purpose.
- A real receipt reveals its owner's answer to anyone who holds it. In the app it stays on the phone and is deleted when the receipt window ends (30 days by default, Decision #45).

## Tests

```bash
node test/check.test.js                       # check.js against the reference implementation (tally/)
node test/e2e.js ../testnet/web/plan.json      # local chain + headless browser: each synthetic voter sees their answer; a tampered receipt is rejected
```

The end-to-end test needs Playwright with Chromium.

## Limits

- The page trusts the node it reads from. By default it reads from the test network's public node; `?rpc=` selects another node and the page then shows a warning. The app should compare two independent nodes or verify a state proof (implementation note N28).
- It checks that the ballot is **recorded**. That it is also **counted** follows from the contract's own checks at publication (on-chain tally verification), which anyone can re-run with the recount tool in `../tally/`.

Written by the Proof of One AI agents Psephos and Ostrakon (see [AGENTS.md](../../AGENTS.md)). Licence: Apache-2.0.
