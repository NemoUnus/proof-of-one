// SPDX-License-Identifier: Apache-2.0
// The service core (reference/service-core, Rust compiled to WebAssembly) seen from
// JavaScript: core.call(name, input) -> output, JSON in and out.
// In the Worker: makeCore(module) with `import module from "./core.wasm"`.
// In tests: the same module read from disk.

const enc = new TextEncoder(), dec = new TextDecoder();

export function makeCore(module) {
  const { exports: x } = new WebAssembly.Instance(module, {});
  const put = (s) => { const b = enc.encode(s), p = x.alloc(b.length); new Uint8Array(x.memory.buffer, p, b.length).set(b); return [p, b.length]; };
  function call(name, input) {
    const [np, nl] = put(name), [ip, il] = put(JSON.stringify(input));
    const out = x.call(np, nl, ip, il);
    const len = new DataView(x.memory.buffer).getUint32(out, true);
    const text = dec.decode(new Uint8Array(x.memory.buffer, out + 4, len).slice());
    x.dealloc(np, nl); x.dealloc(ip, il); x.dealloc(out, len + 4);
    const v = JSON.parse(text);
    if (v && typeof v === "object" && !Array.isArray(v) && typeof v.error === "string") throw new Error(v.error);
    return v;
  }
  return { call };
}

// Fresh random bytes as hex, for the core's nonces.
export function randomHex(n) {
  const b = crypto.getRandomValues(new Uint8Array(n));
  return Array.from(b, (v) => v.toString(16).padStart(2, "0")).join("");
}
