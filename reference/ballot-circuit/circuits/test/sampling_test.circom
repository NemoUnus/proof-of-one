pragma circom 2.1.0;
include "../sampling.circom";
component main {public [pollId, seed, threshold]} = SampleTicket();
