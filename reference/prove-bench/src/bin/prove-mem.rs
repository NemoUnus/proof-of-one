// SPDX-License-Identifier: Apache-2.0
// TEST-ONLY memory measurement of Groth16 proving (prove-mem). Adapted from main.rs:
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


// Two processes, so that the proving process's peak memory is measured on its own:
//   prove-mem setup <circuit.r1cs> <witness.wtns> <dir>   random TEST-ONLY setup; writes pk.bin, matrices.bin
//   prove-mem prove <circuit.r1cs> <witness.wtns> <dir>   loads them, proves as the phone app would
//                                                         (precomputed matrices, no constraint system), verifies
// Peak memory is the process's VmHWM from /proc/self/status.
use ark_groth16::r1cs_to_qap::LibsnarkReduction;
use ark_relations::r1cs::{ConstraintSystem, OptimizationGoal, SynthesisMode, ConstraintMatrices};
use ark_serialize::{CanonicalDeserialize, CanonicalSerialize, Compress, Validate};
use ark_ff::BigInteger;
use ark_groth16::ProvingKey;
use ark_std::UniformRand;
use std::io::{BufReader, BufWriter, Read, Write};

fn peak_mb() -> f64 {
    let s = std::fs::read_to_string("/proc/self/status").unwrap_or_default();
    s.lines().find(|l| l.starts_with("VmHWM")).and_then(|l| l.split_whitespace().nth(1)).and_then(|v| v.parse::<f64>().ok()).unwrap_or(0.0) / 1024.0
}
fn write_matrices(m: &ConstraintMatrices<Fr>, path: &str) {
    let mut f = BufWriter::new(std::fs::File::create(path).unwrap());
    for (k, mat) in [&m.a, &m.b, &m.c].into_iter().enumerate() {
        let _ = k;
        f.write_all(&(mat.len() as u64).to_le_bytes()).unwrap();
        for row in mat.iter() {
            f.write_all(&(row.len() as u32).to_le_bytes()).unwrap();
            for (c, i) in row { f.write_all(&(*i as u32).to_le_bytes()).unwrap(); f.write_all(&c.into_bigint().to_bytes_le()).unwrap(); }
        }
    }
    f.write_all(&(m.num_instance_variables as u64).to_le_bytes()).unwrap();
    f.write_all(&(m.num_constraints as u64).to_le_bytes()).unwrap();
}
fn read_matrices(path: &str) -> (Vec<Vec<Vec<(Fr, usize)>>>, usize, usize) {
    let mut f = BufReader::new(std::fs::File::open(path).unwrap());
    let mut b8 = [0u8; 8]; let mut b4 = [0u8; 4]; let mut b32 = [0u8; 32];
    let mut mats = Vec::new();
    for _ in 0..3 {
        f.read_exact(&mut b8).unwrap(); let n = u64::from_le_bytes(b8) as usize;
        let mut mat = Vec::with_capacity(n);
        for _ in 0..n {
            f.read_exact(&mut b4).unwrap(); let k = u32::from_le_bytes(b4) as usize;
            let mut row = Vec::with_capacity(k);
            for _ in 0..k { f.read_exact(&mut b4).unwrap(); let i = u32::from_le_bytes(b4) as usize; f.read_exact(&mut b32).unwrap(); row.push((Fr::from_le_bytes_mod_order(&b32), i)); }
            mat.push(row);
        }
        mats.push(mat);
    }
    f.read_exact(&mut b8).unwrap(); let ni = u64::from_le_bytes(b8) as usize;
    f.read_exact(&mut b8).unwrap(); let nc = u64::from_le_bytes(b8) as usize;
    (mats, ni, nc)
}
fn to_cm(mut mats: Vec<Vec<Vec<(Fr, usize)>>>, ni: usize, nc: usize, n_wires: usize) -> ConstraintMatrices<Fr> {
    let c = mats.pop().unwrap(); let b = mats.pop().unwrap(); let a = mats.pop().unwrap();
    let nz = |m: &Vec<Vec<(Fr, usize)>>| m.iter().map(|r| r.len()).sum();
    ConstraintMatrices { num_instance_variables: ni, num_witness_variables: n_wires - ni, num_constraints: nc,
        a_num_non_zero: nz(&a), b_num_non_zero: nz(&b), c_num_non_zero: nz(&c), a, b, c }
}

fn main() {
    let a: Vec<String> = std::env::args().collect();
    let (mode, dir) = (a[1].as_str(), a[4].clone());
    if mode == "compress" {
        // Rewrites pk.bin with compressed points (about half the size) and times reading it back.
        let pk = ProvingKey::<Bn254>::deserialize_with_mode(BufReader::new(std::fs::File::open(format!("{dir}/pk.bin")).unwrap()), Compress::No, Validate::No).unwrap();
        pk.serialize_with_mode(BufWriter::new(std::fs::File::create(format!("{dir}/pk_c.bin")).unwrap()), Compress::Yes).unwrap();
        let t = Instant::now();
        let _ = ProvingKey::<Bn254>::deserialize_with_mode(BufReader::new(std::fs::File::open(format!("{dir}/pk_c.bin")).unwrap()), Compress::Yes, Validate::No).unwrap();
        println!("compressed key read back in {:.1} s", t.elapsed().as_secs_f64());
        return;
    }
    let w = read_wtns(&a[3]);
    let mut rng = ark_std::rand::rngs::StdRng::seed_from_u64(1); // TEST ONLY
    if mode == "setup" {
        let r = read_r1cs(&a[2]);
        assert_eq!(w.len(), r.n_wires, "witness length");
        let t = Instant::now();
        let (pk, _vk) = Groth16::<Bn254>::circuit_specific_setup(Circ { r: &r, w: None }, &mut rng).unwrap();
        println!("setup_s {:.1}", t.elapsed().as_secs_f64());
        let cs = ConstraintSystem::<Fr>::new_ref();
        cs.set_optimization_goal(OptimizationGoal::Constraints);
        cs.set_mode(SynthesisMode::Setup);
        Circ { r: &r, w: None }.generate_constraints(cs.clone()).unwrap();
        cs.finalize();
        let m = cs.to_matrices().unwrap();
        write_matrices(&m, &format!("{dir}/matrices.bin"));
        let mut f = BufWriter::new(std::fs::File::create(format!("{dir}/pk.bin")).unwrap());
        pk.serialize_with_mode(&mut f, Compress::No).unwrap();
        println!("written; setup process peak {:.0} MB", peak_mb());
        return;
    }
    // The proving process never reads the .r1cs: like the phone, it has only the key, the matrices and the witness.
    let t = Instant::now();
    let pk = ProvingKey::<Bn254>::deserialize_with_mode(BufReader::new(std::fs::File::open(format!("{dir}/pk.bin")).unwrap()), Compress::No, Validate::No).unwrap();
    let (mats, ni, nc) = read_matrices(&format!("{dir}/matrices.bin"));
    let mats = to_cm(mats, ni, nc, w.len());
    println!("load_s {:.1} peak_after_load_mb {:.0}", t.elapsed().as_secs_f64(), peak_mb());
    let runs: usize = a.get(5).map(|s| s.parse().unwrap()).unwrap_or(2);
    let pvk = Groth16::<Bn254>::process_vk(&pk.vk).unwrap();
    for i in 0..runs {
        let t = Instant::now();
        let (rr, ss) = (Fr::rand(&mut rng), Fr::rand(&mut rng));
        let proof = Groth16::<Bn254, LibsnarkReduction>::create_proof_with_reduction_and_matrices(&pk, rr, ss, &mats, ni, nc, &w).unwrap();
        let pt = t.elapsed().as_secs_f64();
        let ok = Groth16::<Bn254>::verify_with_processed_vk(&pvk, &w[1..ni], &proof).unwrap();
        println!("run {} prove_s {:.2} ok {} peak_mb {:.0}", i + 1, pt, ok, peak_mb());
    }
}
