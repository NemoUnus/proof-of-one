// SPDX-License-Identifier: Apache-2.0
// Aggregator prototype: verifies 2 ballot proofs (UltraHonk, ZK) of one poll and exposes one
// hash over all their public inputs. Size measurement only.
use bb_proof_verification::{UltraHonkVerificationKey, UltraHonkZKProof, PROOF_TYPE_HONK_ZK};
use poseidon::poseidon2::Poseidon2;
global N: u32 = 2; // measured with N = 1, 2 and 4
fn main(vk: UltraHonkVerificationKey, key_hash: Field, proofs: [UltraHonkZKProof; N], pubs: [[Field; 18]; N], batch_hash: pub Field) {
    let mut acc: Field = key_hash;
    for i in 0..N {
        std::verify_proof_with_type(vk, proofs[i], pubs[i], key_hash, PROOF_TYPE_HONK_ZK);
        acc = Poseidon2::hash([acc, Poseidon2::hash(pubs[i], 18)], 2);
    }
    assert(acc == batch_hash);
}
