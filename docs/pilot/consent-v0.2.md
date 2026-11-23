# Proof of One pilot — information for volunteers and consent

*Draft v0.2, 23 November 2026. To be read in full before installing the app. The app shows a short summary of it and asks for your agreement before enrolment.*

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
3. **You answer polls with that membership.** Your answer is locked (encrypted) before it leaves the phone. Only the totals of all answers are ever unlocked, and the system rejects a second answer from the same person.
4. **Anyone can check.** The locked answers and the proof of the count are kept on a public record, so the result can be verified by anyone, without revealing who answered what.

## 3. What this pilot is

Before anyone else uses the system, about 100 adult volunteers try the whole process with their own passport.

- The poll's question is harmless (for example, which football team you support). Nothing depends on the answers.
- Taking part is voluntary and free.
- Everything runs on a **public test network**, not a real one.
- **The software has not yet been reviewed by independent experts.** It may contain mistakes, including mistakes that affect privacy. Finding them is part of the pilot's purpose. If you are not comfortable with this, please do not take part; saying no is completely fine.

## 4. Your information stays private

- **Nothing that identifies you is published anywhere**: not your name, passport number, photo, date of birth, or phone number.
- Your passport data and your selfie **never leave your phone**.
- What is kept on the public test network is only random-looking codes and locked answers. Nobody can read your answer.
- The few things the enrolment service keeps (section 10) are **deleted when the pilot ends**.

One honest limit: in this pilot, the service that enrols members and the service that sends answers to the network are run by the same organiser, and both see your phone's internet address. With effort, that organiser could guess which code on the public network is yours. Even then, your answers stay locked. The full system will use independent operators to remove this limit.

## 5. Please keep the pilot private

- **Do not talk about the pilot or the project outside this group.** Do not post about it on social media.
- **Do not take screenshots or photos of the app.** When asked for a result, use the app's **Share result** button: that text contains no personal data.
- **Keep your member number private** (it looks like `ONE-XXXX-XXXX-XXXX-XXXX-X`). Do not share it with anyone, not even the organiser. The government that issued your passport could compute the same number, so a number you shared could be linked to you.

## 6. Who runs the pilot

The pilot is organised by the person who invited you, who is also the coordinator of this group and runs the pilot's services (section 4).

- The project's developers stay anonymous, for their safety. **Please do not ask or guess who they are, and do not name anyone as a developer**, inside or outside the group.
- Send your questions to the coordinator, in the group or privately. The coordinator passes them on to the project and brings back the answers.

## 7. What you will do

1. Install the app and choose your language.
2. Type three values from the bottom lines of your passport's photo page, then hold the passport to the phone. These values only open the chip and are cleared after reading.
3. Take a selfie. The phone compares it with the photo in the chip, and deletes it.
4. Choose a password (at least 8 characters). It lets you move your membership to another phone. Nobody can recover it for you.
5. The app enrols you. This takes about a minute.
6. Some hours later (between 2 and 26), the first time you open the app, it registers your membership on the public test network by itself.
7. Answer the test poll, change your answer if you like, and after the poll closes, see the result and check that your own answer was counted.

## 8. Who can take part

- You are 18 or older.
- You have your own valid chip passport from the pilot's issuing country.
- You have an Android phone that can read the passport's chip (NFC).

## 9. Staying safe

- If the internet is restricted where you are, use a VPN for the whole pilot: installing, enrolling and voting.
- The app has a neutral name and icon. Removing it removes all its data in one step.
- If you change or lose your phone, install the app on the new one, read your passport again and enter your password: your membership comes back, with the same number.

## 10. Details: what goes where

| What | Where it goes | Kept for |
|---|---|---|
| Your passport's chip data: name, document number, national number, photo | Nowhere. Used only on your phone. | Until you remove the app |
| Your selfie | Nowhere. Compared on the phone, then deleted. | Not kept |
| A mathematical proof that your passport is genuine, with your date of birth, sex, nationality and the month your passport expires | The enrolment service. It needs these to sign your membership. | Not stored |
| Two random-looking fingerprints of your passport, used only to stop a second enrolment; the issuing country; the time of enrolment | The enrolment service | Deleted when the pilot ends |
| Your membership, locked with your password | The enrolment service. It cannot unlock it. | Deleted when the pilot ends |
| Your registration (random-looking codes) and your locked answers | The public test network | Permanently, like everything on a public network |

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
