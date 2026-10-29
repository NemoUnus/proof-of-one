// SPDX-License-Identifier: Apache-2.0
// Proof of One — RSA PKCS#1 v1.5 signature check for any digest and any public exponent
// below 2^EBITS (reference, NOT for production use).
//
// Generalises RSAVerifier65537 and RSAPad from @zk-email/circuits (MIT): same limb
// representation (k limbs of n bits, least significant first), same padding logic,
// but with the DigestInfo prefix and digest length as parameters and the exponent as
// a private input. The exponent must be bound elsewhere (π_doc binds it in the leaf of
// the tree of checked signers), otherwise a prover could choose it.

pragma circom 2.1.6;

include "circomlib/circuits/bitify.circom";
include "circomlib/circuits/comparators.circom";
include "@zk-email/circuits/lib/fp.circom";
include "@zk-email/circuits/lib/rsa.circom"; // FpPow65537Mod

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
// first). Cost: 2·EBITS modular multiplications.
template FpPowVarMod(n, k, EBITS) {
    signal input base[k];
    signal input modulus[k];
    signal input ebits[EBITS]; // least significant first, each 0 or 1 (checked by the caller)
    signal output out[k];

    signal acc[EBITS + 1][k];
    signal pick[EBITS][k];
    component sq[EBITS];
    component mul[EBITS];
    for (var j = 0; j < k; j++) acc[0][j] <== (j == 0) ? 1 : 0;
    for (var s = 0; s < EBITS; s++) {
        var bit = EBITS - 1 - s;
        sq[s] = FpMul(n, k);
        mul[s] = FpMul(n, k);
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
        component p65537 = FpPow65537Mod(n, k);
        p65537.base <== signature;
        p65537.modulus <== modulus;
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
        powOut <== pv.out;
    }
    // EM < modulus by construction, and FpMul reduces fully, so compare limb by limb.
    for (var i = 0; i < k; i++) powOut[i] === pad.out[i];
}
