// SPDX-License-Identifier: Apache-2.0
// Poseidon Merkle trees matching circuits/ballot.circom.
//  - IdentityTree: append-only binary tree of identity leaves (empty leaf = 0).
//  - RevocationTree: indexed (sorted linked-list) tree of revoked handles, leaf =
//    Poseidon(value, nextValue), starting with the sentinel leaf (0, 0). Proves
//    non-membership of rn with the "low leaf": value < rn < next (next 0 = +∞).
// Reference code; rebuilding paths is O(n) and only suitable for tests.
"use strict";

class IncrementalTree {
  constructor(H, depth) {
    this.H = H; this.depth = depth; this.leaves = [];
    this.zeros = [0n];
    for (let i = 0; i < depth; i++) this.zeros.push(H([this.zeros[i], this.zeros[i]]));
  }
  insert(leaf) { this.leaves.push(BigInt(leaf)); return this.leaves.length - 1; }
  update(i, leaf) { this.leaves[i] = BigInt(leaf); }
  levels() {
    const lv = [this.leaves.slice()];
    for (let d = 0; d < this.depth; d++) {
      const cur = lv[d], next = [];
      for (let i = 0; i < cur.length; i += 2) {
        const l = cur[i], r = i + 1 < cur.length ? cur[i + 1] : this.zeros[d];
        next.push(this.H([l, r]));
      }
      lv.push(next);
    }
    return lv;
  }
  get root() { const lv = this.levels(); return lv[this.depth][0] ?? this.zeros[this.depth]; }
  path(index) {
    const lv = this.levels(), siblings = [], pathIndex = [];
    let i = index;
    for (let d = 0; d < this.depth; d++) {
      const sib = i ^ 1;
      siblings.push(sib < lv[d].length ? lv[d][sib] : this.zeros[d]);
      pathIndex.push(i & 1);
      i >>= 1;
    }
    return { siblings, pathIndex };
  }
}

class RevocationTree {
  constructor(H, depth) {
    this.H = H;
    this.tree = new IncrementalTree(H, depth);
    this.entries = [{ value: 0n, next: 0n }];
    this.tree.insert(H([0n, 0n]));
  }
  static LIMIT = 1n << 252n;
  lowIndex(x) {
    return this.entries.findIndex((e) => e.value < x && (e.next === 0n || x < e.next));
  }
  revoke(x) {
    x = BigInt(x);
    if (x <= 0n || x >= RevocationTree.LIMIT) throw new Error("handle out of range");
    if (this.entries.some((e) => e.value === x)) throw new Error("already revoked");
    const li = this.lowIndex(x), low = this.entries[li];
    this.entries.push({ value: x, next: low.next });
    this.tree.insert(this.H([x, low.next]));
    low.next = x;
    this.tree.update(li, this.H([low.value, low.next]));
  }
  get root() { return this.tree.root; }
  // Witness for "x is not revoked". Throws if x is revoked (no low leaf exists).
  nonMembership(x) {
    x = BigInt(x);
    const li = this.lowIndex(x);
    if (li < 0) throw new Error("handle is revoked");
    const { value, next } = this.entries[li];
    return { lowValue: value, nextValue: next, ...this.tree.path(li) };
  }
}

module.exports = { IncrementalTree, RevocationTree };
