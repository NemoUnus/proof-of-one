#!/usr/bin/env bash
# TEST-ONLY trusted setup for the recovery-ballot proof π_recover: single contributor,
# random entropy, NOT secure. About 42,000 constraints, so powers of tau of size 2^16 or
# more. Also writes ../contracts/src/RecoveryVerifier.sol. Reuses PTAU if given (for example the tally circuit's pot18_final.ptau), otherwise
# makes a 2^16 one.
set -euo pipefail
cd "$(dirname "$0")/.."
mkdir -p build setup
[ -f build/recovery.r1cs ] || npx circom2 circuits/recovery.circom --r1cs --wasm --sym --O2 -o build
cd setup
PTAU="${PTAU:-pot16_final.ptau}"
if [ ! -f "$PTAU" ]; then
  npx snarkjs powersoftau new bn128 16 pot16_0.ptau
  npx snarkjs powersoftau contribute pot16_0.ptau pot16_1.ptau --name="TEST ONLY - insecure" -e="$(head -c 64 /dev/urandom | base64)"
  npx snarkjs powersoftau prepare phase2 pot16_1.ptau "$PTAU"
  rm -f pot16_0.ptau pot16_1.ptau
fi
npx snarkjs groth16 setup ../build/recovery.r1cs "$PTAU" recovery_0.zkey
npx snarkjs zkey contribute recovery_0.zkey recovery_test.zkey --name="TEST ONLY" -e="$(head -c 64 /dev/urandom | base64)"
npx snarkjs zkey export verificationkey recovery_test.zkey vkey_recovery_test.json
rm -f recovery_0.zkey
npx snarkjs zkey export solidityverifier recovery_test.zkey ../../contracts/src/RecoveryVerifier.sol
sed -i 's/contract Groth16Verifier/contract RecoveryVerifier/' ../../contracts/src/RecoveryVerifier.sol
