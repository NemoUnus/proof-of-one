# Second-model review of whitepaper v1.1: findings and handling

*Review by a second AI model (ChatGPT), received 9 November 2026, of whitepaper v1.1. Not an independent human review; it does not count towards Gate 0. Handling proposed by the project's AI agents for the founder's approval.*

**Part A.** Of the eight topics from the review of v1.0, the reviewer judged seven **fixed partly** and one **not fixed**. The one not fixed is the single final ballot set across two transparency logs, which v1.1 itself says is unwritten and blocks the log mode. The partial ratings point to the same remaining work: specifications, test vectors and implementation, not wrong statements.

**Parts B and C.** 19 findings: 9 high, 9 medium, 1 low. None is rejected. Two show real gaps in the design text (#1, #8). The others ask for specifications to be written out, or for claims to be qualified further.

| # | Finding | Sev. | Handling |
|---|---|---|---|
| 1 | Tally proof built for 3 trustees, key generation described as 6 of 9: no single coherent configuration | High | **Accepted.** One reference configuration, 3 of 5, used by the contracts, the tally circuit, the test-network polls and their tests. The key-generation simulation and demo still use 6 of 9, as an example of the candidate threshold. The production threshold is to be chosen later and needs its own circuit and setup; 6 of 9 is named only as a candidate. |
| 2 | Public inputs and point checks of π_tally not stated | High | **Accepted, text.** They are specified in the [tally verification spec](../specs/on-chain-tally-verification-v0.1.md) §6 and the circuit: 38 inputs, all from contract state. The whitepaper lists them, and states that subgroup membership is proven in the circuit (each point is 8 times a supplied point) and that the verifier rejects field elements out of range. |
| 3 | Fiat–Shamir transcript of the trustee proofs not stated | Medium | **Accepted, text.** c = Poseidon(2, pollId, j, G, PK_i, A_j, D_ij, T1_ij, T2_ij) over the BN254 scalar field, circomlib parameters. Stated in 7.8; test vectors are in the circuit tests. |
| 4 | "A wrong result cannot pass" ignores setup soundness | Medium | **Accepted.** Qualified: under a sound setup and verifier; the setup is test-only (issue #7). |
| 5 | Cooling-off period lets a stolen phone vote | High | **Accepted** (already disclosed). Add: notification of a pending recovery on every device of the member, and a way to shorten the period when the member proves possession of the old identity; to be specified before real use. |
| 6 | Grace-period semantics | Medium | **Accepted, text and tests.** The contract accepts only the immediately previous root, until 10 minutes after the latest revocation (block timestamp); a second revocation ends the first grace. Boundary tests to be added. |
| 7 | Recovery ballots not a safeguard yet | High | **Accepted** (already "designed, not implemented"). The whitepaper names it as future work and notes that the transparency-log mode needs its own version. |
| 8 | π_unblind public inputs not bound to π_doc and the operators' outputs | High | **Accepted: a real gap in the description.** The enclave must receive B (the public output of π_doc), the operators' Z_i with their DLEQ proofs, which it checks against the key shares on the ledger, and Z; π_unblind's public inputs are B, Z and F. Added to the [design note](../specs/recovery-ballots-and-oprf-key-v0.1.md) and 7.5. |
| 9 | Path, rule and domain separator must be bound | Medium | **Accepted, text.** x is formed inside π_doc from the rule, the path's domain separator and the fields, and only B leaves it; π_unblind proves only the relation between B, Z and F. To be stated. |
| 10 | Threshold OPRF lacks a full specification | High | **Accepted.** Called a research design until a full specification and independent cryptographic review exist. |
| 11 | Operator independence and rate limits are not enforced | Medium | **Accepted.** State which properties are cryptographic (threshold) and which are operational promises (independence, rate limits, published counts). |
| 12 | Share refresh claim needs assumptions | Medium | **Accepted.** Qualified: holds only if the refresh is verified and old shares are erased; an attacker holding a threshold of shares from one period still succeeds. |
| 13 | Recovery-ballot statement unspecified | High | **Partly accepted.** The statement is in the design note §1.2; the whitepaper links it, and the claim stays "designed". |
| 14 | 18 public inputs vs grace root | High | **Partly accepted: no inconsistency.** The ballot proof has no root input; the contract tries the pollHash of the current root, then that of the previous root while in grace. To be explained in 7.7. |
| 15 | "No operator can tell who answered what" | High | **Accepted.** Same conditional wording in Section 1 and 9.2, including trustee collusion before deletion. |
| 16 | "Every result can be checked" vs log polls | Medium | **Accepted.** Front matter limits the claim to the rollup path. |
| 17 | Performance and implementation labels | Medium | **Partly accepted.** Most labels are present since v1.1; the remaining ones are added (build, browser or native). |
| 18 | Breakdown privacy | Medium | **Accepted.** Breakdowns are not enabled until an enforced threshold and controls across overlapping queries are specified. |
| 19 | "All code is open" vs verifier licence issue | Low | **Accepted.** Made precise. |

All accepted changes go into whitepaper v1.2, together with Decision Log #54 (several members on one phone).
