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

    /// Like `load`, but keeps an uncompressed copy of the key at `cache` after the first use:
    /// decompressing 125 MB of points takes half a minute on a phone, reading 250 MB of
    /// uncompressed points takes about a second. The copy is written to a temporary name and
    /// renamed, so a half-written file is never used.
    pub fn load_cached(pk_c: &str, matrices_gz: &str, cache: &str) -> Result<ArkCircuit, Error> {
        use ark_serialize::{CanonicalDeserialize, CanonicalSerialize, Compress, Validate};
        let mut raw = Vec::new();
        std::io::Read::read_to_end(&mut flate2::read::GzDecoder::new(std::fs::File::open(matrices_gz)?), &mut raw)?;
        let (matrices, num_instance, num_constraints) = read_matrices(&raw)?;
        drop(raw);
        let pk = match std::fs::File::open(cache) {
            Ok(f) => ProvingKey::<Bn254>::deserialize_with_mode(std::io::BufReader::new(f), Compress::No, Validate::No)?,
            Err(_) => {
                let pk = ProvingKey::<Bn254>::deserialize_with_mode(std::io::BufReader::new(std::fs::File::open(pk_c)?), Compress::Yes, Validate::No)?;
                let tmp = format!("{cache}.tmp");
                pk.serialize_with_mode(std::io::BufWriter::new(std::fs::File::create(&tmp)?), Compress::No)?;
                std::fs::rename(&tmp, cache)?;
                pk
            }
        };
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

impl ArkCircuit {
    /// π_doc from circuit inputs on the phone (N31, step 2): the witness from the circuit's
    /// witness graph, then the proof, then the check. Returns the public signals (snarkjs
    /// order: outputs, then public inputs) as decimal strings, whether the proof verified,
    /// the witness and proving times in ms, and the proof (snarkjs JSON).
    pub fn prove_inputs(&self, graph: &[u8], inputs_json: &str) -> Result<(Vec<String>, bool, u128, u128, serde_json::Value), Error> {
        let t = std::time::Instant::now();
        let wtns = circom_witnesscalc::calc_witness(inputs_json, graph).map_err(|e| e.to_string())?;
        let w = parse_wtns(&wtns)?;
        drop(wtns);
        let witness_ms = t.elapsed().as_millis();
        // A witness graph computes values but checks no constraint: check them all here
        // (well under a second), so that a document the circuit rejects is reported at once.
        if let Some(i) = self.first_unsatisfied(&w) {
            return Err(format!("the circuit rejects this input (constraint {i} of {})", self.num_constraints).into());
        }
        let t = std::time::Instant::now();
        let mut rng = rand::rngs::OsRng;
        let (r, s) = (Fr::rand(&mut rng), Fr::rand(&mut rng));
        let proof = Groth16::<Bn254, ark_groth16::r1cs_to_qap::LibsnarkReduction>::create_proof_with_reduction_and_matrices(
            &self.pk, r, s, &self.matrices, self.num_instance, self.num_constraints, &w)?;
        let pvk = Groth16::<Bn254>::process_vk(&self.pk.vk)?;
        let ok = Groth16::<Bn254>::verify_with_processed_vk(&pvk, &w[1..self.num_instance], &proof)?;
        let pj: serde_json::Value = serde_json::from_str(&proof_json(&proof))?;
        Ok((w[1..self.num_instance].iter().map(dec).collect(), ok, witness_ms, t.elapsed().as_millis(), pj))
    }

    /// The verifying key in snarkjs's verification_key.json format (for the Solidity
    /// verifier of the enrolment service, which checks π_doc).
    pub fn vkey_json(&self) -> serde_json::Value { vkey_json(&self.pk.vk) }
}

/// A Groth16 verifying key in snarkjs's verification_key.json format.
pub fn vkey_json(vk: &ark_groth16::VerifyingKey<Bn254>) -> serde_json::Value {
    let g1 = |q: &ark_bn254::G1Affine| serde_json::json!([dec(&q.x), dec(&q.y), "1"]);
    let g2 = |q: &ark_bn254::G2Affine| serde_json::json!([[dec(&q.x.c0), dec(&q.x.c1)], [dec(&q.y.c0), dec(&q.y.c1)], ["1", "0"]]);
    serde_json::json!({
        "protocol": "groth16", "curve": "bn128", "nPublic": vk.gamma_abc_g1.len() - 1,
        "vk_alpha_1": g1(&vk.alpha_g1), "vk_beta_2": g2(&vk.beta_g2), "vk_gamma_2": g2(&vk.gamma_g2), "vk_delta_2": g2(&vk.delta_g2),
        "IC": vk.gamma_abc_g1.iter().map(g1).collect::<Vec<_>>(),
    })
}

impl ArkCircuit {
    /// The first constraint (A·w)·(B·w) = C·w that the witness does not satisfy, if any.
    pub fn first_unsatisfied(&self, w: &[Fr]) -> Option<usize> {
        let row = |m: &ark_relations::utils::matrix::Matrix<Fr>, i: usize| -> Fr {
            m[i].iter().fold(Fr::from(0u64), |acc, (c, j)| acc + *c * w[*j])
        };
        (0..self.num_constraints).find(|&i| row(&self.matrices[0], i) * row(&self.matrices[1], i) != row(&self.matrices[2], i))
    }
}

/// TEST ONLY (Decision Log #57, challenge 2): when the inputs carry no `dscRoot`, fills in
/// `dscRoot`, `dscSiblings` and `dscPathIndex` for a DSC tree whose only leaf is the
/// document's own signer, computed by the witness graph of
/// ../document-circuit/circuits/test/dsc_test_tree_s2.circom. Such a proof says nothing
/// about whether the signer is trusted; in the pilot the root and path come from the
/// public list. Returns the inputs JSON and whether the test tree was used.
pub fn with_test_tree(tree_graph: &[u8], inputs_json: &str) -> Result<(String, bool), Error> {
    let mut v: serde_json::Value = serde_json::from_str(inputs_json)?;
    if v.get("dscRoot").is_some() { return Ok((inputs_json.to_string(), false)); }
    let key = serde_json::json!({ "modulus": v["modulus"], "exponent": v["exponent"] }).to_string();
    let wtns = circom_witnesscalc::calc_witness(&key, tree_graph).map_err(|e| e.to_string())?;
    let w = parse_wtns(&wtns)?;
    let depth = 16;
    if w.len() < 2 + depth { return Err("unexpected test-tree witness".into()); }
    v["dscRoot"] = serde_json::Value::String(dec(&w[1]));
    v["dscSiblings"] = serde_json::Value::Array(w[2..2 + depth].iter().map(|x| serde_json::Value::String(dec(x))).collect());
    v["dscPathIndex"] = serde_json::Value::Array(vec![serde_json::Value::String("0".into()); depth]);
    Ok((v.to_string(), true))
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
pub mod fingerprint;
pub mod member;
pub mod ballot;
// Poseidon (circomlib parameters), shared with the enrolment service's core.
#[path = "../../service-core/src/poseidon.rs"]
pub mod poseidon;

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
        let cached = std::path::Path::new(&format!("{pk}.raw")).exists();
        let c = super::ArkCircuit::load_cached(&pk, &mats, &format!("{pk}.raw"))?;
        let load_ms = t.elapsed().as_millis();
        let w = std::fs::read(&wtns)?;
        let t = Instant::now();
        let ok = c.prove_wtns(&w)?;
        Ok(format!(r#"{{"verified":{},"loadMs":{},"cached":{},"proveMs":{},"peakMb":{}}}"#, ok, load_ms, cached, t.elapsed().as_millis(), super::peak_mb()))
    }

    // π_doc from a real passport's inputs (challenge 2): witness graph, proof, check.
    // {"verified":bool,"public":[…],"proof":{…},"testTree":bool,"loadMs":n,"witnessMs":n,"proveMs":n,"peakMb":n} or {"error":…}.
    fn run_doc_inputs(env: &mut JNIEnv, pk: &JString, mats: &JString, graph: &JString, tree: &JString, inputs: &JString) -> Result<String, super::Error> {
        let pk: String = env.get_string(pk)?.into();
        let mats: String = env.get_string(mats)?.into();
        let graph: String = env.get_string(graph)?.into();
        let tree: String = env.get_string(tree)?.into();
        let inputs: String = env.get_string(inputs)?.into();
        let (inputs, test_tree) = super::with_test_tree(&std::fs::read(&tree)?, &inputs)?;
        let t = Instant::now();
        let c = super::ArkCircuit::load_cached(&pk, &mats, &format!("{pk}.raw"))?;
        let load_ms = t.elapsed().as_millis();
        let g = std::fs::read(&graph)?;
        let (public, ok, witness_ms, prove_ms, proof) = c.prove_inputs(&g, &inputs)?;
        Ok(serde_json::json!({ "verified": ok, "public": public, "proof": proof, "testTree": test_tree, "loadMs": load_ms as u64,
            "witnessMs": witness_ms as u64, "proveMs": prove_ms as u64, "peakMb": super::peak_mb() }).to_string())
    }

    // Keyed fingerprints (docs/specs/document-fingerprint-oprf-v0.1.md). Each returns JSON or {"error":…}.
    fn json_or_error(r: Result<serde_json::Value, super::Error>) -> String {
        match r { Ok(v) => v.to_string(), Err(e) => serde_json::json!({ "error": e.to_string() }).to_string() }
    }
    fn s(env: &mut JNIEnv, x: &JString) -> Result<String, super::Error> { Ok(env.get_string(x)?.into()) }
    fn hex(h: &str) -> Result<Vec<u8>, super::Error> {
        if h.len() % 2 != 0 { return Err("odd hex".into()); }
        (0..h.len() / 2).map(|i| u8::from_str_radix(&h[2 * i..2 * i + 2], 16).map_err(|e| e.into())).collect()
    }

    /// Round 1: {"pB","dB","secret"} from DG1 (hex) and, if the issuer's rule takes the
    /// personal number from DG13, DG13 (hex) and the field's tag (else "" and 0).
    #[no_mangle]
    pub extern "system" fn Java_io_github_nemounus_proofofone_reader_NativeProver_fpPrepare<'l>(
        mut env: JNIEnv<'l>, _c: JClass<'l>, graph: JString<'l>, dg1: JString<'l>, year: jni::sys::jint, path: jni::sys::jint,
        dg13: JString<'l>, pn_tag: jni::sys::jint,
    ) -> jstring {
        let r = (|| -> Result<serde_json::Value, super::Error> {
            let g = std::fs::read(s(&mut env, &graph)?)?;
            let d13 = hex(&s(&mut env, &dg13)?)?; // empty: no DG13 rule
            let rule = if d13.is_empty() || pn_tag <= 0 { None } else { Some((d13.as_slice(), pn_tag as u32)) };
            super::fingerprint::prepare(&g, &hex(&s(&mut env, &dg1)?)?, year as u32, path as u8, rule, None)
        })();
        env.new_string(json_or_error(r)).map(|x| x.into_raw()).unwrap_or(std::ptr::null_mut())
    }

    /// Round 2: checks the service's answer and returns π_doc's fingerprint inputs.
    #[no_mangle]
    pub extern "system" fn Java_io_github_nemounus_proofofone_reader_NativeProver_fpComplete<'l>(
        mut env: JNIEnv<'l>, _c: JClass<'l>, graph: JString<'l>, prep: JString<'l>, key: JString<'l>, answer: JString<'l>,
    ) -> jstring {
        let r = (|| -> Result<serde_json::Value, super::Error> {
            let g = std::fs::read(s(&mut env, &graph)?)?;
            let p: serde_json::Value = serde_json::from_str(&s(&mut env, &prep)?)?;
            let k: serde_json::Value = serde_json::from_str(&s(&mut env, &key)?)?;
            let a: serde_json::Value = serde_json::from_str(&s(&mut env, &answer)?)?;
            super::fingerprint::complete(&g, &p, &k, &a)
        })();
        env.new_string(json_or_error(r)).map(|x| x.into_raw()).unwrap_or(std::ptr::null_mut())
    }

    /// Decision #59: member number and backup seed, after fpComplete has checked the answer.
    #[no_mangle]
    pub extern "system" fn Java_io_github_nemounus_proofofone_reader_NativeProver_fpMember<'l>(
        mut env: JNIEnv<'l>, _c: JClass<'l>, prep: JString<'l>, answer: JString<'l>,
    ) -> jstring {
        let r = (|| -> Result<serde_json::Value, super::Error> {
            let p: serde_json::Value = serde_json::from_str(&s(&mut env, &prep)?)?;
            let a: serde_json::Value = serde_json::from_str(&s(&mut env, &answer)?)?;
            super::fingerprint::member_seeds(&p, &a)
        })();
        env.new_string(json_or_error(r)).map(|x| x.into_raw()).unwrap_or(std::ptr::null_mut())
    }

    /// The member's secrets for a new identity (member.rs), from random bytes (hex, ≥ 192 bytes).
    #[no_mangle]
    pub extern "system" fn Java_io_github_nemounus_proofofone_reader_NativeProver_memberNew<'l>(
        mut env: JNIEnv<'l>, _c: JClass<'l>, rand: JString<'l>,
    ) -> jstring {
        let r = (|| -> Result<serde_json::Value, super::Error> { super::member::new_member(&hex(&s(&mut env, &rand)?)?) })();
        env.new_string(json_or_error(r)).map(|x| x.into_raw()).unwrap_or(std::ptr::null_mut())
    }

    /// The ballot (ballot.rs): op "identityPath", "revocation", "input", "recorded" or "nullifier", on a JSON argument.
    #[no_mangle]
    pub extern "system" fn Java_io_github_nemounus_proofofone_reader_NativeProver_ballotOp<'l>(
        mut env: JNIEnv<'l>, _c: JClass<'l>, op: JString<'l>, data: JString<'l>,
    ) -> jstring {
        let r = (|| -> Result<serde_json::Value, super::Error> {
            let op = s(&mut env, &op)?;
            let v: serde_json::Value = serde_json::from_str(&s(&mut env, &data)?)?;
            match op.as_str() {
                "identityPath" => super::ballot::identity_path(&v),
                "revocation" => super::ballot::revocation_witness(&v),
                "input" => super::ballot::ballot_input(&v),
                "recorded" => super::ballot::recorded_answer(&v),
                "nullifier" => super::ballot::nullifier(&v),
                _ => Err("unknown ballot operation".into()),
            }
        })();
        env.new_string(json_or_error(r)).map(|x| x.into_raw()).unwrap_or(std::ptr::null_mut())
    }

    /// The inputs of π_reg (member.rs registration_input), from member.json and the key set.
    #[no_mangle]
    pub extern "system" fn Java_io_github_nemounus_proofofone_reader_NativeProver_regInput<'l>(
        mut env: JNIEnv<'l>, _c: JClass<'l>, data: JString<'l>,
    ) -> jstring {
        let r = (|| -> Result<serde_json::Value, super::Error> {
            let v: serde_json::Value = serde_json::from_str(&s(&mut env, &data)?)?;
            super::member::registration_input(&v)
        })();
        env.new_string(json_or_error(r)).map(|x| x.into_raw()).unwrap_or(std::ptr::null_mut())
    }

    /// TEST ONLY: a synthetic service's answer, for the test screen before the real service.
    #[no_mangle]
    pub extern "system" fn Java_io_github_nemounus_proofofone_reader_NativeProver_fpTestService<'l>(
        mut env: JNIEnv<'l>, _c: JClass<'l>, graph: JString<'l>, k: JString<'l>, pb: JString<'l>, db: JString<'l>,
    ) -> jstring {
        let r = (|| -> Result<serde_json::Value, super::Error> {
            let g = std::fs::read(s(&mut env, &graph)?)?;
            let pb: serde_json::Value = serde_json::from_str(&s(&mut env, &pb)?)?;
            let db: serde_json::Value = serde_json::from_str(&s(&mut env, &db)?)?;
            super::fingerprint::evaluate_for_tests(&g, &s(&mut env, &k)?, &pb, &db)
        })();
        env.new_string(json_or_error(r)).map(|x| x.into_raw()).unwrap_or(std::ptr::null_mut())
    }

    #[no_mangle]
    pub extern "system" fn Java_io_github_nemounus_proofofone_reader_NativeProver_proveDocInputs<'l>(
        mut env: JNIEnv<'l>, _class: JClass<'l>, pk: JString<'l>, mats: JString<'l>, graph: JString<'l>, tree: JString<'l>, inputs: JString<'l>,
    ) -> jstring {
        let out = match run_doc_inputs(&mut env, &pk, &mats, &graph, &tree, &inputs) {
            Ok(s) => s,
            Err(e) => serde_json::json!({ "error": e.to_string() }).to_string(),
        };
        env.new_string(out).map(|s| s.into_raw()).unwrap_or(std::ptr::null_mut())
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

// ---------------------------------------------------------------- iOS and other C callers
// Swift calls these through the C header include/poo_native_prover.h (decision 56: one Rust
// core, a thin native interface per platform). Same JSON result as the Android call above.
// The returned string must be released with poo_string_free.
pub mod ffi {
    use super::Circuit;
    use std::ffi::{CStr, CString};
    use std::os::raw::c_char;
    use std::sync::Mutex;
    use std::time::Instant;

    static CACHE: Mutex<Option<(usize, Circuit)>> = Mutex::new(None);

    fn run(graph: &[u8], zkey: &[u8], inputs: &str) -> Result<String, super::Error> {
        let mut cache = CACHE.lock().map_err(|_| "prover lock poisoned")?;
        let t = Instant::now();
        if cache.as_ref().map(|c| c.0) != Some(zkey.len()) {
            *cache = Some((zkey.len(), Circuit::load(zkey, graph.to_vec())?));
        }
        let load_ms = t.elapsed().as_millis();
        let t = Instant::now();
        let (proof, public, ok) = cache.as_ref().unwrap().1.prove_checked(inputs)?;
        Ok(format!(r#"{{"proof":{},"public":{},"verified":{},"loadMs":{},"proveMs":{}}}"#, proof, public, ok, load_ms, t.elapsed().as_millis()))
    }

    /// Proves one ballot. `graph` and `zkey` are the circuit's witness graph and proving key,
    /// `inputs` the circuit inputs as NUL-terminated JSON. Returns NUL-terminated JSON.
    ///
    /// # Safety
    /// The pointers must be valid for the given lengths, and `inputs` NUL-terminated.
    #[no_mangle]
    pub unsafe extern "C" fn poo_prove(graph: *const u8, graph_len: usize, zkey: *const u8, zkey_len: usize, inputs: *const c_char) -> *mut c_char {
        let out = if graph.is_null() || zkey.is_null() || inputs.is_null() {
            Err::<String, super::Error>("null argument".into())
        } else {
            let g = std::slice::from_raw_parts(graph, graph_len);
            let z = std::slice::from_raw_parts(zkey, zkey_len);
            CStr::from_ptr(inputs).to_str().map_err(|e| e.into()).and_then(|i| run(g, z, i))
        };
        let s = out.unwrap_or_else(|e| serde_json::json!({ "error": e.to_string() }).to_string());
        CString::new(s).map(|c| c.into_raw()).unwrap_or(std::ptr::null_mut())
    }

    /// Releases a string returned by poo_prove.
    ///
    /// # Safety
    /// `s` must come from poo_prove and be released once.
    #[no_mangle]
    pub unsafe extern "C" fn poo_string_free(s: *mut c_char) {
        if !s.is_null() { drop(CString::from_raw(s)); }
    }
}
