// node --test topup.test.mjs — the top-up logic with stand-ins for the faucet and the endpoint.
import test from "node:test";
import assert from "node:assert";
import { requestsNeeded, drip, balanceEth } from "./topup.mjs";
const noSleep = async () => {};
test("requests only what reaches the target, within one run's maximum", () => {
  assert.strictEqual(requestsNeeded(0.03, 0.03, 300), 0);
  assert.strictEqual(requestsNeeded(0.05, 0.03, 300), 0);
  assert.strictEqual(requestsNeeded(0.0299, 0.03, 300), 1);
  assert.strictEqual(requestsNeeded(0.00026, 0.03, 300), 298);
  assert.strictEqual(requestsNeeded(0, 0.03, 100), 100);
});
test("sends to the relay on Base Sepolia, test ETH only", async () => {
  const calls = [];
  const r = await drip(async (o) => { calls.push(o); }, 3, "0x3dB9d15202Bd291558889b42eb4291e288797fb9", noSleep);
  assert.strictEqual(r.sent, 3);
  assert.deepStrictEqual(calls[0], { address: "0x3dB9d15202Bd291558889b42eb4291e288797fb9", network: "base-sepolia", token: "eth" });
});
test("stops when Coinbase says the limit is reached", async () => {
  let k = 0;
  const r = await drip(async () => { if (++k > 5) { const e = new Error("x"); e.errorType = "faucet_limit_exceeded"; throw e; } }, 100, undefined, noSleep);
  assert.strictEqual(r.sent, 5); assert.match(r.stopped, /limit/);
});
test("tolerates a passing error, stops after three in a row", async () => {
  let k = 0;
  const flaky = await drip(async () => { if (++k === 2) throw new Error("busy"); }, 4, undefined, noSleep);
  assert.strictEqual(flaky.sent, 4); assert.strictEqual(flaky.stopped, null);
  const broken = await drip(async () => { throw new Error("down"); }, 4, undefined, noSleep);
  assert.strictEqual(broken.sent, 0); assert.match(broken.stopped, /faucet error/);
});
test("reads the balance from the public endpoint", async () => {
  const fake = async () => ({ json: async () => ({ jsonrpc: "2.0", id: 1, result: "0xf497d0b0f6f2" }) });   // 0.000269 ETH
  assert.strictEqual(await balanceEth("0x3dB9d15202Bd291558889b42eb4291e288797fb9", "x", fake), 0.000268);   // truncated to 6 decimals
});
