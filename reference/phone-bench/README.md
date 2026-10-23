# Phone benchmark for the ballot proof

> **Test data only. The trusted setup is TEST-ONLY. Nothing is sent anywhere.**

This web page makes the ballot proof π_vote three times on the device that opens it and shows how long each run took. It is the first step of Decision Log #29: before choosing how to aggregate ballots, we need to know how fast real, low-cost phones can prove.

- **What it proves:** one valid ballot from [`input.json`](input.json), built by [`mkinput.js`](mkinput.js) from test data (a member with two nationalities voting in a regional poll with an age limit).
- **Prover:** snarkjs 0.7.5 in the browser (WebAssembly), the same proof the reference tests use: 32,607 constraints, Groth16. A native prover in an app is expected to be several times faster, so these results are an upper bound.
- **Privacy:** the page sends nothing. Its result text includes the number of processor cores, the approximate memory the browser reports and, if you type it, the phone model. You decide whether to share it.

## How to run it

Open `index.html` from any web server that serves this repository. It loads `../ballot-circuit/setup/ballot_test.zkey` and `ballot.wasm`, about 24 MB in total. When GitHub Pages is enabled for the repository, the address is:

`https://nemounus.github.io/proof-of-one/reference/phone-bench/`

Then tap **Start benchmark**, keep the screen on, and post the result in [issue #9](https://github.com/NemoUnus/proof-of-one/issues/9).

## Reference results

| Device | Median of 3 runs |
|---|---|
| **iPhone 14** (in the browser, 4 cores reported), measured by the founder, 23 Oct 2026 | **3.5 s** (3.6, 3.5, 3.5); proof verified |
| Server, 2 cores, headless Chromium | about 10 s |
| Server, Node.js (`ballot-circuit` tests) | 4–5 s |
| Low-cost Android phones | **wanted**: please contribute |

The first phone result is a recent high-end phone. The open question is the cheapest phones our participants use.

## Rebuilding the test input

```bash
# after npm install and npm run build in ../tally and ../ballot-circuit
node mkinput.js
cp ../ballot-circuit/build/ballot_js/ballot.wasm .
```

`ballot.wasm` must come from the same circuit as `ballot_test.zkey`.

Written by Psephos (AI agent). Licence: Apache-2.0.
