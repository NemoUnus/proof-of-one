// SPDX-License-Identifier: Apache-2.0
// Identity attributes with several verified nationalities (Decision Log #30).
//
// A member's attributes are a date of birth (Decision Log #37), a sex code and up to
// MAX_DOCS documents, each with its own nationality code and expiry month. Unused slots
// are (0, 0). The date of birth is stored as a day number (days since 1 January 1900),
// hidden inside the leaf; proofs reveal only whether it lies in a poll's range, so an
// age stated at enrolment never goes out of date.
// The same field order is used by the enclave's credential message, the
// registration proof π_reg and the ballot proof π_vote:
//
//   fields = [birthDay, sexCode, nat_0, exp_0, nat_1, exp_1, nat_2, exp_2]
//   attr   = Poseidon(...fields, salt)
//
// Nationality codes are the three ICAO letters packed as one number,
// 65536·c1 + 256·c2 + c3 (natCode("FRA")), exactly as the document-validity proof
// π_doc outputs them. Tests may use any positive number.
// Older single-document attributes { natCode, expiryMonth } are accepted and treated
// as one document.
"use strict";

const MAX_DOCS = 3;
const DAY0 = Date.UTC(1900, 0, 1);
const DAY_MS = 86400000;

// Days since 1 January 1900 (UTC) for a calendar date.
function dayNumber(y, m, d) {
  return Math.round((Date.UTC(y, m - 1, d) - DAY0) / DAY_MS);
}
// The poll's age rule as a range of birth days, evaluated on `on` = [y, m, d]:
// at least `minAge` years old on that day, and at most `maxAge` (optional).
// Someone born on the same calendar day `minAge` years earlier counts as old enough.
function ageRange(on, { minAge = 0, maxAge } = {}) {
  const [y, m, d] = on;
  const maxBirthDay = dayNumber(y - minAge, m, d);
  const minBirthDay = maxAge === undefined ? 0 : dayNumber(y - maxAge - 1, m, d) + 1;
  return { maxBirthDay, minBirthDay };
}

// The packed nationality code of an ICAO three-letter code (e.g. "FRA", "D<<").
function natCode(alpha3) {
  if (typeof alpha3 !== "string" || alpha3.length !== 3) throw new Error("three letters expected");
  return BigInt(alpha3.charCodeAt(0) * 65536 + alpha3.charCodeAt(1) * 256 + alpha3.charCodeAt(2));
}

function docsOf(a) {
  const docs = a.docs ?? [{ nat: a.natCode, expiry: a.expiryMonth }];
  if (docs.length < 1 || docs.length > MAX_DOCS) throw new Error(`between 1 and ${MAX_DOCS} documents`);
  const seen = new Set();
  for (const d of docs) {
    if (!(Number(d.nat) > 0)) throw new Error("nationality code must be positive");
    if (seen.has(Number(d.nat))) throw new Error("one document per nationality");
    seen.add(Number(d.nat));
  }
  return docs.map((d) => ({ nat: BigInt(d.nat), expiry: BigInt(d.expiry) }));
}

function slots(a) {
  const d = docsOf(a);
  while (d.length < MAX_DOCS) d.push({ nat: 0n, expiry: 0n });
  return d;
}

function attrFields(a) {
  return [BigInt(a.birthDay), BigInt(a.sexCode), ...slots(a).flatMap((d) => [d.nat, d.expiry])];
}

function attrHash(H, a, salt) {
  return H([...attrFields(a), BigInt(salt)]);
}

// Index of a document that satisfies the poll's policy: the required nationality
// (any, if 0) and an expiry month not before minExpiryMonth. -1 if none.
function selectDoc(a, policy) {
  if (!inAgeRange(a, policy)) return -1;
  const req = BigInt(policy.requiredNat), minExp = BigInt(policy.minExpiryMonth);
  return slots(a).findIndex((d) => d.nat !== 0n && (req === 0n || d.nat === req) && d.expiry >= minExp);
}

// Adds a document, or replaces the document of the same nationality (renewal).
function withDocument(a, doc) {
  const docs = docsOf(a).filter((d) => d.nat !== BigInt(doc.nat));
  docs.push({ nat: BigInt(doc.nat), expiry: BigInt(doc.expiry) });
  if (docs.length > MAX_DOCS) throw new Error(`at most ${MAX_DOCS} documents`);
  return { birthDay: a.birthDay, sexCode: a.sexCode, docs };
}

function inAgeRange(a, policy) {
  const b = BigInt(a.birthDay);
  return b <= BigInt(policy.maxBirthDay) && b >= BigInt(policy.minBirthDay ?? 0);
}

module.exports = { MAX_DOCS, dayNumber, natCode, ageRange, inAgeRange, docsOf, slots, attrFields, attrHash, selectDoc, withDocument };
