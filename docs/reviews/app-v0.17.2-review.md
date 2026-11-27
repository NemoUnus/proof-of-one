# Review of app v0.17.2: showing the chip photo and the selfie

*27 November 2026. Change under review: Decision #73 (founder's proposal). Checked with an attacker's eye in the Kautilya role (Decision #71, point 3). **Limitation:** the same AI session wrote and checked this change, so this is not an independent review; a review by a separate agent can be run before release if the founder asks.*

## What changed

1. The reader screen shows the photo read from the chip once the passport is read and checked.
2. The face-check screen of enrolment shows the chip photo and, below it, the last selfie, with the result (passed or not).
3. A decoded copy of the chip photo is cached in memory (`FaceStore.chipBitmap`) and used for both the display and the face comparison; a small copy of the selfie (480 pixels at most) is kept in memory while the screen is open.
4. The face-check text says the selfie is not saved and not sent (it used to say "deleted at once"), and a note under the photos says they are gone when the screen closes (8 languages).

## Findings

| # | Severity | Finding | Status |
|---|---|---|---|
| K1 | Medium | A chip-photo decode still running could store the decoded photo **after** `Profiles.clearChip()` had forgotten the passport, so a closed passport's photo would stay in memory (a regression of v0.16 review F1). | Fixed: `FaceStore.clear()` and `FaceStore.bitmap()` are synchronized on the same lock; `clearChip` calls `clear()`. |
| K2 | High | Reading a **second passport** replaced the chip photo bytes but not the cached decoded photo. The face check would then have compared the selfie with the **first** passport's face, so a person could enrol a second passport with their own face after reading their own first. | Fixed: a new reading goes through `FaceStore.set()`, which drops the decoded copy in the same step. |
| K3 | Low | A decode of an earlier passport finishing after a new reading could briefly show the earlier photo on the reader screen. | Fixed: the photo is added only if it is still the current cached one. |
| K4 | Low | No text for screen readers on the photos. | Fixed: the caption is the image's content description. |
| K5 | Note | Bystanders can see the passport photo on screen. It is the holder's own photo, on a screen that blocks screenshots and the recent-apps preview (`FLAG_SECURE`, already set on both screens). Accepted. | — |
| K6 | Note | The similarity number is not shown on screen, so the screen gives no direct signal for tuning a spoof; the shared report keeps it as before, for revising the threshold. | — |
| K7 | Note | The face check before each ballot is unchanged and shows no photo: the chip photo is not kept after enrolment, only the template. | — |

K2 would have been a real hole introduced by this change; it was found before release.

## Checks run

- Type check of the changed files with `kotlinc` against `android.jar` and the project's stubs: no errors in the changed files (the third-party libraries are not on that classpath, as before).
- Not run: a build and a test on a phone. The CI build and the founder's test on his phone are the next step.

— Kautilya (AI agent, Proof of One)
