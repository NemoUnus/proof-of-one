// SPDX-License-Identifier: Apache-2.0
// Proof of One — rebuilding the revocation path on the phone (implementation note N33).
//
// A member's test kit carries a non-revocation witness for the revocation root of the day it
// was made. When the root changes (someone else is revoked), the poll contract accepts ballots
// against the new root only (after a 10-minute grace). The phone therefore rebuilds the
// revocation tree from the public list of revoked handles (the RevocationRegistry's Revoked
// events, in index order), checks that the rebuilt root equals the registry's current root,
// and replaces the witness and the pollHash in the ballot input.
//
// Same trees as ballot-circuit/src/trees.js (Poseidon, circomlib parameters): an indexed
// (sorted linked-list) tree of depth 32, leaf = Poseidon(value, next), sentinel (0, 0).
// Needs PoseidonLite (poseidon.min.js) in the browser, or poseidon-lite in Node.
(function (root) {
  "use strict";
  const PL = root.PoseidonLite || (typeof require === "function" ? (() => {
    const { poseidon2 } = require("poseidon-lite/poseidon2"), { poseidon3 } = require("poseidon-lite/poseidon3"), { poseidon5 } = require("poseidon-lite/poseidon5");
    return { poseidon2, poseidon3, poseidon5 };
  })() : null);
  const DEPTH = 32;
  const H2 = (a, b) => PL.poseidon2([a, b]);

  class Tree {
    constructor() { this.leaves = []; this.zeros = [0n]; for (let i = 0; i < DEPTH; i++) this.zeros.push(H2(this.zeros[i], this.zeros[i])); }
    levels() {
      const lv = [this.leaves.slice()];
      for (let d = 0; d < DEPTH; d++) {
        const cur = lv[d], next = [];
        for (let i = 0; i < cur.length; i += 2) next.push(H2(cur[i], i + 1 < cur.length ? cur[i + 1] : this.zeros[d]));
        lv.push(next);
      }
      return lv;
    }
    root(lv = this.levels()) { return lv[DEPTH][0] ?? this.zeros[DEPTH]; }
    path(index, lv = this.levels()) {
      const siblings = [], pathIndex = [];
      for (let d = 0, i = index; d < DEPTH; d++, i >>= 1) { siblings.push((i ^ 1) < lv[d].length ? lv[d][i ^ 1] : this.zeros[d]); pathIndex.push(i & 1); }
      return { siblings, pathIndex };
    }
  }

  // handles: revoked rn values in the order of their index (1, 2, …).
  function rebuild(handles) {
    const t = new Tree(), entries = [{ value: 0n, next: 0n }];
    t.leaves.push(H2(0n, 0n));
    for (const h of handles.map(BigInt)) {
      const li = entries.findIndex((e) => e.value < h && (e.next === 0n || h < e.next));
      if (li < 0) throw new Error("revocation list is inconsistent");
      const low = entries[li];
      entries.push({ value: h, next: low.next }); t.leaves.push(H2(h, low.next));
      low.next = h; t.leaves[li] = H2(low.value, low.next);
    }
    const lv = t.levels();
    return {
      root: t.root(lv),
      // Witness that rn is not revoked; null if it is.
      nonMembership(rn) {
        rn = BigInt(rn);
        const li = entries.findIndex((e) => e.value < rn && (e.next === 0n || rn < e.next));
        if (li < 0) return null;
        return { lowValue: entries[li].value, nextValue: entries[li].next, ...t.path(li, lv) };
      },
    };
  }

  // pollHash = Poseidon(7, Poseidon(idRoot, revRoot, pollId, PK.x, PK.y),
  //                       Poseidon(maxBirthDay, minBirthDay, minExpiryMonth, requiredNat, ctxHash))
  function pollHash(input, revRoot) {
    const B = (x) => BigInt(x);
    const h1 = PL.poseidon5([B(input.idRoot), B(revRoot), B(input.pollId), B(input.PK[0]), B(input.PK[1])]);
    const h2 = PL.poseidon5([B(input.maxBirthDay), B(input.minBirthDay), B(input.minExpiryMonth), B(input.requiredNat), B(input.ctxHash)]);
    return PL.poseidon3([7n, h1, h2]);
  }

  // The kit's ballot input, moved to the revocation tree given by `handles`.
  // Returns { input } or { revoked: true } if the member's own handle is in the list.
  function refresh(input, handles, expectedRoot) {
    const t = rebuild(handles);
    if (expectedRoot !== undefined && t.root !== BigInt(expectedRoot)) throw new Error("the rebuilt revocation list does not match the registry");
    const w = t.nonMembership(input.rn);
    if (!w) return { revoked: true };
    return { input: { ...input, revRoot: t.root.toString(), pollHash: pollHash(input, t.root).toString(),
      lowValue: w.lowValue.toString(), nextValue: w.nextValue.toString(), revSiblings: w.siblings.map(String), revPathIndex: w.pathIndex.map(String) } };
  }

  const api = { rebuild, pollHash, refresh, DEPTH };
  if (typeof module !== "undefined" && module.exports) module.exports = api; else root.PoORevocation = api;
})(typeof globalThis !== "undefined" ? globalThis : this);
