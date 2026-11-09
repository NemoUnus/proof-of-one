pragma circom 2.1.6;
// SPDX-License-Identifier: Apache-2.0
// Proof of One — tally proof π_tally (Decision Log #53; second-model review of whitepaper v1.0,
// finding 3). Reference circuit, TEST SETUP ONLY, not audited.
//
// Proves that the published counts are the correct decryption of the poll's encrypted totals:
// for t trustees and K options,
//   1. every partial decryption D_ij carries a valid Chaum–Pedersen proof (T1_ij, T2_ij, z_ij)
//      that log_G(PK_i) = log_{A_j}(D_ij), with the Fiat–Shamir challenge
//      c = Poseidon(2, pollId, j, G, PK_i, A_j, D_ij, T1_ij, T2_ij);
//   2. D_ij, T1_ij and T2_ij lie in the prime-order subgroup (each is 8 times a point the
//      prover supplies; 8·E is exactly that subgroup, identity included);
//   3. D_j = Σ λ_i·D_ij, with the Lagrange coefficients λ_i given by the contract;
//   4. B_j = D_j + count_j·G.
// The public inputs come from the contract: its own running totals (A_j, B_j), the trustee
// keys it committed at poll creation, the λ_i it computes from the trustee indices, and the
// counts and D_j being published. No secret is involved: anyone holding the published partial
// decryptions can make this proof. The trustees' DLEQ proofs must use the Poseidon challenge
// above (tally/src/protocol.js, option dleq: "poseidon").
include "../node_modules/circomlib/circuits/poseidon.circom";
include "../node_modules/circomlib/circuits/babyjub.circom";
include "../node_modules/circomlib/circuits/escalarmulfix.circom";
include "../node_modules/circomlib/circuits/escalarmulany.circom";
include "../node_modules/circomlib/circuits/bitify.circom";

function GX() { return 5299619240641551281634865583518297030282874472190772894086521144482721001553; }
function GY() { return 16950150798460657717958625567821834550301663161624707787222815936182638968203; }

// s·P for a scalar given as n bits and a variable point P (the identity is allowed).
template MulBits(n) {
    signal input bits[n];
    signal input p[2];
    signal output out[2];
    component m = EscalarMulAny(n);
    for (var i = 0; i < n; i++) m.e[i] <== bits[i];
    m.p[0] <== p[0];
    m.p[1] <== p[1];
    out[0] <== m.out[0];
    out[1] <== m.out[1];
}

// s·P for a scalar below 2^253.
template MulAny253() {
    signal input x;
    signal input p[2];
    signal output out[2];
    component b = Num2Bits(253);
    b.in <== x;
    component m = MulBits(253);
    for (var i = 0; i < 253; i++) m.bits[i] <== b.out[i];
    m.p[0] <== p[0];
    m.p[1] <== p[1];
    out[0] <== m.out[0];
    out[1] <== m.out[1];
}

// Q = 8·R for a point R on the curve, so Q lies in the prime-order subgroup.
template InSubgroup() {
    signal input q[2];
    signal input r[2];
    component on = BabyCheck();
    on.x <== r[0];
    on.y <== r[1];
    component d[3];
    for (var k = 0; k < 3; k++) {
        d[k] = BabyDbl();
        d[k].x <== k == 0 ? r[0] : d[k - 1].xout;
        d[k].y <== k == 0 ? r[1] : d[k - 1].yout;
    }
    d[2].xout === q[0];
    d[2].yout === q[1];
}

template Add() {
    signal input a[2];
    signal input b[2];
    signal output out[2];
    component s = BabyAdd();
    s.x1 <== a[0]; s.y1 <== a[1];
    s.x2 <== b[0]; s.y2 <== b[1];
    out[0] <== s.xout;
    out[1] <== s.yout;
}

// One Chaum–Pedersen proof: z·G = T1 + c·PK and z·A = T2 + c·D.
template Dleq() {
    signal input pollId;
    signal input j;
    signal input PK[2];
    signal input A[2];
    signal input D[2];
    signal input T1[2];
    signal input T2[2];
    signal input z;

    component h = Poseidon(15);
    var ins[15] = [2, pollId, j, GX(), GY(), PK[0], PK[1], A[0], A[1], D[0], D[1], T1[0], T1[1], T2[0], T2[1]];
    for (var k = 0; k < 15; k++) h.inputs[k] <== ins[k];
    component cb = Num2Bits_strict();   // the challenge as an integer below the field modulus
    cb.in <== h.out;

    component zb = Num2Bits(253);
    zb.in <== z;
    component zG = EscalarMulFix(253, [GX(), GY()]);
    for (var k = 0; k < 253; k++) zG.e[k] <== zb.out[k];
    component zA = MulBits(253);
    for (var k = 0; k < 253; k++) zA.bits[k] <== zb.out[k];
    zA.p[0] <== A[0]; zA.p[1] <== A[1];

    component cPK = MulBits(254);
    component cD = MulBits(254);
    for (var k = 0; k < 254; k++) { cPK.bits[k] <== cb.out[k]; cD.bits[k] <== cb.out[k]; }
    cPK.p[0] <== PK[0]; cPK.p[1] <== PK[1];
    cD.p[0] <== D[0]; cD.p[1] <== D[1];

    component r1 = Add(); r1.a[0] <== T1[0]; r1.a[1] <== T1[1]; r1.b[0] <== cPK.out[0]; r1.b[1] <== cPK.out[1];
    component r2 = Add(); r2.a[0] <== T2[0]; r2.a[1] <== T2[1]; r2.b[0] <== cD.out[0]; r2.b[1] <== cD.out[1];
    zG.out[0] === r1.out[0];
    zG.out[1] === r1.out[1];
    zA.out[0] === r2.out[0];
    zA.out[1] === r2.out[1];
}

template Tally(t, K) {
    // public
    signal input pollId;
    signal input A[K][2];
    signal input B[K][2];
    signal input counts[K];
    signal input PK[t][2];
    signal input lambda[t];
    signal input D[K][2];
    // private: the trustees' partial decryptions and proofs, and the points R with Q = 8·R
    signal input Dij[t][K][2];
    signal input T1[t][K][2];
    signal input T2[t][K][2];
    signal input z[t][K];
    signal input Dr[t][K][2];
    signal input T1r[t][K][2];
    signal input T2r[t][K][2];

    component dl[t][K];
    component sub[t][K][3];
    component lam[t][K];
    component acc[t][K];
    for (var j = 0; j < K; j++) {
        for (var i = 0; i < t; i++) {
            sub[i][j][0] = InSubgroup(); sub[i][j][0].q <== Dij[i][j]; sub[i][j][0].r <== Dr[i][j];
            sub[i][j][1] = InSubgroup(); sub[i][j][1].q <== T1[i][j]; sub[i][j][1].r <== T1r[i][j];
            sub[i][j][2] = InSubgroup(); sub[i][j][2].q <== T2[i][j]; sub[i][j][2].r <== T2r[i][j];

            dl[i][j] = Dleq();
            dl[i][j].pollId <== pollId;
            dl[i][j].j <== j;
            dl[i][j].PK <== PK[i];
            dl[i][j].A <== A[j];
            dl[i][j].D <== Dij[i][j];
            dl[i][j].T1 <== T1[i][j];
            dl[i][j].T2 <== T2[i][j];
            dl[i][j].z <== z[i][j];

            lam[i][j] = MulAny253();
            lam[i][j].x <== lambda[i];
            lam[i][j].p <== Dij[i][j];
            acc[i][j] = Add();
            if (i == 0) { acc[i][j].a[0] <== 0; acc[i][j].a[1] <== 1; }
            else acc[i][j].a <== acc[i - 1][j].out;
            acc[i][j].b <== lam[i][j].out;
        }
    }
    component cnt[K];
    component cntG[K];
    component sumB[K];
    for (var j = 0; j < K; j++) {
        acc[t - 1][j].out[0] === D[j][0];
        acc[t - 1][j].out[1] === D[j][1];
        cnt[j] = Num2Bits(32);
        cnt[j].in <== counts[j];
        cntG[j] = EscalarMulFix(32, [GX(), GY()]);
        for (var k = 0; k < 32; k++) cntG[j].e[k] <== cnt[j].out[k];
        sumB[j] = Add();
        sumB[j].a <== D[j];
        sumB[j].b <== cntG[j].out;
        sumB[j].out[0] === B[j][0];
        sumB[j].out[1] === B[j][1];
    }
}

component main {public [pollId, A, B, counts, PK, lambda, D]} = Tally(3, 4);
