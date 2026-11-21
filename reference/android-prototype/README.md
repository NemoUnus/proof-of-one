# Chip reader and native prover — Android test app (schedule activities 0.8 and 1.4-00)

> **Test app only. Not audited.** It reads a passport chip and checks it on the phone. Since v0.8 one screen, **Enrol with the pilot service**, enrols the passport with the pilot's enrolment service (Decision Log #57): the only screen that sends anything, and only to that service.

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

Since v0.3 a second button runs the **enrolment proof π_doc** benchmark with a TEST-ONLY random key; since v0.5 it proves suite 2 (749,147 constraints) from a synthetic passport, with the witness computed on the phone (see below).

## Enrolment with the pilot service (v0.8, Decision Log #57 and #58)

After a passport is read, **Enrol with the pilot service** runs the whole enrolment against the pilot's service ([`../enrol-service`](../enrol-service), [design](../../docs/specs/pilot-enrolment-service-v0.1.md)):

1. the signer's certificate goes to `/signer`, which checks it against the issuing state's CSCA and adds it to the tree of checked signers; the app takes its path from `/path`;
2. a session gives a fresh challenge, the date and the issuing state's rule (person-key path, DG13 field);
3. the member's secrets are made on the phone (`member.rs`, as `enrolment.js newMember`); only the commitment `cm` leaves the phone;
4. the keyed fingerprints: the blinded points go to `/evaluate`, the answers are checked against the service's published key (DLEQ);
5. π_doc is made on the phone with the real tree path, the challenge and the date (no test tree);
6. `/enrol` checks π_doc (through the verifier contract), the session, the rule and the uniqueness of both fingerprints, and signs the credential.

The secrets and the credential stay in the app's private storage (`member.json`, no backup); uninstalling the app deletes them. Sent to the service: the signer's certificate (public), the issuing state, two blinded points, π_doc and its public values (birth date, sex, nationality, expiry month, face commitment, the two keyed fingerprints). Never sent: the photo, the MRZ, the document number, the personal number, the name. A passport can be enrolled once; the face check does not yet gate this screen (its threshold is still being measured).

## Face check test (v0.4, Decision Log #57)

After a successful read, the button **Face check test** compares the chip photo (DG2) with a selfie, **on the phone**, and shows a similarity score. Its purpose is to set the threshold of the pilot's face check from real measurements: the passport holder, and other people, against the same chip photo. Nothing is stored or sent; the selfie file is deleted as soon as it is read; **Share the numbers** shares the scores only.

- Chip photos in JPEG 2000 are decoded with JP2ForAndroid (OpenJPEG).
- Faces are found with SCRFD-500M (five landmarks), aligned onto the standard 112×112 template, and compared by the cosine of two ArcFace MobileFaceNet embeddings. The pipeline was checked against a Python reference ([`face/ref.py`](face/ref.py)).
- The models come from InsightFace's "buffalo_sc" release, downloaded by the workflow and checked against [`face/models.sha256`](face/models.sha256). InsightFace's code is MIT; its **pretrained models are for non-commercial research use only**. That fits the non-commercial pilot; any real release needs a model whose licence allows it, or one trained by the project.
- The selfie is taken by the phone's camera app (no camera permission in this app).

**First measurements (16 November 2026, Samsung Galaxy S24 Ultra, one field-test passport, chip photo JPEG 241×320):**

| Selfie | Similarity |
|---|---|
| the holder, facing the camera | 0.714 |
| the holder, facing the camera | 0.697 |
| the holder, head lowered and turned | 0.563 |
| another person | 0.058 |

Face found in the chip photo and in every selfie (detector score 0.82–0.83); detection and comparison 56–114 ms per picture. **Provisional threshold: 0.40**, well above the other person and below the holder's worst picture. Before the pilot it needs more measurements, above all from people who resemble the holder (relatives of the same sex and age), and from other passports and phones.

## Person key from the personal number in DG13 (v0.7)

Where DG13 holds a field with a ten-digit number, the enrolment proof test now takes the person key from it (path 1, number in DG13): π_doc hashes DG13 against the signed security object, walks its fields to the one with that tag, and uses its bytes as the personal number ([spec](../../docs/specs/document-fingerprint-oprf-v0.1.md), step 8a). The suite-2 circuit has 913,581 constraints. In the pilot the rule (path and tag) comes from the service for each issuing state; the test screen guesses it from the chip. The result says which path was used.

**Measured (20 November 2026, Samsung Galaxy S24 Ultra, one field-test passport):** person key from the DG13 number; both fingerprint rounds 0.1 s; witness 0.4–0.5 s; proof 3.4 s, then 3.3 s; key read in 61.4 s the first time and 3.5 s afterwards; verified on the phone, outputs equal to the machine-readable zone; the fingerprints of the second run equal those of the first; peak memory 1.6 GB. Earlier, with the name path (18 November): proof 3.1 s, the fingerprints also stable across two runs.

## Personal number outside the MRZ (v0.6.1, a diagnostic)

Decision #43 builds the person key from a personal number where the signed data carries one. Its standard place is DG11; DG13 is free for national use and may hold one too. After a read, the report now lists for DG11, DG12 and DG13 (where the chip has them) the size, whether the hash matches the security object, how many runs of exactly ten digits they contain and where, and the tags of their structure; never the contents. Since v0.6.2 it also counts, per field, the digits in other encodings (raw bytes 0–9, packed BCD, Arabic-Indic and Persian digits in UTF-8 or UTF-16), since national data may not use ASCII. If such a number is found, its last three digits are shown **on the phone's screen only**, not in the shared report, so that the holder can tell whether it is their personal number.

## Keyed fingerprints in the enrolment proof test (v0.6, Decision Log #58)

The enrolment proof test now also computes the two keyed fingerprints of the [OPRF specification](../../docs/specs/document-fingerprint-oprf-v0.1.md) (person key and document key) and proves them inside π_doc (suite 2, 763,666 constraints). Until the uniqueness service exists, the service's side runs on the phone with a **TEST-ONLY key** (`fpTestService`). Fingerprints under a published key protect nothing, so the screen never shows or shares them; it shows only which person-key path the passport allows (1 if the MRZ carries a personal number, else 2), the time of the two rounds, and whether the fingerprints are the same as in the previous run.

## Enrolment proof test with a real passport (v0.5, Decision Log #57, challenge 2)

After a successful read, the button **Enrolment proof test (from this passport)** makes the enrolment proof π_doc from the chip data just read, **on the phone**:

1. `DocInput.kt` builds the circuit input from DG1, the security object's signed content and signed attributes, the signature and the signer's RSA key, including the RSA hints. It is a port of `document-circuit/src/document.js`, and the workflow checks on synthetic passports that both build the same input byte for byte ([`test/DocInputCheck.kt`](test/DocInputCheck.kt)).
2. The native prover computes the witness from the circuit's witness graph, checks every constraint, proves and verifies (suite 2: SHA-1 and RSA up to 3,146 bits with any odd exponent below 2^17).
3. The screen compares the proof's outputs (birth date, sex, nationality, expiry month) with the same values read directly from the machine-readable zone, and shows timings and memory. **Share the result** shares numbers and yes/no only.

TEST ONLY: the key is a random TEST-ONLY key, and the tree of checked signers holds only this passport's signer, so the proof does not show that the signer is trusted. The chip report also says whether the document fits the circuits (suite, and sizes against the circuit's limits).

**First measurement (16 November 2026, Samsung Galaxy S24 Ultra, Android 14, one field-test passport of suite 2):** eContent 192 of 448 bytes and signed attributes 128 of 192 bytes after padding; witness on the phone 0.3 s; proof 3.3 s, then 3.0 s; reading the key 53.8 s the first time, 2.7 s afterwards; **verified on the phone, and the proof's outputs equal the values read from the machine-readable zone**; peak memory of the app 1.4 GB. From chip data to a verified proof: about 6 seconds after the first run.

The benchmark screen's enrolment button now proves suite 2 from a synthetic passport in the same way (witness on the phone), instead of suite 1 from a precomputed witness. The APK is about 280 MB.

## Build

The APK is built by GitHub Actions ([workflow](../../.github/workflows/android-prototype.yml)) on every change to this folder. Open the repository's **Actions** tab, choose the latest run of "Android chip reader (test build)" and download the artifact `proof-of-one-reader-debug-apk`. It contains the APK and its SHA-256.

To build locally: Android SDK (API 35), JDK 17 and Gradle 8.10; first build the native prover into `app/src/main/jniLibs/` and copy `ballot.graph`, `ballot_test.zkey` and `input.json` into `app/src/main/assets/`, as the workflow does; then `gradle assembleDebug` in this folder.

## Install on a phone

The APK is debug-signed. On Android, allow installing apps from the file manager or browser you use, open the APK, then turn the permission off again. A new build replaces the old one only after uninstalling it, because each build is signed with a different test key.

## Privacy

- Internet (since v0.8) is used by the enrolment screen only, and only to the pilot's enrolment service. The other screens send nothing.
- The three access values and the chip data stay in memory and are cleared after each read. The only thing written to storage is the enrolled member's secrets and credential (`member.json`, private to the app).
- The screen is protected from screenshots while the app is open (`FLAG_SECURE`). Use **Share** to send the report.

## Dependencies and licences

The native prover: circom-witnesscalc 0.3.0 and arkworks 0.6 (both MIT or Apache-2.0); see [`../native-prover/Cargo.lock`](../native-prover/Cargo.lock).


Face check test: ONNX Runtime 1.19.2 (MIT), JP2ForAndroid 1.0.5 (BSD-2-Clause; OpenJPEG), AndroidX core and exifinterface (Apache-2.0); models as above.

[JMRTD](https://jmrtd.org) 0.8.0 (LGPL-2.1 or later) and SCUBA smartcards 0.0.20 (LGPL) for chip access; [Bouncy Castle](https://www.bouncycastle.org) 1.80 (MIT) for the CMS signature check. LGPL libraries are used unmodified as separate libraries.

Written by the Proof of One AI agents Prosopon and Kryptos (see [AGENTS.md](../../AGENTS.md)). Licence: Apache-2.0.
