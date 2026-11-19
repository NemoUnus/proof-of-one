// SPDX-License-Identifier: Apache-2.0
// Checks the phone's fingerprint code (src/fingerprint.rs) against the JavaScript reference
// on test vectors (document-circuit/scripts/fp-vectors.js), synthetic passports only:
//   fp-check <fp_helper.graph> <vectors.json>
// For each vector: round 1 with the vector's r gives its blinded points; a TEST-ONLY service
// with the vector's key answers; round 2 checks the DLEQ proofs and must give exactly the
// reference's π_doc inputs. A wrong proof and a wrong key must be refused.
use poo_native_prover::fingerprint as fp;
fn main() {
    let a: Vec<String> = std::env::args().collect();
    if a.len() != 3 { eprintln!("usage: fp-check <fp_helper.graph> <vectors.json>"); std::process::exit(2); }
    let g = std::fs::read(&a[1]).expect("graph");
    let vs: serde_json::Value = serde_json::from_str(&std::fs::read_to_string(&a[2]).expect("vectors")).expect("json");
    let mut bad = 0;
    for v in vs.as_array().unwrap() {
        let name = v["name"].as_str().unwrap();
        let dg1: Vec<u8> = (0..v["dg1"].as_str().unwrap().len() / 2).map(|i| u8::from_str_radix(&v["dg1"].as_str().unwrap()[2 * i..2 * i + 2], 16).unwrap()).collect();
        let path = v["path"].as_str().unwrap().parse::<u8>().unwrap();
        let dg13: Option<Vec<u8>> = v.get("dg13").and_then(|x| x.as_str()).map(|h| (0..h.len() / 2).map(|i| u8::from_str_radix(&h[2 * i..2 * i + 2], 16).unwrap()).collect());
        let tag = v.get("pnTag").and_then(|x| x.as_str()).map(|t| t.parse::<u32>().unwrap());
        let rule = match (&dg13, tag) { (Some(d), Some(t)) => Some((d.as_slice(), t)), _ => None };
        let prep = fp::prepare(&g, &dg1, 2026, path, rule, Some((v["pR"].as_str().unwrap(), v["dR"].as_str().unwrap()))).expect("prepare");
        let ans = fp::evaluate_for_tests(&g, v["k"].as_str().unwrap(), &prep["pB"], &prep["dB"]).expect("evaluate");
        let inp = fp::complete(&g, &prep, &ans["K"], &ans).expect("complete");
        let ok = inp == v["input"];
        if !ok { bad += 1; eprintln!("{name}: got {inp}\nwant {}", v["input"]); }
        // refusals
        let mut wrong = ans.clone();
        wrong["pS"] = serde_json::Value::String("1".into());
        let r1 = fp::complete(&g, &prep, &ans["K"], &wrong).is_err();
        let other = fp::evaluate_for_tests(&g, "12345", &prep["pB"], &prep["dB"]).unwrap();
        let r2 = fp::complete(&g, &prep, &ans["K"], &other).is_err();
        if !(r1 && r2) { bad += 1; }
        println!("{name}: {}; wrong proof refused: {r1}; answer from another key refused: {r2}", if ok { "identical to the reference" } else { "DIFFERENT" });
    }
    if bad > 0 { eprintln!("{bad} problem(s)"); std::process::exit(1); }
    println!("all identical");
}
