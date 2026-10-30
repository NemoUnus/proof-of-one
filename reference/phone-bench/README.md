# Phone benchmark for the ballot proof

> **Test data only. The trusted setup is TEST-ONLY. Nothing is sent anywhere.**

This web page makes the ballot proof π_vote three times on the device that opens it and shows how long each run took. It is the first step of Decision Log #29: before choosing how to aggregate ballots, we need to know how fast real, low-cost phones can prove.

- **What it proves:** one valid ballot from [`input.json`](input.json), built by [`mkinput.js`](mkinput.js) from test data (a member with two nationalities voting in a regional poll with an age limit).
- **Prover:** snarkjs 0.7.5 in the browser (WebAssembly), served from this folder (`snarkjs.min.js`, GPL-3.0, unchanged from the npm package) so that the page does not depend on a third-party CDN, the same proof the reference tests use: 32,607 constraints, Groth16. A native prover in an app is expected to be several times faster, so these results are an upper bound.
- **Privacy:** the page sends nothing. Its result text includes the number of processor cores, the approximate memory the browser reports and, if you type it, the phone model. You decide whether to share it.

## How to run it

Open `index.html` from any web server that serves this repository. It loads `../ballot-circuit/setup/ballot_test.zkey` and `ballot.wasm`, about 24 MB in total. When GitHub Pages is enabled for the repository, the address is:

`https://nemounus.github.io/proof-of-one/reference/phone-bench/`

Then tap **Start benchmark**, keep the screen on, and post the result in [issue #9](https://github.com/NemoUnus/proof-of-one/issues/9).

## Changes

- **Page v0.2 (30 October 2026):** the proving library is served from the repository instead of a CDN, the page no longer loads web fonts from Google (a slow or blocked font request can delay the page's script), the Start button works as soon as the page opens and waits for the library, and any error is shown on the page. In v0.1 a slow or blocked CDN could leave the button doing nothing.

## Reference results

| Device | Median of 3 runs |
|---|---|
| **iPhone 14** (in the browser, 4 cores reported), measured by the founder, 23 Oct 2026 | **3.5 s** (3.6, 3.5, 3.5); proof verified |
| **Samsung Galaxy S24 Ultra** (Chrome on Android), measured by the founder, 28 Oct 2026 | **3.0 s** (3.2, 2.8, 3.0); proof verified; 8 cores, about 8 GB reported |
| Server, 2 cores, headless Chromium | about 10 s |
| Server, Node.js (`ballot-circuit` tests) | 4–5 s |
| Low-cost Android phones | **wanted**: please contribute |

The first two phone results are recent high-end phones. The open question is the cheapest phones our participants use.

## Rebuilding the test input

```bash
# after npm install and npm run build in ../tally and ../ballot-circuit
node mkinput.js
cp ../ballot-circuit/build/ballot_js/ballot.wasm .
```

`ballot.wasm` must come from the same circuit as `ballot_test.zkey`.

Written by Psephos (AI agent). Licence: Apache-2.0.
