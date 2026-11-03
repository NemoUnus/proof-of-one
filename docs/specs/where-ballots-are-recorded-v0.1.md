# Where ballots are recorded: a comparison v0.1

*Proof of One design note, at the founder's request (Decision Log #44: "the ledger is to be compared again"). Status: draft for decision, 3 November 2026. Drafted by the project's AI agents. Costs are estimates from measured gas and published prices, not measurements on a public network.*

## 1. The question

From the start, every ballot has been written to an Ethereum Layer-2 network. The founder asked whether that is really needed, or whether a published report would do.

What the two founding properties need is a **public bulletin board** (whitepaper §8, [cost of large polls §4](cost-of-large-polls-v0.1.md)). R1 is that every member can check their own ballot; R2 is that anyone can recount. The board must have four properties:

1. **Append-only:** nothing can be removed or changed after it is recorded.
2. **One view:** everyone sees the same record. An operator must not be able to show a voter a version with her ballot and the public a version without it.
3. **Open to all:** anyone can read everything.
4. **Hard to censor:** no single party can refuse a ballot for long.

What is published stays the same in every option: per ballot, the poll's nullifier and the **encrypted** ballot with its proof; per poll, the trustees' decryption of the totals with proofs. No one's answer is ever published in clear (Decision Log #45). The options differ only in where this is written and who guarantees the four properties.

## 2. The three options

**A. Every ballot on a Layer-2 rollup (current design).** A contract checks each ballot's proof, keeps one ballot per nullifier and, since 3 November 2026, keeps the encrypted totals and checks the published result ([on-chain tally verification](on-chain-tally-verification-v0.1.md)).

**B. Transparency logs with witnesses, anchored on a chain (hybrid).** Ballots are appended to public, append-only logs built as Merkle trees, the technique that makes web certificates publicly auditable (Certificate Transparency, which relies on independent monitors). Independent **witnesses** run by other organisations regularly check and cosign each log's latest state (witness cosigning as specified by Sigsum and C2SP tlog-witness). An honest witness cosigns only a state that extends the one it last saw, so verifiers that require cosignatures from a quorum of witnesses cannot be shown two different versions. Once a day, and at the close of each poll, the log's state (one 32-byte hash) is recorded on a chain. Verifiers check proofs and the one-ballot-per-nullifier rule themselves when they recount; this is already what R2 requires. The **identity registry stays on the rollup**, because registration needs an on-chain check that each credential is used only once, and it happens once per member, not once per poll.

**C. A published report on a website.** The operator publishes the list of nullifiers with encrypted ballots, and the result, as files.

## 3. What each option guarantees

| Property | A. Rollup | B. Logs + witnesses + anchor | C. Website report |
|---|---|---|---|
| R1: a member can check their own ballot | Yes | Yes, with a Merkle proof from the log | Yes, but only against what the operator shows them |
| R2: anyone can recount | Yes | Yes | Yes, from the operator's files |
| Append-only | Yes (the chain) | Yes: the Merkle tree makes any change visible to anyone who checks consistency proofs; the daily anchor fixes it on a chain | **No**: files can be changed; only copies taken by others show it |
| One view for everyone | Yes | Yes, **if** verifiers require cosignatures from a quorum of independent witnesses | **No**: the operator can show different files to different people |
| Hard to censor | Strong: the rollup's sequencer can delay a ballot by up to about a day; forced inclusion through Ethereum bounds this, hence the 48-hour minimum poll length | Medium: a log operator can refuse a ballot. Mitigations: several independent logs; a signed receipt for every accepted ballot, so a refusal after a receipt is provable; direct submission to the rollup as a last resort | **Weak**: the operator can refuse silently |
| Rules enforced (valid proof, one ballot per nullifier) | By the contract, before recording | By every verifier at recount; invalid entries are ignored by a public rule | By every verifier at recount |
| Result checked automatically | Yes: count check and challenges in the contract | Partly: the recount tool checks; the published result and the final log state can be anchored and challenged | No |
| Who must be trusted | Ethereum, the rollup's operator (limited by forced inclusion) and the rollup's upgrade authority (security council or upgrade keys) | That a quorum of witnesses is honest and that at least one log accepts each ballot | The operator |
| Data kept | Rollup history and archives; on Ethereum as blobs for about 18 days | Log operators, witnesses and any mirror | The operator and anyone who copies it |

Option C provides R1 and R2 only on paper. Without one view and append-only, the operator could show a voter her ballot while leaving it out of the version everyone else recounts. That is exactly what Proof of One is meant to make impossible, so **option C is not recommended**.

## 4. Cost

### 4.1 Assumptions (3 November 2026)

- **A ballot in option A:** about 124,000 gas in a batch, plus about 440,000 gas per batch (reference contracts, measured; [contracts README](../../reference/contracts/README.md)). In batches of 64, about 131,000 gas per ballot.
- **Layer-2 gas price:** 0.02 gwei, Arbitrum's minimum base fee and the price shown on 3 November 2026 [p1][p4]. This is a floor: prices rise with demand, and peaks of ten times or more have occurred.
- **ETH price:** about 2,300 US dollars (2,266 on 3 November [p1]; 2,504 on 11 October [p2]).
- **Ballot data:** about 800 bytes with its proof. The cost of posting it to Ethereum is not counted separately. Published median fees for simple transfers on Layer-2 networks (about 1 cent in mid-2026) are higher than this estimate for a ballot, so the figures for option A below are **lower bounds**.
- **Option B:** storage and bandwidth for the logs, a server that checks each ballot's proof before accepting it (a few milliseconds per ballot), and one anchoring transaction per day and per poll.

### 4.2 Estimates

| Ballots in a poll | A. Rollup, 0.02 gwei (lower bound) | A. Rollup, peak (×10) | B. Logs + anchor | C. Website |
|---|---|---|---|---|
| 10,000 | about 60 US dollars | about 600 | a few dollars | almost nothing |
| 1,000,000 | about 6,000 | about 60,000 | tens of dollars | almost nothing |
| 100,000,000 | about 600,000, and see 4.3 | — | a few hundred dollars (80 GB of data, about 80 CPU-hours of proof checking on one core) | almost nothing |

All figures are rough estimates. Option B also has a fixed monthly cost: the log servers, and independent witnesses, which are run by partner organisations rather than paid per ballot.

### 4.3 Capacity, not only price

At about 131,000 gas per ballot, a poll with 1 million ballots needs about 130 billion gas, and a poll with 100 million about 13 trillion. Arbitrum One targets about ten million gas per second [p4]; Base's limit is ten or more times higher. On Arbitrum, a million-ballot poll would fill the whole chain for about 3.6 hours, and a 100-million-ballot poll for about two weeks; even on Base, the larger poll would take more than a day of the whole chain. Before that point fees would rise sharply. **For very large open polls, option A is limited by capacity even more than by price.** Option B has no such limit: logs of this kind are built for thousands of entries per second each [p3], and several logs can run in parallel.

The rollup design of the [cost note](cost-of-large-polls-v0.1.md) §3, which aggregates ballots with a proof and posts only data, reduces A's execution cost. It still needs blob space for every ballot and heavy proving on servers.

## 5. Recommendation

1. **Use both A and B, by poll size.**
   - The identity registry, sampled polls and small open polls stay on the rollup (A). Their cost is small, the contract enforces every rule, and the code exists and is tested.
   - Large open polls are recorded in transparency logs with witnesses and anchored on the rollup (B).
   - Every poll's rules state where its ballots are recorded, and the app checks R1 the same way in both.
2. **Do not use C.**
3. **Next steps:**
   - Measure the real cost of option A on a public test network (activity 1.6).
   - Write the specification of option B and give it its own red-team review: how a voter gets a receipt; how the final ballot set is fixed when several logs are used; what a censored voter does; how witnesses are chosen and what quorum verifiers require.
   - Approach organisations that already run transparency-log witnesses about witnessing for Proof of One.
4. **Founder decision:** whether to adopt this split as Decision Log #46.

## Sources

- [p1] Arbitrum gas tracker, chaingate.dev, 3 November 2026 (0.02 gwei; ETH about 2,266 US dollars): https://chaingate.dev/gas-tracker/arbitrum
- [p2] Ethereum base fee at 0.0673 gwei; ETH at 2,504 US dollars, CryptoTicker, 11 October 2026: https://cryptoticker.io/en/ethereum-price-base-fee-low-october-2026/
- [p3] Tessera v1.0, transparency.dev, 22 September 2025 (more than 10,000 entries per second on local storage; built-in support for witnessing): https://blog.transparency.dev/tessera-v1-0-is-here
- [p4] Arbitrum governance proposal raising the gas target to 10 million gas per second and the minimum Layer-2 base fee to 0.02 gwei: https://forum.arbitrum.foundation/t/aip-raise-the-gas-target-min-l2-base-fee-implement-improvements-to-the-pricing-algorithm/30182
- Sigsum, transparency logs with witness cosigning: https://www.sigsum.org ; C2SP tlog-witness and tlog-cosignature: https://c2sp.org
- L2 fees in 2026 (median Base and Arbitrum fees per operation, June 2026): https://hoge.gg/l2-fees-fell-another-38-but-the-user-moved-to-base-not-arbitrum/
