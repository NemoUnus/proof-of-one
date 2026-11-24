// SPDX-License-Identifier: Apache-2.0
// Check of the phone's ballot (ballot.rs), run by the Android workflow:
//   1. the identity path at the poll's snapshot and the non-revocation witness, rebuilt from
//      the published leaves and revocations, and π_vote's inputs give exactly the inputs of
//      ballot-circuit's buildBallot (scripts/vote-vector.js);
//   2. a revoked member and a member who joined after the poll opened are refused;
//   3. the witness graph and the TEST-ONLY key prove the inputs, and the proof verifies.
// Usage: vote-check <vote-vector.json> <ballot.graph> <ballot_test.zkey>
use poo_native_prover::{ballot, Circuit};

fn main() {
    let a: Vec<String> = std::env::args().collect();
    if a.len() != 4 { eprintln!("usage: vote-check <vote-vector.json> <ballot.graph> <ballot_test.zkey>"); std::process::exit(2); }
    let v: serde_json::Value = serde_json::from_str(&std::fs::read_to_string(&a[1]).unwrap()).unwrap();
    let id = ballot::identity_path(&v["tree"]).unwrap();
    let rev = ballot::revocation_witness(&v["revocation"]).unwrap();
    let mut d = v["data"].clone();
    d["idPath"] = id.clone(); d["rev"] = rev;
    let out = ballot::ballot_input(&d).unwrap();
    let (got, want) = (&out["input"], &v["input"]);
    let mut bad = 0;
    for (k, w) in want.as_object().unwrap() {
        if &got[k] != w { eprintln!("input {} differs:\n  {}\n  {}", k, got[k], w); bad += 1; }
    }
    if got.as_object().unwrap().len() != want.as_object().unwrap().len() { eprintln!("different input fields"); bad += 1; }
    if out["nf"] != v["nf"] { eprintln!("nullifier differs"); bad += 1; }
    if bad > 0 { std::process::exit(1); }
    println!("ballot inputs match buildBallot ({} fields; identity path at the snapshot of {} leaves)", want.as_object().unwrap().len(), id["n"]);
    let e1 = ballot::revocation_witness(&v["revokedMember"]).unwrap_err().to_string();
    let e2 = ballot::identity_path(&v["late"]).unwrap_err().to_string();
    println!("refused: revoked member ({e1}); member registered after the poll opened ({e2})");
    let c = Circuit::load(&std::fs::read(&a[3]).unwrap(), std::fs::read(&a[2]).unwrap()).unwrap();
    let t = std::time::Instant::now();
    let (_, public, ok) = c.prove_checked(&got.to_string()).unwrap();
    let public: Vec<String> = serde_json::from_str(&public).unwrap();
    let expect_head = vec![got["pollHash"].as_str().unwrap().to_string(), got["nf"].as_str().unwrap().to_string()];
    println!("π_vote proved in {} ms; verified: {}; public signals start with pollHash, nf: {}", t.elapsed().as_millis(), ok, public[..2] == expect_head[..]);
    if !ok || public[..2] != expect_head[..] { std::process::exit(1); }
}
