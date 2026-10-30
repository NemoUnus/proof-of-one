# Cost of large polls — design note v0.1

*Authors: Ostrakon, Psephos and Metron (AI agents), at the founder's request. Schedule activity 0.17. Status: design proposal for discussion; nothing here is implemented, measured on a public network or reviewed. Figures marked "estimate" are calculations, not measurements.*

## 1. The problem

Participation must stay free: a fee, however small, would cut participation and would exclude people who cannot reach the international payment system, who are among those the project most wants to serve. The cost of each poll is therefore paid by the common fund or by whoever commissions the poll (Decision Log #35, #36).

With today's design every ballot is written to the ledger. Measured in the reference contracts, a ballot sent in a large batch costs about 101,000 gas ([ballot aggregation §7](ballot-aggregation-v0.1.md)). At assumed Layer-2 prices that is roughly a quarter of a cent to four cents, so:

| Ballots in a poll | Estimated cost (today's design) |
|---|---|
| 3,000 | about 8 to 120 US dollars |
| 100,000 | about 250 to 4,000 US dollars |
| 1,000,000 | about 2,500 to 40,000 US dollars |

Small polls are cheap; the problem is polls with very many participants. Raising that money every month needs an organisation, which the project does not have. This note proposes two design changes that cut the cost by much more than funding could, and lists funding sources for what remains.

## 2. Verified random sampling

### 2.1 Idea

Most questions of the form "what do the people of a country think?" do not need every member to answer. A **simple random sample** of about 1,000 to 3,000 people estimates a share to within about ±3 and ±1.8 percentage points (95% confidence), whatever the population size. Ordinary online polls cannot draw such a sample, because they cannot verify who their respondents are or stop people from joining many times. Proof of One can, because every member is verified and unique.

A **sampled poll** invites a random subset of the eligible members. Nobody, including the project, learns who was invited.

### 2.2 How a member knows they are invited

```
seed      = public random value from an unbiasable beacon, fixed after the
            poll's snapshot, poll identifier and invitation rate
ticket    = Poseidon(TAG_SAMPLE, pollId, seed, s)      (s = identity secret)
top       = ticket >> 190                              (its top 64 bits)
threshold = ⌊p · r / 2^190⌋                            (p = rate, r = field size)
invited  ⇔  top < threshold
```

Because r is about 2^253.6, the top bits range up to about 2^63.6; the threshold is computed from r, not from 2^64, or the rate would be about 32% too high.

The phone computes its ticket privately. The ballot proof gains one statement, "my ticket is below the threshold". A prototype ([`reference/ballot-circuit/circuits/sampling.circom`](../../reference/ballot-circuit/circuits/sampling.circom)) measures **939 constraints**, about 3% of the ballot proof; it compares the top 64 bits of the ticket with the threshold, and a threshold of 2^64 invites everyone, so one ballot proof can serve open and sampled polls alike. The contract rejects ballots without it in sampled polls.

- **Who is invited cannot be chosen, under conditions.** s is fixed at enrolment; the snapshot, poll identifier and rate are fixed before the seed exists. A member cannot try many secrets, because each person has one identity and a new identity is not in the poll's snapshot (Decision Log #43). This holds only if the seed cannot be biased: a single sequencer or the proposer of the block whose value is used could bias it, so the seed must come from an unbiasable source such as a threshold randomness beacon (for example drand). It must also be impossible to run many copies of the same poll and publish only a convenient one ("poll shopping"), for example by counting every created poll in public statistics. A group of members who share their tickets with a poll creator learns nothing it could use if the seed is unbiased.
- **The invited set stays private.** Tickets depend on the identity secret, so no one else can compute them. Those who answer reveal only what any participant reveals: that some eligible member answered.
- **Stratified samples.** The invitation rate p can depend on a hidden attribute cell (age group, nationality), proven inside the ballot proof as for breakdowns (whitepaper §7.9). This lets small groups be over-sampled and weighted back. Two costs: a small over-sampled cell is a small anonymity set, and weighting widens the margin of error (the design effect), so the figures in 2.1 apply only to unweighted simple random samples.

### 2.3 Effect

| | Open poll (today) | Sampled poll |
|---|---|---|
| Ballots for a country of 10 million members | up to 10 million | about 3,000 to 10,000 invited, so that about 3,000 answer |
| Cost (estimate) | up to about 25,000 to 400,000 US dollars | about 8 to 120 US dollars |
| What the result describes | the members who chose to answer | a random sample of members, minus those who did not answer |

The result describes **members**, not the whole population: people without a chip document or a smartphone are still missing (whitepaper §6.4), and invited members who do not answer can bias the result. Both are stated with every sampled result, with the response rate. Even so, a verified random sample of members is a much stronger basis than any self-selected online poll, and it addresses limitation 18 of the whitepaper (representativeness).

**Open polls stay a core purpose** (Decision Log #44). Sampled polls suit estimates, such as polling before a public vote, and are cheap enough for media and research organisations to commission. Open polls, in which every eligible member can answer, are for questions on which a whole community wants to be heard, including questions that no authority has put to a vote.

### 2.4 Open questions

- Which public randomness source to use on the chosen Layer-2 network, and how to make sure nobody can bias it.
- How many invitations to send for a target number of answers, and how to report non-response honestly (Metron).
- Whether a member who was not invited should see that a sampled poll exists (transparency) without being able to answer.
- Coercion: someone could ask a member to show whether they were invited. The answer is the same as for participation today (whitepaper §17, item 8).

## 3. Ballot rollup with data in blobs

### 3.1 Idea

Today each ballot is a Layer-2 transaction: the rollup executes it (proof check, storage, about 101,000 gas) and posts its data to Ethereum, already as blob data (EIP-4844). In a **ballot rollup**, relays collect ballots, prove in one aggregation proof that every ballot is valid and that only the last ballot per nullifier counts, and post only:

- the root of a tree of (nullifier, ballot) pairs and the running totals of the encrypted ballots;
- the aggregation proof;
- the ballots themselves as data, not as executed transactions.

This is option D of the [ballot aggregation note](ballot-aggregation-v0.1.md). Most of its saving comes from no longer executing each ballot on the Layer-2 network (verification, storage and the call-data gas of about 8,700 per ballot that the aggregation note counted as a floor); the data itself still reaches Ethereum as blobs, which are priced in a separate and so far cheap market.

### 3.2 What stays true

- **R1 (own ballot).** The voter's phone receives a short Merkle path showing that its ballot is in the posted root, and checks the ballot data in a blob or in an archive.
- **R2 (recount).** Anyone can download the ballots, rebuild the tree, check that it matches the root, add the ciphertexts and check the trustees' decryption proofs.
- **No silent dropping.** A voter who does not find their ballot in a root submits it directly on chain, as today (more expensive, but rare), or challenges.

### 3.3 What changes

| | Today (one transaction per ballot) | Ballot rollup |
|---|---|---|
| Ballot data | in the Layer-2 network's history (kept by its nodes and archives); on Ethereum as blobs for about 18 days | the same: blobs for about 18 days, then archives |
| A voter's own check | against a Layer-2 node or archive | the same, plus a Merkle path to the posted root |
| Proving | on phones only | phones, plus heavy proving on relays' servers (about 750,000 gates per verified ballot in the current prototype) |
| Cost per ballot (estimate) | about 101,000 gas | the proof and root per batch, plus blob space; to be measured |

Blob space is limited per block, and its price rises with demand; a poll with a million ballots (about 544 MB of ballot data) would use a noticeable share of it for a few hours. The real price can only be measured on a public test network. Relays' server costs are also new.

### 3.4 When to use it

The ballot rollup suits open polls with very many participants. Sampled polls (section 2) are small enough to stay on the simpler design, in which the contract checks and records every ballot. Binding votes, if they ever come, keep the full on-chain design.

## 4. Where ballots are recorded

The founder asked why the design uses Ethereum, and whether it is the best choice. The answer has two parts.

**Why Ethereum was chosen.** Not for cost: Ethereum's base layer is expensive, which is why the design uses a Layer-2 rollup. It was chosen for the properties R1 and R2 need from the place where ballots are recorded: nobody can rewrite or hide what was recorded, nobody can show different records to different people, everyone can read everything, and no single party can refuse a ballot for long. Ethereum has the largest and most diverse set of validators among networks that run smart contracts, a long record without halts, and mature support for the proofs used here (pairing operations for Groth16 built into the virtual machine, audited libraries such as Semaphore). A rollup inherits most of these properties at a fraction of the cost.

**What R1 and R2 actually need.** Not a blockchain as such, but a public **bulletin board**: append-only, the same for everyone, readable by everyone, and hard to censor. Validity rules (proofs, one ballot per nullifier) can be checked either by a contract or by every verifier who recounts; R2 already requires the second.

| Option | Who could censor or rewrite | Rules checked by | Data kept | Cost per ballot | Main concern |
|---|---|---|---|---|---|
| A. Ethereum Layer-2 rollup (current design) | The sequencer can delay; forced inclusion through Ethereum limits this | Contract | In the Layer-2 history (its nodes and archives); on Ethereum as blobs for about 18 days | Measured 101,000 gas in batches; money cost to be measured (Layer-2 fees fell sharply in 2026 [c1]) | Sequencer operated by one company; fee spikes |
| B. Ethereum base layer | Very hard | Contract | Permanently | Often 10 to 100 times or more than A | Too expensive for ballots; suited only to anchoring |
| C. Other base chains | Depends on each chain's validator set | Contract | Permanently | Usually lower | Often fewer or more concentrated validators; less mature tooling for these proofs; each needs its own assessment |
| D. Own application chain | Its validators, at first few | Chain's own logic | As its validators keep it | Operating cost instead of fees | Neutrality must be built from scratch; validators can be pressured |
| E. Rollup with a separate data-availability layer | The data layer's validators | Contract | As that layer keeps it | Lower data cost | A second trust assumption and often a second token |
| F. Several independent transparency logs with witnesses [c2] | A log operator can refuse an entry; if verifiers require cosignatures from a quorum of honest witnesses, it cannot show different versions to different people | Every verifier (recount) | As long as operators and mirrors keep it | Close to zero | No contract enforces rules; censorship resistance depends on having several independent logs |
| G. **Hybrid: ballots in F, one commitment per poll on A** | As F during the poll; the commitment fixes the final ballot set | Every verifier, plus the contract for the final commitment | Logs and archives; commitment permanent | One transaction per poll plus log hosting | New design; needs its own specification and red-team review |

**Assessment.**

1. **Re-measure option A first.** After the 2026 Ethereum upgrades that raised blob capacity, average Layer-2 transaction fees fell to fractions of a cent [c1]. Those averages cover typical transactions, not a 101,000-gas ballot. If a ballot cost about 0.1 cent, a million-ballot open poll would cost about 1,000 dollars instead of the 2,500 to 40,000 in section 1. Fees can rise again with demand, so this must be measured on a public test network over time, not assumed.
2. **Keep the identity registry on a rollup.** Registration needs an on-chain check that each credential is used once, and happens once per member, not once per poll.
3. **Study option G for very large open polls.** Transparency logs are a mature technique (used today to make certificates and software signatures publicly auditable), and witness cosigning is an emerging extension that is starting to be deployed; together they cost almost nothing per entry. Combined with one commitment per poll on the rollup, the cost of an open poll would no longer grow with the number of participants. The questions to answer: how a voter is sure their ballot is in a log before the close; how the final ballot set is fixed when several logs are used; and how a censored voter escapes (submitting to another log, or directly to the rollup).
4. **Options C, D and E** are not preferred: each trades neutrality for cost, and A or G reach low costs without that trade.

## 5. Funding sources for what remains

The designs above aim to make most polls cost tens of dollars. Funding is still needed for infrastructure and for large open polls. Candidate sources, checked on 30 October 2026 (to be verified again before applying):

| Source | Fit | Status and caveats |
|---|---|---|
| NLnet | Open-source internet infrastructure and privacy | Next deadline 3 November 2026; the funds open for proposals and their funders change between calls and must be checked on its proposal page before applying. Usually small grants |
| Ethereum Foundation, Ecosystem Support Program | Zero-knowledge, privacy, public goods on Ethereum | No open rounds; funding now goes through published wishlists and requests for proposals |
| Open Technology Fund | Internet freedom tools for people in restrictive countries | Strong fit, but funded by the US government, which itself could be used to discredit or endanger participants in some countries; its funding was disrupted in 2025, partly restored through court orders, and its status is still contested. Needs a careful safety review before any approach |
| Commissioned polls (universities, media) | Pay for their own polls (Decision Log #35) | Sampled polls make this affordable for them |
| Proof of personhood and age checks for other services | Main planned income (Decision Log #36) | Needs the system to be live |

All of them need a named person or legal entity to receive money, and no money is accepted before legal review (whitepaper §16). This links the funding question to finding a sponsor or host organisation (schedule activity 0.14).

## 6. Proposal

1. Keep both poll types (Decision Log #44): **sampled polls** for estimates, commissioned by media and research organisations; **open polls** where a whole community wants to be heard. Join the ticket prototype (939 constraints, tested) to the ballot proof, with seed and threshold bound in pollHash and a matching contract change.
2. Specify the **ballot rollup with blob data**, or the hybrid of section 4, as the path for very large open polls, after recursive aggregation (Decision Log #29), with its own red-team review of how voters check their ballot.
3. Correct whitepaper §8.9: "100 times is not reachable" holds for call data, not for blob data or public logs; state the new trade-offs.
4. Measure the money cost of a ballot on a public Layer-2 test network, and study the hybrid of section 4 (option G) for very large open polls.
5. Prepare funding applications only after a sponsor or host organisation exists, starting with sources that do not tie the project to any one government.

— Ostrakon, Psephos and Metron (AI agents, Proof of One)

## Sources

- [c1] Ethereum's BPO-2 parameter change of 7 January 2026 raised the blob target to 14 and the limit to 21 per block; reported average Layer-2 fees fell to about 0.1 cent or less: https://blockeden.xyz/blog/2026/02/02/ethereum-bpo-2-upgrade-blob-target-14-limit-21-rollup-scaling/ (secondary source; to be confirmed with on-chain data).
- [c2] Sigsum, transparency logs with witness cosigning: https://www.sigsum.org ; C2SP specifications tlog-checkpoint, tlog-cosignature and tlog-witness: https://c2sp.org
