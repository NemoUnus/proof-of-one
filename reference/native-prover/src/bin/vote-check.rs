// SPDX-License-Identifier: Apache-2.0
// Check of the phone's ballot (ballot.rs), run by the Android workflow:
//   1. the identity path at the poll's snapshot and the non-revocation witness, rebuilt from
//      the published leaves and revocations, and π_vote's inputs give exactly the inputs of
//      ballot-circuit's buildBallot (scripts/vote-vector.js);
//   2. a revoked member, a leaf not in the named root, and an identity re-issued after the
//      poll opened (Decision #62) are refused;
//   3. the recorded answer is found from the contract's ballot hash alone (Decision #62);
//   4. the witness graph and the TEST-ONLY key prove the inputs, and the proof verifies.
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
    let nf = ballot::nullifier(&serde_json::json!({ "member": d["member"], "pollId": d["poll"]["pollId"] })).unwrap();
    if nf["nf"] != v["nf"] { eprintln!("nullifier op differs"); bad += 1; }
    if bad > 0 { std::process::exit(1); }
    println!("ballot inputs match buildBallot ({} fields; identity path at the snapshot of {} leaves)", want.as_object().unwrap().len(), id["n"]);
    let e1 = ballot::revocation_witness(&v["revokedMember"]).unwrap_err().to_string();
    let e2 = ballot::identity_path(&v["late"]).unwrap_err().to_string();
    let mut reissued = d.clone();
    reissued["attrs"]["notBefore"] = serde_json::json!((v["data"]["poll"]["openTime"].as_str().unwrap().parse::<u64>().unwrap() + 60).to_string());
    let e3 = ballot::ballot_input(&reissued).unwrap_err().to_string();
    println!("refused: revoked member ({e1}); a leaf not in the root named ({e2}); re-issued after the poll opened ({e3})");
    let rec = ballot::recorded_answer(&v["recorded"]).unwrap();
    let mut other = v["recorded"].clone(); other["ballotHash"] = serde_json::json!("00".repeat(28));
    let none = ballot::recorded_answer(&other).unwrap();
    println!("recorded answer found from the ballot hash alone: choice {}, revision {} (expected 2, 3); unknown ballot: {}", rec["choice"], rec["revision"], none["choice"]);
    if rec["choice"] != 2 || rec["revision"] != 3 || !none["choice"].is_null() || rec["ct"] != out["ct"] { std::process::exit(1); }
    let c = Circuit::load(&std::fs::read(&a[3]).unwrap(), std::fs::read(&a[2]).unwrap()).unwrap();
    let t = std::time::Instant::now();
    let (_, public, ok) = c.prove_checked(&got.to_string()).unwrap();
    let public: Vec<String> = serde_json::from_str(&public).unwrap();
    let expect_head: Vec<String> = ["pollHash", "nf", "idRoot"].iter().map(|k| got[*k].as_str().unwrap().to_string()).collect();
    println!("π_vote proved in {} ms; verified: {}; public signals start with pollHash, nf, idRoot: {}", t.elapsed().as_millis(), ok, public[..3] == expect_head[..]);
    if !ok || public[..3] != expect_head[..] { std::process::exit(1); }
}
