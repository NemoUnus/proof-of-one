// SPDX-License-Identifier: Apache-2.0
// Proof of One — SHA-1 over a padded byte array of variable length (reference, NOT for
// production use). Written for π_doc's SHA-1 suite (FIPS 180-4 §6.1) from circomlib
// primitives; Rarimo's MIT-licensed SHA-1 circuit (rarimo/passport-zk-circuits) was
// read as a reference. SHA-1 is used here only where passports themselves use it.
//
// Words are 32 signals, least significant bit first.

pragma circom 2.1.6;

include "circomlib/circuits/bitify.circom";
include "circomlib/circuits/binsum.circom";
include "circomlib/circuits/comparators.circom";
include "circomlib/circuits/sha256/ch.circom";
include "circomlib/circuits/sha256/maj.circom";
include "circomlib/circuits/sha256/xor3.circom";

function sha1K(t) {
    if (t < 20) return 0x5A827999;
    if (t < 40) return 0x6ED9EBA1;
    if (t < 60) return 0x8F1BBCDC;
    return 0xCA62C1D6;
}
function sha1H(i) {
    var h[5] = [0x67452301, 0xEFCDAB89, 0x98BADCFE, 0x10325476, 0xC3D2E1F0];
    return h[i];
}

// One SHA-1 compression: hin (five words) and a 512-bit block (16 words) to hout.
template Sha1Compress() {
    signal input hin[5][32];
    signal input block[16][32];
    signal output hout[5][32];

    // Message schedule: w[t] = rotl1(w[t-3] ^ w[t-8] ^ w[t-14] ^ w[t-16]).
    signal w[80][32];
    signal x1[64][32];
    signal x2[64][32];
    signal x3[64][32];
    for (var t = 0; t < 16; t++) for (var i = 0; i < 32; i++) w[t][i] <== block[t][i];
    for (var t = 16; t < 80; t++) {
        for (var i = 0; i < 32; i++) {
            x1[t - 16][i] <== w[t - 3][i] + w[t - 8][i] - 2 * w[t - 3][i] * w[t - 8][i];
            x2[t - 16][i] <== x1[t - 16][i] + w[t - 14][i] - 2 * x1[t - 16][i] * w[t - 14][i];
            x3[t - 16][i] <== x2[t - 16][i] + w[t - 16][i] - 2 * x2[t - 16][i] * w[t - 16][i];
        }
        for (var i = 0; i < 32; i++) w[t][i] <== x3[t - 16][(i + 31) % 32];
    }

    signal a[81][32];
    signal b[81][32];
    signal c[81][32];
    signal d[81][32];
    signal e[81][32];
    for (var i = 0; i < 32; i++) {
        a[0][i] <== hin[0][i]; b[0][i] <== hin[1][i]; c[0][i] <== hin[2][i];
        d[0][i] <== hin[3][i]; e[0][i] <== hin[4][i];
    }

    component fch[20];
    component fpar[40];
    component fmaj[20];
    component sum[80];
    var nCh = 0; var nPar = 0; var nMaj = 0;
    for (var t = 0; t < 80; t++) {
        sum[t] = BinSum(32, 5);
        if (t < 20) {
            fch[nCh] = Ch_t(32);
            fch[nCh].a <== b[t]; fch[nCh].b <== c[t]; fch[nCh].c <== d[t];
            sum[t].in[1] <== fch[nCh].out;
            nCh++;
        } else if (t >= 40 && t < 60) {
            fmaj[nMaj] = Maj_t(32);
            fmaj[nMaj].a <== b[t]; fmaj[nMaj].b <== c[t]; fmaj[nMaj].c <== d[t];
            sum[t].in[1] <== fmaj[nMaj].out;
            nMaj++;
        } else {
            fpar[nPar] = Xor3(32);
            fpar[nPar].a <== b[t]; fpar[nPar].b <== c[t]; fpar[nPar].c <== d[t];
            sum[t].in[1] <== fpar[nPar].out;
            nPar++;
        }
        var k = sha1K(t);
        for (var i = 0; i < 32; i++) {
            sum[t].in[0][i] <== a[t][(i + 27) % 32]; // rotl5(a)
            sum[t].in[2][i] <== e[t][i];
            sum[t].in[3][i] <== (k >> i) & 1;
            sum[t].in[4][i] <== w[t][i];
        }
        for (var i = 0; i < 32; i++) {
            a[t + 1][i] <== sum[t].out[i]; // mod 2^32: the carry bits are dropped
            b[t + 1][i] <== a[t][i];
            c[t + 1][i] <== b[t][(i + 2) % 32]; // rotl30(b)
            d[t + 1][i] <== c[t][i];
            e[t + 1][i] <== d[t][i];
        }
    }

    component fin[5];
    for (var j = 0; j < 5; j++) {
        fin[j] = BinSum(32, 2);
        for (var i = 0; i < 32; i++) fin[j].in[0][i] <== hin[j][i];
    }
    for (var i = 0; i < 32; i++) {
        fin[0].in[1][i] <== a[80][i]; fin[1].in[1][i] <== b[80][i]; fin[2].in[1][i] <== c[80][i];
        fin[3].in[1][i] <== d[80][i]; fin[4].in[1][i] <== e[80][i];
    }
    for (var j = 0; j < 5; j++) for (var i = 0; i < 32; i++) hout[j][i] <== fin[j].out[i];
}

// SHA-1 of a message already padded (FIPS 180-4 §5.1.1) to `paddedInLength` bytes,
// followed by zeros up to maxByteLength. Output: 160 bits, most significant first,
// like Sha256Bytes. The padding bytes are not checked here: a wrong padding gives the
// digest of another message, which must still match a value the state signed.
template Sha1Bytes(maxByteLength) {
    assert(maxByteLength % 64 == 0);
    var nBlocks = maxByteLength \ 64;
    signal input paddedIn[maxByteLength];
    signal input paddedInLength;
    signal output out[160];

    component byteBits[maxByteLength];
    for (var i = 0; i < maxByteLength; i++) {
        byteBits[i] = Num2Bits(8);
        byteBits[i].in <== paddedIn[i];
    }

    // Number of blocks actually hashed: paddedInLength = 64 * used, 1 <= used <= nBlocks.
    signal used;
    used <-- paddedInLength \ 64;
    paddedInLength === 64 * used;
    component isLast[nBlocks];
    var one = 0;
    for (var j = 0; j < nBlocks; j++) {
        isLast[j] = IsEqual();
        isLast[j].in[0] <== used;
        isLast[j].in[1] <== j + 1;
        one += isLast[j].out;
    }
    one === 1;

    component comp[nBlocks];
    for (var j = 0; j < nBlocks; j++) {
        comp[j] = Sha1Compress();
        for (var w = 0; w < 16; w++) {
            for (var i = 0; i < 32; i++) {
                // word w is bytes 4w..4w+3, big-endian; bit i counts from the least significant
                comp[j].block[w][i] <== byteBits[64 * j + 4 * w + 3 - (i \ 8)].out[i % 8];
            }
        }
        for (var h = 0; h < 5; h++) {
            for (var i = 0; i < 32; i++) {
                if (j == 0) comp[j].hin[h][i] <== (sha1H(h) >> i) & 1;
                else comp[j].hin[h][i] <== comp[j - 1].hout[h][i];
            }
        }
    }

    // Select the state after the last used block.
    signal sel[nBlocks][160];
    for (var j = 0; j < nBlocks; j++) {
        for (var h = 0; h < 5; h++) {
            for (var i = 0; i < 32; i++) {
                sel[j][32 * h + 31 - i] <== isLast[j].out * comp[j].hout[h][i];
            }
        }
    }
    for (var b = 0; b < 160; b++) {
        var acc = 0;
        for (var j = 0; j < nBlocks; j++) acc += sel[j][b];
        out[b] <== acc;
    }
}
