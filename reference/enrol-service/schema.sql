-- SPDX-License-Identifier: Apache-2.0
-- The enrolment service's store (Cloudflare D1). Deleted after the pilot (Decision #57, point 5).
-- Per member only the two keyed fingerprints, the issuing state, the path and the time.
CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,          -- random, 128 bits
  created INTEGER NOT NULL,     -- unix seconds
  issuer INTEGER NOT NULL,      -- packed three-letter code
  challenge TEXT NOT NULL,
  pB TEXT, dB TEXT, pZ TEXT, dZ TEXT,
  state INTEGER NOT NULL DEFAULT 0   -- 0 new, 1 evaluated, 2 used
);
CREATE TABLE IF NOT EXISTS members (
  fp TEXT NOT NULL UNIQUE,      -- person key
  fd TEXT NOT NULL UNIQUE,      -- document key
  issuer INTEGER NOT NULL,
  path INTEGER NOT NULL,
  created INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS counters (
  name TEXT PRIMARY KEY,        -- "evaluations", "enrolments", "sessions:<day>"
  n INTEGER NOT NULL
);
