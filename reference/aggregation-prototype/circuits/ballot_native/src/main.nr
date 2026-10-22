// SPDX-License-Identifier: Apache-2.0
// Variant for size comparison only: the same statement as π_vote, but with the hash
// (Poseidon2) and curve (Grumpkin) that UltraHonk supports natively. Changing to these
// would change the ballot encryption and every hash in the protocol.
use poseidon::poseidon2::Poseidon2;
use std::embedded_curve_ops::{EmbeddedCurvePoint, EmbeddedCurveScalar, multi_scalar_mul, fixed_base_scalar_mul};

fn h<let N: u32>(x: [Field; N]) -> Field { Poseidon2::hash(x, N) }
fn merkle_root<let D: u32>(leaf: Field, sib: [Field; D], idx: [bool; D]) -> Field {
    let mut cur = leaf;
    for i in 0..D { cur = if idx[i] { h([sib[i], cur]) } else { h([cur, sib[i]]) }; }
    cur
}
fn main(
    poll_hash: pub Field, nf: pub Field, ca: pub [[Field; 2]; 4], cb: pub [[Field; 2]; 4],
    id_root: Field, rev_root: Field, poll_id: Field, pk: [Field; 2],
    min_age: u32, min_exp: u32, req_nat: Field, ctx: Field,
    s: EmbeddedCurveScalar, age: u32, sex: Field, nat: [Field; 3], exp: [u32; 3], sel: [bool; 3], salt: Field, rn: Field,
    id_sib: [Field; 32], id_idx: [bool; 32], low: Field, next: Field, rev_sib: [Field; 32], rev_idx: [bool; 32],
    v: [bool; 4], r: [EmbeddedCurveScalar; 4],
) {
    let p = fixed_base_scalar_mul(s);
    let idc = h([p.x, p.y]);
    let attr = h([age as Field, sex, nat[0], exp[0] as Field, nat[1], exp[1] as Field, nat[2], exp[2] as Field, salt]);
    assert(merkle_root(h([idc, attr, rn]), id_sib, id_idx) == id_root);
    assert(merkle_root(h([low, next]), rev_sib, rev_idx) == rev_root);
    assert(low.lt(rn));
    assert((next == 0) | rn.lt(next));
    assert(h([1, poll_id, s.lo, s.hi]) == nf);
    assert(age >= min_age);
    let mut nsel: Field = 0; let mut esel: u32 = 0; let mut count: u32 = 0;
    for d in 0..3 { if sel[d] { nsel = nat[d]; esel = exp[d]; count += 1; } }
    assert(count == 1); assert(nsel != 0); assert(esel >= min_exp); assert((req_nat == 0) | (nsel == req_nat));
    let pkp = EmbeddedCurvePoint { x: pk[0], y: pk[1] };
    let mut sum: u32 = 0;
    for j in 0..4 {
        sum += v[j] as u32;
        let a = fixed_base_scalar_mul(r[j]);
        assert((a.x == ca[j][0]) & (a.y == ca[j][1]));
        let rpk = multi_scalar_mul([pkp], [r[j]]);
        let g = fixed_base_scalar_mul(EmbeddedCurveScalar { lo: 1, hi: 0 });
        let b = if v[j] { rpk + g } else { rpk };
        assert((b.x == cb[j][0]) & (b.y == cb[j][1]));
    }
    assert(sum == 1);
    assert(h([7, h([id_root, rev_root, poll_id, pk[0], pk[1]]), h([min_age as Field, min_exp as Field, req_nat, ctx])]) == poll_hash);
}
