// SPDX-License-Identifier: Apache-2.0
// The recovery proof's TEST-ONLY key is larger than the 25 MB a file added through GitHub's
// web page may have, so the repository keeps it gzipped (setup/recovery_test.zkey.gz).
// zkey(name) returns the path of setup/<name>, unpacking <name>.gz next to it first if the
// unpacked file is missing or older than the archive. The unpacked file is not committed.
"use strict";
const fs = require("fs");
const path = require("path");
const zlib = require("zlib");

function zkey(name) {
  const file = path.join(__dirname, "..", "setup", name);
  const gz = file + ".gz";
  if (fs.existsSync(gz) && (!fs.existsSync(file) || fs.statSync(file).mtimeMs < fs.statSync(gz).mtimeMs)) {
    const tmp = file + ".part";
    fs.writeFileSync(tmp, zlib.gunzipSync(fs.readFileSync(gz)));
    fs.renameSync(tmp, file);
  }
  return file;
}
module.exports = { zkey };
