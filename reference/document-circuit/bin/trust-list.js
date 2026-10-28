#!/usr/bin/env node
// SPDX-License-Identifier: Apache-2.0
// Builds the published trust list (references only) from CSCA master lists you have
// downloaded yourself, and prints its listHash so you can compare it with ours.
//   node bin/trust-list.js GermanMasterList.ml [more.ml ...] > trust-list.json
"use strict";
const fs = require("fs");
const path = require("path");
const T = require("../src/trustlist");

const files = process.argv.slice(2);
if (!files.length) { console.error("usage: node bin/trust-list.js <master list .ml> ..."); process.exit(2); }
const pins = Object.values(T.PINNED).flat().map((p) => p.sha256);
const today = new Date().toISOString().slice(0, 10);
const sources = files.map((f) => T.readMasterList(fs.readFileSync(f), { pinned: pins, name: path.basename(f) }));
const list = T.buildTrustList(sources, { today });
console.error(`${list.entries.length} CA certificates from ${list.countries.length} countries, valid on ${today}`);
console.error(`listHash ${list.listHash}`);
const pub = T.publishable(list, sources);
console.error(`${pub.itemisedEntries} entries itemised; ${pub.totalEntries - pub.itemisedEntries} come only from whole-list sources and are not itemised`);
process.stdout.write(JSON.stringify({ built: today, sources: sources.map((s) => ({ name: s.name, fileSha256: s.fileSha256, signer: s.signer.subject, anchor: s.anchor.sha256, itemised: s.itemise })), ...pub }, null, 1) + "\n");
