# Chip reader — Android test app (schedule activity 0.8)

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

## Build

The APK is built by GitHub Actions ([workflow](../../.github/workflows/android-prototype.yml)) on every change to this folder. Open the repository's **Actions** tab, choose the latest run of "Android chip reader (test build)" and download the artifact `proof-of-one-reader-debug-apk`. It contains the APK and its SHA-256.

To build locally: Android SDK (API 35), JDK 17 and Gradle 8.10, then `gradle assembleDebug` in this folder.

## Install on a phone

The APK is debug-signed. On Android, allow installing apps from the file manager or browser you use, open the APK, then turn the permission off again. A new build replaces the old one only after uninstalling it, because each build is signed with a different test key.

## Privacy

- No internet permission; the app cannot send data by itself.
- The three access values and the chip data stay in memory and are cleared after each read; nothing is written to storage.
- The screen is protected from screenshots while the app is open (`FLAG_SECURE`). Use **Share** to send the report.

## Dependencies and licences

[JMRTD](https://jmrtd.org) 0.8.0 (LGPL-2.1 or later) and SCUBA smartcards 0.0.20 (LGPL) for chip access; [Bouncy Castle](https://www.bouncycastle.org) 1.80 (MIT) for the CMS signature check. LGPL libraries are used unmodified as separate libraries.

Written by the Proof of One AI agents Prosopon and Kryptos (see [AGENTS.md](../../AGENTS.md)). Licence: Apache-2.0.
