# Chip reader and native prover — Android test app (schedule activities 0.8 and 1.4-00)

> **Test app only. Not audited, not for real enrolment.** It reads a passport chip and checks it on the phone; it does not create an identity and sends nothing anywhere (it has no internet permission).

## What it does

1. You type three values from the bottom lines of the passport photo page: document number, date of birth and date of expiry. They open the chip (PACE if the chip offers it, otherwise BAC) and are cleared from the screen and memory after each read.
2. It reads DG1 (the machine-readable zone), DG2 (the face image) and the security object (SOD).
3. It checks on the phone (ICAO 9303 passive authentication):
   - the hashes of DG1 and DG2 equal those listed in the SOD;
   - the SOD signature verifies under the document signer certificate (DSC) carried in the SOD.
4. It shows a report without name, document number or birth date: access method, timings, issuing state and nationality, file sizes, hash and signature algorithms, the data groups present (DG14 and DG15 show chip and active authentication), and the DSC's subject, issuer, key type and SHA-256 fingerprint.
5. **Share** sends the report and the DSC certificate (public, no personal data) with any app you choose.

Whether the DSC was issued by a trusted country signing CA is **not** checked on the phone. As in the design, the public trust-list tool checks it ([trust list §4](../../docs/specs/trust-list-v0.1.md)): `T.checkDsc(list, dsc)` in [`document-circuit/src/trustlist.js`](../document-circuit/src/trustlist.js).

The report also measures what the zero-knowledge proof π_doc must handle on real documents: the signature suite of the DSC and the sizes of the security object's content and signed attributes ([document-validity proof §6](../../docs/specs/document-validity-proof-v0.1.md)).

## Ballot proof benchmark (native prover, v0.2)

The button **Ballot proof benchmark (native prover)** opens a second screen. It makes the ballot proof π_vote three times with the native prover ([`../native-prover/`](../native-prover/)), from the same synthetic input and TEST-ONLY key as the browser benchmark, checks it on the phone and shows a result to share. It needs no passport and sends nothing. The app is built for 64-bit ARM phones only.

Since v0.3 a second button runs the **enrolment proof π_doc** benchmark (577,678 constraints, TEST-ONLY random key, precomputed synthetic witness). It needs about 1 GB of memory and 150 MB of storage. The APK is therefore about 180 MB.

## Face check test (v0.4, Decision Log #57)

After a successful read, the button **Face check test** compares the chip photo (DG2) with a selfie, **on the phone**, and shows a similarity score. Its purpose is to set the threshold of the pilot's face check from real measurements: the passport holder, and other people, against the same chip photo. Nothing is stored or sent; the selfie file is deleted as soon as it is read; **Share the numbers** shares the scores only.

- Chip photos in JPEG 2000 are decoded with JP2ForAndroid (OpenJPEG).
- Faces are found with SCRFD-500M (five landmarks), aligned onto the standard 112×112 template, and compared by the cosine of two ArcFace MobileFaceNet embeddings. The pipeline was checked against a Python reference ([`face/ref.py`](face/ref.py)).
- The models come from InsightFace's "buffalo_sc" release, downloaded by the workflow and checked against [`face/models.sha256`](face/models.sha256). InsightFace's code is MIT; its **pretrained models are for non-commercial research use only**. That fits the non-commercial pilot; any real release needs a model whose licence allows it, or one trained by the project.
- The selfie is taken by the phone's camera app (no camera permission in this app).

## Build

The APK is built by GitHub Actions ([workflow](../../.github/workflows/android-prototype.yml)) on every change to this folder. Open the repository's **Actions** tab, choose the latest run of "Android chip reader (test build)" and download the artifact `proof-of-one-reader-debug-apk`. It contains the APK and its SHA-256.

To build locally: Android SDK (API 35), JDK 17 and Gradle 8.10; first build the native prover into `app/src/main/jniLibs/` and copy `ballot.graph`, `ballot_test.zkey` and `input.json` into `app/src/main/assets/`, as the workflow does; then `gradle assembleDebug` in this folder.

## Install on a phone

The APK is debug-signed. On Android, allow installing apps from the file manager or browser you use, open the APK, then turn the permission off again. A new build replaces the old one only after uninstalling it, because each build is signed with a different test key.

## Privacy

- No internet permission; the app cannot send data by itself.
- The three access values and the chip data stay in memory and are cleared after each read; nothing is written to storage.
- The screen is protected from screenshots while the app is open (`FLAG_SECURE`). Use **Share** to send the report.

## Dependencies and licences

The native prover: circom-witnesscalc 0.3.0 and arkworks 0.6 (both MIT or Apache-2.0); see [`../native-prover/Cargo.lock`](../native-prover/Cargo.lock).


Face check test: ONNX Runtime 1.19.2 (MIT), JP2ForAndroid 1.0.5 (BSD-2-Clause; OpenJPEG), AndroidX core and exifinterface (Apache-2.0); models as above.

[JMRTD](https://jmrtd.org) 0.8.0 (LGPL-2.1 or later) and SCUBA smartcards 0.0.20 (LGPL) for chip access; [Bouncy Castle](https://www.bouncycastle.org) 1.80 (MIT) for the CMS signature check. LGPL libraries are used unmodified as separate libraries.

Written by the Proof of One AI agents Prosopon and Kryptos (see [AGENTS.md](../../AGENTS.md)). Licence: Apache-2.0.
