# The iPhone app: reading documents, publishing, removals and attestation

*Research note v0.1, 11 November 2026. Schedule activity 1.14 (Decision Log #56). Prepared by the project's AI agents for the founder; sources at the end. Rules and figures are as published on the dates given and may change.*

## Summary

1. **An iPhone app can read passport chips.** Apple's Core NFC framework gives apps access to ICAO 9303 chips. The app must implement the chip's access protocols itself, and an open-source Swift library already does most of this. Browsers on iPhones cannot.
2. **Publishing needs a legal name.** Apple shows the publisher's legal name on the App Store: a person's own legal name (an alias or nickname delays approval), or the name of a registered legal entity with a D-U-N-S number. Apple's guidelines also say that apps in highly regulated fields, or that require sensitive user information, should be submitted by a legal entity that provides the service, "and not by an individual developer".
3. **Governments do get apps removed.** In its 2025 report Apple removed 2,045 apps on government demand, mostly in three countries. In 2021 Apple and Google removed an opposition voting-advice app in one country on the first day of its parliamentary election. An App Store app is therefore not a reliable channel in the places where the project is most needed.
4. **Device attestation contacts Apple.** App Attest certifies an app's key through Apple's servers. It is optional for the project's purposes and should stay so.
5. **Proposal.** Keep the browser path for voting, which already works on iPhones. Use the app only for what needs it (enrolment, and later key storage). Publish the iPhone app through a legal entity that actually provides the service; a named individual's account is excluded by Apple's own rule for such apps. A first build check of the shared Rust core for iPhones runs on GitHub (§6).

## 1. Reading identity documents on an iPhone

Core NFC can read ISO 7816 chips, the type used by ICAO 9303 passports (the project's assessment, consistent with [1] and [2]). The app declares the passport application identifier `A0000002471001` under the Info.plist key `com.apple.developer.nfc.readersession.iso7816.select-identifiers`, and adds the NFC tag-reading capability with a usage description [1]. An Apple engineer notes that this key belongs in Info.plist, not the entitlements file, and that the app must implement the passport's security protocols itself [1].

The open-source Swift library NFCPassportReader (MIT licence) implements Basic Access Control (BAC), PACE with Generic Mapping only, passive authentication, active authentication and chip authentication [2]. It is a candidate for the iOS interface layer, to be reviewed like any other dependency. PACE with Integrated or Chip Authentication Mapping is still on its to-do list, so documents that require those mappings would need further work.

No iPhone browser offers Web NFC, and Web NFC cannot read passport chips on any platform (Decision Log #56; MDN and the W3C Web NFC draft describe it as reading NDEF messages only). Enrolment on an iPhone therefore needs a native app.

## 2. Who can publish on the App Store

- **Individual account.** "Your personal legal name is needed so that you can enter into contracts with Apple. Your name will be displayed as the seller name of your apps on the App Store." An alias or nickname delays approval [3].
- **Organisation account.** "Your organization must be a legal entity that can enter into contracts with Apple. We do not accept DBAs, fictitious business names, trade names, or branches." It needs a D-U-N-S number, and its name is shown as the seller [3].
- **Regulated or sensitive services.** Guideline 5.1.1(ix): "Apps that provide services in highly regulated fields (such as banking and financial services, healthcare, gambling, legal cannabis use, air travel and crypto exchanges) or that require sensitive user information should be submitted by a legal entity that provides the services, and not by an individual developer" [4]. Polling is not among the examples, but Proof of One reads identity documents and compares faces, so the rule very likely applies to it. In one published rejection under this guideline, Apple wrote that the app "must be published under a seller name and company name" of the organisation providing the service, and that the issue "cannot" be resolved "with documentation showing permission to publish this app on behalf of the content owner" [5].

What follows for the project:

- A **named co-maintainer** publishing under their own name would put that person's legal name on every listing, in every country, for an app that some governments may object to, and guideline 5.1.1(ix) excludes individual developers for such apps. This route is not available in practice.
- A **host organisation** would probably have to be the provider of the service in Apple's eyes, not only a publisher, so it would carry real responsibility for the app. There is precedent for one organisation publishing another's privacy app: Orbot for iOS is developed by the Guardian Project [6] and published on the App Store by The Tor Project, Inc. [11]. Orbot is not in a regulated field, so this does not show how Apple would treat a polling app.
- A **legal entity of the project** (Decision Log #44, point 5) fits Apple's rules best. It needs the legal advice already planned, including whether its officers can stay anonymous.

## 3. Removals at governments' request

- Apple's 2025 App Store Transparency Report lists **2,045 apps removed** after government takedown demands. The largest numbers came from Russia (1,213), Vietnam (335) and mainland China (196) [7].
- In September 2021, Apple and Google removed the opposition's "Smart Voting" app from their Russian stores on the first of three voting days of the parliamentary election, after demands from the authorities [8].

These removals apply only in the country that demands them; the app stays available elsewhere [7]. The App Store is also not offered at all in some countries (general knowledge, not from the sources above).

What follows for the project:

1. **Voting must not depend on the app.** The browser path already works on iPhones (the app prototype and the voting page). It should stay a first-class way to answer.
2. **Enrolment needs the app only once.** An iPhone user who cannot install the app can enrol on an Android phone, for example under their own profile on a relative's phone (Decision Log #54), and then move the identity to their iPhone with the encrypted backup (Decision Log #56, point 4).
3. **Distribution outside the App Store is limited.** In the European Union, apps can also be offered through alternative marketplaces or directly from a website. They must still pass Apple's notarisation, and web distribution needs a developer that meets one of seven eligibility criteria, for example two continuous years in the developer programme and an app with more than one million first annual installs in the prior calendar year, or a fee waiver as an approved non-profit [9]. This helps only EU users and does not remove Apple from the path.

## 4. Device attestation on iOS

Apple's App Attest creates a key in the Secure Enclave and asks "Apple servers to certify that the key belongs to a valid instance of your app". The call that certifies the key "accesses a remote Apple server" [10]. Keys do not survive reinstallation, device migration or a restore from backup [10].

Decision Log #34 asks that core functions do not depend on Apple's or Google's servers. Our assessment, not stated by Apple: App Attest would let Apple see when an install of the app certifies a key, though not who the member is. Proposal: use App Attest, if at all, only as one optional signal at enrolment, never for voting, and never as a condition for taking part.

## 5. App Review topics to prepare

- A clear privacy policy and the data-collection labels: the face template and document fingerprint kept by the uniqueness service (whitepaper §6), and nothing else.
- The reason for NFC and camera access, stated in the usage descriptions.
- Guideline 5.1.1(ix): an explanation of who provides the service (see §2).
- A demonstration account or mode for the reviewer that uses synthetic documents only.

## 6. Build check of the shared core

Decision #56 makes the app's core one Rust library with a thin interface per platform. The native prover (reference/native-prover) is the first part of that core. It now has a C interface for Swift (`include/poo_native_prover.h`: `poo_prove`, `poo_string_free`), tested on Linux with a synthetic ballot: proved and verified twice, and bad input returns an error instead of crashing.

The workflow `.github/workflows/ios-core.yml` runs on GitHub's macOS servers. It builds static libraries for iPhones and for the iPhone simulator, packs them with the header into an XCFramework that a Swift app can link, and runs the same C test on the Mac and inside an iPhone simulator. No Apple account is needed for any of this. Results are recorded in the tracker (task 1.14-02).

## 7. Decisions for the founder

1. **Publishing route** (Decision Log #56, point 2). Recommended: a legal entity of the project, or a host organisation willing to be the provider of the service. Not possible under guideline 5.1.1(ix): a named individual's account.
2. **App Attest** optional and used at enrolment only (§4).
3. **Voting in the browser** kept as a first-class path on all phones (§3).

## Sources

1. Apple Developer Forums, "ePassport NFC detected but not reading, entitlement error when adding AID": https://developer.apple.com/forums/thread/817267
2. NFCPassportReader (A. Quinn), README: https://github.com/AndyQ/NFCPassportReader
3. Apple Developer Program, "Become a member" (enrolment requirements): https://developer.apple.com/programs/enroll/
4. Apple, App Store Review Guidelines, guideline 5.1.1(ix), checked 11 November 2026: https://developer.apple.com/app-store/review/guidelines/ (archived record: https://conductatlas.com/platform/apple/apple-app-store-review-guidelines/provision/CA-P-019068/regulated-and-sensitive-apps-must-be-submitted-by-legal-entities/)
5. Apple Developer Forums, "App Rejection Guideline 5.1.1 (ix)": https://developer.apple.com/forums/thread/750018
6. Help Net Security, "Product showcase: Orbot – Tor VPN for iOS", 14 January 2026: https://www.helpnetsecurity.com/2026/01/14/product-showcase-orbot-tor-ios/
7. Apple, 2025 App Store Transparency Report: https://www.apple.com/legal/app-store/transparency/2025/
8. TechCrunch, "Apple and Google bow to pressure in Russia to remove Kremlin critic's tactical voting app", 17 September 2021: https://techcrunch.com/2021/09/17/apple-and-google-bow-to-pressure-in-russia-to-remove-kremlin-critics-tactical-voting-app
9. Apple, "Getting started with Web Distribution in the EU": https://developer.apple.com/support/web-distribution-eu/
10. Apple, "Establishing your app's integrity" (DeviceCheck / App Attest): https://developer.apple.com/documentation/devicecheck/establishing-your-app-s-integrity
11. App Store listing of Orbot (developer: The Tor Project; provider: The Tor Project, Inc), checked 11 November 2026: https://apps.apple.com/gb/app/orbot/id1609461599

— Hermes and Prosopon (AI agents, Proof of One)
