# Test transparency log (Phase 1a, synthetic ballots only)

A public, append-only log of **synthetic** test ballots in the [C2SP tlog-tiles](https://c2sp.org/tlog-tiles) format, written by [Tessera](https://github.com/transparency-dev/tessera) and served by GitHub Pages from this repository. It is the first step towards the log mode of the whitepaper (§8.12) and of [transparency-log ballots](../../docs/specs/transparency-log-ballots-v0.1.md). No real person, document or answer is in it.

**What it is not yet:** the log does not check ballot proofs, has no witnesses yet, and is a single log, not two. The whitepaper's rule for one set of ballots across two logs is still to be written (second-model review of v1.0, finding 4). Do not use it for any real poll.

## Files

| Path | What |
|---|---|
| `log/` | The log itself: `checkpoint` (signed note), `tile/…` (hashes and entry bundles). Written only by the workflow. |
| `log.vkey` | The log's public key (signed-note verifier key). |
| `entries/pending/`, `entries/added/` | Ballot files waiting to be appended, and those already appended. |
| `web/index.html` | Viewer: checks the checkpoint signature, recomputes the root from the tiles in the browser, lists recent entries, finds a ballot by index or nullifier and checks that it is in the signed tree. |
| `web/tlog.js` | The verifier used by the viewer and by `verify-log.js` (browser and Node, no dependencies). |
| `web/keygen.html` | Makes a log key pair in the browser (Ed25519, signed-note format). The private key never leaves the page. |
| `make-entries.js` | Makes N synthetic ballots: random nullifier, a random answer encrypted under the test poll key. |
| `verify-log.js` | Checks the whole log as any reader can: signature, root, every leaf, entry format. |
| `test/` | Tests of the verifier against Tessera's own test log (Apache-2.0, copied with its licence). |

## Entry format (test, version 0)

One line of JSON per ballot, keys in this order:

```
{"type":"proof-of-one/test-ballot/v0","poll":"test-log-1","nf":"<decimal>","r":1,"ct":[16 decimals]}
```

`ct` is the encrypted one-hot ballot in the contract's order (all A points, then all B points), as on the rollup.

## How it runs

The workflow `.github/workflows/test-log.yml` runs by hand ("Run workflow", with a number of ballots) or when files are pushed to `entries/pending/`. It:

1. tests the verifier against Tessera's test log;
2. makes the synthetic ballots;
3. appends every pending file with Tessera's `posix-oneshot` (v1.0.4), which signs a new checkpoint with the repository secret `LOG_PRIVATE_KEY`;
4. checks the whole log with `verify-log.js`;
5. commits the log back to the repository.

## Setting it up (once)

1. Open `web/keygen.html` on the project's GitHub Pages site and make a key pair with the default name `nemounus.github.io/proof-of-one/test-log/1`.
2. Put the **private** key in the repository secret `LOG_PRIVATE_KEY` (Settings → Secrets and variables → Actions). It is never written anywhere else.
3. Put the **public** key, one line, in `reference/test-log/log.vkey`.

## Checking it yourself

```
node reference/test-log/verify-log.js reference/test-log/log reference/test-log/log.vkey
node reference/test-log/test/tlog.test.js
```

## Next

Witness cosignatures from the Witness Network's testing list (a policy file for `--witness_policy_file`), proof checking before appending, a second log, and the rule for one set of ballots across logs.

Licence: Apache-2.0.
