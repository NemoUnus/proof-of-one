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

- **Page v0.3 and v0.4 (30 October 2026):** the page shows the exact error and the browser when the proving library cannot start, and says plainly when a browser is too old. Found with an iPhone 7 on iOS 13.7: its Safari has no BigInt, so it cannot run the prover at all. **The browser benchmark needs iOS 14 or later** (or Chrome 67 / Firefox 68 or later); iPhone 7 can be updated to iOS 15.

## Reference results

| Device | Median of 3 runs |
|---|---|
| **iPhone 14** (in the browser, 4 cores reported), measured by the founder, 23 Oct 2026 | **3.5 s** (3.6, 3.5, 3.5); proof verified |
| **Samsung Galaxy S24 Ultra** (Chrome on Android), measured by the founder, 28 Oct 2026 | **3.0 s** (3.2, 2.8, 3.0); proof verified; 8 cores, about 8 GB reported |
| Server, 2 cores, headless Chromium | about 10 s |
| Server, Node.js (`ballot-circuit` tests) | 4–5 s |
| **iPhone 16 Pro Max**, volunteer, 4 Nov 2026 | **2.1 s** (2.2, 2.1, 2.1) |
| **iPhone 16 Pro**, volunteer, 4 Nov 2026 (three sessions) | **2.2–2.3 s** |
| **Samsung Galaxy A56**, volunteer, 4 Nov 2026 | **2.7 s** (2.9, 2.7, 2.7) |
| **iPhone 13 Pro Max**, volunteer, 4 Nov 2026 | **3.7 s** (3.6, 3.7, 3.7) |
| **iPhone 13**, volunteer, 4 Nov 2026 | **5.9 s** (6.5, 5.9, 5.9) |
| **Samsung Galaxy A31** (mid-range, 2020), volunteer, 4 Nov 2026 | **7.5 s** (8.6, 7.4, 7.5) |
| **Samsung Galaxy A70** (4G, mid-range, 2019), volunteer, 4 Nov 2026 | **9.1 s** (14.7, 9.1, 8.0); a second session on 5 Nov: **6.7 s** (7.7, 6.5, 6.7) |
| **Poco C65** (low-cost, 2023), volunteer, 4 Nov 2026 | **7.1 s** (7.9, 6.7, 7.1); 8 cores, about 8 GB reported |
| **Realme RMX3830** (model code as reported), volunteer, 4 Nov 2026 | **8.3 s** (8.3, 8.1, 65.6); the third run was probably slowed by the screen turning off or the browser going to the background |
| **Samsung Galaxy S21 FE 5G** (2022), volunteer, 5 Nov 2026 | **7.0 s** (7.7, 7.0, 6.7); 8 cores, about 8 GB reported; download 19.7 s |
| **Samsung Galaxy M10, SM-M105F** (entry level, 2019), volunteer, 4 Nov 2026 | **19.5 s** (21.7, 19.4, 19.5); 8 cores, about 2 GB reported |
| **Samsung Galaxy J5** (model as reported; entry level, 2015–2016), volunteer, 5 Nov 2026 | **49.3 s** (50.2, 45.8, 49.3); 4 cores, about 1 GB reported; download 128.2 s |

Every run produced a proof that verified. **The ballot proof is practical in a phone's browser on every phone tested that runs a modern browser**: about 2 to 4 seconds on recent phones, 7 to 9 seconds on low-cost 2023 phones and mid-range phones from 2019 to 2022, about 20 seconds on an entry-level phone from 2019 with 2 GB of memory, and about 50 seconds on a 2015–2016 entry-level phone with 1 GB. A native prover in the app should be several times faster. The one phone that could not run it, an iPhone 7 on iOS 13.7, failed because its browser is too old, not because it is too slow.

The document-validity proof made at enrolment is about 18 to 23 times larger (577,678 to 749,147 constraints). In a browser on an entry-level phone it would take many minutes, so enrolment needs a native prover (activity 0.8). Download times (up to 128 s for the 23 MB of proving key and circuit on a slow connection) also matter for people with expensive or slow data; the app should ship the key with the app or download it once over Wi-Fi.

Native prover in the Android test app (same proof, input and key): **0.5 s** on the Galaxy S24 Ultra, against 3.0 s in its browser. See [`../native-prover/`](../native-prover/).

## Rebuilding the test input

```bash
# after npm install and npm run build in ../tally and ../ballot-circuit
node mkinput.js
cp ../ballot-circuit/build/ballot_js/ballot.wasm .
```

`ballot.wasm` must come from the same circuit as `ballot_test.zkey`.

Written by Psephos (AI agent). Licence: Apache-2.0.
