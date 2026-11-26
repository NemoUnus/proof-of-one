// SPDX-License-Identifier: AGPL-3.0-or-later
// Proof of One — keep the relay's account funded with test coins (Decision #69, point 6).
//
// The relay pays the volunteers' registrations and ballots on Base Sepolia from its own
// account. This script, run once a day by .github/workflows/relay-topup.yml, reads that
// account's balance from the public endpoint and, if it is below TARGET, asks Coinbase's
// developer faucet (CDP) for test ETH sent straight to the relay's account: 0.0001 ETH a
// request, at most 0.1 ETH per address in 24 hours (Coinbase's limits). It stops at the
// target, at MAX_REQUESTS, or when Coinbase answers that the limit is reached.
// Test coins only: the faucet serves test networks, and the script never holds or moves a key.
// Credentials: CDP_API_KEY_ID and CDP_API_KEY_SECRET, repository secrets set by the founder.
//
// Usage: node topup.mjs            (in the workflow)
//        node topup.mjs --dry      (reads the balance and says what it would do; no requests)
const RELAY = process.env.RELAY_ACCOUNT || "0x3dB9d15202Bd291558889b42eb4291e288797fb9";
const RPC = process.env.RPC_URL || "https://sepolia.base.org";
const TARGET = Number(process.env.TOPUP_TARGET || "0.03");          // ETH
const MAX_REQUESTS = Number(process.env.TOPUP_MAX || "300");        // 0.03 ETH at 0.0001 a request
const PER_REQUEST = 0.0001;                                          // ETH, Coinbase's drip
const WEI = 10n ** 18n;

export async function balanceEth(address, rpc = RPC, doFetch = fetch) {
  const r = await doFetch(rpc, { method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "eth_getBalance", params: [address, "latest"] }) });
  const j = await r.json();
  if (j.error || typeof j.result !== "string") throw new Error("could not read the balance: " + JSON.stringify(j.error || j));
  const wei = BigInt(j.result);
  return Number(wei / 10n ** 12n) / 1e6;   // ETH with 6 decimals
}

/** How many requests are needed to reach the target, within the limit of one run. */
export function requestsNeeded(balance, target = TARGET, max = MAX_REQUESTS) {
  if (balance >= target) return 0;
  return Math.min(max, Math.ceil((target - balance) / PER_REQUEST - 1e-9));
}

/** Asks the faucet n times, a moment apart; stops early when Coinbase says the limit is reached. */
export async function drip(faucet, n, address = RELAY, sleep = (ms) => new Promise((ok) => setTimeout(ok, ms))) {
  let sent = 0, failures = 0, stopped = null;
  while (sent < n) {
    try {
      await faucet({ address, network: "base-sepolia", token: "eth" });
      sent++; failures = 0;
      await sleep(1200);
    } catch (e) {
      const why = String((e && (e.errorType || e.statusCode || e.message)) || e);
      if (/limit|429/i.test(why)) { stopped = "Coinbase's 24-hour limit reached"; break; }
      // a busy moment is tolerated; three failures in a row stop the run
      if (++failures >= 3) { stopped = "faucet error: " + why; break; }
      await sleep(5000);
    }
  }
  return { sent, eth: Number((sent * PER_REQUEST).toFixed(4)), stopped };
}

async function main() {
  const dry = process.argv.includes("--dry");
  const before = await balanceEth(RELAY);
  const n = requestsNeeded(before);
  const lines = [`Relay account ${RELAY} on Base Sepolia: ${before} ETH (target ${TARGET} ETH).`];
  if (n === 0) lines.push("At or above the target: nothing requested.");
  else if (dry) lines.push(`Would request ${n} × ${PER_REQUEST} ETH from the Coinbase developer faucet (dry run: nothing requested).`);
  else {
    if (!process.env.CDP_API_KEY_ID || !process.env.CDP_API_KEY_SECRET) throw new Error("the secrets CDP_API_KEY_ID and CDP_API_KEY_SECRET are not set");
    const { CdpClient } = await import("@coinbase/cdp-sdk");
    const cdp = new CdpClient();
    const r = await drip((o) => cdp.evm.requestFaucet(o), n);
    lines.push(`Requested ${r.sent} × ${PER_REQUEST} ETH = ${r.eth} ETH.` + (r.stopped ? ` Stopped: ${r.stopped}.` : ""));
    await new Promise((ok) => setTimeout(ok, 15000));   // let the last transfers land
    lines.push(`Balance now: ${await balanceEth(RELAY)} ETH.`);
  }
  console.log(lines.join("\n"));
  if (process.env.GITHUB_STEP_SUMMARY) (await import("node:fs")).appendFileSync(process.env.GITHUB_STEP_SUMMARY, lines.map((l) => "- " + l).join("\n") + "\n");
}

if (import.meta.url === `file://${process.argv[1]}`) main().catch((e) => { console.error("Top-up failed: " + e.message); process.exit(1); });
