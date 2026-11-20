// SPDX-License-Identifier: Apache-2.0
// π_doc from circuit inputs, as the phone app does it (challenge 2), on a computer:
//   doc-prove <pk_c.bin> <matrices.gz> <document_s2.graph> <dsc_test_tree_s2.graph> <inputs.json>
// Inputs without `dscRoot` get the TEST-ONLY one-signer tree. TEST-ONLY keys.
fn main() {
    let a: Vec<String> = std::env::args().collect();
    if a.len() != 6 { eprintln!("usage: doc-prove <pk_c.bin> <matrices.gz> <graph> <tree_graph> <inputs.json>"); std::process::exit(2); }
    let inputs = std::fs::read_to_string(&a[5]).expect("inputs");
    let (inputs, test_tree) = poo_native_prover::with_test_tree(&std::fs::read(&a[4]).expect("tree graph"), &inputs).expect("test tree");
    let t = std::time::Instant::now();
    let cache = format!("{}.raw", a[1]);
    let c = poo_native_prover::ArkCircuit::load_cached(&a[1], &a[2], &cache).expect("key");
    let load = t.elapsed().as_millis();
    let g = std::fs::read(&a[3]).expect("graph");
    match c.prove_inputs(&g, &inputs) {
        Ok((public, ok, wms, pms, proof)) => println!("{}", serde_json::json!({ "verified": ok, "public": public, "proof": proof, "testTree": test_tree, "loadMs": load as u64, "witnessMs": wms as u64, "proveMs": pms as u64, "peakMb": poo_native_prover::peak_mb() })),
        Err(e) => { println!("{}", serde_json::json!({ "error": e.to_string() })); std::process::exit(1); }
    }
}
