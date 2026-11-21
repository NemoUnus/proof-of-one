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
#[cfg(test)]
use std::str::FromStr;

pub use crate::Error;

const TAG_CREDENTIAL: u64 = 3;
const B32: &[u8; 32] = b"0123456789ABCDEFGHJKMNPQRSTVWXYZ"; // Crockford's base 32

/// The readable member number of Decision #59 (as memberNumber in fingerprint.js): the
/// low 80 bits of the seed as 16 base-32 characters in four groups, then a check character,
/// the weighted sum (i + 1)·d_i of the 16 digits mod 31.
pub fn member_number(seed: &Fr) -> String {
    let b = seed.into_bigint().to_bytes_le();
    let mut v: u128 = 0;
    for i in (0..10).rev() { v = (v << 8) | b[i] as u128; }
    let d: Vec<usize> = (0..16).rev().map(|i| ((v >> (5 * i)) & 31) as usize).collect();
    let check = d.iter().enumerate().map(|(i, x)| (i + 1) * x).sum::<usize>() % 31;
    let s: String = d.iter().map(|&x| B32[x] as char).collect();
    format!("ONE-{}-{}-{}-{}-{}", &s[0..4], &s[4..8], &s[8..12], &s[12..16], B32[check] as char)
}
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

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn number_format() {
        // the same values as fingerprint.js memberNumber
        assert_eq!(member_number(&Fr::from(123456789u64)), "ONE-0000-0000-003N-QK8N-4");
        let x = Fr::from_str("1606938044258990275541962092341162602522203981437114822955697").unwrap();
        assert_eq!(member_number(&x), "ONE-0000-VD6T-BXZF-84NH-C");
    }
}
