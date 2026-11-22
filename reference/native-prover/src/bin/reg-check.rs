// SPDX-License-Identifier: Apache-2.0
// Check of the phone's π_reg path (Decision #61), run by the Android workflow:
//   1. registration_input (member.rs), as the app calls it with member.json and the key set,
//      gives exactly the inputs of enrolment.js buildRegistration (scripts/reg-vector.js);
//   2. the witness graph and the TEST-ONLY key prove them, and the proof verifies, with
//      public signals [leaf, cn, keySetRoot].
// Usage: reg-check <reg-vector.json> <registration.graph> <registration_test.zkey>
use poo_native_prover::{member::registration_input, Circuit};

fn main() {
    let a: Vec<String> = std::env::args().collect();
    if a.len() != 4 { eprintln!("usage: reg-check <reg-vector.json> <registration.graph> <registration_test.zkey>"); std::process::exit(2); }
    let v: serde_json::Value = serde_json::from_str(&std::fs::read_to_string(&a[1]).unwrap()).unwrap();
    let out = registration_input(&v["data"]).unwrap();
    let (got, want) = (&out["input"], &v["input"]);
    let mut bad = 0;
    for (k, w) in want.as_object().unwrap() {
        if &got[k] != w { eprintln!("input {} differs: {} vs {}", k, got[k], w); bad += 1; }
    }
    if got.as_object().unwrap().len() != want.as_object().unwrap().len() { eprintln!("different input fields"); bad += 1; }
    if bad > 0 { std::process::exit(1); }
    println!("registration inputs match buildRegistration ({} fields)", want.as_object().unwrap().len());
    let c = Circuit::load(&std::fs::read(&a[3]).unwrap(), std::fs::read(&a[2]).unwrap()).unwrap();
    let t = std::time::Instant::now();
    let (_, public, ok) = c.prove_checked(&got.to_string()).unwrap();
    let public: Vec<String> = serde_json::from_str(&public).unwrap();
    let expect = vec![out["leaf"].as_str().unwrap().to_string(), out["cn"].as_str().unwrap().to_string(), want["keySetRoot"].as_str().unwrap().to_string()];
    println!("π_reg proved in {} ms; verified: {}; public signals as expected: {}", t.elapsed().as_millis(), ok, public == expect);
    if !ok || public != expect { std::process::exit(1); }
}
