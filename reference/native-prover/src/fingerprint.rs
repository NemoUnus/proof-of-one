// SPDX-License-Identifier: Apache-2.0
// Proof of One — the phone's side of the keyed document fingerprints (OPRF over Baby
// Jubjub), shared by Android and iPhone. Specification:
// docs/specs/document-fingerprint-oprf-v0.1.md; reference: document-circuit/src/fingerprint.js,
// with which this code is checked on test vectors (src/bin/fp-check.rs).
//
// Round 1 (`prepare`): from the signed DG1, the two points x = HashToCurve(fields) and their
// blinded forms B = r·x, sent to the service. Round 2 (`complete`): checks the service's
// DLEQ proofs for its answers Z = k·B, then gives π_doc's fingerprint inputs (hints, r,
// V = 8⁻¹·r⁻¹·Z, B, Z). The Poseidon hashes come from the witness graph of
// document-circuit/circuits/phone/fp_helper.circom; all curve arithmetic is here.
//
// NOT constant-time; the secrets (r) live only for one enrolment.

use ark_bn254::Fr;
use ark_ff::{BigInteger, Field, PrimeField, UniformRand, Zero, One};
use ark_ed_on_bn254::Fr as Sc; // scalars modulo ℓ, the order of the prime subgroup
use std::str::FromStr;

pub use crate::Error;
type Pt = (Fr, Fr);

const A_ED: u64 = 168700;
const D_ED: u64 = 168696;
const A_MONT: u64 = 168698;
const Z_MAP: u64 = 5;

fn fr(s: &str) -> Result<Fr, Error> { Fr::from_str(s).map_err(|_| format!("bad field element {s}").into()) }
fn sc(s: &str) -> Result<Sc, Error> { Sc::from_str(s).map_err(|_| format!("bad scalar {s}").into()) }
fn dec<F: PrimeField>(x: &F) -> String { x.into_bigint().to_string() }
fn g8() -> Pt {
    (fr("5299619240641551281634865583518297030282874472190772894086521144482721001553").unwrap(),
     fr("16950150798460657717958625567821834550301663161624707787222815936182638968203").unwrap())
}

// ---- twisted Edwards arithmetic (complete: d is not a square)
fn add(p: &Pt, q: &Pt) -> Pt {
    let (a, d) = (Fr::from(A_ED), Fr::from(D_ED));
    let t = d * p.0 * q.0 * p.1 * q.1;
    let x = (p.0 * q.1 + p.1 * q.0) * (Fr::one() + t).inverse().unwrap();
    let y = (p.1 * q.1 - a * p.0 * q.0) * (Fr::one() - t).inverse().unwrap();
    (x, y)
}
fn neg(p: &Pt) -> Pt { (-p.0, p.1) }
fn mul_bits(p: &Pt, bits_be: &[bool]) -> Pt {
    let mut r = (Fr::zero(), Fr::one());
    for &b in bits_be { r = add(&r, &r); if b { r = add(&r, p); } }
    r
}
fn mul(p: &Pt, k: &Sc) -> Pt { mul_bits(p, &k.into_bigint().to_bits_be()) }
fn on_curve(p: &Pt) -> bool {
    let (x2, y2) = (p.0 * p.0, p.1 * p.1);
    Fr::from(A_ED) * x2 + y2 == Fr::one() + Fr::from(D_ED) * x2 * y2
}
/// On the curve, in the prime-order subgroup, not the identity.
pub fn valid(p: &Pt) -> bool {
    on_curve(p) && *p != (Fr::zero(), Fr::one()) && mul_bits(p, &Sc::MODULUS.to_bits_be()) == (Fr::zero(), Fr::one())
}

// ---- Elligator 2 (spec §3): returns the point and the hints (v, e)
fn map(t: Fr) -> Result<(Pt, Fr, u8), Error> {
    let am = Fr::from(A_MONT);
    let den = Fr::one() + Fr::from(Z_MAP) * t * t;
    let u1 = -am * den.inverse().ok_or("exceptional input to the map")?;
    let g = |u: Fr| u * u * u + am * u * u + u;
    let e: u8 = if g(u1).legendre().is_qr() || g(u1).is_zero() { 1 } else { 0 };
    let u = if e == 1 { u1 } else { -u1 - am };
    let mut v = g(u).sqrt().ok_or("no square root")?;
    if v.into_bigint().is_odd() != (e == 1) { v = -v; }
    if v.is_zero() || (u + Fr::one()).is_zero() { return Err("exceptional input to the map".into()); }
    Ok(((u * v.inverse().unwrap(), (u - Fr::one()) * (u + Fr::one()).inverse().unwrap()), v, e))
}

/// The fields of a TD3 passport's DG1 (spec §3), as the values of each key.
struct Fields { person: [Fr; 5], document: [Fr; 5] }
fn be(b: &[u8]) -> Fr { Fr::from_be_bytes_mod_order(b) }
/// The value of the DG13 field with tag `tag`, left-aligned in 31 bytes, and its length
/// (spec §3; the circuit's Dg13Field): found by walking the fields from the first.
pub fn dg13_field(b: &[u8], tag: u32) -> Result<(Fr, u64), Error> {
    if b.len() < 4 || b[0] != 0x6D { return Err("not a DG13".into()); }
    let (cs, clen) = match b[1] {
        x if x < 0x80 => (2usize, x as usize),
        0x81 => (3, b[2] as usize),
        0x82 => (4, b[2] as usize * 256 + b[3] as usize),
        _ => return Err("DG13 length".into()),
    };
    let end = cs + clen;
    if end > b.len() { return Err("DG13 too short".into()); }
    let (mut i, mut hit, mut n) = (cs, None, 0);
    while i < end {
        let two = b[i] & 0x1F == 0x1F;
        let tl = if two { 2 } else { 1 };
        let t = if two { b[i] as u32 * 256 + b[i + 1] as u32 } else { b[i] as u32 };
        let lb = b[i + tl];
        let (l, hl) = if lb < 0x80 { (lb as usize, tl + 1) } else if lb == 0x81 { (b[i + tl + 1] as usize, tl + 2) } else { return Err("DG13 field length".into()) };
        if t == tag { hit = Some((i + hl, l)); n += 1; }
        i += hl + l;
    }
    if i != end || n != 1 { return Err("DG13 field not found exactly once".into()); }
    let (st, l) = hit.unwrap();
    if l < 1 || l > 31 { return Err("DG13 field length out of range".into()); }
    let mut v = [0u8; 31];
    v[..l].copy_from_slice(&b[st..st + l]);
    Ok((be(&v), l as u64))
}

fn fields(dg1: &[u8], current_year: u32, path: u8, dg13: Option<(&[u8], u32)>) -> Result<Fields, Error> {
    if dg1.len() != 93 || dg1[0] != 0x61 { return Err("DG1 is not a TD3 passport's".into()); }
    let l1 = &dg1[5..49];
    let l2 = &dg1[49..93];
    let code3 = |b: &[u8]| Fr::from(b[0] as u64 * 65536 + b[1] as u64 * 256 + b[2] as u64);
    let num = |a: usize, b: usize| -> Result<u32, Error> { Ok(std::str::from_utf8(&l2[a..b])?.parse::<u32>()?) };
    let yy = num(13, 15)?;
    let by = if yy > current_year % 100 { 1900 + yy } else { 2000 + yy };
    let birth_day = day_number(by as i64, num(15, 17)? as i64, num(17, 19)? as i64);
    let sex = match l2[20] { b'M' => 1u64, b'F' => 2, _ => 0 };
    let (nat, iss) = (code3(&l2[10..13]), code3(&l1[2..5]));
    let bd = Fr::from(birth_day as u64);
    let person = match (path, dg13) {
        (1, Some((d, tag))) => { let (v, l) = dg13_field(d, tag)?; [nat, v, Fr::from(l), bd, Fr::from(sex)] }
        (1, None) => [nat, be(&l2[28..42]), Fr::zero(), bd, Fr::from(sex)],
        (2, None) => [nat, be(&l1[5..36]), be(&l1[36..44]), bd, Fr::from(sex)],
        (2, Some(_)) => return Err("a DG13 rule applies to path 1 only".into()),
        _ => return Err("unknown path".into()),
    };
    Ok(Fields { person, document: [iss, be(&l2[0..9]), Fr::zero(), Fr::zero(), Fr::zero()] })
}
/// Days since 1900-01-01; a day past the month's end rolls over, as in the circuit.
fn day_number(y: i64, m: i64, d: i64) -> i64 {
    let days = |y: i64, m: i64, d: i64| -> i64 { // days from civil (Howard Hinnant's algorithm)
        let y = if m <= 2 { y - 1 } else { y };
        let era = y.div_euclid(400);
        let yoe = y - era * 400;
        let doy = (153 * (if m > 2 { m - 3 } else { m + 9 }) + 2) / 5 + d - 1;
        era * 146097 + yoe * 365 + yoe / 4 - yoe / 100 + doy
    };
    days(y, m, 1) + (d - 1) - days(1900, 1, 1)
}

/// The Poseidon helper graph: t-values of both keys, and the two DLEQ challenges.
fn helper(graph: &[u8], person: (Fr, &[Fr; 5]), document: (Fr, &[Fr; 5]), q: [[Fr; 10]; 2]) -> Result<Vec<Fr>, Error> {
    let s = |v: &[Fr]| v.iter().map(|x| serde_json::Value::String(dec(x))).collect::<Vec<_>>();
    let input = serde_json::json!({
        "pTag": dec(&person.0), "pVals": s(person.1), "dTag": dec(&document.0), "dVals": s(document.1),
        "q": [s(&q[0]), s(&q[1])],
    });
    let wtns = circom_witnesscalc::calc_witness(&input.to_string(), graph).map_err(|e| e.to_string())?;
    let w = crate::parse_wtns(&wtns)?;
    Ok(w[1..7].to_vec())
}

fn hash_to_curve(t0: Fr, t1: Fr) -> Result<(Pt, [(Fr, u8); 2]), Error> {
    let (p0, v0, e0) = map(t0)?;
    let (p1, v1, e1) = map(t1)?;
    let s = add(&p0, &p1);
    let x = mul_bits(&s, &[true, false, false, false]); // ·8
    if !valid(&x) { return Err("hash to curve failed".into()); }
    Ok((x, [(v0, e0), (v1, e1)]))
}

fn random_odd() -> Sc {
    let mut rng = rand::rngs::OsRng;
    loop { let r = Sc::rand(&mut rng); if r.into_bigint().is_odd() { return r; } }
}

fn pt_json(p: &Pt) -> serde_json::Value { serde_json::json!([dec(&p.0), dec(&p.1)]) }
fn pt_of(v: &serde_json::Value) -> Result<Pt, Error> {
    Ok((fr(v[0].as_str().ok_or("point expected")?)?, fr(v[1].as_str().ok_or("point expected")?)?))
}

/// Round 1. Returns {"pB", "dB"} for the service, and "secret": what round 2 needs
/// (keep it in memory only). `r` may be given for tests: {"pR": "...", "dR": "..."}.
/// `dg13`: when the issuer's rule puts the personal number in DG13, its bytes and the tag.
pub fn prepare(helper_graph: &[u8], dg1: &[u8], current_year: u32, path: u8, dg13: Option<(&[u8], u32)>, fixed_r: Option<(&str, &str)>) -> Result<serde_json::Value, Error> {
    let f = fields(dg1, current_year, path, dg13)?;
    let w = helper(helper_graph, (Fr::from(path as u64), &f.person), (Fr::from(3u64), &f.document), [[Fr::zero(); 10]; 2])?;
    let (xp, hp) = hash_to_curve(w[0], w[1])?;
    let (xd, hd) = hash_to_curve(w[2], w[3])?;
    let (rp, rd) = match fixed_r { Some((a, b)) => (sc(a)?, sc(b)?), None => (random_odd(), random_odd()) };
    if !rp.into_bigint().is_odd() || !rd.into_bigint().is_odd() { return Err("r must be odd".into()); }
    let hints = |h: &[(Fr, u8); 2]| serde_json::json!({ "v": [dec(&h[0].0), dec(&h[1].0)], "e": [h[0].1.to_string(), h[1].1.to_string()] });
    Ok(serde_json::json!({
        "pB": pt_json(&mul(&xp, &rp)), "dB": pt_json(&mul(&xd, &rd)),
        "secret": { "path": path.to_string(), "pnSrc": if dg13.is_some() { "1" } else { "0" }, "pX": pt_json(&xp), "dX": pt_json(&xd), "pR": dec(&rp), "dR": dec(&rd),
                    "pH": hints(&hp), "dH": hints(&hd) },
    }))
}

/// Round 2. `prep`: the output of `prepare`; `answer`: the service's
/// {"pZ", "pC", "pS", "dZ", "dC", "dS"}; `k_pub`: its published key K.
/// Checks both DLEQ proofs and returns π_doc's fingerprint inputs.
pub fn complete(helper_graph: &[u8], prep: &serde_json::Value, k_pub: &serde_json::Value, answer: &serde_json::Value) -> Result<serde_json::Value, Error> {
    let s = &prep["secret"];
    let k = pt_of(k_pub)?;
    if !valid(&k) { return Err("invalid service key".into()); }
    let g = g8();
    let mut out = serde_json::json!({ "path": s["path"].clone(), "pnSrc": s["pnSrc"].clone() });
    let mut qs = [[Fr::zero(); 10]; 2];
    let mut parts = Vec::new();
    for (i, (pre, x)) in [("p", "pX"), ("d", "dX")].iter().enumerate() {
        let b = pt_of(&prep[format!("{pre}B")])?;
        let z = pt_of(&answer[format!("{pre}Z")])?;
        if !valid(&z) { return Err("invalid answer from the service".into()); }
        let c = sc(answer[format!("{pre}C")].as_str().ok_or("missing c")?)?;
        let sv = sc(answer[format!("{pre}S")].as_str().ok_or("missing s")?)?;
        let t1 = add(&mul(&g, &sv), &neg(&mul(&k, &c)));
        let t2 = add(&mul(&b, &sv), &neg(&mul(&z, &c)));
        qs[i] = [k.0, k.1, b.0, b.1, z.0, z.1, t1.0, t1.1, t2.0, t2.1];
        let r = sc(s[format!("{pre}R")].as_str().ok_or("missing r")?)?;
        let w = mul(&z, &r.inverse().ok_or("r = 0")?);
        let v = mul(&w, &Sc::from(8u64).inverse().unwrap());
        parts.push((pre.to_string(), c, b, z, r, v, pt_of(&s[*x])?));
    }
    // challenges, from the same Poseidon helper (its first outputs are not used here)
    let zero5 = [Fr::zero(); 5];
    let w = helper(helper_graph, (Fr::zero(), &zero5), (Fr::zero(), &zero5), qs)?;
    for (i, (pre, c, b, z, r, v, x)) in parts.iter().enumerate() {
        let c_expected = Sc::from_le_bytes_mod_order(&w[4 + i].into_bigint().to_bytes_le());
        if *c != c_expected { return Err("the service's DLEQ proof does not verify".into()); }
        // B must be r·x: a check of our own state
        if mul(x, r) != *b { return Err("inconsistent session".into()); }
        let h = &s[format!("{pre}H")];
        out[format!("{pre}V")] = h["v"].clone();
        out[format!("{pre}E")] = h["e"].clone();
        out[format!("{pre}R")] = serde_json::Value::String(dec(r));
        out[format!("{pre}Vw")] = pt_json(v);
        out[format!("{pre}B")] = pt_json(b);
        out[format!("{pre}Z")] = pt_json(z);
    }
    Ok(out)
}

/// TEST ONLY: the service's answer for a blinded point, with a fixed nonce.
pub fn evaluate_for_tests(helper_graph: &[u8], k: &str, pb: &serde_json::Value, db: &serde_json::Value) -> Result<serde_json::Value, Error> {
    let k = sc(k)?;
    let g = g8();
    let kp = mul(&g, &k);
    let (b0, b1) = (pt_of(pb)?, pt_of(db)?);
    let t = Sc::from(123456789u64);
    let mk = |b: &Pt| -> [Fr; 10] { let z = mul(b, &k); let t1 = mul(&g, &t); let t2 = mul(b, &t); [kp.0, kp.1, b.0, b.1, z.0, z.1, t1.0, t1.1, t2.0, t2.1] };
    let zero5 = [Fr::zero(); 5];
    let w = helper(helper_graph, (Fr::zero(), &zero5), (Fr::zero(), &zero5), [mk(&b0), mk(&b1)])?;
    let cs: Vec<Sc> = (0..2).map(|i| Sc::from_le_bytes_mod_order(&w[4 + i].into_bigint().to_bytes_le())).collect();
    Ok(serde_json::json!({
        "K": pt_json(&kp),
        "pZ": pt_json(&mul(&b0, &k)), "pC": dec(&cs[0]), "pS": dec(&(t + cs[0] * k)),
        "dZ": pt_json(&mul(&b1, &k)), "dC": dec(&cs[1]), "dS": dec(&(t + cs[1] * k)),
    }))
}
