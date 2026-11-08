// SPDX-License-Identifier: Apache-2.0
// Proof of One — reading and checking a transparency log in the C2SP tlog-tiles format
// (as written by Tessera), in the browser and in Node. TEST LOG, synthetic ballots only.
//
// What it checks, with no trust in the server that hosts the files:
//  1. the checkpoint (origin, size, root hash) is a signed note under the log's public key
//     (C2SP signed-note, Ed25519), and optionally cosigned by witnesses (C2SP tlog-cosignature);
//  2. the root hash recomputed from the log's tiles equals the signed root, and the leaf at a
//     given index is the RFC 6962 hash of the entry found in the entry bundle at that index.
// Together these show that the entry is in the tree the log signed. All hashing is SHA-256.
(function (root) {
  "use strict";
  const enc = new TextEncoder();
  const subtle = (typeof crypto !== "undefined" && crypto.subtle) ? crypto.subtle : require("crypto").webcrypto.subtle;
  const b64 = (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
  const toB64 = (u) => btoa(String.fromCharCode(...u));
  const cat = (...a) => { const o = new Uint8Array(a.reduce((n, x) => n + x.length, 0)); let i = 0; for (const x of a) { o.set(x, i); i += x.length; } return o; };
  const sha256 = async (u) => new Uint8Array(await subtle.digest("SHA-256", u));
  const eq = (a, b) => a.length === b.length && a.every((x, i) => x === b[i]);

  // ---- signed notes (c2sp.org/signed-note); Ed25519 keys only
  // vkey: "<name>+<hex key hash>+<base64(0x01 || 32-byte public key)>"
  async function parseVkey(vkey) {
    const a = vkey.indexOf("+"), b = vkey.indexOf("+", a + 1);   // the key itself may contain "+"
    const name = vkey.slice(0, a), hash = vkey.slice(a + 1, b), k = vkey.slice(b + 1);
    const raw = b64(k);
    // 0x01: Ed25519 signer key (the log); 0x04: Ed25519 cosignature key (a witness, c2sp.org/tlog-cosignature)
    if (!((raw[0] === 1 || raw[0] === 4) && raw.length === 33)) throw new Error("only Ed25519 verifier keys (types 0x01 and 0x04) are supported");
    const id = (await sha256(cat(enc.encode(name), enc.encode("\n"), raw))).slice(0, 4);
    const hex = [...id].map((x) => x.toString(16).padStart(2, "0")).join("");
    if (hex !== hash) throw new Error("verifier key hash does not match its key");
    const key = await subtle.importKey("raw", raw.slice(1), { name: "Ed25519" }, false, ["verify"]);
    return { name, id, key, pub: raw.slice(1), type: raw[0] };
  }
  // Returns the note text and the list of signatures that verify under any of the given keys.
  async function openNote(note, vkeys) {
    const cut = note.lastIndexOf("\n\n");
    if (cut < 0) throw new Error("not a signed note");
    const text = note.slice(0, cut + 1);
    const sigs = note.slice(cut + 2).split("\n").filter((l) => l.startsWith("— "));
    const keys = await Promise.all(vkeys.map(parseVkey));
    const ok = [];
    for (const line of sigs) {
      const [, name, sigB64] = line.match(/^— (\S+) (\S+)$/) || [];
      if (!name) continue;
      const sig = b64(sigB64);
      for (const k of keys) {
        if (k.name !== name || !eq(sig.slice(0, 4), k.id)) continue;
        if (k.type === 1 && sig.length === 68 && await subtle.verify({ name: "Ed25519" }, k.key, sig.slice(4), enc.encode(text))) ok.push({ name, type: "signature" });
        // C2SP tlog-cosignature v1 (key type 0x04): signed message "cosignature/v1\ntime <t>\n" + note body
        if (k.type === 4 && sig.length === 76) {
          const t = sig.slice(4, 12); let time = 0n; for (const x of t) time = (time << 8n) | BigInt(x);
          const msg = enc.encode(`cosignature/v1\ntime ${time}\n` + text);
          if (await subtle.verify({ name: "Ed25519" }, k.key, sig.slice(12), msg)) ok.push({ name, type: "cosignature", time: Number(time) });
        }
      }
    }
    return { text, verified: ok };
  }
  function parseCheckpoint(text) {
    const [origin, size, rootHash] = text.split("\n");
    if (!/^\d+$/.test(size)) throw new Error("bad checkpoint size");
    return { origin, size: Number(size), root: b64(rootHash) };
  }

  // ---- tiles (c2sp.org/tlog-tiles): tile height 8, width up to 256
  const encIndex = (n) => { const s = String(n).padStart(3, "0"); const parts = []; let x = n; do { parts.unshift(String(x % 1000).padStart(3, "0")); x = Math.floor(x / 1000); } while (x > 0); return parts.map((p, i) => (i < parts.length - 1 ? "x" + p : p)).join("/"); };
  function tilePath(level, index, width) { return `tile/${level}/${encIndex(index)}` + (width < 256 ? `.p/${width}` : ""); }
  function entriesPath(index, width) { return `tile/entries/${encIndex(index)}` + (width < 256 ? `.p/${width}` : ""); }

  // A reader for one log of `size` leaves; `fetchBytes(path)` returns a Uint8Array.
  function reader(fetchBytes, size) {
    const tiles = new Map();
    const width = (level, index) => { // number of hashes in tile (level, index) for a tree of `size`
      const leavesPerHash = 2 ** (8 * level), n = Math.floor(size / leavesPerHash);
      return Math.min(256, n - index * 256);
    };
    async function tile(level, index) {
      const k = level + "/" + index;
      if (!tiles.has(k)) tiles.set(k, fetchBytes(tilePath(level, index, width(level, index))));
      return tiles.get(k);
    }
    // Hash of the complete subtree at height h covering leaves [i*2^h, (i+1)*2^h)
    async function node(h, i) {
      if (h % 8 === 0) {
        const L = h / 8, t = await tile(L, Math.floor(i / 256)), p = i % 256;
        if (t.length < 32 * (p + 1)) throw new Error(`tile ${L}/${Math.floor(i / 256)} too short`);
        return t.slice(32 * p, 32 * (p + 1));
      }
      return sha256(cat(Uint8Array.of(1), await node(h - 1, 2 * i), await node(h - 1, 2 * i + 1)));
    }
    // RFC 6962 Merkle tree hash of leaves [lo, hi)
    async function mth(lo, hi) {
      const n = hi - lo;
      if ((n & (n - 1)) === 0 && lo % n === 0) return node(Math.log2(n), lo / n);
      let k = 1; while (k * 2 < n) k *= 2;
      return sha256(cat(Uint8Array.of(1), await mth(lo, lo + k), await mth(lo + k, hi)));
    }
    async function entry(i) {
      const b = await fetchBytes(entriesPath(Math.floor(i / 256), Math.min(256, size - Math.floor(i / 256) * 256)));
      let o = 0;
      for (let j = 0; j <= i % 256; j++) {
        const len = (b[o] << 8) | b[o + 1]; o += 2;
        if (j === i % 256) return b.slice(o, o + len);
        o += len;
      }
      throw new Error("entry not found in bundle");
    }
    return { root: () => mth(0, size), leaf: (i) => node(0, i), entry };
  }

  // Full check of entry i against a checkpoint note. Returns the entry bytes.
  async function checkEntry(fetchBytes, checkpointNote, logVkey, i, witnessVkeys = []) {
    const logKey = await openNote(checkpointNote, [logVkey]);
    if (!logKey.verified.some((s) => s.type === "signature")) throw new Error("the checkpoint is not signed by the log's key");
    const cp = parseCheckpoint(logKey.text);
    if (!(i >= 0 && i < cp.size)) throw new Error("entry index outside the checkpoint");
    const r = reader(fetchBytes, cp.size);
    if (!eq(await r.root(), cp.root)) throw new Error("the tiles do not give the signed root");
    const e = await r.entry(i);
    if (!eq(await r.leaf(i), await sha256(cat(Uint8Array.of(0), e)))) throw new Error("the entry does not match its leaf hash");
    const cos = witnessVkeys.length ? (await openNote(checkpointNote, witnessVkeys)).verified.filter((s) => s.type === "cosignature") : [];
    return { checkpoint: cp, entry: e, cosignatures: cos };
  }

  const api = { openNote, parseVkey, parseCheckpoint, reader, checkEntry, tilePath, entriesPath, sha256, toB64 };
  if (typeof module !== "undefined" && module.exports) module.exports = api; else root.TLog = api;
})(typeof self !== "undefined" ? self : this);
