// SPDX-License-Identifier: Apache-2.0
// The verifying key of a TEST-ONLY π_doc proving key, in snarkjs's verification_key.json
// format, for the Solidity verifier that the enrolment service calls:
//   doc-vkey <pk_c.bin>    (compressed arkworks ProvingKey, as prove-mem writes it)
use ark_serialize::{CanonicalDeserialize, Compress, Validate};
fn main() {
    let a: Vec<String> = std::env::args().collect();
    if a.len() != 2 { eprintln!("usage: doc-vkey <pk_c.bin>"); std::process::exit(2); }
    let f = std::io::BufReader::new(std::fs::File::open(&a[1]).expect("key"));
    // Only the verifying key is needed: it is serialized first in a ProvingKey.
    let vk = ark_groth16::VerifyingKey::<ark_bn254::Bn254>::deserialize_with_mode(f, Compress::Yes, Validate::Yes).expect("verifying key");
    println!("{}", serde_json::to_string_pretty(&poo_native_prover::vkey_json(&vk)).unwrap());
}
