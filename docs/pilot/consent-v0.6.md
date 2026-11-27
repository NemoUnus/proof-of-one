# Proof of One pilot — information for volunteers and consent

*Version 0.6, 27 November 2026; replaces version 0.5. It applies from app version 0.17.1, once the organiser has approved and published it. What changed: a review of the project's whitepaper by a second AI model found that version 0.5 left out several things that are true of this pilot. This version adds them: anyone who can open your membership can see your past answers (sections 4 and 9); the organiser's services run on a commercial cloud, without the protected hardware of the full design (section 4); a lost or stolen phone's membership cannot be cancelled during the pilot (section 9); with about 100 members, taking part is easier to infer (section 4); and who could compute your member number (section 5). Everything else is as in version 0.5.*

## 1. Why this project exists

Many people cannot say freely what they think. Polls are often run by those who want a certain answer, and nobody can check how the results were counted. Online polls can also be filled by fake accounts, so that one person counts as a thousand.

Proof of One is an open-source project for polls in which:

- **each real person can answer once**, so fake accounts cannot change the result;
- **nobody can see who answered what**, not even the people who run the system;
- **anyone can check the count**, because the result is computed from public records.

The aim is to let people anywhere be heard honestly and safely. The project is non-commercial: nobody earns money from it.

## 2. How it works, in simple words

1. **Your passport shows that you are a real person.** The chip in your passport is signed by the country that issued it, so it cannot be faked. Your phone reads it.
2. **Your phone proves this without telling who you are.** Using mathematics, the phone shows "this is a genuine passport, used only once" without sending your name, number or photo. You receive a membership: a long random code that stays on your phone.
3. **You answer polls with that membership.** Your answer is encrypted before it leaves the phone. Only the totals of all answers are ever decrypted, and the system rejects a second answer from the same person.
4. **Anyone can check.** The encrypted answers and the proof of the count are kept on a public record, so the result can be verified by anyone, without revealing who answered what.

## 3. What this pilot is

Before anyone else uses the system, about 100 adult volunteers try the whole process with their own passport.

- The poll's question is harmless (for example, which football team you support). Nothing depends on the answers.
- Taking part is voluntary and free.
- Everything runs on a **public test network**, not a real one.
- **The software has not yet been reviewed by independent experts.** It may contain mistakes, including mistakes that affect privacy. Finding them is part of the pilot's purpose. If you are not comfortable with this, please do not take part; saying no is completely fine.

## 4. Your information stays private

- **Nothing that identifies you is published anywhere**: not your name, passport number, photo, date of birth, or phone number.
- Your passport data and your selfie **never leave your phone**. (One exception we cannot control: some phones' camera apps also save a copy of the selfie in the gallery. After enrolment, look in your gallery and delete it if it is there.)
- To check before each answer that it is you, the phone keeps a **face template** made from the photo in your passport's chip: 512 numbers, not a picture. It stays on your phone only, encrypted with your password, is never sent anywhere, and is not part of your backup. Removing your membership from the phone, or removing the app, deletes it.
- What is kept on the public test network is only random-looking codes and encrypted answers. Nobody can read your answer there.
- **On your phone, your answers can be seen.** The app does not keep a list of your answers, but it can find each of them again from the public record with your membership's secret. So anyone who can open your membership (with your password, or because they watched you type it) can see what you answered in every poll you took part in. Keep your password to yourself.
- The few things the enrolment service keeps (section 10) are **deleted when the pilot ends**.

One honest limit: in this pilot, the service that enrols members and the service that sends answers to the network are run by the same organiser, on a commercial cloud service, and both see your phone's internet address. The full design runs the enrolment checks inside protected hardware with independent operators; the pilot does not. With effort, that organiser could guess which code on the public network is yours. Even then, your answers stay encrypted. With only about 100 members, it is also easier than it will be in the full system to infer that a particular person took part.

A second limit: to show which polls you have answered and to check results, the app reads the public test network through a public access point run by a third party (not the organiser). That access point sees your phone's internet address and the random-looking codes your phone asks about; from them it could tell that several of these codes belong to the same phone. It cannot see your name or your answers. A VPN (section 9) hides your internet address from it.

## 5. Please keep the pilot private

- **Do not talk about the pilot or the project outside this group.** Do not post about it on social media.
- **Do not take screenshots or photos of the app.** When asked for a result, use the app's **Share result** button. That text holds no name, document number, member number or photo. It does hold technical details, such as how closely your selfie matched (rounded) and, for a passport that could not be read, the public certificate that signed that kind of passport.
- **Keep your member number private** (it looks like `ONE-XXXX-XXXX-XXXX-XXXX-X`). Do not share it with anyone, not even the organiser. Whoever runs the enrolment service, or anyone who obtained its key, could compute the same number from your passport data, so a number you shared could be linked to you.

## 6. Who runs the pilot

The pilot is organised by the person who invited you, who is also the coordinator of this group and runs the pilot's services (section 4).

- The project's developers stay anonymous, for their safety. **Please do not ask or guess who they are, and do not name anyone as a developer**, inside or outside the group.
- Send your questions to the coordinator, in the group or privately. The coordinator passes them on to the project and brings back the answers.

## 7. What you will do

1. Install the app and choose your language.
2. Type three values from the bottom lines of your passport's photo page, then hold the passport to the phone. These values only open the chip and are cleared after reading.
3. Take a selfie. The phone compares it with the photo in the chip, and deletes it. It keeps only the face template of the chip photo (section 4).
4. Give your membership a name on this phone, a nickname only you recognise rather than your real name, and choose a password (at least 8 characters, hard to guess). The password opens your membership on this phone each time, and lets you move it to another phone. Nobody can recover it for you, not even the project: if you forget it, this membership cannot be opened on any phone during the pilot, and you cannot enrol again with the same passport. Keep it somewhere safe.
5. The app enrols you. This takes about a minute.
6. A few minutes later (between 1 and 10), while the app is open or the next time you open it, it registers your membership on the public test network by itself. While the app shows this registration page, your membership stays open until the registration is done. From then on you can answer every open poll.
7. Answer the test polls and change your answer if you like. Before each answer is sent, the app asks for a selfie and compares it, on the phone only, with your face template. This check discourages someone else from answering for you on your phone; it cannot stop a changed version of the app, and it may not stop a good photo of you. After three failed selfies, the app waits ten minutes (while it stays open). If you move your membership to another phone with your password, the app shows the answer recorded for you, and you can keep it or change it. After the poll closes, see the result and check that your own answer was counted.

## 7a. Results and statistics

With each result, the app shows the number of people who took part, their share of all registered members, and how many times answers were changed before the poll closed. These numbers come from the public record. Nobody can see which answer anyone changed, from or to.

Results by group, such as by sex or age group, are **not** published in this pilot. If they are added later, this text will first be updated, and they would be shown only for groups large enough that no one's answer can be worked out.

## 8. Who can take part

- You are 18 or older.
- You have your own valid chip passport from the pilot's issuing country.
- You have an Android phone that can read the passport's chip (NFC).

## 9. Staying safe

- If the internet is restricted where you are, use a VPN for the whole pilot: installing, enrolling and voting.
- The app has a neutral name and icon. Removing it removes all its data in one step.
- If you change or lose your phone, install the app on the new one, read your passport again and enter your password: your membership comes back, with the same number. In this pilot a lost or stolen phone's membership **cannot be cancelled**: it stays protected only by your password and the face check, so choose a strong password. Moving the phone's data with a phone-to-phone transfer does not move the membership: the app's data is not copied, by design.
- **Sharing a phone.** Up to four people can each keep their own membership on one phone, for example a parent without a suitable phone. Each membership opens only with its own password and closes by itself after five minutes without use. Anyone holding the phone can try passwords; after the third wrong one the app makes them wait, longer each time (up to an hour; restarting the phone starts the wait again), so choose a password that is hard to guess. Do not let anyone watch you type your password: whoever knows it can open your membership on that phone. The names given to the memberships, and the day each was added, can be seen by anyone who opens the app, so use nicknames. Anyone holding the phone can also remove a membership from it, as they could remove the app; the membership itself can then be restored with the passport and the password, if its backup was stored at enrolment. Each person enrols with their own passport and their own face.

## 10. Details: what goes where

| What | Where it goes | Kept for |
|---|---|---|
| Your passport's chip data: name, document number, national number, photo | Nowhere. Used only on your phone. | Until you remove the app |
| Your selfie (at enrolment and before each answer) | Nowhere. Compared on the phone, then deleted. (Some camera apps also save a copy in the gallery: see section 4.) | Not kept by the app |
| Face template of your passport's photo (512 numbers, not a picture) | Nowhere. Kept on your phone, encrypted with your password. | Until you remove your membership from the phone or remove the app |
| The name you give your membership on the phone | Nowhere | Until you remove it from the phone or remove the app |
| A mathematical proof that your passport is genuine, with your date of birth, sex, nationality and the month your passport expires | The enrolment service. It needs these to sign your membership. | Not stored |
| Two random-looking fingerprints of your passport, used only to stop a second enrolment; the issuing country; the time of enrolment | The enrolment service | Deleted when the pilot ends |
| Your membership, encrypted with your password | The enrolment service. It cannot decrypt it from what it holds; someone who also knew your passport data would still have to guess your password. | Deleted when the pilot ends |
| Your registration (random-looking codes) and your encrypted answers | The public test network | Permanently, like everything on a public network |
| Your phone's internet address, and the random-looking codes your phone asks about when it shows polls and results | A public test-network access point, run by a third party (section 4) | As that third party keeps its records; the organiser does not control it |

## 11. Ending and deletion

- You can stop at any time by removing the app. You do not need to give a reason.
- All data of the enrolment service is deleted **at the latest 30 days after the pilot's last poll closes**, and the deletion is announced.
- What is on the public test network cannot be deleted by anyone, but it contains nothing that identifies you.

## 12. Agreement

By ticking the box in the app, you confirm that:

- you are 18 or older and the passport is your own;
- you have read this text and understood that the software has not been independently reviewed;
- you will not talk about the pilot outside the group, share screenshots or share your member number;
- you take part voluntarily and can stop at any time.
