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

/// The inputs of the registration proof π_reg (Decision #61), as `buildRegistration` in
/// enrolment.js, from what the phone kept at enrolment (member.json) and the published key
/// set. `v` holds:
///   member     {s, salt, rho, idc, cn}            the secrets made by new_member
///   attrs      {birthDay, sexCode, natCode, expMonth}   the signed attributes (one document)
///   credential {rn, epoch, A: [x, y], R8: [x, y], S}    the service's signature
///   keySet     {root, siblings[8], pathIndex[8]}  the signing key's path in the key set
/// Returns {"input": the circuit's inputs, "leaf", "cn"}. Only leaf and cn are made public,
/// by the proof, on the ledger.
pub fn registration_input(v: &serde_json::Value) -> Result<serde_json::Value, Error> {
    fn get<'a>(v: &'a serde_json::Value, k: &str) -> Result<&'a serde_json::Value, Error> {
        v.get(k).ok_or_else(|| format!("{} missing", k).into())
    }
    fn num(v: &serde_json::Value, k: &str) -> Result<Fr, Error> {
        let x = get(v, k)?;
        let t = x.as_str().map(|s| s.to_string()).or_else(|| x.as_u64().map(|n| n.to_string())).ok_or(format!("{}: decimal expected", k))?;
        use std::str::FromStr;
        Fr::from_str(&t).map_err(|_| format!("{}: not a field element", k).into())
    }
    fn pair(v: &serde_json::Value, k: &str) -> Result<[String; 2], Error> {
        let a = get(v, k)?.as_array().filter(|a| a.len() == 2).ok_or(format!("{}: [x, y] expected", k))?;
        let f = |i: usize| a[i].as_str().map(|s| s.to_string()).ok_or_else(|| Error::from(format!("{}: decimal strings expected", k)));
        Ok([f(0)?, f(1)?])
    }
    let m = get(v, "member")?; let at = get(v, "attrs")?; let c = get(v, "credential")?; let ks = get(v, "keySet")?;
    let (salt, rho, idc, cn, rn) = (num(m, "salt")?, num(m, "rho")?, num(m, "idc")?, num(m, "cn")?, num(c, "rn")?);
    if h(&[Fr::from(TAG_CREDENTIAL), rho])? != cn { return Err("cn does not match rho".into()); }
    let (bd, sx, nat, exp) = (num(at, "birthDay")?, num(at, "sexCode")?, num(at, "natCode")?, num(at, "expMonth")?);
    let z = Fr::zero();
    // attrHash: birthDay, sexCode, (nat, expiry) for three document slots, salt
    let attr_hash = h(&[bd, sx, nat, exp, z, z, z, z, salt])?;
    let leaf = h(&[idc, attr_hash, rn])?;
    let arr = |k: &str| -> Result<Vec<String>, Error> {
        let a = get(ks, k)?.as_array().filter(|a| a.len() == 8).ok_or(format!("keySet.{}: 8 entries expected", k))?;
        a.iter().map(|x| x.as_str().map(|s| s.to_string()).or_else(|| x.as_u64().map(|n| n.to_string()))
            .ok_or_else(|| Error::from(format!("keySet.{}: decimal strings expected", k)))).collect()
    };
    let (a, r8) = (pair(c, "A")?, pair(c, "R8")?);
    let input = serde_json::json!({
        "leaf": dec(&leaf), "cn": dec(&cn), "keySetRoot": dec(&num(ks, "root")?),
        "s": get(m, "s")?.as_str().ok_or("s: decimal expected")?,
        "birthDay": dec(&bd), "sexCode": dec(&sx),
        "nat": [dec(&nat), "0", "0"], "exp": [dec(&exp), "0", "0"],
        "salt": dec(&salt), "rho": dec(&rho), "rn": dec(&rn), "epoch": dec(&num(c, "epoch")?),
        "Ax": a[0], "Ay": a[1], "R8x": r8[0], "R8y": r8[1], "S": dec(&num(c, "S")?),
        "keySiblings": arr("siblings")?, "keyPathIndex": arr("pathIndex")?,
    });
    Ok(serde_json::json!({ "input": input, "leaf": dec(&leaf), "cn": dec(&cn) }))
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
