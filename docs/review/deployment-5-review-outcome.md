# Review of deployment 5: what was done about each finding

*24 November 2026. Two independent reviews of deployment 5 (Decisions #62, #63) from the same [brief](deployment-5-review-brief.md): a separate agent of the team that did not write the code ([report](deployment-5-review-team-agent.md), findings A1–D5) and a second AI model, ChatGPT ([report](deployment-5-review-second-model.md), findings F-01–F-08, A-01–A-03). Neither is a human audit. The fixes are in deployment 6 (`reference/testnet/plan8.js`) and app v0.14; the pilot's poll waits for them (Decision #65).*

## Fixed before the pilot

| Finding | Both / one | What was wrong | What changed | Test |
|---|---|---|---|---|
| A2, F-01 | both | Ballot randomness came from (secret, poll, revision) only. Two ballots with the same revision and different answers would reveal both answers (B − B′ = (v − v′)·G). This could happen with two phones, a retry after a slow block, or a relay that misreports the count. | The choice is part of the derivation: `r_j = H(15, s, pollId, revision, choice, j)`. Equal random values now imply an identical ballot, which reveals only equality. The circuit is unchanged (r is a free witness); JS `ballotRandomness` and Rust `ballot_randomness`, and the recorded-answer search, try every choice. | `ballot.test.js` "two different answers never share random values"; relay `pilot.test.mjs` two ballots from one state |
| A1 | team agent | The app took the poll's tally key, times, policy and context hash from the relay, so a dishonest relay could make the phone encrypt to its own key and read the answer. | The app reads them from the polls contract directly (`Chain.kt`, `getPoll`, `contextHash`) through a public RPC endpoint, never from the relay. | the app's chain reader, run on the JVM against the test chain, reads the same 28 values as ethers (`pilot.test.mjs`) |
| B1, F-02 | both | The poll's text was not checked against the poll's `metadataHash`, so a relay could swap the options' labels. | The relay serves the exact text bytes (`textJson`). The app shows the poll, and allows an answer, only if Keccak-256 of those bytes equals `metadataHash` read from the chain. | relay test checks the hash of `textJson`; Keccak checked on the JVM against known vectors |
| A4, F-03, Q3 | both (they differed on the remedy) | The relay chose which identity root the phone proved against, so it could pick an older, smaller one. | The app reads the newest root and the leaf count from the registry and proves against that root, with the first `leafCount` leaves of the relay's list. The team agent suggested a root at least 30 minutes old. The second model's view was adopted: the newest root gives the largest anonymity set, and timing correlation does not depend on the root. | chain reader test |
| C1, F-06 | both | "Recorded" was confirmed from the relay's report. | The ballot slot (`ballots(pollId, nf)`) is read from the chain, before and after sending. | chain reader test |
| C2 | team agent | Registration was saved on the relay's word. | The app saves it only once the leaf is found in the registry on chain, and checks that the relay sends to the registry the polls contract uses and that the service's key set is the registry's. | — (Android) |
| B2 | team agent | The bound at publication was `leafCount − revokedCount`, so revocations after voting could block a result for good. This was a regression in deployment 5. | The bound is `leafCount`, every membership ever registered. The polls contract is redeployed (deployment 6); the registries and verifiers stay. | contract suite |
| C5 | team agent | `openTime` was not checked. | `createPoll` refuses an `openTime` that does not fit 40 bits or is more than an hour in the past. | `polls.test.js` createPoll |
| C3, A-02 | both | Finding the member's path for an unexpected root rebuilt the tree for every prefix (O(n²)). | Prefix roots are computed incrementally (O(n·depth)); the usual case builds the tree once. A count above 64 from anywhere is not believed. | `vote-check` |
| D2, A-03 | both | Stale comments; the design note still described batches. | Comments updated; [joining-open-polls-v0.2](../specs/joining-open-polls-v0.2.md) notes Decision #63. | — |

## Recorded, not needed for the pilot

These are recorded in the decision log's open items and the project schedule.

| Finding | Why it can wait | Plan |
|---|---|---|
| A3 | Anyone who obtains a member's secret can open all that member's past answers. This follows directly from principle 2 of Decision #62 without a server-side erasable secret. | State it in the threat model and the information text. Consider an erasable, per-poll secret later. |
| B3, F-04 | The 10-minute revocation grace and the order of revoke-then-reissue. The pilot never re-issues an identity (`notBefore` is always 0). | Issue a new identity only after the old one's revocation is on chain plus the grace period, with `notBefore` set after it. Add tests. |
| F-05 | Governance can change the key set at once. In the pilot, governance is the founder's test wallet. | Multisignature and a timelock before any real use. |
| Trustee keys (second model) | Only the first t trustee keys are checked against the tally key. | Check them against DKG commitments (polynomial commitment). |
| F-08 | The nullifier does not include the deployment. There is one deployment per identity in the pilot. | Add `ctxHash` to the nullifier at the next circuit change. |
| A-01 | The sampling seed comes from a block hash. The pilot has no sampled polls. | Use drand or a similar beacon. |
| F-07 | Test-only trusted setups. | Run a ceremony before production, as already planned. |
| D1 | A recovery ballot uses random values, so the app cannot open it. Recovery ballots are not in the pilot. | Derive them like ordinary ballots. |
| D3–D5, C4 | Only the first poll is shown; batch mixing across the grace period; roots cannot be retired; `/state` cost. | Later app and relay versions; key-epoch rule for roots. |

## Not adopted

- **A per-attempt random salt published with the ballot (F-01 alternative).** Putting the choice into the derivation removes the leak without any new state to recover after a restore.
- **Binding the revision into the proof (F-01 alternative).** The count it would be checked against comes from the chain at sending time, so it would not prevent a second, stale submission from being broadcast. The choice derivation makes such a submission harmless.

— Hypatia (AI agent, Proof of One), with Kautilya, Condorcet and Cai Lun
