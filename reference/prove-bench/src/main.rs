// SPDX-License-Identifier: Apache-2.0
// TEST-ONLY Groth16 timing for a Circom circuit: reads circuit.r1cs and a witness.wtns made by
// snarkjs, runs a random (insecure) circuit-specific setup, then times proving and verifying.
// Used only to measure proving cost; the keys it makes must never be used for anything else.
use ark_bn254::{Bn254, Fr};
use ark_ff::PrimeField;
use ark_groth16::Groth16;
use ark_relations::lc;
use ark_relations::r1cs::{ConstraintSynthesizer, ConstraintSystemRef, LinearCombination, SynthesisError, Variable};
use ark_snark::SNARK;
use std::time::Instant;
use ark_std::rand::SeedableRng;

struct R1cs { n_wires: usize, n_pub: usize, cons: Vec<[Vec<(usize, Fr)>; 3]> }

fn u32le(b: &[u8], p: &mut usize) -> u32 { let v = u32::from_le_bytes(b[*p..*p + 4].try_into().unwrap()); *p += 4; v }
fn u64le(b: &[u8], p: &mut usize) -> u64 { let v = u64::from_le_bytes(b[*p..*p + 8].try_into().unwrap()); *p += 8; v }
fn fr(b: &[u8], p: &mut usize, n8: usize) -> Fr { let v = Fr::from_le_bytes_mod_order(&b[*p..*p + n8]); *p += n8; v }

fn sections(b: &[u8], magic: &[u8]) -> Vec<(u32, usize, usize)> {
    assert_eq!(&b[0..4], magic, "bad magic");
    let mut p = 8; let n = u32le(b, &mut p); let mut out = vec![];
    for _ in 0..n { let t = u32le(b, &mut p); let s = u64le(b, &mut p) as usize; out.push((t, p, s)); p += s; }
    out
}

fn read_r1cs(path: &str) -> R1cs {
    let b = std::fs::read(path).unwrap(); let secs = sections(&b, b"r1cs");
    let (_, hp, _) = *secs.iter().find(|s| s.0 == 1).unwrap(); let mut p = hp;
    let n8 = u32le(&b, &mut p) as usize; p += n8;
    let n_wires = u32le(&b, &mut p) as usize; let n_out = u32le(&b, &mut p) as usize;
    let n_pub_in = u32le(&b, &mut p) as usize; let _n_prv = u32le(&b, &mut p); let _labels = u64le(&b, &mut p);
    let m = u32le(&b, &mut p) as usize;
    let (_, cp, _) = *secs.iter().find(|s| s.0 == 2).unwrap(); let mut p = cp;
    let mut cons = Vec::with_capacity(m);
    for _ in 0..m {
        let mut lcs: [Vec<(usize, Fr)>; 3] = Default::default();
        for k in 0..3 { let nt = u32le(&b, &mut p); for _ in 0..nt { let w = u32le(&b, &mut p) as usize; let c = fr(&b, &mut p, n8); lcs[k].push((w, c)); } }
        cons.push(lcs);
    }
    R1cs { n_wires, n_pub: n_out + n_pub_in, cons }
}

fn read_wtns(path: &str) -> Vec<Fr> {
    let b = std::fs::read(path).unwrap(); let secs = sections(&b, b"wtns");
    let (_, hp, _) = *secs.iter().find(|s| s.0 == 1).unwrap(); let mut p = hp;
    let n8 = u32le(&b, &mut p) as usize; p += n8; let n = u32le(&b, &mut p) as usize;
    let (_, dp, _) = *secs.iter().find(|s| s.0 == 2).unwrap(); let mut p = dp;
    (0..n).map(|_| fr(&b, &mut p, n8)).collect()
}

#[derive(Clone)]
struct Circ<'a> { r: &'a R1cs, w: Option<&'a [Fr]> }
impl<'a> ConstraintSynthesizer<Fr> for Circ<'a> {
    fn generate_constraints(self, cs: ConstraintSystemRef<Fr>) -> Result<(), SynthesisError> {
        let mut vars = Vec::with_capacity(self.r.n_wires); vars.push(Variable::One);
        let val = |i: usize| -> Result<Fr, SynthesisError> { self.w.map(|w| w[i]).ok_or(SynthesisError::AssignmentMissing) };
        for i in 1..self.r.n_wires {
            vars.push(if i <= self.r.n_pub { cs.new_input_variable(|| val(i))? } else { cs.new_witness_variable(|| val(i))? });
        }
        let mk = |t: &Vec<(usize, Fr)>| { let mut l: LinearCombination<Fr> = lc!(); for (w, c) in t { l = l + (*c, vars[*w]); } l };
        for c in &self.r.cons { cs.enforce_constraint(mk(&c[0]), mk(&c[1]), mk(&c[2]))?; }
        Ok(())
    }
}

fn main() {
    let a: Vec<String> = std::env::args().collect();
    let r = read_r1cs(&a[1]); let w = read_wtns(&a[2]);
    assert_eq!(w.len(), r.n_wires, "witness length");
    // Check the witness satisfies every constraint (also checks the parsing).
    let ev = |t: &Vec<(usize, Fr)>| t.iter().fold(Fr::from(0u64), |s, (i, c)| s + *c * w[*i]);
    let bad = r.cons.iter().filter(|c| ev(&c[0]) * ev(&c[1]) != ev(&c[2])).count();
    println!("constraints {} wires {} public {} unsatisfied {}", r.cons.len(), r.n_wires, r.n_pub, bad);
    assert_eq!(bad, 0);
    let mut rng = ark_std::rand::rngs::StdRng::seed_from_u64(1); // TEST ONLY
    let t = Instant::now();
    let (pk, vk) = Groth16::<Bn254>::circuit_specific_setup(Circ { r: &r, w: None }, &mut rng).unwrap();
    println!("setup_s {:.1}", t.elapsed().as_secs_f64());
    let pubs: Vec<Fr> = w[1..=r.n_pub].to_vec();
    let runs: usize = a.get(3).map(|s| s.parse().unwrap()).unwrap_or(3);
    for i in 0..runs {
        let t = Instant::now();
        let proof = Groth16::<Bn254>::prove(&pk, Circ { r: &r, w: Some(&w) }, &mut rng).unwrap();
        let pt = t.elapsed().as_secs_f64();
        let t = Instant::now();
        let ok = Groth16::<Bn254>::verify(&vk, &pubs, &proof).unwrap();
        println!("run {} prove_s {:.2} verify_ms {:.1} ok {}", i + 1, pt, t.elapsed().as_secs_f64() * 1000.0, ok);
        let mut bad = pubs.clone(); bad[0] += Fr::from(1u64);
        assert!(!Groth16::<Bn254>::verify(&vk, &bad, &proof).unwrap(), "altered public input must fail");
    }
    let _ = Fr::MODULUS;
}
