#!/usr/bin/env bash
# TEST-ONLY trusted setup: single contributor, random entropy, NOT secure.
set -euo pipefail
cd "$(dirname "$0")/.."
mkdir -p setup && cd setup
npx snarkjs powersoftau new bn128 15 pot15_0.ptau
npx snarkjs powersoftau contribute pot15_0.ptau pot15_1.ptau --name="TEST ONLY - insecure" -e="$(head -c 64 /dev/urandom | base64)"
npx snarkjs powersoftau prepare phase2 pot15_1.ptau pot15_final.ptau
npx snarkjs groth16 setup ../build/ballot.r1cs pot15_final.ptau ballot_0.zkey
npx snarkjs zkey contribute ballot_0.zkey ballot_test.zkey --name="TEST ONLY" -e="$(head -c 64 /dev/urandom | base64)"
npx snarkjs zkey export verificationkey ballot_test.zkey vkey_test.json
rm -f pot15_0.ptau pot15_1.ptau ballot_0.zkey
