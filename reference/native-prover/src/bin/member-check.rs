// SPDX-License-Identifier: Apache-2.0
// Prints the member secrets for the given random bytes (hex), for the cross-check against
// enrolment.js's newMember (test vectors only): member-check <hex of 192 bytes>
fn main() {
    let h = std::env::args().nth(1).unwrap_or_default();
    let b: Vec<u8> = (0..h.len() / 2).map(|i| u8::from_str_radix(&h[2 * i..2 * i + 2], 16).unwrap()).collect();
    match poo_native_prover::member::new_member(&b) {
        Ok(v) => println!("{v}"),
        Err(e) => { eprintln!("{e}"); std::process::exit(1) }
    }
}
