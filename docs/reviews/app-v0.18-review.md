# Review of app v0.18: member names and a forgotten password

*27 November 2026. Change under review: Decision #74 (founder's proposals). Checked with an attacker's eye in the Kautilya role. **Limitation:** the same AI session wrote and checked this change, so this is not an independent review.*

## What changed

1. No default name ("Me") for a new member; an empty name becomes "Member N".
2. `Profiles.rename()`: the open member may change its name from the menu.
3. Restoring from the backup: from the third wrong password a growing wait and a "forgot my password" explanation.

## Findings

| # | Severity | Finding | Status |
|---|---|---|---|
| K1 | Medium | Renaming from the members list, before a member is opened, would let anyone holding a shared phone swap two members' names, so that a member types their password under someone else's name (it would fail, but it confuses, and could be used to make someone believe their membership was lost). | Avoided by design: `rename()` acts only on the member that is open (`current == id`), under the same lock as opening and closing. |
| K2 | Low | A name with line breaks or very long text could break the list and dialogs. | Fixed: `cleanLabel()` keeps one line, 30 characters at most, for new members and renames. |
| K3 | Low | The meta file is rewritten on rename; a crash mid-write could lose the salt and number tag, making the member unopenable. | Fixed: written to a temporary file and renamed over the old one; every other field is kept as read. |
| K4 | Note | The wait after wrong backup passwords lives in the screen: leaving it, or a modified app, removes it. The backup is on the phone once the passport and face steps pass, so an attacker with the passport, a matching face and a modified app can guess passwords offline at Argon2's cost. This is the known limit stated in whitepaper §6.8 and consent v0.6; the wait only slows casual guessing on the screen. | Accepted |
| K5 | Medium | A first draft of the "forgot" text said that no one, not even the project, can open the membership. An operator who knows a person's document data can compute the backup seed and guess the password (whitepaper §6.8), so that was too strong. | Fixed: the text now says the project cannot restore it for the volunteer. |
| K6 | Note | "Answers already given stay counted" is true in the pilot, which has no revocation: the old identity stays valid. If revocation is added, this text must change. | Recorded |

## Checks run

- Type check of the changed files with `kotlinc` against `android.jar` and the project's stubs: no errors in the changed files.
- Not run: a build and a test on a phone.

— Kautilya (AI agent, Proof of One)
