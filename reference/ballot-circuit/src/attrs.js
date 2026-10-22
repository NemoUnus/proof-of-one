// SPDX-License-Identifier: Apache-2.0
// Identity attributes with several verified nationalities (Decision Log #30).
//
// A member's attributes are an age band, a sex code and up to MAX_DOCS documents,
// each with its own nationality code and expiry month. Unused slots are (0, 0).
// The same field order is used by the enclave's credential message, the
// registration proof π_reg and the ballot proof π_vote:
//
//   fields = [ageBand, sexCode, nat_0, exp_0, nat_1, exp_1, nat_2, exp_2]
//   attr   = Poseidon(...fields, salt)
//
// Older single-document attributes { natCode, expiryMonth } are accepted and treated
// as one document.
"use strict";

const MAX_DOCS = 3;

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
  return [BigInt(a.ageBand), BigInt(a.sexCode), ...slots(a).flatMap((d) => [d.nat, d.expiry])];
}

function attrHash(H, a, salt) {
  return H([...attrFields(a), BigInt(salt)]);
}

// Index of a document that satisfies the poll's policy: the required nationality
// (any, if 0) and an expiry month not before minExpiryMonth. -1 if none.
function selectDoc(a, policy) {
  const req = BigInt(policy.requiredNat), minExp = BigInt(policy.minExpiryMonth);
  return slots(a).findIndex((d) => d.nat !== 0n && (req === 0n || d.nat === req) && d.expiry >= minExp);
}

// Adds a document, or replaces the document of the same nationality (renewal).
function withDocument(a, doc) {
  const docs = docsOf(a).filter((d) => d.nat !== BigInt(doc.nat));
  docs.push({ nat: BigInt(doc.nat), expiry: BigInt(doc.expiry) });
  if (docs.length > MAX_DOCS) throw new Error(`at most ${MAX_DOCS} documents`);
  return { ageBand: a.ageBand, sexCode: a.sexCode, docs };
}

module.exports = { MAX_DOCS, docsOf, slots, attrFields, attrHash, selectDoc, withDocument };
