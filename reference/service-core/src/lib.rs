// SPDX-License-Identifier: Apache-2.0
// Proof of One — the cryptography of the pilot's enrolment service, compiled to
// WebAssembly for a Cloudflare Worker (docs/specs/pilot-enrolment-service-v0.1.md, §4).
//
//   evaluate  the OPRF answer Z = k·B for both blinded points of a session, each with a
//             Chaum–Pedersen (DLEQ) proof (docs/specs/document-fingerprint-oprf-v0.1.md, §4)
//   sign      the member's credential: revocation handle rn and an EdDSA-Poseidon signature
//             of H(CREDENTIAL_MSG, attributes, cm, rn, epoch), as the enclave's issue() in
//             reference/enrolment-circuit/src/enrolment.js
//   public    the public keys that belong to the service's secrets
//   poseidon  Poseidon (circomlib parameters), for the Worker's own hashes
//
// The functions are pure: the Worker passes fresh random bytes (crypto.getRandomValues)
// for every nonce, so no random source is needed inside WebAssembly.
// Points are Baby Jubjub (EIP-2494) in the form of circomlib, as decimal [x, y].
// Arithmetic uses arkworks' extended coordinates on the isomorphic curve with a = 1.
// NOT constant-time. TEST ONLY: not reviewed outside the project.

use ark_bn254::Fr;
use ark_ec::{twisted_edwards::Affine, AdditiveGroup, AffineRepr, CurveGroup};
use ark_ed_on_bn254::{EdwardsAffine, EdwardsConfig, EdwardsProjective, Fr as Sc};
use ark_ff::{BigInteger, Field, MontFp, PrimeField, Zero};
use light_poseidon::{Poseidon, PoseidonHasher};
use serde_json::{json, Value};
use std::cell::RefCell;
use std::collections::HashMap;
use std::str::FromStr;

pub type Error = String;
pub type Pt = (Fr, Fr);

/// "PoO-fingerprint-dleq-v1" read as a big-endian integer (spec §2).
pub const DST_DLEQ: &str = "7704123452673633426289274067332910969819640578532275761";
const TAG_CREDENTIAL_MSG: u64 = 5;
const TAG_REVOCATION: u64 = 6;

// sqrt(168700): x_ark = S·x maps circomlib's curve (a = 168700) onto arkworks' (a = 1).
const SQRT_A: Fr = MontFp!("7214280148105020021932206872019688659210616427216992810330019057549499971851");

/// A decimal field element, canonical (no leading zeros, below p).
pub fn fr(s: &str) -> Result<Fr, Error> {
    let ok = !s.is_empty() && s.len() <= 77 && s.bytes().all(|c| c.is_ascii_digit()) && (s == "0" || !s.starts_with('0'));
    if !ok { return Err(format!("bad number {s}")); }
    let v = Fr::from_str(s).map_err(|_| format!("bad field element {s}"))?;
    if dec(&v) != s { return Err(format!("field element not below p: {s}")); }
    Ok(v)
}
pub fn dec<F: PrimeField>(x: &F) -> String { x.into_bigint().to_string() }
fn sc_of_fr(x: &Fr) -> Sc { Sc::from_le_bytes_mod_order(&x.into_bigint().to_bytes_le()) }

fn hexbytes(s: &str) -> Result<Vec<u8>, Error> {
    let s = s.strip_prefix("0x").unwrap_or(s);
    if s.len() % 2 != 0 { return Err("odd hex length".into()); }
    (0..s.len()).step_by(2).map(|i| u8::from_str_radix(&s[i..i + 2], 16).map_err(|_| "bad hex".to_string())).collect()
}
/// A scalar in [1, ℓ) from at least 64 bytes (bias below 2^-250).
fn scalar(b: &[u8]) -> Result<Sc, Error> {
    if b.len() < 64 { return Err("at least 64 random bytes are needed".into()); }
    let s = Sc::from_be_bytes_mod_order(b);
    if s.is_zero() { return Err("zero scalar".into()); }
    Ok(s)
}
fn field(b: &[u8]) -> Result<Fr, Error> {
    if b.len() < 64 { return Err("at least 64 random bytes are needed".into()); }
    Ok(Fr::from_be_bytes_mod_order(b))
}

// ---- points: circomlib form <-> arkworks
fn to_ark(p: &Pt) -> Result<EdwardsAffine, Error> {
    let a = Affine::<EdwardsConfig>::new_unchecked(p.0 * SQRT_A, p.1);
    if !a.is_on_curve() { return Err("point not on the curve".into()); }
    Ok(a)
}
fn of_ark(p: &EdwardsAffine) -> Pt {
    if p.is_zero() { return (Fr::zero(), Fr::from(1u64)); }
    (p.x * SQRT_A.inverse().unwrap(), p.y)
}
fn base8() -> EdwardsAffine {
    to_ark(&(MontFp!("5299619240641551281634865583518297030282874472190772894086521144482721001553"),
             MontFp!("16950150798460657717958625567821834550301663161624707787222815936182638968203"))).unwrap()
}
pub fn pt(v: &Value) -> Result<Pt, Error> {
    let a = v.as_array().filter(|a| a.len() == 2).ok_or("point [x, y] expected")?;
    Ok((fr(a[0].as_str().ok_or("decimal string expected")?)?, fr(a[1].as_str().ok_or("decimal string expected")?)?))
}
fn pt_json(p: &Pt) -> Value { json!([dec(&p.0), dec(&p.1)]) }
/// On the curve, in the prime-order subgroup, not the identity (spec §4: the service's check of B).
fn valid(p: &Pt) -> Result<EdwardsAffine, Error> {
    let a = to_ark(p)?;
    if a.is_zero() { return Err("identity point".into()); }
    if !a.is_in_correct_subgroup_assuming_on_curve() { return Err("point outside the prime-order subgroup".into()); }
    Ok(a)
}
fn mul(p: &EdwardsAffine, k: &Sc) -> EdwardsAffine { (*p * *k).into_affine() }

// ---- Poseidon (circomlib)
thread_local! {
    static HASHERS: RefCell<HashMap<usize, Poseidon<Fr>>> = RefCell::new(HashMap::new());
    static BASE_TABLE: Vec<EdwardsAffine> = {
        let mut t = Vec::with_capacity(256);
        let mut p: EdwardsProjective = base8().into();
        for _ in 0..256 { t.push(p.into_affine()); p.double_in_place(); }
        t
    };
    static PUBLIC: RefCell<Option<(String, Pt)>> = const { RefCell::new(None) };
}
/// Poseidon with circomlib's parameters (1 to 12 inputs); one hasher per width, kept.
pub fn poseidon(inputs: &[Fr]) -> Result<Fr, Error> {
    HASHERS.with(|m| {
        let mut m = m.borrow_mut();
        if !m.contains_key(&inputs.len()) {
            m.insert(inputs.len(), Poseidon::<Fr>::new_circom(inputs.len()).map_err(|e| e.to_string())?);
        }
        m.get_mut(&inputs.len()).unwrap().hash(inputs).map_err(|e| e.to_string())
    })
}
/// k·Base8 from a table of 2^i·Base8 (additions only).
fn mul_base(k: &Sc) -> EdwardsAffine {
    BASE_TABLE.with(|t| {
        let bits = k.into_bigint().to_bits_le();
        let mut acc = EdwardsProjective::zero();
        for (i, b) in bits.iter().enumerate() { if *b { acc += t[i]; } }
        acc.into_affine()
    })
}
/// K = k·Base8, computed once per key.
fn oprf_public(s: &Secrets) -> Pt {
    let id = dec(&s.k);
    PUBLIC.with(|c| {
        if let Some((i, p)) = &*c.borrow() { if *i == id { return *p; } }
        let p = of_ark(&mul_base(&s.k));
        *c.borrow_mut() = Some((id, p));
        p
    })
}

fn str_of<'a>(v: &'a Value, key: &str) -> Result<&'a str, Error> {
    v[key].as_str().ok_or_else(|| format!("missing {key}"))
}

pub struct Secrets { pub k: Sc, pub a: Sc, pub kr: Fr }
/// The service's secrets, each 64 random bytes in hex: "oprf", "credential", "revocation".
pub fn secrets(v: &Value) -> Result<Secrets, Error> {
    Ok(Secrets {
        k: scalar(&hexbytes(str_of(v, "oprf")?)?)?,
        a: scalar(&hexbytes(str_of(v, "credential")?)?)?,
        kr: field(&hexbytes(str_of(v, "revocation")?)?)?,
    })
}

/// {"K": OPRF public key, "A": credential public key, "keyLeaf": H(A)}.
pub fn public(s: &Secrets) -> Result<Value, Error> {
    let (kp, ap) = (oprf_public(s), of_ark(&mul_base(&s.a)));
    Ok(json!({ "K": pt_json(&kp), "A": pt_json(&ap), "keyLeaf": dec(&poseidon(&[ap.0, ap.1])?) }))
}

fn dleq_hash(kp: &Pt, b: &Pt, z: &Pt, t1: &Pt, t2: &Pt) -> Result<Sc, Error> {
    Ok(sc_of_fr(&poseidon(&[fr(DST_DLEQ)?, kp.0, kp.1, b.0, b.1, z.0, z.1, t1.0, t1.1, t2.0, t2.1])?))
}

/// One OPRF answer with its DLEQ proof; `t` is the proof's nonce.
fn answer(k: &Sc, kp: &Pt, b: &Pt, t: &Sc) -> Result<(Pt, Sc, Sc), Error> {
    let ba = valid(b)?;
    let z = of_ark(&mul(&ba, k));
    let (t1, t2) = (of_ark(&mul_base(t)), of_ark(&mul(&ba, t)));
    let c = dleq_hash(kp, b, &z, &t1, &t2)?;
    Ok((z, c, *t + c * k))
}

/// Round 1 of a session: {"pB", "dB", "rand": 128 random bytes hex} ->
/// {"pZ", "pC", "pS", "dZ", "dC", "dS"}, the answer that fingerprint.rs `complete` takes.
pub fn evaluate(s: &Secrets, v: &Value) -> Result<Value, Error> {
    let r = hexbytes(str_of(v, "rand")?)?;
    if r.len() < 128 { return Err("128 random bytes are needed".into()); }
    let kp = oprf_public(s);
    let (pb, db) = (pt(&v["pB"])?, pt(&v["dB"])?);
    let (pz, pc, ps) = answer(&s.k, &kp, &pb, &scalar(&r[..64])?)?;
    let (dz, dc, ds) = answer(&s.k, &kp, &db, &scalar(&r[64..128])?)?;
    Ok(json!({ "pZ": pt_json(&pz), "pC": dec(&pc), "pS": dec(&ps), "dZ": pt_json(&dz), "dC": dec(&dc), "dS": dec(&ds) }))
}

/// The phone's check of an answer (spec §4), for tests.
pub fn verify_answer(kp: &Pt, b: &Pt, z: &Pt, c: &Sc, s: &Sc) -> Result<bool, Error> {
    let g = base8();
    let (ka, ba, za) = (valid(kp)?, valid(b)?, valid(z)?);
    let t1 = of_ark(&(mul(&g, s) + mul(&ka, &-*c)).into_affine());
    let t2 = of_ark(&(mul(&ba, s) + mul(&za, &-*c)).into_affine());
    Ok(dleq_hash(kp, b, z, &t1, &t2)? == *c)
}

/// The credential (enrolment.js, sign()): {"fp": person key, "attrs": the 8 attribute
/// fields [birthDay, sexCode, nat_0, exp_0, nat_1, exp_1, nat_2, exp_2], "cm", "epoch",
/// "generation" (0 for a first identity), "rand": 64 random bytes hex} ->
/// {"rn", "msg", "A", "R8", "S"}. rn = H(6, kR, fp, generation) mod 2^252.
pub fn sign(s: &Secrets, v: &Value) -> Result<Value, Error> {
    let fp = fr(str_of(v, "fp")?)?;
    let attrs = v["attrs"].as_array().filter(|a| a.len() == 8).ok_or("8 attribute fields expected")?;
    let attrs = attrs.iter().map(|x| fr(x.as_str().ok_or("decimal string expected")?)).collect::<Result<Vec<_>, _>>()?;
    let cm = fr(str_of(v, "cm")?)?;
    let epoch = fr(str_of(v, "epoch")?)?;
    let generation = fr(v["generation"].as_str().unwrap_or("0"))?;
    let h = poseidon(&[Fr::from(TAG_REVOCATION), s.kr, fp, generation])?;
    let mut bi = h.into_bigint();
    bi.0[3] &= (1u64 << 60) - 1; // mod 2^252
    let rn = Fr::from_bigint(bi).unwrap();
    let mut m = vec![Fr::from(TAG_CREDENTIAL_MSG)];
    m.extend(attrs);
    m.push(cm); m.push(rn); m.push(epoch);
    let msg = poseidon(&m)?;
    let a = of_ark(&mul_base(&s.a));
    let r = scalar(&hexbytes(str_of(v, "rand")?)?)?;
    let r8 = of_ark(&mul_base(&r));
    let hm = poseidon(&[r8.0, r8.1, a.0, a.1, msg])?;
    // circomlib's verifier: S·Base8 = R8 + (8·hm)·A, with A = a·Base8
    let sig = r + Sc::from(8u64) * sc_of_fr(&hm) * s.a;
    Ok(json!({ "rn": dec(&rn), "msg": dec(&msg), "A": pt_json(&a), "R8": pt_json(&r8), "S": dec(&sig) }))
}

/// circomlib's verifyPoseidon, for tests.
pub fn verify_signature(a: &Pt, msg: &Fr, r8: &Pt, s: &str) -> Result<bool, Error> {
    let sv = fr(s)?;
    if sv.into_bigint() >= Sc::MODULUS.into() { return Ok(false); }
    let hm = poseidon(&[r8.0, r8.1, a.0, a.1, *msg])?;
    let g = base8();
    let left = mul(&g, &sc_of_fr(&sv));
    let right = (to_ark(r8)? + mul(&to_ark(a)?, &(Sc::from(8u64) * sc_of_fr(&hm)))).into_affine();
    Ok(left == right)
}

/// One entry point for the Worker: `name`, JSON in, JSON out ({"error"} on failure).
pub fn call(name: &str, input: &str) -> String {
    let run = || -> Result<Value, Error> {
        let v: Value = serde_json::from_str(input).map_err(|e| e.to_string())?;
        match name {
            "public" => public(&secrets(&v["secrets"])?),
            "evaluate" => evaluate(&secrets(&v["secrets"])?, &v),
            "sign" => sign(&secrets(&v["secrets"])?, &v),
            "poseidon" => {
                let xs = v["inputs"].as_array().ok_or("inputs expected")?;
                let xs = xs.iter().map(|x| fr(x.as_str().ok_or("decimal string expected")?)).collect::<Result<Vec<_>, _>>()?;
                Ok(json!(dec(&poseidon(&xs)?)))
            }
            "verifyAnswer" => Ok(json!(verify_answer(&pt(&v["K"])?, &pt(&v["B"])?, &pt(&v["Z"])?,
                &sc_of_fr(&fr(str_of(&v, "c")?)?), &sc_of_fr(&fr(str_of(&v, "s")?)?))?)),
            "verifySignature" => Ok(json!(verify_signature(&pt(&v["A"])?, &fr(str_of(&v, "msg")?)?, &pt(&v["R8"])?, str_of(&v, "S")?)?)),
            _ => Err(format!("unknown function {name}")),
        }
    };
    match run() { Ok(v) => v.to_string(), Err(e) => json!({ "error": e }).to_string() }
}

// ---- WebAssembly interface: alloc, then call(name, input) -> pointer to [len u32 LE][utf-8];
// the caller frees both buffers with dealloc.
#[cfg(target_arch = "wasm32")]
mod wasm {
    #[no_mangle]
    pub extern "C" fn alloc(len: usize) -> *mut u8 {
        let mut v = Vec::<u8>::with_capacity(len.max(1));
        let p = v.as_mut_ptr();
        std::mem::forget(v);
        p
    }
    #[no_mangle]
    pub unsafe extern "C" fn dealloc(p: *mut u8, cap: usize) { drop(Vec::from_raw_parts(p, 0, cap.max(1))); }
    #[no_mangle]
    pub unsafe extern "C" fn call(np: *const u8, nl: usize, ip: *const u8, il: usize) -> *mut u8 {
        let name = std::str::from_utf8(std::slice::from_raw_parts(np, nl)).unwrap_or("");
        let input = std::str::from_utf8(std::slice::from_raw_parts(ip, il)).unwrap_or("");
        let out = super::call(name, input).into_bytes();
        let mut buf = Vec::with_capacity(4 + out.len());
        buf.extend_from_slice(&(out.len() as u32).to_le_bytes());
        buf.extend_from_slice(&out);
        let p = buf.as_mut_ptr();
        std::mem::forget(buf);
        p
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn sqrt_a() { assert_eq!(SQRT_A * SQRT_A, Fr::from(168700u64)); }
    #[test]
    fn base8_in_subgroup() { assert!(valid(&of_ark(&base8())).is_ok()); }
    #[test]
    fn canonical_numbers() {
        assert!(fr("0").is_ok() && fr("01").is_err() && fr("").is_err() && fr("-1").is_err());
        assert!(fr("21888242871839275222246405745257275088548364400416034343698204186575808495617").is_err());
    }
}
