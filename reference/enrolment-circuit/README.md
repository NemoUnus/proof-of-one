# Proof of One — unlinkable registration, batch insertion and revocation (reference)

> **Reference code for review and testing only. Not audited. The included trusted setup is TEST-ONLY and insecure.**

This package implements how a person who has passed the uniqueness checks gets onto the identity registry **without the registration service being able to tell which registry entry is theirs**. It also covers how a lost identity is revoked without revealing which entry it was.

Specification: [`docs/specs/ballot-and-enrolment-v0.1.md`](../../docs/specs/ballot-and-enrolment-v0.1.md) §2, with red-team changes C1 (hidden revocation handle) and C2 (minimum batch, hidden signing epoch) from [`docs/specs/red-team-review-ballot-spec-v0.1.md`](../../docs/specs/red-team-review-ballot-spec-v0.1.md).

## The flow

1. **Phone.** Creates its secrets and sends the enclave only a hiding commitment `cm = Poseidon(4, idc, salt, ρ)`.
2. **Enclave.** After its document and face checks (simulated here), it signs `(attributes, cm, rn, epoch)`. `rn` is a revocation handle it derives from the person's fingerprint and an enrolment counter.
3. **Phone, later and in a separate session.** Registers `leaf` and `cn = Poseidon(3, ρ)` with the proof π_reg:
   - it knows `s`, and `leaf = Poseidon(idc, attributes, rn)` uses the same format the ballot proof checks;
   - `cm` and `cn` are formed correctly from the same `idc` and `ρ`;
   - the enclave's EdDSA signature is valid;
   - the signing key is one of the published enclave keys. Which key, and therefore which epoch, stays hidden;
   - `rn` is below 2^252.
4. **Registry.** Each `cn` can be used once. Leaves enter the tree only in batches of at least *K*.
5. **Re-enrolment** after a lost phone with no backup. The enclave issues a new credential and returns the old `rn`, which is published in the revocation registry. From then on, the old identity cannot produce a ballot proof.
6. **Adding or renewing a document** ([Decision #30](../../docs/specs/several-nationalities-v0.1.md)). A member with a further genuine document, such as a second nationality, keeps the same identity secret. The enclave checks that the document is unused and belongs to the same face, then issues a credential carrying all documents (up to three). The old handle is revoked as in step 5.

The enclave knows `cm`, `rn` and the attributes, but not `idc`, `salt` or `ρ`. Linking a person to `leaf` or `cn` would therefore mean inverting or distinguishing Poseidon outputs. Whether this argument holds is the open question in [issue #3](https://github.com/NemoUnus/proof-of-one/issues/3).

## Batch insertion proof π_batch

Inserting leaves by hashing on-chain costs about 1 million gas per leaf (see the implementation notes). `circuits/batch_insert.circom` instead proves that a full batch of B = 2^k registered leaves was written, in order, into the empty aligned subtree at the next position of the identity tree. Its public inputs are only the old root, the new root, the start index and the chain hash of the leaves, which the contract keeps as leaves are registered. The prover therefore cannot change, drop, reorder or overwrite leaves. Anyone may submit the proof.

## Revocation update proof π_revoke

`circuits/revoke.circom` proves that a handle `rn` is added correctly to the indexed revocation tree. It shows that `rn` lies in a gap of the sorted list, so it is not already revoked, that the low leaf is updated to point to `rn`, and that `(rn, next)` is appended at the next free slot, which must be empty. The contract supplies the old root and the next index from its own state.

## Size

| Circuit | Constraints (`--O2`) |
|---|---|
| π_reg (key-set tree depth 8, i.e. up to 256 enclave keys; up to 3 documents) | **9,369** |
| π_batch, B = 4 (reference parameters) | **16,227** |
| π_batch, B = 1,024 (realistic batch; compiled for measurement only) | **501,947** |
| π_revoke (revocation tree depth 32) | **32,521** |

## Run it

```bash
npm install
npm run build
npm run setup:test   # optional: regenerate the TEST-ONLY setup (a test key is already included)
npm test
```

The tests also use [`../tally`](../tally/) and [`../ballot-circuit`](../ballot-circuit/). Install and build those first.

## Tests

| Test | Expected result |
|---|---|
| Honest registration | Accepted; the enclave's records contain neither the leaf nor `cn` |
| Using a credential twice | Rejected by the registry |
| Forged enclave signature | Cannot be proven |
| Signing key outside the published key set | Cannot be proven |
| Changing attributes after signing (e.g. an earlier date of birth) | Cannot be proven |
| Swapping the revocation handle | Cannot be proven |
| Same person enrolling twice without the re-enrolment path | Refused by the enclave |
| Minimum batch | Leaves wait until *K* are pending |
| **End to end** | Register → batch → valid ballot proof (π_vote). After re-enrolment, the old identity can no longer vote; the new one and other members can |
| Batch insertion, honest (two consecutive batches) | Proofs verify; new root equals the reference tree |
| Batch aimed at an occupied subtree | Cannot be proven (existing leaves cannot be overwritten) |
| Misaligned batch start | Cannot be proven |
| Different chain hash, or leaves reordered by the prover | Cannot be proven / fails against the registered chain hash |
| Revocation, honest (three handles, including a smaller one) | Proofs verify; roots match the reference tree |
| Revoking the same handle twice | Impossible: no gap exists, and replaying the old witness fails |
| Appending into an occupied slot | Cannot be proven |
| Zero or out-of-range handle | Cannot be proven |
| Proof used with a different new root | Verification fails |
| Adding a second nationality, end to end | One identity with both nationalities; old handle revoked; same nullifier; enclave cannot link old and new leaf; votes in both regions verify |
| Someone else's document, a face that does not match, a document already used | Refused by the enclave |
| Renewal and limits | Renewal replaces the document of the same nationality; at most three documents; one per nationality |

## Not implemented

- Document reading, the document-validity proof, liveness, face matching and duplicate search. The enclave receives a `fingerprint` that stands for "this person".
- Enclave attestation, threshold or MPC operation of the enclave, the cooling-off period, random delays and network anonymity.
- The on-chain registries that verify these proofs are in [`../contracts`](../contracts/).

## Authorship and review status

Written by the Proof of One AI agents Kryptos and Psephos (see [AGENTS.md](../../AGENTS.md)). Not yet reviewed by independent human experts.

Licence: Apache-2.0.
