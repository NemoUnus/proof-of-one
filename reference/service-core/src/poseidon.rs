// SPDX-License-Identifier: Apache-2.0
// Poseidon over BN254 with circomlib's parameters, in the optimized form of circomlibjs's
// poseidon_opt.js (sparse matrices in the partial rounds, after Neptune), 1 to 16 inputs.
// Constants: poseidon_opt.bin (scripts/poseidon-constants.cjs). Checked against
// circomlibjs in ../enrol-service/test/core.test.mjs.
use ark_bn254::Fr;
use ark_ff::{PrimeField, Zero};
use std::cell::RefCell;
use std::collections::HashMap;

const BIN: &[u8] = include_bytes!("poseidon_opt.bin");
const NP: [usize; 16] = [56, 57, 56, 60, 60, 63, 64, 63, 60, 66, 60, 65, 70, 60, 64, 68];
const NF: usize = 8;

struct Params { c: Vec<Fr>, s: Vec<Fr>, m: Vec<Vec<Fr>>, p: Vec<Vec<Fr>> }

fn params(t: usize) -> Params {
    let mut off = 0usize;
    let mut take = |n: usize| -> Vec<Fr> {
        let v = (0..n).map(|i| Fr::from_be_bytes_mod_order(&BIN[off + 32 * i..off + 32 * (i + 1)])).collect();
        off += 32 * n;
        v
    };
    for w in 2..=17usize {
        let np = NP[w - 2];
        let c = take(NF * w + np);
        let s = take((2 * w - 1) * np);
        let m = take(w * w);
        let p = take(w * w);
        if w == t {
            let rows = |v: Vec<Fr>| v.chunks(w).map(|r| r.to_vec()).collect();
            return Params { c, s, m: rows(m), p: rows(p) };
        }
    }
    unreachable!()
}

thread_local! { static CACHE: RefCell<HashMap<usize, std::rc::Rc<Params>>> = RefCell::new(HashMap::new()); }

#[inline(always)]
fn pow5(a: Fr) -> Fr { let a2 = a * a; a2 * a2 * a }
// state ← state · X, with X[j][i] (as circomlibjs: new[i] = Σ_j X[j][i]·state[j])
fn mix(state: &[Fr], x: &[Vec<Fr>]) -> Vec<Fr> {
    (0..state.len()).map(|i| state.iter().enumerate().fold(Fr::zero(), |acc, (j, a)| acc + x[j][i] * a)).collect()
}

pub fn hash(inputs: &[Fr]) -> Result<Fr, String> {
    if inputs.is_empty() || inputs.len() > 16 { return Err(format!("Poseidon takes 1 to 16 inputs, not {}", inputs.len())); }
    let t = inputs.len() + 1;
    let k = CACHE.with(|c| c.borrow_mut().entry(t).or_insert_with(|| std::rc::Rc::new(params(t))).clone());
    let np = NP[t - 2];
    let mut st: Vec<Fr> = std::iter::once(Fr::zero()).chain(inputs.iter().copied()).collect();
    for (i, a) in st.iter_mut().enumerate() { *a += k.c[i]; }
    for r in 0..NF / 2 - 1 {
        for (i, a) in st.iter_mut().enumerate() { *a = pow5(*a) + k.c[(r + 1) * t + i]; }
        st = mix(&st, &k.m);
    }
    for (i, a) in st.iter_mut().enumerate() { *a = pow5(*a) + k.c[(NF / 2) * t + i]; }
    st = mix(&st, &k.p);
    for r in 0..np {
        st[0] = pow5(st[0]) + k.c[(NF / 2 + 1) * t + r];
        let base = (2 * t - 1) * r;
        let s0 = st.iter().enumerate().fold(Fr::zero(), |acc, (j, a)| acc + k.s[base + j] * a);
        let x0 = st[0];
        for j in 1..t { st[j] += x0 * k.s[base + t + j - 1]; }
        st[0] = s0;
    }
    for r in 0..NF / 2 - 1 {
        for (i, a) in st.iter_mut().enumerate() { *a = pow5(*a) + k.c[(NF / 2 + 1) * t + np + r * t + i]; }
        st = mix(&st, &k.m);
    }
    for a in st.iter_mut() { *a = pow5(*a); }
    Ok(mix(&st, &k.m)[0])
}
