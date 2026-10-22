// SPDX-License-Identifier: Apache-2.0
// Proof of One — ballot proof π_vote (reference circuit).
// Specification: docs/specs/ballot-and-enrolment-v0.1.md §4.2, with the revocation
// handle of red-team change C1 (docs/specs/red-team-review-ballot-spec-v0.1.md).
//
// STATEMENT (all private values stay on the phone):
//   1. P = s·G and idc = Poseidon(P.x, P.y)                     identity
//   2. leaf = Poseidon(idc, Poseidon(ageBand, natCode, sexCode, expiryMonth, salt), rn)
//      and leaf is in the identity tree with root `idRoot`       membership
//   3. rn is NOT in the revocation tree with root `revRoot`       not revoked
//   4. nf = Poseidon(1, pollId, s)                               one ballot per poll
//   5. ageBand ≥ minAgeBand, expiryMonth ≥ minExpiryMonth,
//      and natCode == requiredNat unless requiredNat == 0        eligibility
//   6. every v_j ∈ {0,1} and Σ v_j = 1                           well-formed one-hot
//   7. A_j = r_j·G and B_j = v_j·G + r_j·PK for every j           encryption
//   8. ctxHash is bound to the proof                              no replay elsewhere
//   9. pollHash = Poseidon(7, Poseidon(idRoot, revRoot, pollId, PK.x, PK.y),
//                         Poseidon(minAgeBand, minExpiryMonth, requiredNat, ctxHash))
//
// PUBLIC INPUTS (18): pollHash, nf, and the 16 ciphertext coordinates. The nine
// per-poll values are private inputs bound by pollHash, which the contract computes
// once when the poll is created. This saves about 50,000 gas per ballot compared
// with making all nine public (docs/specs/implementation-notes-v0.1.md).
//
// SECURITY ASSUMPTIONS AND LIMITS
// - G is Base8, generator of the prime-order subgroup of Baby Jubjub.
// - PK must be checked to be on the curve and in the subgroup OUTSIDE the circuit
//   (by the contract / ledger) — the circuit trusts it as a public input.
// - Scalars s and r_j are decomposed into 253 bits; values ≥ the subgroup order
//   are allowed and harmless for encryption, but the phone should sample them < ℓ.
// - Revocation handles rn and indexed-tree values must be < 2^252 (comparator range).
// - Reference circuit for review. Not audited.

pragma circom 2.1.0;

include "../node_modules/circomlib/circuits/poseidon.circom";
include "../node_modules/circomlib/circuits/babyjub.circom";
include "../node_modules/circomlib/circuits/escalarmulfix.circom";
include "../node_modules/circomlib/circuits/escalarmulany.circom";
include "../node_modules/circomlib/circuits/bitify.circom";
include "../node_modules/circomlib/circuits/comparators.circom";

// Base8 of Baby Jubjub (EIP-2494).
function GX() { return 5299619240641551281634865583518297030282874472190772894086521144482721001553; }
function GY() { return 16950150798460657717958625567821834550301663161624707787222815936182638968203; }

// Root of a binary Poseidon Merkle tree from a leaf and its path.
// pathIndex[i] = 0 if the current node is the left child at level i, 1 if right.
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
        // left = idx ? sibling : cur ; right = idx ? cur : sibling
        left[i]  <== cur[i] + pathIndex[i] * (siblings[i] - cur[i]);
        right[i] <== siblings[i] + pathIndex[i] * (cur[i] - siblings[i]);
        h[i] = Poseidon(2);
        h[i].inputs[0] <== left[i];
        h[i].inputs[1] <== right[i];
        cur[i + 1] <== h[i].out;
    }
    root <== cur[depth];
}

// x·G for a 253-bit scalar x (fixed base).
template MulG() {
    signal input x;
    signal output out[2];
    component bits = Num2Bits(253);
    bits.in <== x;
    component m = EscalarMulFix(253, [GX(), GY()]);
    for (var i = 0; i < 253; i++) m.e[i] <== bits.out[i];
    out[0] <== m.out[0];
    out[1] <== m.out[1];
}

// x·P for a 253-bit scalar x and a variable point P.
template MulAny() {
    signal input x;
    signal input p[2];
    signal output out[2];
    component bits = Num2Bits(253);
    bits.in <== x;
    component m = EscalarMulAny(253);
    for (var i = 0; i < 253; i++) m.e[i] <== bits.out[i];
    m.p[0] <== p[0];
    m.p[1] <== p[1];
    out[0] <== m.out[0];
    out[1] <== m.out[1];
}

template Ballot(depth, revDepth, k) {
    // ------------------------------------------------------------ public inputs
    signal input pollHash;
    signal input nf;
    signal input CA[k][2];           // A_j
    signal input CB[k][2];           // B_j

    // ------------------------------------------- per-poll values, bound by pollHash
    signal input idRoot;
    signal input revRoot;
    signal input pollId;
    signal input PK[2];
    signal input minAgeBand;
    signal input minExpiryMonth;
    signal input requiredNat;        // 0 = any nationality
    signal input ctxHash;

    // ----------------------------------------------------------- private inputs
    signal input s;
    signal input ageBand;
    signal input natCode;
    signal input sexCode;
    signal input expiryMonth;
    signal input salt;
    signal input rn;
    signal input idSiblings[depth];
    signal input idPathIndex[depth];
    // revocation non-membership: the "low" leaf (lowValue, nextValue) with
    // lowValue < rn < nextValue (nextValue == 0 means +infinity)
    signal input lowValue;
    signal input nextValue;
    signal input revSiblings[revDepth];
    signal input revPathIndex[revDepth];
    signal input v[k];
    signal input r[k];

    // 1. identity
    component P = MulG();
    P.x <== s;
    component idc = Poseidon(2);
    idc.inputs[0] <== P.out[0];
    idc.inputs[1] <== P.out[1];

    // 2. membership
    component attr = Poseidon(5);
    attr.inputs[0] <== ageBand;
    attr.inputs[1] <== natCode;
    attr.inputs[2] <== sexCode;
    attr.inputs[3] <== expiryMonth;
    attr.inputs[4] <== salt;
    component leaf = Poseidon(3);
    leaf.inputs[0] <== idc.out;
    leaf.inputs[1] <== attr.out;
    leaf.inputs[2] <== rn;
    component idTree = MerkleRoot(depth);
    idTree.leaf <== leaf.out;
    for (var i = 0; i < depth; i++) {
        idTree.siblings[i] <== idSiblings[i];
        idTree.pathIndex[i] <== idPathIndex[i];
    }
    idTree.root === idRoot;

    // 3. not revoked (indexed Merkle tree, low-leaf proof)
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
    lowLt.in[1] <== rn;
    lowLt.out === 1;
    component nextIsInf = IsZero();
    nextIsInf.in <== nextValue;
    component rnLtNext = LessThan(252);
    rnLtNext.in[0] <== rn;
    rnLtNext.in[1] <== nextValue;
    // rn < nextValue, or nextValue == 0 (end of list)
    (1 - nextIsInf.out) * (1 - rnLtNext.out) === 0;

    // 4. nullifier
    component nfH = Poseidon(3);
    nfH.inputs[0] <== 1;             // domain tag TAG.NULLIFIER
    nfH.inputs[1] <== pollId;
    nfH.inputs[2] <== s;
    nfH.out === nf;

    // 5. eligibility policy
    component ageOk = GreaterEqThan(16);
    ageOk.in[0] <== ageBand;
    ageOk.in[1] <== minAgeBand;
    ageOk.out === 1;
    component expOk = GreaterEqThan(32);
    expOk.in[0] <== expiryMonth;
    expOk.in[1] <== minExpiryMonth;
    expOk.out === 1;
    requiredNat * (natCode - requiredNat) === 0;

    // 6–7. one-hot ballot, encrypted
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

        // v_j·G is G when v_j = 1, the identity (0, 1) when v_j = 0
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

    // 8–9. bind every per-poll value, including the submission context, to pollHash
    component ph1 = Poseidon(5);
    ph1.inputs[0] <== idRoot;
    ph1.inputs[1] <== revRoot;
    ph1.inputs[2] <== pollId;
    ph1.inputs[3] <== PK[0];
    ph1.inputs[4] <== PK[1];
    component ph2 = Poseidon(4);
    ph2.inputs[0] <== minAgeBand;
    ph2.inputs[1] <== minExpiryMonth;
    ph2.inputs[2] <== requiredNat;
    ph2.inputs[3] <== ctxHash;
    component ph = Poseidon(3);
    ph.inputs[0] <== 7;              // domain tag TAG.POLL
    ph.inputs[1] <== ph1.out;
    ph.inputs[2] <== ph2.out;
    ph.out === pollHash;
}

component main {public [pollHash, nf, CA, CB]} = Ballot(32, 32, 4);
