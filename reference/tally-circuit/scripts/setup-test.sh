#!/usr/bin/env bash
# TEST-ONLY trusted setup for π_tally: single contributor, random entropy, NOT secure.
# Writes setup/tally_test.zkey, setup/vkey_tally_test.json and ../contracts/src/TallyVerifier.sol.
set -euo pipefail
cd "$(dirname "$0")/.."
mkdir -p setup && cd setup
if [ ! -f pot18_final.ptau ]; then
  npx snarkjs powersoftau new bn128 18 pot18_0.ptau
  npx snarkjs powersoftau contribute pot18_0.ptau pot18_1.ptau --name="TEST ONLY - insecure" -e="$(head -c 64 /dev/urandom | base64)"
  npx snarkjs powersoftau prepare phase2 pot18_1.ptau pot18_final.ptau
  rm -f pot18_0.ptau pot18_1.ptau
fi
npx snarkjs groth16 setup ../build/tally.r1cs pot18_final.ptau tally_0.zkey
npx snarkjs zkey contribute tally_0.zkey tally_test.zkey --name="TEST ONLY" -e="$(head -c 64 /dev/urandom | base64)"
npx snarkjs zkey export verificationkey tally_test.zkey vkey_tally_test.json
npx snarkjs zkey export solidityverifier tally_test.zkey ../../contracts/src/TallyVerifier.sol
sed -i 's/contract Groth16Verifier/contract TallyVerifier/' ../../contracts/src/TallyVerifier.sol
rm -f tally_0.zkey
