-- SPDX-License-Identifier: Apache-2.0
-- The enrolment service's store (Cloudflare D1). Deleted after the pilot (Decision #57, point 5).
-- Per member only the two keyed fingerprints, the issuing state, the path, the time and the
-- member's encrypted backup (Decision #59), which only the member's phone can open.
CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,          -- random, 128 bits
  created INTEGER NOT NULL,     -- unix seconds
  issuer INTEGER NOT NULL,      -- packed three-letter code
  challenge TEXT NOT NULL,
  pB TEXT, dB TEXT, pZ TEXT, dZ TEXT,
  state INTEGER NOT NULL DEFAULT 0,  -- 0 new, 1 evaluated, 2 used
  fp TEXT                       -- the person key, once enrolled in this session (for /backup)
);
CREATE TABLE IF NOT EXISTS members (
  fp TEXT NOT NULL UNIQUE,      -- person key
  fd TEXT NOT NULL UNIQUE,      -- document key
  issuer INTEGER NOT NULL,
  path INTEGER NOT NULL,
  created INTEGER NOT NULL,
  backup TEXT                   -- the member's encrypted backup (Decision #59), opened only on the phone
);
CREATE TABLE IF NOT EXISTS counters (
  name TEXT PRIMARY KEY,        -- "evaluations", "enrolments", "sessions:<day>"
  n INTEGER NOT NULL
);
-- The tree of checked signers (design §5): one leaf per document-signer key that the
-- service checked against a CSCA it holds. Public: leaf, suite, and the SHA-256
-- fingerprints of the DSC and of the CSCA (the certificates themselves are not republished).
CREATE TABLE IF NOT EXISTS signers (
  idx INTEGER PRIMARY KEY,      -- position in the tree, from 0
  leaf TEXT NOT NULL UNIQUE,
  suite INTEGER NOT NULL,
  dsc TEXT NOT NULL,            -- SHA-256 of the DSC certificate
  csca TEXT NOT NULL,           -- SHA-256 of the CSCA certificate that signed it
  created INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS roots (
  root TEXT PRIMARY KEY,        -- every root the tree has had (signers are never removed)
  size INTEGER NOT NULL,
  created INTEGER NOT NULL
);
-- Upgrading a database made before Decision #59 (run once in the D1 console):
--   ALTER TABLE sessions ADD COLUMN fp TEXT;
--   ALTER TABLE members ADD COLUMN backup TEXT;
