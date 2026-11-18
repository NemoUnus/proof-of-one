// TEST ONLY: DocumentKeys alone, to test the fingerprint part apart from π_doc.
pragma circom 2.1.6;
include "../lib/fingerprint.circom";
component main {public [path, pB, pZ, dB, dZ]} = DocumentKeys();
