// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.24;

/// @title Baby Jubjub point validation (EIP-2494)
/// @notice Checks that a point is on the curve and in the prime-order subgroup.
/// @dev Used once per poll to validate the tally public key, and by the tally checks
///      (running aggregate, decryption challenges). Ballot ciphertexts do not need the
///      subgroup check on-chain: the ballot proof computes them from Base8 and the
///      (validated) tally key, so they are in the subgroup by construction.
///      Points are kept in projective coordinates (X : Y : Z), so no modular inversion
///      is needed except in toAffine. (0 : 0 : 0) is used as a storage default and
///      treated as the identity by add.
///      Reference code; not audited.
library BabyJubjub {
    uint256 internal constant P = 21888242871839275222246405745257275088548364400416034343698204186575808495617;
    uint256 internal constant A = 168700;
    uint256 internal constant D = 168696;
    uint256 internal constant ORDER = 2736030358979909402780800718157159386076813972158567259200215660948447373041;

    function isOnCurve(uint256 x, uint256 y) internal pure returns (bool) {
        if (x >= P || y >= P) return false;
        uint256 x2 = mulmod(x, x, P);
        uint256 y2 = mulmod(y, y, P);
        uint256 lhs = addmod(mulmod(A, x2, P), y2, P);
        uint256 rhs = addmod(1, mulmod(D, mulmod(x2, y2, P), P), P);
        return lhs == rhs;
    }

    /// @notice True if (x, y) is on the curve, not the identity, and ORDER·(x, y) = identity.
    function isInSubgroup(uint256 x, uint256 y) internal pure returns (bool) {
        if (!isOnCurve(x, y)) return false;
        if (x == 0 && y == 1) return false; // identity is not a valid public key
        (uint256 X, uint256 Y, uint256 Z) = _mul(x, y, ORDER);
        return X == 0 && Y == Z; // projective identity (0 : 1 : 1)
    }

    /// @notice True for the identity (0, 1) or a point of the prime-order subgroup.
    function isInSubgroupOrIdentity(uint256 x, uint256 y) internal pure returns (bool) {
        return (x == 0 && y == 1) || isInSubgroup(x, y);
    }

    /// @notice Base8, the generator used by the ballot circuit and the reference tally.
    uint256 internal constant GX = 5299619240641551281634865583518297030282874472190772894086521144482721001553;
    uint256 internal constant GY = 16950150798460657717958625567821834550301663161624707787222815936182638968203;

    /// @notice Projective addition; (0 : 0 : 0) counts as the identity.
    function add(uint256 X1, uint256 Y1, uint256 Z1, uint256 X2, uint256 Y2, uint256 Z2)
        internal pure returns (uint256, uint256, uint256)
    {
        if (Z1 == 0) return (X2, Y2, Z2);
        if (Z2 == 0) return (X1, Y1, Z1);
        return _add(X1, Y1, Z1, X2, Y2, Z2);
    }

    /// @notice k·(x, y) for an affine point, in projective coordinates.
    function mul(uint256 x, uint256 y, uint256 k) internal pure returns (uint256, uint256, uint256) {
        return _mul(x, y, k);
    }

    /// @notice Projective equality (both points must have Z ≠ 0).
    function eq(uint256 X1, uint256 Y1, uint256 Z1, uint256 X2, uint256 Y2, uint256 Z2) internal pure returns (bool) {
        return mulmod(X1, Z2, P) == mulmod(X2, Z1, P) && mulmod(Y1, Z2, P) == mulmod(Y2, Z1, P);
    }

    /// @notice Affine coordinates of a projective point (one modular inversion).
    function toAffine(uint256 X, uint256 Y, uint256 Z) internal view returns (uint256, uint256) {
        if (Z == 0) return (0, 1); // storage default = identity
        uint256 zi = expmod(Z, P - 2, P);
        return (mulmod(X, zi, P), mulmod(Y, zi, P));
    }

    /// @notice b^e mod m with the modexp precompile (EIP-198).
    function expmod(uint256 b, uint256 e, uint256 m) internal view returns (uint256 r) {
        (bool ok, bytes memory out) = address(5).staticcall{gas: 20000}(abi.encode(32, 32, 32, b, e, m));
        require(ok, "modexp");
        r = abi.decode(out, (uint256));
    }

    // Projective addition on a twisted Edwards curve (a·x² + y² = 1 + d·x²·y²).
    function _add(uint256 X1, uint256 Y1, uint256 Z1, uint256 X2, uint256 Y2, uint256 Z2)
        private pure returns (uint256, uint256, uint256)
    {
        uint256 a_ = mulmod(Z1, Z2, P);
        uint256 b_ = mulmod(a_, a_, P);
        uint256 c_ = mulmod(X1, X2, P);
        uint256 d_ = mulmod(Y1, Y2, P);
        uint256 e_ = mulmod(D, mulmod(c_, d_, P), P);
        uint256 f_ = addmod(b_, P - e_, P);
        uint256 g_ = addmod(b_, e_, P);
        uint256 t = addmod(mulmod(addmod(X1, Y1, P), addmod(X2, Y2, P), P), P - addmod(c_, d_, P), P);
        uint256 X3 = mulmod(mulmod(a_, f_, P), t, P);
        uint256 Y3 = mulmod(mulmod(a_, g_, P), addmod(d_, P - mulmod(A, c_, P), P), P);
        uint256 Z3 = mulmod(f_, g_, P);
        return (X3, Y3, Z3);
    }

    function _mul(uint256 x, uint256 y, uint256 k) private pure returns (uint256 X, uint256 Y, uint256 Z) {
        (X, Y, Z) = (0, 1, 1);
        (uint256 Qx, uint256 Qy, uint256 Qz) = (x, y, 1);
        while (k != 0) {
            if (k & 1 == 1) (X, Y, Z) = _add(X, Y, Z, Qx, Qy, Qz);
            (Qx, Qy, Qz) = _add(Qx, Qy, Qz, Qx, Qy, Qz);
            k >>= 1;
        }
    }
}
