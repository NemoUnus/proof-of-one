// SPDX-License-Identifier: Apache-2.0
// Proof of One — invitation ticket for sampled polls (reference, NOT for production use).
// Design: docs/specs/cost-of-large-polls-v0.1.md §2 (Decision Log #44).
//
//   ticket  = Poseidon(13, pollId, seed, s)        13 = domain tag SAMPLE
//   top     = the 64 most significant of the 254 bits of ticket
//   invited ⇔ top < threshold                      threshold ≤ 2^64
//
// seed is a public random value fixed after the poll's snapshot; threshold encodes the
// invitation rate p as about p · floor(r / 2^190), where r is the field size. A
// threshold of 2^64 invites everyone (an open poll), so one ballot circuit can serve
// both poll types. seed and threshold are to be bound into pollHash like the other
// per-poll values. Num2Bits_strict rejects the second 254-bit representation of the
// ticket, so the prover cannot choose its top bits.
pragma circom 2.1.0;

include "../node_modules/circomlib/circuits/poseidon.circom";
include "../node_modules/circomlib/circuits/bitify.circom";
include "../node_modules/circomlib/circuits/comparators.circom";

template SampleTicket() {
    signal input pollId;
    signal input seed;
    signal input s;
    signal input threshold;   // 1 … 2^64

    component h = Poseidon(4);
    h.inputs[0] <== 13;
    h.inputs[1] <== pollId;
    h.inputs[2] <== seed;
    h.inputs[3] <== s;

    component bits = Num2Bits_strict();
    bits.in <== h.out;
    var top = 0;
    for (var i = 0; i < 64; i++) top += bits.out[190 + i] * (1 << i);

    // threshold must itself fit in 65 bits for the comparison to be sound
    component tb = Num2Bits(65);
    tb.in <== threshold;
    component lt = LessThan(65);
    lt.in[0] <== top;
    lt.in[1] <== threshold;
    lt.out === 1;
}
