#!/usr/bin/env bash
# TEST-ONLY trusted setup for π_tally: NOT secure, and on purpose REPRODUCIBLE.
#
# Every step is deterministic: the powers of tau start from the fixed initial values, and
# both phases get only a "beacon" contribution derived from a public string. Anyone who
# runs this script on the same circuit gets the same key, byte for byte, so a lost key file
# can always be rebuilt and anyone can check the deployed verifier against the sources.
# For the same reason the key is worthless for security: whoever reads this script knows
# the toxic waste. Production needs a real multi-party ceremony (spec, §7).
#
# (Until 17 November 2026 this script used random entropy. That key was kept only in one
# working environment and was lost with it, so the TallyVerifier of test deployment 2 can
# no longer accept a result; see reference/testnet/DEPLOYMENT.md and implementation note N37.)
#
# Writes setup/tally_test.zkey, setup/vkey_tally_test.json and ../contracts/src/TallyVerifier.sol.
set -euo pipefail
cd "$(dirname "$0")/.."
BEACON=$(printf '%s' "Proof of One - TEST ONLY - tally setup v2 - public and insecure" | sha256sum | cut -c1-64)
SNARKJS="node ../node_modules/snarkjs/build/cli.cjs"
mkdir -p setup && cd setup
# Phase 1 (slow: the last step takes about an hour on two cores). Each step is skipped if
# its output exists, so an interrupted run can be resumed.
[ -f pot18_beacon_final.ptau ] || {
  [ -f pot18_1.ptau ] || {
    $SNARKJS powersoftau new bn128 18 pot18_0.ptau
    $SNARKJS powersoftau beacon pot18_0.ptau pot18_1.ptau "$BEACON" 10 -n="TEST ONLY public beacon"
    rm -f pot18_0.ptau
  }
  $SNARKJS powersoftau prepare phase2 pot18_1.ptau pot18_beacon_final.ptau.part
  mv pot18_beacon_final.ptau.part pot18_beacon_final.ptau
  rm -f pot18_1.ptau
}
$SNARKJS groth16 setup ../build/tally.r1cs pot18_beacon_final.ptau tally_0.zkey
$SNARKJS zkey beacon tally_0.zkey tally_test.zkey "$BEACON" 10 -n="TEST ONLY public beacon"
rm -f tally_0.zkey
$SNARKJS zkey export verificationkey tally_test.zkey vkey_tally_test.json
$SNARKJS zkey export solidityverifier tally_test.zkey ../../contracts/src/TallyVerifier.sol
sed -i 's/contract Groth16Verifier/contract TallyVerifier/' ../../contracts/src/TallyVerifier.sol
sha256sum tally_test.zkey vkey_tally_test.json
