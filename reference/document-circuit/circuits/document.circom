// SPDX-License-Identifier: Apache-2.0
// Proof of One — document-validity proof π_doc (reference, NOT for production use).
// Specification: docs/specs/document-validity-proof-v0.1.md.
//
// Proves, without revealing the document, that the phone holds an ICAO 9303 passport
// (TD3) whose chip data was signed by a document signer (DSC) in the public tree of
// checked signers, that the passport has not expired, and which attributes it carries:
//
//   1. SHA-256(DG1) is the DG1 hash listed in the LDS security object (eContent);
//   2. the DG2 (face image) hash listed there is committed to as C_face;
//   3. SHA-256(eContent) is the messageDigest in the signed attributes;
//   4. the signed attributes carry a valid RSA-2048 PKCS#1 v1.5 SHA-256 signature
//      (e = 65537) under the DSC key;
//   5. Poseidon(alg, Poseidon(n_0..n_15), n_16) of the DSC modulus is a leaf of the
//      DSC tree with root `dscRoot`;
//   6. the expiry date in DG1 is on or after `today`;
//   7. outputs: birthDay (days since 1900-01-01), sexCode (M 1, F 2, other 0),
//      natCode (nationality, the three ICAO letters packed as one number) and
//      expMonth (year·12 + month), as used by π_reg and π_vote.
//
// Values are read from fixed positions inside data that is hashed and signed, and
// every read checks the DER bytes in front of it, so a value cannot be taken from
// another field. Bytes outside the hashed length are never read.
//
// SHA-256 and RSA come from @zk-email/circuits (MIT); circomlib is GPL-3.0.
// Supported in v0.1: TD3 passports, SHA-256 data-group hashes, RSA-2048 PKCS#1 v1.5.

pragma circom 2.1.6;

include "circomlib/circuits/poseidon.circom";
include "circomlib/circuits/comparators.circom";
include "circomlib/circuits/bitify.circom";
include "@zk-email/circuits/lib/sha.circom";
include "@zk-email/circuits/lib/rsa.circom";
include "@zk-email/circuits/utils/array.circom";

// Bits of a SHA-256 output (most significant bit first) as 32 bytes.
template ShaBitsToBytes() {
    signal input bits[256];
    signal output bytes[32];
    for (var i = 0; i < 32; i++) {
        var acc = 0;
        for (var b = 0; b < 8; b++) acc += bits[8 * i + b] * (1 << (7 - b));
        bytes[i] <== acc;
    }
}

// Reads `prefixLen + 32` bytes at `start` from a hashed array of `paddedLen` bytes,
// checks the fixed prefix and returns the 32 bytes after it.
template ReadHashAfterPrefix(maxLen, prefixLen) {
    signal input in[maxLen];
    signal input paddedLen;
    signal input start;
    signal input prefix[prefixLen];
    signal output value[32];

    // start + prefixLen + 32 <= paddedLen: never read past the hashed bytes, and
    // never let the shifter wrap around.
    component inside = LessEqThan(16);
    inside.in[0] <== start + prefixLen + 32;
    inside.in[1] <== paddedLen;
    inside.out === 1;

    component sel = VarShiftLeft(maxLen, prefixLen + 32);
    sel.in <== in;
    sel.shift <== start;
    for (var i = 0; i < prefixLen; i++) sel.out[i] === prefix[i];
    for (var i = 0; i < 32; i++) value[i] <== sel.out[prefixLen + i];
}

// An ASCII digit as its value 0–9.
template Digit() {
    signal input c;
    signal output d;
    // c is a byte (range-checked by the SHA-256 input); require '0' <= c <= '9'.
    component ge = GreaterEqThan(8);
    ge.in[0] <== c;
    ge.in[1] <== 48;
    ge.out === 1;
    component le = LessEqThan(8);
    le.in[0] <== c;
    le.in[1] <== 57;
    le.out === 1;
    d <== c - 48;
}

// Days since 1900-01-01 for 1901 <= y <= 2099, 1 <= m <= 12, 1 <= d <= 31.
template DayNumber() {
    signal input y;
    signal input m;
    signal input d;
    signal output out;

    // q = floor((y − 1901) / 4), r = (y − 1901) mod 4; y is a leap year when r = 3.
    signal q;
    signal r;
    q <-- (y - 1901) \ 4;
    r <-- (y - 1901) % 4;
    y - 1901 === 4 * q + r;
    // Bit decompositions make (q, r) unique: 0 <= r < 4, 0 <= q < 64.
    component rb = Num2Bits(2);
    rb.in <== r;
    component qb = Num2Bits(6);
    qb.in <== q;
    component leap = IsEqual();
    leap.in[0] <== r;
    leap.in[1] <== 3;

    var cum[12] = [0, 31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 334];
    component isM[12];
    var sumSel = 0;
    var cumSel = 0;
    for (var i = 0; i < 12; i++) {
        isM[i] = IsEqual();
        isM[i].in[0] <== m;
        isM[i].in[1] <== i + 1;
        sumSel += isM[i].out;
        cumSel += isM[i].out * cum[i];
    }
    sumSel === 1; // 1 <= m <= 12

    component after = GreaterThan(4);
    after.in[0] <== m;
    after.in[1] <== 2;
    signal leapDay;
    leapDay <== leap.out * after.out;

    // d and m come from two ASCII digits, so 0 <= d, m <= 99 here.
    component d1 = GreaterEqThan(7);
    d1.in[0] <== d;
    d1.in[1] <== 1;
    d1.out === 1;
    component d31 = LessEqThan(7);
    d31.in[0] <== d;
    d31.in[1] <== 31;
    d31.out === 1;

    // y − 1901 = 4q + r, so leap years before y (from 1904) number q, plus 365 per year.
    out <== 365 * (y - 1900) + q + cumSel + leapDay + d - 1;
}

template DocumentProof(maxE, maxSA, depth) {
    // ---------------- public inputs
    signal input dscRoot;        // root of the tree of checked document signers
    signal input today;          // day number of the enrolment date
    signal input currentYear;    // four-digit year of the enrolment date (century of birth dates)
    signal input cm;             // the member's hiding commitment (binding only)
    signal input challenge;      // fresh challenge from the enrolment service (binding only)

    // ---------------- private inputs
    signal input dg1[128];       // DG1 (93 bytes), SHA-256 padded
    signal input eContent[maxE]; // LDS security object, SHA-256 padded
    signal input eLen;           // padded length of eContent in bytes
    signal input dg1Off;         // start of the DG1 hash entry in eContent
    signal input dg2Off;         // start of the DG2 hash entry in eContent
    signal input sa[maxSA];      // signed attributes (SET), SHA-256 padded
    signal input saLen;
    signal input mdOff;          // start of the messageDigest attribute in sa
    signal input signature[17];  // RSA signature, 121-bit limbs, least significant first
    signal input modulus[17];    // DSC modulus, same limbs
    signal input dscSiblings[depth];
    signal input dscPathIndex[depth];
    signal input rFace;          // blinding of the face-image commitment

    // ---------------- outputs
    signal output birthDay;
    signal output sexCode;
    signal output natCode;
    signal output expMonth;
    signal output cFace;

    // Bind the commitment and the challenge into the proof.
    signal cmSq;
    cmSq <== cm * cm;
    signal chSq;
    chSq <== challenge * challenge;

    // ---- 1. DG1 hash
    // DG1 of a TD3 passport: 61 5B 5F 1F 58, then 88 MRZ characters.
    dg1[0] === 0x61; dg1[1] === 0x5B; dg1[2] === 0x5F; dg1[3] === 0x1F; dg1[4] === 0x58;
    component hDg1 = Sha256Bytes(128);
    hDg1.paddedIn <== dg1;
    hDg1.paddedInLength <== 128;
    component dg1Hash = ShaBitsToBytes();
    dg1Hash.bits <== hDg1.out;

    var P1[7] = [0x30, 0x25, 0x02, 0x01, 0x01, 0x04, 0x20];
    component rd1 = ReadHashAfterPrefix(maxE, 7);
    rd1.in <== eContent;
    rd1.paddedLen <== eLen;
    rd1.start <== dg1Off;
    for (var i = 0; i < 7; i++) rd1.prefix[i] <== P1[i];
    for (var i = 0; i < 32; i++) rd1.value[i] === dg1Hash.bytes[i];

    // ---- 2. DG2 hash, committed to for the face check in the enclave
    var P2[7] = [0x30, 0x25, 0x02, 0x01, 0x02, 0x04, 0x20];
    component rd2 = ReadHashAfterPrefix(maxE, 7);
    rd2.in <== eContent;
    rd2.paddedLen <== eLen;
    rd2.start <== dg2Off;
    for (var i = 0; i < 7; i++) rd2.prefix[i] <== P2[i];
    var hi = 0;
    var lo = 0;
    for (var i = 0; i < 16; i++) { hi = hi * 256 + rd2.value[i]; lo = lo * 256 + rd2.value[16 + i]; }
    component cf = Poseidon(3);
    cf.inputs[0] <== hi;
    cf.inputs[1] <== lo;
    cf.inputs[2] <== rFace;
    cFace <== cf.out;

    // ---- 3. eContent hash is the signed messageDigest
    component hE = Sha256Bytes(maxE);
    hE.paddedIn <== eContent;
    hE.paddedInLength <== eLen;
    component eHash = ShaBitsToBytes();
    eHash.bits <== hE.out;
    var PM[17] = [0x30, 0x2F, 0x06, 0x09, 0x2A, 0x86, 0x48, 0x86, 0xF7, 0x0D, 0x01, 0x09, 0x04, 0x31, 0x22, 0x04, 0x20];
    component rdm = ReadHashAfterPrefix(maxSA, 17);
    rdm.in <== sa;
    rdm.paddedLen <== saLen;
    rdm.start <== mdOff;
    for (var i = 0; i < 17; i++) rdm.prefix[i] <== PM[i];
    for (var i = 0; i < 32; i++) rdm.value[i] === eHash.bytes[i];
    // The signed attributes are a DER SET.
    sa[0] === 0x31;

    // ---- 4. RSA signature over SHA-256(signed attributes)
    component hS = Sha256Bytes(maxSA);
    hS.paddedIn <== sa;
    hS.paddedInLength <== saLen;
    // The digest as an integer, split into 121-bit limbs (least significant first).
    component rsa = RSAVerifier65537(121, 17);
    for (var l = 0; l < 17; l++) {
        var acc = 0;
        for (var t = 0; t < 121; t++) {
            var bit = l * 121 + t;
            if (bit < 256) acc += hS.out[255 - bit] * (1 << t);
        }
        rsa.message[l] <== acc;
        rsa.signature[l] <== signature[l];
        rsa.modulus[l] <== modulus[l];
    }

    // ---- 5. the DSC key is in the tree of checked signers
    component m16 = Poseidon(16);
    for (var i = 0; i < 16; i++) m16.inputs[i] <== modulus[i];
    component leaf = Poseidon(3);
    leaf.inputs[0] <== 1; // algorithm: RSA-2048, SHA-256, PKCS#1 v1.5
    leaf.inputs[1] <== m16.out;
    leaf.inputs[2] <== modulus[16];
    component lvl[depth];
    signal cur[depth + 1];
    signal left[depth];
    signal right[depth];
    cur[0] <== leaf.out;
    for (var i = 0; i < depth; i++) {
        dscPathIndex[i] * (1 - dscPathIndex[i]) === 0;
        left[i] <== cur[i] + dscPathIndex[i] * (dscSiblings[i] - cur[i]);
        right[i] <== dscSiblings[i] + dscPathIndex[i] * (cur[i] - dscSiblings[i]);
        lvl[i] = Poseidon(2);
        lvl[i].inputs[0] <== left[i];
        lvl[i].inputs[1] <== right[i];
        cur[i + 1] <== lvl[i].out;
    }
    cur[depth] === dscRoot;

    // ---- 6–7. MRZ fields (TD3: line 2 starts at MRZ position 44; MRZ starts at DG1 byte 5)
    var L2 = 5 + 44;
    component dig[12];
    // birth date YYMMDD at L2+13, expiry YYMMDD at L2+21
    for (var i = 0; i < 6; i++) { dig[i] = Digit(); dig[i].c <== dg1[L2 + 13 + i]; }
    for (var i = 0; i < 6; i++) { dig[6 + i] = Digit(); dig[6 + i].c <== dg1[L2 + 21 + i]; }
    // the last two digits of the current year
    signal cy;
    cy <-- currentYear % 100;
    signal cc;
    cc <-- currentYear \ 100;
    currentYear === cc * 100 + cy;
    cc === 20; // enrolment happens in 2000–2099
    component cyb = Num2Bits(7);
    cyb.in <== cy;
    component cyr = LessThan(7);
    cyr.in[0] <== cy;
    cyr.in[1] <== 100;
    cyr.out === 1;

    signal byy;
    byy <== dig[0].d * 10 + dig[1].d;
    // born in 19YY when YY is after the current year's YY, else 20YY
    component b19 = GreaterThan(7);
    b19.in[0] <== byy;
    b19.in[1] <== cy;
    component bd = DayNumber();
    bd.y <== 2000 + byy - 100 * b19.out;
    bd.m <== dig[2].d * 10 + dig[3].d;
    bd.d <== dig[4].d * 10 + dig[5].d;
    birthDay <== bd.out;

    signal expYear;
    signal expM;
    expYear <== 2000 + dig[6].d * 10 + dig[7].d;
    expM <== dig[8].d * 10 + dig[9].d;
    component ed = DayNumber();
    ed.y <== expYear;
    ed.m <== expM;
    ed.d <== dig[10].d * 10 + dig[11].d;
    component valid = GreaterEqThan(20);
    valid.in[0] <== ed.out;
    valid.in[1] <== today;
    valid.out === 1;
    expMonth <== expYear * 12 + expM;

    // sex at L2+20: 'M' 1, 'F' 2, anything else 0
    component isM = IsEqual();
    isM.in[0] <== dg1[L2 + 20];
    isM.in[1] <== 77;
    component isF = IsEqual();
    isF.in[0] <== dg1[L2 + 20];
    isF.in[1] <== 70;
    sexCode <== isM.out + 2 * isF.out;

    // nationality: three letters at L2+10
    natCode <== dg1[L2 + 10] * 65536 + dg1[L2 + 11] * 256 + dg1[L2 + 12];
}

component main {public [dscRoot, today, currentYear, cm, challenge]} = DocumentProof(448, 192, 16);
