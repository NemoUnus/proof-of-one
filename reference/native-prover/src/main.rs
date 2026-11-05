// SPDX-License-Identifier: Apache-2.0
// Usage: poo-prove <circuit.graph> <circuit.zkey> <inputs.json> <proof.json> <public.json> [runs]
// Times witness and proof separately; the output files are in snarkjs's format.
use std::time::Instant;
fn main() -> Result<(), poo_native_prover::Error> {
    let a: Vec<String> = std::env::args().collect();
    if a.len() < 6 { eprintln!("usage: poo-prove graph zkey inputs.json proof.json public.json [runs]"); std::process::exit(2); }
    let runs: usize = a.get(6).map(|s| s.parse().unwrap()).unwrap_or(1);
    let t = Instant::now();
    let c = poo_native_prover::Circuit::load(&std::fs::read(&a[2])?, std::fs::read(&a[1])?)?;
    println!("load: {:.2} s", t.elapsed().as_secs_f64());
    let inputs = std::fs::read_to_string(&a[3])?;
    let mut out = (String::new(), String::new());
    for i in 0..runs {
        let t = Instant::now();
        c.witness(&inputs)?;
        let tw = t.elapsed().as_secs_f64();
        let t = Instant::now();
        out = c.prove(&inputs)?;
        println!("run {}: witness {:.3} s, witness+proof {:.2} s", i + 1, tw, t.elapsed().as_secs_f64());
    }
    std::fs::write(&a[4], &out.0)?;
    std::fs::write(&a[5], &out.1)?;
    Ok(())
}
