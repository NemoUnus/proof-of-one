// SPDX-License-Identifier: Apache-2.0
// Proof of One — π_doc, suite 1: SHA-256 data-group hashes, SHA-256 CMS digest,
// RSA-2048 PKCS#1 v1.5, e = 65537 (reference, NOT for production use).
// The circuit itself is in lib/document_core.circom.
pragma circom 2.1.6;
include "./lib/document_core.circom";
component main {public [dscRoot, today, currentYear, cm, challenge]} = DocumentProof(448, 192, 16, 256, 256, 17, 0, 1);
