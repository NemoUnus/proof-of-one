// SPDX-License-Identifier: Apache-2.0
// Proof of One — RSA PKCS#1 v1.5 signature check for any digest and any public exponent
// below 2^EBITS (reference, NOT for production use).
//
// Generalises RSAVerifier65537 and RSAPad from @zk-email/circuits (MIT): same limb
// representation (k limbs of n bits, least significant first), same padding logic,
// but with the DigestInfo prefix and digest length as parameters and the exponent as
// a private input. The exponent must be bound elsewhere (π_doc binds it in the leaf of
// the tree of checked signers), otherwise a prover could choose it.
//
// Hints (since v0.2, N31): the quotient and remainder of every modular multiplication are
// private inputs instead of values computed inside the witness generator. The constraints
// are those of zk-email's FpMul; q and r are range-checked and r < p, so for given a and b
// they are unique, and whoever computes them (the phone's own code) cannot change the
// result. This lets a witness graph (circom-witnesscalc) evaluate the whole circuit: its
// compiler cannot run long_div, whose loops depend on signal values.

pragma circom 2.1.6;

include "circomlib/circuits/bitify.circom";
include "circomlib/circuits/comparators.circom";
include "@zk-email/circuits/lib/fp.circom"; // poly_eval, poly_interp, BigLessThan, CheckCarryToZero

// The number of modular multiplications, and so of hints, for EBITS (0: e = 65537).
function rsaMuls(EBITS) {
    if (EBITS == 0) return 17;
    return 2 * EBITS;
}

// a·b mod p as zk-email's FpMul, with the quotient q and remainder r given as inputs.
// Checks a·b = p·q + r as polynomials (carry to zero), q and r in proper n-bit limbs,
// r < p. The caller must give a, b < p in proper form (true for the chains below).
template FpMulHinted(n, k) {
    assert(n + n + log_ceil(k) + 2 <= 252);
    signal input a[k];
    signal input b[k];
    signal input p[k];
    signal input q[k];
    signal input r[k];
    signal output out[k];

    signal v_ab[2 * k - 1];
    for (var x = 0; x < 2 * k - 1; x++) {
        var v_a = poly_eval(k, a, x);
        var v_b = poly_eval(k, b, x);
        v_ab[x] <== v_a * v_b;
    }
    component qRange[k];
    component rRange[k];
    component rLt = BigLessThan(n, k);
    for (var i = 0; i < k; i++) {
        qRange[i] = Num2Bits(n);
        qRange[i].in <== q[i];
        rRange[i] = Num2Bits(n);
        rRange[i].in <== r[i];
        rLt.a[i] <== r[i];
        rLt.b[i] <== p[i];
    }
    rLt.out === 1;
    signal v_pq_r[2 * k - 1];
    for (var x = 0; x < 2 * k - 1; x++) {
        var v_p = poly_eval(k, p, x);
        var v_q = poly_eval(k, q, x);
        var v_r = poly_eval(k, r, x);
        v_pq_r[x] <== v_p * v_q + v_r;
    }
    signal v_t[2 * k - 1];
    for (var x = 0; x < 2 * k - 1; x++) v_t[x] <== v_ab[x] - v_pq_r[x];
    var t[200] = poly_interp(2 * k - 1, v_t);
    component tCheck = CheckCarryToZero(n, n + n + log_ceil(k) + 2, 2 * k - 1);
    for (var i = 0; i < 2 * k - 1; i++) tCheck.in[i] <== t[i];
    for (var i = 0; i < k; i++) out[i] <== r[i];
}

// base^65537 mod modulus: 16 squarings, then one multiplication by base (as zk-email's
// FpPow65537Mod). Hints 0–15: the squarings; hint 16: the final multiplication.
template FpPow65537Hinted(n, k) {
    signal input base[k];
    signal input modulus[k];
    signal input hq[17][k];
    signal input hr[17][k];
    signal output out[k];
    component m[17];
    for (var i = 0; i < 17; i++) {
        m[i] = FpMulHinted(n, k);
        m[i].p <== modulus;
        m[i].q <== hq[i];
        m[i].r <== hr[i];
    }
    m[0].a <== base;
    m[0].b <== base;
    for (var i = 1; i < 16; i++) {
        m[i].a <== m[i - 1].out;
        m[i].b <== m[i - 1].out;
    }
    m[16].a <== base;
    m[16].b <== m[15].out;
    out <== m[16].out;
}

// EM = 00 01 FF..FF 00 || DigestInfo prefix || H, as a number in k limbs of n bits.
// HB: digest bits; PREFIX: DigestInfo prefix bytes as one number; PREFIX_BITS: its bits.
template Pkcs1Pad(n, k, HB, PREFIX, PREFIX_BITS) {
    signal input modulus[k];
    signal input message[k];
    signal output out[k];

    var msgLen = HB;
    var baseLen = HB + PREFIX_BITS;

    signal paddedMessageBits[n * k];
    component modulusN2B[k];
    component messageN2B[k];
    signal modulusBits[n * k];
    signal messageBits[n * k];
    for (var i = 0; i < k; i++) {
        messageN2B[i] = Num2Bits(n);
        messageN2B[i].in <== message[i];
        for (var j = 0; j < n; j++) messageBits[i * n + j] <== messageN2B[i].out[j];
        modulusN2B[i] = Num2Bits(n);
        modulusN2B[i].in <== modulus[i];
        for (var j = 0; j < n; j++) modulusBits[i * n + j] <== modulusN2B[i].out[j];
    }
    for (var i = msgLen; i < n * k; i++) messageBits[i] === 0;
    for (var i = 0; i < msgLen; i++) paddedMessageBits[i] <== messageBits[i];
    for (var i = baseLen; i < baseLen + 8; i++) paddedMessageBits[i] <== 0;
    for (var i = msgLen; i < baseLen; i++) paddedMessageBits[i] <== (PREFIX >> (i - msgLen)) & 1;

    // FF bytes up to the byte below the modulus' top byte, then 01, then 00 (as RSAPad).
    component modulusZero[(n * k + 7 - (baseLen + 8)) \ 8];
    {
        var modulusPrefix = 0;
        for (var i = n * k - 1; i >= baseLen + 8; i--) {
            if (i + 8 < n * k) {
                modulusPrefix += modulusBits[i + 8];
                if (i % 8 == 0) {
                    var idx = (i - (baseLen + 8)) \ 8;
                    modulusZero[idx] = IsZero();
                    modulusZero[idx].in <== modulusPrefix;
                    paddedMessageBits[i] <== 1 - modulusZero[idx].out;
                } else {
                    paddedMessageBits[i] <== paddedMessageBits[i + 1];
                }
            } else {
                paddedMessageBits[i] <== 0;
            }
        }
    }
    // PKCS#1 v1.5 requires at least 8 bytes of FF.
    assert(baseLen + 8 + 65 <= n * k);
    for (var i = baseLen + 8; i < baseLen + 8 + 65; i++) paddedMessageBits[i] === 1;

    component b2n[k];
    for (var i = 0; i < k; i++) {
        b2n[i] = Bits2Num(n);
        for (var j = 0; j < n; j++) b2n[i].in[j] <== paddedMessageBits[i * n + j];
        out[i] <== b2n[i].out;
    }
}

// base^e mod modulus by square-and-multiply over EBITS exponent bits (most significant
// first). Cost: 2·EBITS modular multiplications. Hint 2s: the squaring of step s; hint
// 2s + 1: its multiplication by base (computed at every step, used when the bit is 1).
template FpPowVarMod(n, k, EBITS) {
    signal input base[k];
    signal input modulus[k];
    signal input ebits[EBITS]; // least significant first, each 0 or 1 (checked by the caller)
    signal input hq[2 * EBITS][k];
    signal input hr[2 * EBITS][k];
    signal output out[k];

    signal acc[EBITS + 1][k];
    signal pick[EBITS][k];
    component sq[EBITS];
    component mul[EBITS];
    for (var j = 0; j < k; j++) acc[0][j] <== (j == 0) ? 1 : 0;
    for (var s = 0; s < EBITS; s++) {
        var bit = EBITS - 1 - s;
        sq[s] = FpMulHinted(n, k);
        mul[s] = FpMulHinted(n, k);
        sq[s].q <== hq[2 * s];
        sq[s].r <== hr[2 * s];
        mul[s].q <== hq[2 * s + 1];
        mul[s].r <== hr[2 * s + 1];
        for (var j = 0; j < k; j++) {
            sq[s].a[j] <== acc[s][j];
            sq[s].b[j] <== acc[s][j];
            sq[s].p[j] <== modulus[j];
        }
        for (var j = 0; j < k; j++) {
            mul[s].a[j] <== sq[s].out[j];
            mul[s].b[j] <== base[j];
            mul[s].p[j] <== modulus[j];
        }
        for (var j = 0; j < k; j++) {
            pick[s][j] <== ebits[bit] * (mul[s].out[j] - sq[s].out[j]);
            acc[s + 1][j] <== sq[s].out[j] + pick[s][j];
        }
    }
    for (var j = 0; j < k; j++) out[j] <== acc[EBITS][j];
}

// Checks signature^e = EM(message) mod modulus. message: the digest as a number in k
// limbs. With EBITS = 0 the exponent is fixed to 65537 (the zk-email circuit's path).
template RsaPkcs1Verify(n, k, HB, PREFIX, PREFIX_BITS, EBITS) {
    signal input message[k];
    signal input signature[k];
    signal input modulus[k];
    signal input exponent;
    signal input hq[rsaMuls(EBITS)][k]; // hints: quotient and remainder of each multiplication
    signal input hr[rsaMuls(EBITS)][k];

    component pad = Pkcs1Pad(n, k, HB, PREFIX, PREFIX_BITS);
    pad.modulus <== modulus;
    pad.message <== message;

    // The signature is in proper form and below the modulus.
    component sRange[k];
    component lt = BigLessThan(n, k);
    for (var i = 0; i < k; i++) {
        sRange[i] = Num2Bits(n);
        sRange[i].in <== signature[i];
        lt.a[i] <== signature[i];
        lt.b[i] <== modulus[i];
    }
    lt.out === 1;

    signal powOut[k];
    if (EBITS == 0) {
        exponent === 65537;
        component p65537 = FpPow65537Hinted(n, k);
        p65537.base <== signature;
        p65537.modulus <== modulus;
        p65537.hq <== hq;
        p65537.hr <== hr;
        powOut <== p65537.out;
    } else {
        // An odd exponent of at least 3, below 2^EBITS.
        component eb = Num2Bits(EBITS);
        eb.in <== exponent;
        eb.out[0] === 1;
        component isOne = IsEqual();
        isOne.in[0] <== exponent;
        isOne.in[1] <== 1;
        isOne.out === 0;
        component pv = FpPowVarMod(n, k, EBITS);
        pv.base <== signature;
        pv.modulus <== modulus;
        pv.ebits <== eb.out;
        pv.hq <== hq;
        pv.hr <== hr;
        powOut <== pv.out;
    }
    // EM < modulus by construction, and FpMul reduces fully, so compare limb by limb.
    for (var i = 0; i < k; i++) powOut[i] === pad.out[i];
}
