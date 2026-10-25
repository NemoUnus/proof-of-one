#!/usr/bin/env bash
# TEST-ONLY trusted setup for π_doc: single contributor, random entropy, NOT secure.
# The circuit has 577,678 constraints, so it needs a 2^20 powers-of-tau file. Pass an
# existing one as the first argument, or let the script make a TEST-ONLY one (slow:
# about an hour on one core). The proving key is about 300 MB and is not committed.
set -euo pipefail
cd "$(dirname "$0")/.."
mkdir -p setup && cd setup
PTAU="${1:-}"
if [ -z "$PTAU" ]; then
  npx snarkjs powersoftau new bn128 20 pot20_0.ptau
  npx snarkjs powersoftau contribute pot20_0.ptau pot20_1.ptau --name="TEST ONLY - insecure" -e="$(head -c 64 /dev/urandom | base64)"
  npx snarkjs powersoftau prepare phase2 pot20_1.ptau pot20_final.ptau
  rm -f pot20_0.ptau pot20_1.ptau
  PTAU=pot20_final.ptau
fi
npx snarkjs groth16 setup ../build/document.r1cs "$PTAU" document_0.zkey
npx snarkjs zkey contribute document_0.zkey document_test.zkey --name="TEST ONLY" -e="$(head -c 64 /dev/urandom | base64)"
npx snarkjs zkey export verificationkey document_test.zkey vkey_test.json
rm -f document_0.zkey
