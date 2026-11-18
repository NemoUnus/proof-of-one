// SPDX-License-Identifier: Apache-2.0
// Proof of One — keyed document fingerprint (OPRF over Baby Jubjub) inside π_doc
// (reference, NOT for production use). Specification:
// docs/specs/document-fingerprint-oprf-v0.1.md; JavaScript reference: src/fingerprint.js.
// Decision Log #43, #47 and #58.
//
// For a tag and five values taken from the signed DG1, KeyedFingerprint proves:
//   x = HashToCurve(tag, values)          (deterministic, see HashToBabyJub)
//   B = r·x                               (B public: what the phone sent the service)
//   Z = r·W, W = 8·V                      (Z public: the service's answer k·B; W = k·x)
//   F = Poseidon(DST_F, x, W)             (output: the keyed fingerprint)
// with r odd and 0 < r < ℓ. W is forced into the prime-order subgroup (W = 8·V) and r
// is invertible modulo 8ℓ, so Z = r·W has exactly one solution W = r⁻¹·Z = k·x: the
// prover cannot get a second fingerprint for the same values.
//
// Hints (as for the RSA check, so that a witness graph can evaluate everything): the
// square roots and branch bits of the Elligator 2 maps are private inputs, and every one
// is checked here.
pragma circom 2.1.6;
include "circomlib/circuits/poseidon.circom";
include "circomlib/circuits/bitify.circom";
include "circomlib/circuits/comparators.circom";
include "circomlib/circuits/babyjub.circom";
include "circomlib/circuits/escalarmulany.circom";

// Elligator 2 on the Montgomery form of Baby Jubjub, v² = u³ + A·u² + u (A = 168698),
// with Z = 5 (a non-square), then to twisted Edwards: x = u/v, y = (u−1)/(u+1).
//   u1 = −A / (1 + Z·t²);  e = 1 if g(u1) is a square, else 0;  u = e ? u1 : −u1 − A
//   v² = g(u), with v odd exactly when e = 1.
// Exactly one of g(u1) and g(−u1 − A) is a square (t ≠ 0), so v² = g(u) also forces e;
// the parity rule fixes the sign of v. The result is a function of t.
template Elligator2Map() {
    signal input t;
    signal input v;     // hint: the square root
    signal input e;     // hint: the branch
    signal output out[2];
    var A = 168698;

    signal den;
    den <== 1 + 5 * t * t;
    signal u1;
    u1 <-- -A / den;
    u1 * den === -A;            // den = 0 cannot satisfy this, as A ≠ 0
    e * (e - 1) === 0;
    signal eu;
    eu <== e * (2 * u1 + A);
    signal u;
    u <== eu - u1 - A;          // e = 1: u1;  e = 0: −u1 − A
    signal u2;
    u2 <== u * u;
    signal u3;
    u3 <== u2 * u;
    v * v === u3 + A * u2 + u;
    component vb = Num2Bits_strict();
    vb.in <== v;
    vb.out[0] === e;

    // to twisted Edwards; v ≠ 0 and u + 1 ≠ 0 are checked by their inverses
    signal vi;
    vi <-- 1 / v;
    vi * v === 1;
    signal ui;
    ui <-- 1 / (u + 1);
    ui * (u + 1) === 1;
    out[0] <== u * vi;
    out[1] <== (u - 1) * ui;
}

// HashToCurve(tag, vals) = 8·(map(t0) + map(t1)), t_i = Poseidon(DST_H2C, tag, vals, i).
template HashToBabyJub() {
    signal input tag;
    signal input vals[5];
    signal input v[2];
    signal input e[2];
    signal output out[2];
    var DST_H2C = 30094232237006380571442476825519183475862119910307377; // "PoO-fingerprint-h2c-v1"

    component h[2];
    component m[2];
    for (var i = 0; i < 2; i++) {
        h[i] = Poseidon(8);
        h[i].inputs[0] <== DST_H2C;
        h[i].inputs[1] <== tag;
        for (var j = 0; j < 5; j++) h[i].inputs[2 + j] <== vals[j];
        h[i].inputs[7] <== i;
        m[i] = Elligator2Map();
        m[i].t <== h[i].out;
        m[i].v <== v[i];
        m[i].e <== e[i];
    }
    component s = BabyAdd();
    s.x1 <== m[0].out[0]; s.y1 <== m[0].out[1];
    s.x2 <== m[1].out[0]; s.y2 <== m[1].out[1];
    component d[3];
    for (var i = 0; i < 3; i++) d[i] = BabyDbl();
    d[0].x <== s.xout; d[0].y <== s.yout;
    d[1].x <== d[0].xout; d[1].y <== d[0].yout;
    d[2].x <== d[1].xout; d[2].y <== d[1].yout;
    out[0] <== d[2].xout;
    out[1] <== d[2].yout;
}

// 8·V, so the result is in the prime-order subgroup.
template TimesEight() {
    signal input in[2];
    signal output out[2];
    component d[3];
    for (var i = 0; i < 3; i++) d[i] = BabyDbl();
    d[0].x <== in[0]; d[0].y <== in[1];
    d[1].x <== d[0].xout; d[1].y <== d[0].yout;
    d[2].x <== d[1].xout; d[2].y <== d[1].yout;
    out[0] <== d[2].xout;
    out[1] <== d[2].yout;
}

template KeyedFingerprint() {
    signal input tag;
    signal input vals[5];
    signal input v[2];          // hints of the two maps
    signal input e[2];
    signal input r;             // blinding scalar: odd, 0 < r < ℓ
    signal input V[2];          // W = 8·V = k·x (the phone computes W = r⁻¹·Z and V = 8⁻¹·W)
    signal input B[2];          // r·x, sent to the service
    signal input Z[2];          // k·B, the service's answer
    signal output F;
    var L = 2736030358979909402780800718157159386076813972158567259200215660948447373041;
    var DST_F = 459201541702367867606238965233141837704844899889; // "PoO-fingerprint-F-v1"

    component x = HashToBabyJub();
    x.tag <== tag;
    x.vals <== vals;
    x.v <== v;
    x.e <== e;

    component rb = Num2Bits(251);
    rb.in <== r;
    rb.out[0] === 1;
    component rl = LessThan(251);
    rl.in[0] <== r;
    rl.in[1] <== L;
    rl.out === 1;

    component bx = EscalarMulAny(251);
    bx.e <== rb.out;
    bx.p <== x.out;
    bx.out[0] === B[0];
    bx.out[1] === B[1];

    component vc = BabyCheck();
    vc.x <== V[0]; vc.y <== V[1];
    component w = TimesEight();
    w.in <== V;
    component zw = EscalarMulAny(251);
    zw.e <== rb.out;
    zw.p <== w.out;
    zw.out[0] === Z[0];
    zw.out[1] === Z[1];

    component f = Poseidon(5);
    f.inputs[0] <== DST_F;
    f.inputs[1] <== x.out[0];
    f.inputs[2] <== x.out[1];
    f.inputs[3] <== w.out[0];
    f.inputs[4] <== w.out[1];
    F <== f.out;
}

// The two keys of a TD3 passport (Decision #47), from the MRZ inside the signed DG1.
//   person key (tag = path): path 1, personal number: (nationality, personal number, 0, birth day, sex)
//                            path 2, name:            (nationality, name[0..31), name[31..39), birth day, sex)
//   document key (tag 3):    (issuing state, document number, 0, 0, 0)
// The path is a public input: the service accepts only the path its rules give for the
// issuing state (output `issuer`), so a person cannot pick a second path.
template DocumentKeys() {
    signal input dg1[128];      // DG1 bytes (each already range-checked as a byte by the DG1 hash)
    signal input natCode;
    signal input birthDay;
    signal input sexCode;
    signal input path;          // public: 1 or 2
    signal input pV[2]; signal input pE[2]; signal input pR; signal input pVw[2]; signal input pB[2]; signal input pZ[2];
    signal input dV[2]; signal input dE[2]; signal input dR; signal input dVw[2]; signal input dB[2]; signal input dZ[2];
    signal output personKey;
    signal output documentKey;
    signal output issuer;

    var L1 = 5;
    var L2 = 5 + 44;
    var name0 = 0;
    for (var i = 0; i < 31; i++) name0 = name0 * 256 + dg1[L1 + 5 + i];
    var name1 = 0;
    for (var i = 31; i < 39; i++) name1 = name1 * 256 + dg1[L1 + 5 + i];
    var pn = 0;
    for (var i = 0; i < 14; i++) pn = pn * 256 + dg1[L2 + 28 + i];
    var docNo = 0;
    for (var i = 0; i < 9; i++) docNo = docNo * 256 + dg1[L2 + i];
    issuer <== dg1[L1 + 2] * 65536 + dg1[L1 + 3] * 256 + dg1[L1 + 4];

    signal sel;                 // 0: path 1, 1: path 2
    sel <== path - 1;
    sel * (sel - 1) === 0;
    signal a;
    a <== pn + sel * (name0 - pn);
    signal b;
    b <== sel * name1;

    component pk = KeyedFingerprint();
    pk.tag <== path;
    pk.vals[0] <== natCode; pk.vals[1] <== a; pk.vals[2] <== b; pk.vals[3] <== birthDay; pk.vals[4] <== sexCode;
    pk.v <== pV; pk.e <== pE; pk.r <== pR; pk.V <== pVw; pk.B <== pB; pk.Z <== pZ;
    personKey <== pk.F;

    component dk = KeyedFingerprint();
    dk.tag <== 3;
    dk.vals[0] <== issuer; dk.vals[1] <== docNo; dk.vals[2] <== 0; dk.vals[3] <== 0; dk.vals[4] <== 0;
    dk.v <== dV; dk.e <== dE; dk.r <== dR; dk.V <== dVw; dk.B <== dB; dk.Z <== dZ;
    documentKey <== dk.F;
}
