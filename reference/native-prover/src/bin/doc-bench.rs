// SPDX-License-Identifier: Apache-2.0
// Usage: doc-bench <pk_c.bin> <matrices.gz> <witness.wtns>   (π_doc, TEST-ONLY random setup; N31)
use std::time::Instant;
fn main() -> Result<(), poo_native_prover::Error> {
    let a: Vec<String> = std::env::args().collect();
    let t = Instant::now();
    let c = poo_native_prover::ArkCircuit::load(&std::fs::read(&a[1])?, &std::fs::read(&a[2])?)?;
    println!("load {:.1} s, peak {} MB", t.elapsed().as_secs_f64(), poo_native_prover::peak_mb());
    let w = std::fs::read(&a[3])?;
    for i in 1..=2 {
        let t = Instant::now();
        let ok = c.prove_wtns(&w)?;
        println!("run {i}: prove {:.2} s, verified {ok}, peak {} MB", t.elapsed().as_secs_f64(), poo_native_prover::peak_mb());
    }
    Ok(())
}
