// SPDX-License-Identifier: Apache-2.0
// Proof of One — π_doc, suite 2: SHA-1 data-group hashes, SHA-1 CMS digest, RSA up to
// 3146 bits (26 limbs; RSA-3072 in practice) PKCS#1 v1.5, any odd exponent below 2^17
// (reference, NOT for production use). The circuit itself is in lib/document_core.circom.
pragma circom 2.1.6;
include "./lib/document_core.circom";
component main {public [dscRoot, today, currentYear, cm, challenge]} = DocumentProof(448, 192, 16, 160, 160, 26, 17, 2);
