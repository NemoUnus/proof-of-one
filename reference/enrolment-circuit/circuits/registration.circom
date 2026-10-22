// SPDX-License-Identifier: Apache-2.0
// Proof of One — unlinkable registration proof π_reg (reference circuit).
// Specification: docs/specs/ballot-and-enrolment-v0.1.md §2.3, with the hidden
// revocation handle of red-team change C1 and the hidden signing epoch of C2.
//
// CONTEXT
// At enrolment the enclave saw the person's document and face, checked uniqueness,
// and signed  msg = Poseidon(5, ageBand, sexCode, nat_0, exp_0, nat_1, exp_1, nat_2, exp_2,
//                             cm, rn, epoch)   (up to 3 documents; Decision #30)
// where cm = Poseidon(4, idc, salt, ρ) HIDES the identity commitment idc.
// Later, in a separate session, the phone registers (leaf, cn) on the ledger with
// this proof. The enclave knows cm, rn and the attributes, but not idc, salt or ρ,
// so it cannot recognise leaf or cn.
//
// STATEMENT
//   1. P = s·G and idc = Poseidon(P.x, P.y)
//   2. leaf = Poseidon(idc, Poseidon(ageBand, sexCode, nat_0, exp_0, nat_1, exp_1,
//                                    nat_2, exp_2, salt), rn)
//      — the same leaf format the ballot circuit proves membership of
//   3. cm = Poseidon(4, idc, salt, ρ) and cn = Poseidon(3, ρ)
//   4. (R8, S) is a valid EdDSA-Poseidon signature on msg under enclave key A
//   5. Poseidon(A.x, A.y) is a leaf of the published enclave key-set tree (keySetRoot);
//      which key, and therefore which epoch, stays hidden
//   6. rn < 2^252 (range required by the revocation comparators)
//
// PUBLIC INPUTS: leaf, cn, keySetRoot.
// Reference circuit for review. Not audited.

pragma circom 2.1.0;

include "../node_modules/circomlib/circuits/poseidon.circom";
include "../node_modules/circomlib/circuits/babyjub.circom";
include "../node_modules/circomlib/circuits/eddsaposeidon.circom";
include "../node_modules/circomlib/circuits/bitify.circom";

template MerkleRoot(depth) {
    signal input leaf;
    signal input siblings[depth];
    signal input pathIndex[depth];
    signal output root;
    component h[depth];
    signal cur[depth + 1];
    signal left[depth];
    signal right[depth];
    cur[0] <== leaf;
    for (var i = 0; i < depth; i++) {
        pathIndex[i] * (pathIndex[i] - 1) === 0;
        left[i]  <== cur[i] + pathIndex[i] * (siblings[i] - cur[i]);
        right[i] <== siblings[i] + pathIndex[i] * (cur[i] - siblings[i]);
        h[i] = Poseidon(2);
        h[i].inputs[0] <== left[i];
        h[i].inputs[1] <== right[i];
        cur[i + 1] <== h[i].out;
    }
    root <== cur[depth];
}

template Registration(keyDepth) {
    // public
    signal input leaf;
    signal input cn;
    signal input keySetRoot;
    // private
    signal input s;
    signal input ageBand;
    signal input sexCode;
    signal input nat[3];
    signal input exp[3];
    signal input salt;
    signal input rho;
    signal input rn;
    signal input epoch;
    signal input Ax;
    signal input Ay;
    signal input R8x;
    signal input R8y;
    signal input S;
    signal input keySiblings[keyDepth];
    signal input keyPathIndex[keyDepth];

    // 1. identity
    component P = BabyPbk();
    P.in <== s;
    component idc = Poseidon(2);
    idc.inputs[0] <== P.Ax;
    idc.inputs[1] <== P.Ay;

    // 2. leaf
    component attr = Poseidon(9);
    attr.inputs[0] <== ageBand;
    attr.inputs[1] <== sexCode;
    for (var d = 0; d < 3; d++) {
        attr.inputs[2 + 2 * d] <== nat[d];
        attr.inputs[3 + 2 * d] <== exp[d];
    }
    attr.inputs[8] <== salt;
    component lf = Poseidon(3);
    lf.inputs[0] <== idc.out;
    lf.inputs[1] <== attr.out;
    lf.inputs[2] <== rn;
    lf.out === leaf;

    // 3. hiding commitment and credential nullifier
    component cm = Poseidon(4);
    cm.inputs[0] <== 4;              // domain tag TAG.COMMITMENT
    cm.inputs[1] <== idc.out;
    cm.inputs[2] <== salt;
    cm.inputs[3] <== rho;
    component cnH = Poseidon(2);
    cnH.inputs[0] <== 3;             // domain tag TAG.CREDENTIAL
    cnH.inputs[1] <== rho;
    cnH.out === cn;

    // 4. enclave signature on the credential message
    component msg = Poseidon(12);
    msg.inputs[0] <== 5;             // domain tag TAG.CREDENTIAL_MSG
    msg.inputs[1] <== ageBand;
    msg.inputs[2] <== sexCode;
    for (var d = 0; d < 3; d++) {
        msg.inputs[3 + 2 * d] <== nat[d];
        msg.inputs[4 + 2 * d] <== exp[d];
    }
    msg.inputs[9] <== cm.out;
    msg.inputs[10] <== rn;
    msg.inputs[11] <== epoch;
    component sig = EdDSAPoseidonVerifier();
    sig.enabled <== 1;
    sig.Ax <== Ax;
    sig.Ay <== Ay;
    sig.R8x <== R8x;
    sig.R8y <== R8y;
    sig.S <== S;
    sig.M <== msg.out;

    // 5. the signing key is one of the published enclave keys
    component keyLeaf = Poseidon(2);
    keyLeaf.inputs[0] <== Ax;
    keyLeaf.inputs[1] <== Ay;
    component keys = MerkleRoot(keyDepth);
    keys.leaf <== keyLeaf.out;
    for (var i = 0; i < keyDepth; i++) {
        keys.siblings[i] <== keySiblings[i];
        keys.pathIndex[i] <== keyPathIndex[i];
    }
    keys.root === keySetRoot;

    // 6. range of the revocation handle
    component rnBits = Num2Bits(252);
    rnBits.in <== rn;
}

component main {public [leaf, cn, keySetRoot]} = Registration(8);
