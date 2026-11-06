// SPDX-License-Identifier: Apache-2.0
// Proof of One — native Groth16 prover for the phone app (schedule 1.4-00). TEST-ONLY setups.
//
// One call turns circuit inputs (JSON, as snarkjs takes them) into a proof and public
// signals in snarkjs's JSON format, so the same verifier, contracts and tests apply:
//   1. witness: circom-witnesscalc evaluates a precompiled witness graph of the circuit
//      (built once with its `build-circuit` tool), with no WebAssembly runtime;
//   2. proof: arkworks Groth16 with Circom's QAP reduction, from the snarkjs .zkey.
// SECURITY: the proof's randomness (r, s) comes from the operating system's CSPRNG. The
// inputs include the member's secret; this code keeps nothing and writes nothing to disk.
use ark_bn254::{Bn254, Fr};
use ark_circom::{read_zkey, CircomReduction};
use ark_ff::{BigInteger, PrimeField};
use ark_groth16::{Groth16, Proof, ProvingKey};
use ark_snark::SNARK;
use ark_std::UniformRand;
use std::io::Cursor;

pub type Error = Box<dyn std::error::Error + Send + Sync>;

/// A proving key and the circuit's constraint matrices, read once from a .zkey.
pub struct Circuit {
    pk: ProvingKey<Bn254>,
    matrices: Vec<ark_relations::utils::matrix::Matrix<Fr>>,
    num_instance: usize,
    num_constraints: usize,
    graph: Vec<u8>,
}

impl Circuit {
    pub fn load(zkey: &[u8], graph: Vec<u8>) -> Result<Circuit, Error> {
        let (pk, m) = read_zkey(&mut Cursor::new(zkey))?;
        Ok(Circuit {
            pk,
            num_instance: m.num_instance_variables,
            num_constraints: m.num_constraints,
            matrices: vec![m.a, m.b, m.c],
            graph,
        })
    }

    /// Witness: the circuit's full assignment, from the inputs JSON.
    pub fn witness(&self, inputs_json: &str) -> Result<Vec<Fr>, Error> {
        let wtns = circom_witnesscalc::calc_witness(inputs_json, &self.graph).map_err(|e| e.to_string())?;
        parse_wtns(&wtns)
    }

    /// Proof and public signals as snarkjs JSON strings.
    pub fn prove(&self, inputs_json: &str) -> Result<(String, String), Error> {
        let w = self.witness(inputs_json)?;
        let mut rng = rand::rngs::OsRng;
        let (r, s) = (Fr::rand(&mut rng), Fr::rand(&mut rng));
        let proof = Groth16::<Bn254, CircomReduction>::create_proof_with_reduction_and_matrices(
            &self.pk, r, s, &self.matrices, self.num_instance, self.num_constraints, &w)?;
        let public: Vec<String> = w[1..self.num_instance].iter().map(dec).collect();
        Ok((proof_json(&proof), serde_json::to_string(&public)?))
    }

    /// Prove and check the proof on the phone before anything is sent. Returns the snarkjs
    /// JSON strings and whether the proof verified under this circuit's verifying key.
    pub fn prove_checked(&self, inputs_json: &str) -> Result<(String, String, bool), Error> {
        let w = self.witness(inputs_json)?;
        let mut rng = rand::rngs::OsRng;
        let (r, s) = (Fr::rand(&mut rng), Fr::rand(&mut rng));
        let proof = Groth16::<Bn254, CircomReduction>::create_proof_with_reduction_and_matrices(
            &self.pk, r, s, &self.matrices, self.num_instance, self.num_constraints, &w)?;
        let ok = self.verify(&proof, &w[1..self.num_instance])?;
        let public: Vec<String> = w[1..self.num_instance].iter().map(dec).collect();
        Ok((proof_json(&proof), serde_json::to_string(&public)?, ok))
    }

    /// Verify with the proving key's verifying key (a check on the phone before sending).
    pub fn verify(&self, proof: &Proof<Bn254>, public: &[Fr]) -> Result<bool, Error> {
        let pvk = Groth16::<Bn254>::process_vk(&self.pk.vk)?;
        Ok(Groth16::<Bn254>::verify_with_processed_vk(&pvk, public, proof)?)
    }
}

/// A circuit whose key and matrices were made by arkworks itself (random TEST-ONLY setup in
/// ../prove-bench, prove-mem), used for the enrolment proof π_doc benchmark (N31). The
/// witness is given as a .wtns file. Reduction: arkworks' own (LibsnarkReduction).
pub struct ArkCircuit {
    pk: ProvingKey<Bn254>,
    matrices: Vec<ark_relations::utils::matrix::Matrix<Fr>>,
    num_instance: usize,
    num_constraints: usize,
}

impl ArkCircuit {
    /// `pk`: ProvingKey, canonical serialization with compressed points.
    /// `matrices_gz`: gzip of the matrices file written by prove-mem.
    pub fn load(pk: &[u8], matrices_gz: &[u8]) -> Result<ArkCircuit, Error> {
        use ark_serialize::{CanonicalDeserialize, Compress, Validate};
        let pk = ProvingKey::<Bn254>::deserialize_with_mode(Cursor::new(pk), Compress::Yes, Validate::No)?;
        let mut raw = Vec::new();
        std::io::Read::read_to_end(&mut flate2::read::GzDecoder::new(matrices_gz), &mut raw)?;
        let (matrices, num_instance, num_constraints) = read_matrices(&raw)?;
        Ok(ArkCircuit { pk, matrices, num_instance, num_constraints })
    }

    /// Prove from a .wtns and verify on the phone. Returns whether the proof verified.
    pub fn prove_wtns(&self, wtns: &[u8]) -> Result<bool, Error> {
        let w = parse_wtns(wtns)?;
        let mut rng = rand::rngs::OsRng;
        let (r, s) = (Fr::rand(&mut rng), Fr::rand(&mut rng));
        let proof = Groth16::<Bn254, ark_groth16::r1cs_to_qap::LibsnarkReduction>::create_proof_with_reduction_and_matrices(
            &self.pk, r, s, &self.matrices, self.num_instance, self.num_constraints, &w)?;
        let pvk = Groth16::<Bn254>::process_vk(&self.pk.vk)?;
        Ok(Groth16::<Bn254>::verify_with_processed_vk(&pvk, &w[1..self.num_instance], &proof)?)
    }
}

/// The matrices format of prove-mem: for A, B, C: rows (u64), then per row: entries (u32) and
/// (column u32, coefficient 32 bytes little-endian); then instance variables and constraints (u64).
fn read_matrices(b: &[u8]) -> Result<(Vec<ark_relations::utils::matrix::Matrix<Fr>>, usize, usize), Error> {
    let mut o = 0usize;
    let mut take = |n: usize| -> Result<&[u8], Error> { if o + n > b.len() { return Err("matrices file too short".into()); } let s = &b[o..o + n]; o += n; Ok(s) };
    let mut mats = Vec::with_capacity(3);
    for _ in 0..3 {
        let rows = u64::from_le_bytes(take(8)?.try_into().unwrap()) as usize;
        let mut m = Vec::with_capacity(rows);
        for _ in 0..rows {
            let k = u32::from_le_bytes(take(4)?.try_into().unwrap()) as usize;
            let mut row = Vec::with_capacity(k);
            for _ in 0..k {
                let i = u32::from_le_bytes(take(4)?.try_into().unwrap()) as usize;
                row.push((Fr::from_le_bytes_mod_order(take(32)?), i));
            }
            m.push(row);
        }
        mats.push(m);
    }
    let ni = u64::from_le_bytes(take(8)?.try_into().unwrap()) as usize;
    let nc = u64::from_le_bytes(take(8)?.try_into().unwrap()) as usize;
    Ok((mats, ni, nc))
}

/// Peak resident memory of this process, in MB (Linux and Android: VmHWM).
pub fn peak_mb() -> u64 {
    std::fs::read_to_string("/proc/self/status").ok()
        .and_then(|s| s.lines().find(|l| l.starts_with("VmHWM")).and_then(|l| l.split_whitespace().nth(1)).and_then(|v| v.parse::<u64>().ok()))
        .unwrap_or(0) / 1024
}

fn dec<F: PrimeField>(x: &F) -> String {
    let b = x.into_bigint().to_bytes_be();
    num_to_dec(&b)
}
fn num_to_dec(be: &[u8]) -> String {
    // big-endian bytes to decimal, without a bignum dependency
    let mut digits: Vec<u8> = vec![0];
    for &byte in be {
        let mut carry = byte as u32;
        for d in digits.iter_mut() { let v = (*d as u32) * 256 + carry; *d = (v % 10) as u8; carry = v / 10; }
        while carry > 0 { digits.push((carry % 10) as u8); carry /= 10; }
    }
    while digits.len() > 1 && *digits.last().unwrap() == 0 { digits.pop(); }
    digits.iter().rev().map(|d| (b'0' + d) as char).collect()
}

fn proof_json(p: &Proof<Bn254>) -> String {
    let g1 = |q: &ark_bn254::G1Affine| serde_json::json!([dec(&q.x), dec(&q.y), "1"]);
    let g2 = |q: &ark_bn254::G2Affine| serde_json::json!([[dec(&q.x.c0), dec(&q.x.c1)], [dec(&q.y.c0), dec(&q.y.c1)], ["1", "0"]]);
    serde_json::json!({ "pi_a": g1(&p.a), "pi_b": g2(&p.b), "pi_c": g1(&p.c), "protocol": "groth16", "curve": "bn128" }).to_string()
}

/// Minimal reader of the .wtns format (iden3 binfile: header section 1, values section 2).
pub fn parse_wtns(b: &[u8]) -> Result<Vec<Fr>, Error> {
    let u32_at = |o: usize| u32::from_le_bytes(b[o..o + 4].try_into().unwrap()) as usize;
    let u64_at = |o: usize| u64::from_le_bytes(b[o..o + 8].try_into().unwrap()) as usize;
    if b.len() < 12 || &b[0..4] != b"wtns" { return Err("not a wtns file".into()); }
    let nsec = u32_at(8);
    let (mut off, mut n8, mut n, mut values) = (12usize, 0usize, 0usize, None);
    for _ in 0..nsec {
        let (ty, len) = (u32_at(off), u64_at(off + 4));
        let body = off + 12;
        if ty == 1 { n8 = u32_at(body); n = u32_at(body + 4 + n8); }
        if ty == 2 { values = Some(body); }
        off = body + len;
    }
    let start = values.ok_or("wtns without values")?;
    if n8 != 32 { return Err("unexpected field size".into()); }
    Ok((0..n).map(|i| Fr::from_le_bytes_mod_order(&b[start + 32 * i..start + 32 * (i + 1)])).collect())
}

// ---------------------------------------------------------------- Android (JNI)
// Kotlin: object NativeProver { external fun prove(graph: ByteArray, zkey: ByteArray, inputs: String): String }
// Returns JSON: {"proof":…, "public":…, "verified":bool, "loadMs":n, "proveMs":n} or {"error":"…"}.
// The circuit (proving key and matrices) is loaded once per process and kept for later calls.
mod android {
    use super::Circuit;
    use jni::objects::{JByteArray, JClass, JString};
    use jni::sys::jstring;
    use jni::JNIEnv;
    use std::sync::Mutex;
    use std::time::Instant;

    static CACHE: Mutex<Option<(usize, Circuit)>> = Mutex::new(None);

    fn run(env: &mut JNIEnv, graph: &JByteArray, zkey: &JByteArray, inputs: &JString) -> Result<String, super::Error> {
        let inputs: String = env.get_string(inputs)?.into();
        let zlen = env.get_array_length(zkey)? as usize;
        let mut cache = CACHE.lock().map_err(|_| "prover lock poisoned")?;
        let t = Instant::now();
        if cache.as_ref().map(|c| c.0) != Some(zlen) {
            let z = env.convert_byte_array(zkey)?;
            let g = env.convert_byte_array(graph)?;
            *cache = Some((zlen, Circuit::load(&z, g)?));
        }
        let load_ms = t.elapsed().as_millis();
        let t = Instant::now();
        let (proof, public, ok) = cache.as_ref().unwrap().1.prove_checked(&inputs)?;
        Ok(format!(r#"{{"proof":{},"public":{},"verified":{},"loadMs":{},"proveMs":{}}}"#, proof, public, ok, load_ms, t.elapsed().as_millis()))
    }

    // Enrolment proof benchmark: {"verified":bool,"loadMs":n,"proveMs":n,"peakMb":n} or {"error":…}.
    // The key is read on every call (it is large and used once per enrolment).
    // The files are passed by path, not as byte arrays, so that 150 MB never sits in the Java heap.
    fn run_doc(env: &mut JNIEnv, pk: &JString, mats: &JString, wtns: &JString) -> Result<String, super::Error> {
        let pk: String = env.get_string(pk)?.into();
        let mats: String = env.get_string(mats)?.into();
        let wtns: String = env.get_string(wtns)?.into();
        let t = Instant::now();
        let c = super::ArkCircuit::load(&std::fs::read(&pk)?, &std::fs::read(&mats)?)?;
        let load_ms = t.elapsed().as_millis();
        let w = std::fs::read(&wtns)?;
        let t = Instant::now();
        let ok = c.prove_wtns(&w)?;
        Ok(format!(r#"{{"verified":{},"loadMs":{},"proveMs":{},"peakMb":{}}}"#, ok, load_ms, t.elapsed().as_millis(), super::peak_mb()))
    }

    #[no_mangle]
    pub extern "system" fn Java_io_github_nemounus_proofofone_reader_NativeProver_proveDoc<'l>(
        mut env: JNIEnv<'l>, _class: JClass<'l>, pk: JString<'l>, mats: JString<'l>, wtns: JString<'l>,
    ) -> jstring {
        let out = match run_doc(&mut env, &pk, &mats, &wtns) {
            Ok(s) => s,
            Err(e) => serde_json::json!({ "error": e.to_string() }).to_string(),
        };
        env.new_string(out).map(|s| s.into_raw()).unwrap_or(std::ptr::null_mut())
    }

    #[no_mangle]
    pub extern "system" fn Java_io_github_nemounus_proofofone_reader_NativeProver_prove<'l>(
        mut env: JNIEnv<'l>, _class: JClass<'l>, graph: JByteArray<'l>, zkey: JByteArray<'l>, inputs: JString<'l>,
    ) -> jstring {
        let out = match run(&mut env, &graph, &zkey, &inputs) {
            Ok(s) => s,
            Err(e) => serde_json::json!({ "error": e.to_string() }).to_string(),
        };
        env.new_string(out).map(|s| s.into_raw()).unwrap_or(std::ptr::null_mut())
    }
}
