#!/usr/bin/env bash
# Fetch the two Noir libraries at the exact commits used for the measurements.
set -euo pipefail
cd "$(dirname "$0")/.."
mkdir -p libs && cd libs
git clone -q https://github.com/noir-lang/poseidon && git -C poseidon checkout -q 37a3a201eff8187760e909384d5881ed4a0a086c
git clone -q --filter=blob:none --sparse https://github.com/AztecProtocol/aztec-packages
git -C aztec-packages checkout -q 47e78169a047e1aebe97b3bc3ae0aab2d03bd221
git -C aztec-packages sparse-checkout set barretenberg/noir/bb_proof_verification
