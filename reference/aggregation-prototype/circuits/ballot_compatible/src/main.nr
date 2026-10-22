// SPDX-License-Identifier: Apache-2.0
// Proof of One — ballot proof π_vote, Noir port for size measurement (prototype).
// Same statement as reference/ballot-circuit/circuits/ballot.circom (Decision #30 version).
use poseidon::poseidon::bn254::{hash_2, hash_3, hash_4, hash_5, hash_9};

global GX: Field = 5299619240641551281634865583518297030282874472190772894086521144482721001553;
global GY: Field = 16950150798460657717958625567821834550301663161624707787222815936182638968203;

global A: Field = 168700;
global DD: Field = 168696;

// Baby Jubjub (twisted Edwards) in affine coordinates: plain double-and-add over 254 bits.
// Not optimised (no fixed-base windowing); the size measured is therefore an upper bound.
struct Point { x: Field, y: Field }
fn add(p: Point, q: Point) -> Point {
    let t = DD * p.x * q.x * p.y * q.y;
    Point { x: (p.x * q.y + p.y * q.x) / (1 + t), y: (p.y * q.y - A * p.x * q.x) / (1 - t) }
}
fn mul(n: Field, p: Point) -> Point {
    let bits: [bool; 254] = n.to_le_bits();
    let mut acc = Point { x: 0, y: 1 };
    for k in 0..254 {
        let i = 253 - k;
        acc = add(acc, acc);
        if bits[i] { acc = add(acc, p); }
    }
    acc
}

fn merkle_root<let D: u32>(leaf: Field, sib: [Field; D], idx: [bool; D]) -> Field {
    let mut cur = leaf;
    for i in 0..D {
        let (l, r) = if idx[i] { (sib[i], cur) } else { (cur, sib[i]) };
        cur = hash_2([l, r]);
    }
    cur
}

fn main(
    poll_hash: pub Field, nf: pub Field, ca: pub [[Field; 2]; 4], cb: pub [[Field; 2]; 4],
    id_root: Field, rev_root: Field, poll_id: Field, pk: [Field; 2],
    min_age: u32, min_exp: u32, req_nat: Field, ctx: Field,
    s: Field, age: u32, sex: Field, nat: [Field; 3], exp: [u32; 3], sel: [bool; 3], salt: Field, rn: Field,
    id_sib: [Field; 32], id_idx: [bool; 32],
    low: Field, next: Field, rev_sib: [Field; 32], rev_idx: [bool; 32],
    v: [bool; 4], r: [Field; 4],
) {
    let g = Point { x: GX, y: GY };
    // 1. identity
    let p = mul(s, g);
    let idc = hash_2([p.x, p.y]);
    // 2. membership
    let attr = hash_9([age as Field, sex, nat[0], exp[0] as Field, nat[1], exp[1] as Field, nat[2], exp[2] as Field, salt]);
    let leaf = hash_3([idc, attr, rn]);
    assert(merkle_root(leaf, id_sib, id_idx) == id_root);
    // 3. not revoked
    assert(merkle_root(hash_2([low, next]), rev_sib, rev_idx) == rev_root);
    assert(low.lt(rn));
    assert((next == 0) | rn.lt(next));
    // 4. nullifier
    assert(hash_3([1, poll_id, s]) == nf);
    // 5. eligibility with one privately selected document
    assert(age >= min_age);
    let mut nsel: Field = 0; let mut esel: u32 = 0; let mut count: u32 = 0;
    for d in 0..3 { if sel[d] { nsel = nat[d]; esel = exp[d]; count += 1; } }
    assert(count == 1);
    assert(nsel != 0);
    assert(esel >= min_exp);
    assert((req_nat == 0) | (nsel == req_nat));
    // 6–7. one-hot ballot, encrypted
    let pkp = Point { x: pk[0], y: pk[1] };
    let mut sum: u32 = 0;
    for j in 0..4 {
        sum += (v[j] as u32);
        let a = mul(r[j], g);
        assert((a.x == ca[j][0]) & (a.y == ca[j][1]));
        let rpk = mul(r[j], pkp);
        let b = if v[j] { add(g, rpk) } else { rpk };
        assert((b.x == cb[j][0]) & (b.y == cb[j][1]));
    }
    assert(sum == 1);
    // 8–9. pollHash
    let h1 = hash_5([id_root, rev_root, poll_id, pk[0], pk[1]]);
    let h2 = hash_4([min_age as Field, min_exp as Field, req_nat, ctx]);
    assert(hash_3([7, h1, h2]) == poll_hash);
}
