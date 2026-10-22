#!/usr/bin/env bash
# TEST-ONLY trusted setup: single contributor, random entropy, NOT secure.
# Reuses ../ballot-circuit/setup/pot15_final.ptau if present, otherwise creates one.
set -euo pipefail
cd "$(dirname "$0")/.."
mkdir -p setup && cd setup
if [ -f ../../ballot-circuit/setup/pot15_final.ptau ]; then
  cp ../../ballot-circuit/setup/pot15_final.ptau .
else
  npx snarkjs powersoftau new bn128 15 pot15_0.ptau
  npx snarkjs powersoftau contribute pot15_0.ptau pot15_1.ptau --name="TEST ONLY - insecure" -e="$(head -c 64 /dev/urandom | base64)"
  npx snarkjs powersoftau prepare phase2 pot15_1.ptau pot15_final.ptau
  rm -f pot15_0.ptau pot15_1.ptau
fi
npx snarkjs groth16 setup ../build/registration.r1cs pot15_final.ptau registration_0.zkey
npx snarkjs zkey contribute registration_0.zkey registration_test.zkey --name="TEST ONLY" -e="$(head -c 64 /dev/urandom | base64)"
npx snarkjs zkey export verificationkey registration_test.zkey vkey_test.json
rm -f registration_0.zkey
npx snarkjs groth16 setup ../build/batch_insert.r1cs pot15_final.ptau batch_0.zkey
npx snarkjs zkey contribute batch_0.zkey batch_test.zkey --name="TEST ONLY" -e="$(head -c 64 /dev/urandom | base64)"
npx snarkjs zkey export verificationkey batch_test.zkey vkey_batch_test.json
rm -f batch_0.zkey
npx snarkjs groth16 setup ../build/revoke.r1cs pot15_final.ptau revoke_0.zkey
npx snarkjs zkey contribute revoke_0.zkey revoke_test.zkey --name="TEST ONLY" -e="$(head -c 64 /dev/urandom | base64)"
npx snarkjs zkey export verificationkey revoke_test.zkey vkey_revoke_test.json
rm -f revoke_0.zkey
