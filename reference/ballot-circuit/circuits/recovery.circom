// SPDX-License-Identifier: Apache-2.0
// Proof of One — recovery-ballot proof π_recover (reference circuit).
// Design: docs/specs/recovery-ballots-and-oprf-key-v0.1.md §1 and §1.5 (Decision Log #52,
// point 2).
//
// SITUATION
// A member's phone was stolen while poll X was open. The member recovered: the old identity
// was revoked, and the enclave issued a new identity after a face check. A recovery ballot
// lets the member, if they kept a backup of the old secret, replace whatever the old
// identity last recorded in X (perhaps the thief's ballot) with their own answer.
//
// THE LINK BETWEEN THE TWO IDENTITIES (§1.5)
// At recovery the enclave chooses the new identity's revocation handle as
//     rn_new = Poseidon(14, rn_old, ρ)        (retrying ρ until rn_new < 2^252)
// and gives ρ (the input `link`) to the member. rn is set by the enclave and signed in the credential, so no
// one can choose an rn_new that points to someone else's old identity. The identity leaf
// format, the registration proof and the ballot proof are unchanged; members who never
// recovered have a random rn as before. Without ρ, rn_new reveals nothing about rn_old,
// even after both are published by revocations.
//
// STATEMENT (all private values stay on the phone)
//   old identity, in poll X's membership snapshot:
//   1. P_old = s_old·G, idc_old = Poseidon(P_old.x, P_old.y)
//   2. leaf_old = Poseidon(idc_old, Poseidon(birthDay, sexCode, nat_0, exp_0, nat_1, exp_1,
//                                            nat_2, exp_2, salt), rn_old)  ∈ tree(idRoot)
//   3. nf = Poseidon(1, pollId, s_old)          the ballot replaces the old identity's
//   4. eligibility of the old identity, exactly as in π_vote (age range, one document)
//   new identity, current and not revoked:
//   5. P_new = s_new·G, idc_new = Poseidon(P_new.x, P_new.y)
//   6. leaf_new = Poseidon(idc_new, attr_new, rn_new) ∈ tree(idRootNow)
//   7. rn_new is not in the revocation tree with root revRoot
//   8. rn_new = Poseidon(14, rn_old, ρ)          the new identity replaces the old one
//   the ballot:
//   9. one-hot v, A_j = r_j·G, B_j = v_j·G + r_j·PK    as in π_vote
//  10. pollHash = Poseidon(7, Poseidon(idRoot, revRoot, pollId, PK.x, PK.y),
//                         Poseidon(maxBirthDay, minBirthDay, minExpiryMonth, requiredNat, ctxHash))
//      — the same pollHash as π_vote for poll X and the current revocation root
//
// The old identity is NOT checked against the revocation tree: it has been revoked.
// The new identity's non-revocation stands in for it.
//
// PUBLIC INPUTS (19): pollHash, nf, the 16 ciphertext coordinates, idRootNow.
// The contract supplies idRootNow from the identity registry (its current root), and
// pollHash from the poll and the revocation root, as for π_vote.
//
// Reference circuit for review. Not audited. TEST-ONLY setup.
pragma circom 2.1.0;

include "lib.circom";

template Recovery(depth, revDepth, k) {
    // ------------------------------------------------------------ public inputs
    signal input pollHash;
    signal input nf;
    signal input CA[k][2];
    signal input CB[k][2];
    signal input idRootNow;
    // ------------------------------------------- per-poll values, bound by pollHash
    signal input idRoot;             // poll X's membership snapshot
    signal input revRoot;            // the current revocation root
    signal input pollId;
    signal input PK[2];
    signal input maxBirthDay;
    signal input minBirthDay;
    signal input minExpiryMonth;
    signal input requiredNat;
    signal input ctxHash;
    // ------------------------------------------------- old identity (from the backup)
    signal input sOld;
    signal input birthDay;
    signal input sexCode;
    signal input nat[3];
    signal input exp[3];
    signal input docSel[3];
    signal input salt;
    signal input rnOld;
    signal input idSiblings[depth];
    signal input idPathIndex[depth];
    // ----------------------------------------------------------------- new identity
    signal input sNew;
    signal input attrNew;            // the new leaf's attribute hash (its fields stay closed)
    signal input link;          // ρ of the design: the secret that links the two handles
    signal input newSiblings[depth];
    signal input newPathIndex[depth];
    signal input lowValue;
    signal input nextValue;
    signal input revSiblings[revDepth];
    signal input revPathIndex[revDepth];
    // ----------------------------------------------------------------------- ballot
    signal input v[k];
    signal input r[k];

    // 1–2. old identity in the snapshot
    component PO = MulG();
    PO.x <== sOld;
    component idcOld = Poseidon(2);
    idcOld.inputs[0] <== PO.out[0];
    idcOld.inputs[1] <== PO.out[1];
    component attr = Poseidon(9);
    attr.inputs[0] <== birthDay;
    attr.inputs[1] <== sexCode;
    for (var d = 0; d < 3; d++) {
        attr.inputs[2 + 2 * d] <== nat[d];
        attr.inputs[3 + 2 * d] <== exp[d];
    }
    attr.inputs[8] <== salt;
    component leafOld = Poseidon(3);
    leafOld.inputs[0] <== idcOld.out;
    leafOld.inputs[1] <== attr.out;
    leafOld.inputs[2] <== rnOld;
    component oldTree = MerkleRoot(depth);
    oldTree.leaf <== leafOld.out;
    for (var i = 0; i < depth; i++) {
        oldTree.siblings[i] <== idSiblings[i];
        oldTree.pathIndex[i] <== idPathIndex[i];
    }
    oldTree.root === idRoot;

    // 3. the old identity's nullifier in this poll
    component nfH = Poseidon(3);
    nfH.inputs[0] <== 1;             // TAG.NULLIFIER
    nfH.inputs[1] <== pollId;
    nfH.inputs[2] <== sOld;
    nfH.out === nf;

    // 4. eligibility of the old identity (as in π_vote)
    component oldEnough = LessEqThan(32);
    oldEnough.in[0] <== birthDay;
    oldEnough.in[1] <== maxBirthDay;
    oldEnough.out === 1;
    component youngEnough = GreaterEqThan(32);
    youngEnough.in[0] <== birthDay;
    youngEnough.in[1] <== minBirthDay;
    youngEnough.out === 1;
    signal selNat[3];
    signal selExp[3];
    var selSum = 0;
    var natAcc = 0;
    var expAcc = 0;
    for (var d = 0; d < 3; d++) {
        docSel[d] * (docSel[d] - 1) === 0;
        selNat[d] <== docSel[d] * nat[d];
        selExp[d] <== docSel[d] * exp[d];
        selSum += docSel[d];
        natAcc += selNat[d];
        expAcc += selExp[d];
    }
    selSum === 1;
    signal natSel <== natAcc;
    signal expSel <== expAcc;
    component natEmpty = IsZero();
    natEmpty.in <== natSel;
    natEmpty.out === 0;
    component expOk = GreaterEqThan(32);
    expOk.in[0] <== expSel;
    expOk.in[1] <== minExpiryMonth;
    expOk.out === 1;
    requiredNat * (natSel - requiredNat) === 0;

    // 8. the link: rn_new = Poseidon(14, rn_old, ρ)
    component linkH = Poseidon(3);
    linkH.inputs[0] <== 14;          // TAG.REPLACES
    linkH.inputs[1] <== rnOld;
    linkH.inputs[2] <== link;
    signal rnNew <== linkH.out;

    // 5–6. new identity in the current identity tree
    component PN = MulG();
    PN.x <== sNew;
    component idcNew = Poseidon(2);
    idcNew.inputs[0] <== PN.out[0];
    idcNew.inputs[1] <== PN.out[1];
    component leafNew = Poseidon(3);
    leafNew.inputs[0] <== idcNew.out;
    leafNew.inputs[1] <== attrNew;
    leafNew.inputs[2] <== rnNew;
    component newTree = MerkleRoot(depth);
    newTree.leaf <== leafNew.out;
    for (var i = 0; i < depth; i++) {
        newTree.siblings[i] <== newSiblings[i];
        newTree.pathIndex[i] <== newPathIndex[i];
    }
    newTree.root === idRootNow;

    // 7. the new identity is not revoked (indexed tree, low-leaf proof, as in π_vote)
    component rnRange = Num2Bits(252);   // rn_new < 2^252, as the comparators require
    rnRange.in <== rnNew;
    component revLeaf = Poseidon(2);
    revLeaf.inputs[0] <== lowValue;
    revLeaf.inputs[1] <== nextValue;
    component revTree = MerkleRoot(revDepth);
    revTree.leaf <== revLeaf.out;
    for (var i = 0; i < revDepth; i++) {
        revTree.siblings[i] <== revSiblings[i];
        revTree.pathIndex[i] <== revPathIndex[i];
    }
    revTree.root === revRoot;
    component lowLt = LessThan(252);
    lowLt.in[0] <== lowValue;
    lowLt.in[1] <== rnNew;
    lowLt.out === 1;
    component nextIsInf = IsZero();
    nextIsInf.in <== nextValue;
    component rnLtNext = LessThan(252);
    rnLtNext.in[0] <== rnNew;
    rnLtNext.in[1] <== nextValue;
    (1 - nextIsInf.out) * (1 - rnLtNext.out) === 0;

    // 9. one-hot ballot, encrypted (as in π_vote)
    signal sum[k + 1];
    sum[0] <== 0;
    component rG[k];
    component rPK[k];
    component add[k];
    signal vGx[k];
    signal vGy[k];
    for (var j = 0; j < k; j++) {
        v[j] * (v[j] - 1) === 0;
        sum[j + 1] <== sum[j] + v[j];
        rG[j] = MulG();
        rG[j].x <== r[j];
        rG[j].out[0] === CA[j][0];
        rG[j].out[1] === CA[j][1];
        rPK[j] = MulAny();
        rPK[j].x <== r[j];
        rPK[j].p[0] <== PK[0];
        rPK[j].p[1] <== PK[1];
        vGx[j] <== v[j] * GX();
        vGy[j] <== 1 + v[j] * (GY() - 1);
        add[j] = BabyAdd();
        add[j].x1 <== vGx[j];
        add[j].y1 <== vGy[j];
        add[j].x2 <== rPK[j].out[0];
        add[j].y2 <== rPK[j].out[1];
        add[j].xout === CB[j][0];
        add[j].yout === CB[j][1];
    }
    sum[k] === 1;

    // 10. bind the per-poll values to pollHash
    component ph1 = Poseidon(5);
    ph1.inputs[0] <== idRoot;
    ph1.inputs[1] <== revRoot;
    ph1.inputs[2] <== pollId;
    ph1.inputs[3] <== PK[0];
    ph1.inputs[4] <== PK[1];
    component ph2 = Poseidon(5);
    ph2.inputs[0] <== maxBirthDay;
    ph2.inputs[1] <== minBirthDay;
    ph2.inputs[2] <== minExpiryMonth;
    ph2.inputs[3] <== requiredNat;
    ph2.inputs[4] <== ctxHash;
    component ph = Poseidon(3);
    ph.inputs[0] <== 7;              // TAG.POLL
    ph.inputs[1] <== ph1.out;
    ph.inputs[2] <== ph2.out;
    ph.out === pollHash;
}

component main {public [pollHash, nf, CA, CB, idRootNow]} = Recovery(32, 32, 4);
