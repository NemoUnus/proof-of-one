// SPDX-License-Identifier: Apache-2.0
// Proof of One — the member's secrets, made on the phone at enrolment, as `newMember` in
// reference/enrolment-circuit/src/enrolment.js:
//   s (identity secret, a scalar), salt and ρ (scalars);
//   idc = H(s·G) with G = Base8;  cm = H(4, idc, salt, ρ);  cn = H(3, ρ).
// Only cm leaves the phone (in π_doc and to the enrolment service); the rest is kept by
// the app. The random bytes come from the caller (Android's SecureRandom).
use crate::fingerprint::{dec, g8, mul};
use ark_bn254::Fr;
use ark_ed_on_bn254::Fr as Sc;
use ark_ff::{BigInteger, PrimeField, Zero};

pub use crate::Error;

const TAG_CREDENTIAL: u64 = 3;
const TAG_COMMITMENT: u64 = 4;

fn h(xs: &[Fr]) -> Result<Fr, Error> { crate::poseidon::hash(xs).map_err(|e| e.into()) }
fn scalar(b: &[u8]) -> Result<Sc, Error> {
    let s = Sc::from_be_bytes_mod_order(b);
    if s.is_zero() { return Err("zero scalar".into()); }
    Ok(s)
}
fn fr_of(s: &Sc) -> Fr { Fr::from_le_bytes_mod_order(&s.into_bigint().to_bytes_le()) }

/// `rand`: at least 192 random bytes (64 per secret). Returns {"s","salt","rho","idc","cm","cn"}.
pub fn new_member(rand: &[u8]) -> Result<serde_json::Value, Error> {
    if rand.len() < 192 { return Err("192 random bytes are needed".into()); }
    let s = scalar(&rand[0..64])?;
    let salt = fr_of(&scalar(&rand[64..128])?);
    let rho = fr_of(&scalar(&rand[128..192])?);
    let p = mul(&g8(), &s);
    let idc = h(&[p.0, p.1])?;
    let cm = h(&[Fr::from(TAG_COMMITMENT), idc, salt, rho])?;
    let cn = h(&[Fr::from(TAG_CREDENTIAL), rho])?;
    Ok(serde_json::json!({ "s": dec(&s), "salt": dec(&salt), "rho": dec(&rho), "idc": dec(&idc), "cm": dec(&cm), "cn": dec(&cn) }))
}
