# The pilot's enrolment service

*Design v0.1, 20 November 2026. Decision Log #57 (pilot), #58 (OPRF), #43 and #47 (uniqueness rules), #53 (limits on the OPRF key). Prepared by the project's AI agents for the founder. Not reviewed outside the project. For the pilot only: it stands in for the attested enclave of the whitepaper (§6–7), which does not exist yet.*

## 1. What it does, and what it never sees

The service is the only server in the pilot that knows anything about a member's document. Everything else stays on the phone (Decision #57, point 3).

| The service receives | The service never receives |
|---|---|
| blinded points `pB`, `dB` (random-looking); the proof π_doc and its public signals: birth day, sex code, nationality code, expiry month, the face commitment `cFace`, the two keyed fingerprints, the issuing state, the path; the commitment `cm` | the face, the chip photo, the MRZ, the document number, the personal number, the name, the identity secret, the identity leaf |

It stores, per enrolled member, only: person key `Fp`, document key `Fd`, issuing state, path, the time of enrolment. Deleted after the pilot (Decision #57, point 5).

## 2. Flow

```
Phone                                   Service                              Test network
  1. GET /info  ───────────────────────►  OPRF key K, credential key set, rules,
                                           tree of checked signers (root), counts
  2. POST /session {issuer} ──────────►  challenge (random), session id
  3. POST /evaluate {session, pB, dB} ─►  Z = k·B for both, DLEQ proofs
     (fingerprint round 2 on the phone; π_doc with challenge, pB, pZ, dB, dZ)
  4. POST /enrol {session, π_doc, cm} ►  checks (§3); reserves Fp, Fd;
                                         signs the credential  ◄─────────────  verifies π_doc by eth_call
     ◄──────────────────────────────────  credential (σ, rn, link, epoch)
  5. after a random delay: π_reg through the relay ──────────────────────────►  IdentityRegistry.register
  6. a scheduled job inserts full batches of 4 ──────────────────────────────►  insertBatch
```

## 3. Checks at enrolment (step 4)

1. The session exists, is less than 10 minutes old, and has had exactly one evaluation.
2. The proof's public inputs equal the session's: `challenge`, `pB`, `pZ`, `dB`, `dZ`; `cm` as sent; `today` within one day of the service's date; `currentYear` this year.
3. `dscRoot` is the current root of the tree of checked signers (§5).
4. The issuing state has a rule, and `path`, `pnSrc`, `pnTag` are the rule's.
5. π_doc verifies.
6. Uniqueness (Decision #47, pilot form): a known `Fd` is the same document again; a known `Fp` is the same person with another document. Both are refused in the pilot, which has no face comparison on the service; a member who lost a phone re-enrols through the recovery path (Decision #52). `Fp` and `Fd` are inserted in one transaction with unique constraints, so two enrolments with one document cannot both pass (Decision #43, point 2).
7. The credential is signed as the enclave's `issue()` does (`reference/enrolment-circuit/src/enrolment.js`): message `H(CREDENTIAL_MSG, attributes, cm, rn, epoch)`, EdDSA-Poseidon, with the revocation handle `rn` derived from a separate secret.

## 4. Platform and limits

- **Cloudflare Workers, free plan**, like the relay; deployed from this repository. Free Workers may use about 10 ms of processor time per request. Curve arithmetic in JavaScript would exceed that, so the service's cryptography (OPRF answer and DLEQ, credential signature, Poseidon) is the Rust code of `native-prover` compiled to WebAssembly.
- **Measured (21 November 2026):** the core compiled to WebAssembly takes 4.4–5.0 ms for an evaluation (both answers with their DLEQ proofs and subgroup checks) and 2.2–2.6 ms for a credential, on a server under Node 22 (`reference/enrol-service`).
- **π_doc is verified by a verifier contract** on the test network, called with `eth_call`: free, no transaction, and the pairing does not run in the Worker (`DocVerifier`, 375,678 gas in an `eth_call`). The contract is deployed once (a step of the next test-network plan). Its key is the TEST-ONLY, reproducible one the app uses.
- **Storage:** Cloudflare D1 (SQLite), free tier: sessions (deleted after 10 minutes), members (`Fp`, `Fd`, issuer, path, time), daily counters.
- **Secrets** (in the Cloudflare dashboard, never in files): the OPRF key `k`, the credential signing keys, the revocation-handle secret.
- **Limits and openness (Decision #53, point 1):** one OPRF evaluation per session; sessions per day capped (for the pilot, 300); `/info` shows the running number of evaluations and of enrolments, so that a holder of the service who evaluated guesses would show in the counts.
- **No request logs** (as the relay).

## 5. Tree of checked signers

π_doc proves that the document's signer (DSC) is a leaf of a published tree. In the pilot:

- When a phone meets a signer that is not in the tree, it sends the DSC certificate (public data) and π_doc's suite to `POST /signer`.
- The service checks the certificate's signature against the CSCA certificates it holds (variable `CSCA_CERTS`, taken from the master lists under the trust-list specification) with WebCrypto (RSA PKCS #1 v1.5, RSA-PSS, ECDSA on P-256, P-384 and P-521; brainpool curves not yet), that the DSC is valid today and was issued while its CSCA was valid, that it is not self-signed, and that its RSA key fits the suite. If so, it adds the key's leaf (as π_doc builds it) and records the new root. At most 100 new signers a day.
- The phone asks for its path (`GET /path?leaf=…`) and proves against that root. Every root the tree has had stays accepted, since signers are never removed in the pilot.
- `GET /signers` publishes the tree: per leaf its suite and the SHA-256 fingerprints of the DSC and of the CSCA that signed it. The certificates themselves are not republished: the ICAO master list may not be redistributed (trust list specification, §2), and the DSCs are on every passport of their issuer. Anyone who holds a certificate can recompute its leaf and fingerprint and recheck the tree. The list names no country.
- Measured (21 November 2026): a new signer costs about 1 ms for the leaf and 1.5–2.5 ms for the tree with up to 20 signers. Above about 60 signers the tree's hashes would exceed the Worker's time limit; the service would then keep the tree's inner nodes in its store instead of recomputing them.

**What the service reveals.** A live service cannot hide which issuing states it accepts: `/session` answers per state, and the fingerprints and leaves can be matched against the public master lists and DSC collections. The repository and the project's texts still name no state; the rules and certificates are set only in the Worker's configuration.

## 6. What the founder sets up

1. A new Worker from this repository, as for the relay (root directory `reference/enrol-service`).
2. A D1 database bound to it (a few clicks).
3. Its secrets, made in the browser with a page of the repository (`testnet/web/enrol-secrets.html`), which shows them once and sends them nowhere.
4. The issuing-state rules and the CSCA certificates as variables of the Worker, so that no country is named in the repository.

## 7. Open points

1. The batch job (step 6): a scheduled GitHub Action with the relay's test key, or a phone that computes the batch proof. To be measured.
2. Re-enrolment after a lost phone through the service (Decision #52): after the first enrolments work.
3. Rate limits per network address are deliberately not used: they would push volunteers in countries with restricted internet off shared VPN exits (Decision #34).
