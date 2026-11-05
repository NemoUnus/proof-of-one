// SPDX-License-Identifier: AGPL-3.0-only
// Proof of One — test ballot relay (Phase 1a, activity 1.6-04). SYNTHETIC POLLS ONLY.
//
// A phone sends its ballot here instead of to the network; the relay submits it with its own
// test coins, so voters need no wallet. It runs as a Cloudflare Worker.
//
// WHAT THE RELAY CAN AND CANNOT DO
// - It cannot change a ballot: the proof binds the ciphertexts, the nullifier and the poll.
// - It cannot read a ballot: it sees only ciphertexts, as everyone does on the ledger.
// - It CAN refuse or delay a ballot. The phone can always submit directly instead (vote.html
//   offers both), and on the real network forced inclusion through Ethereum remains.
// - It (and Cloudflare) see the voter's network address. This code keeps no logs of it.
//   Network privacy (Tor, OHTTP) is a later design step (whitepaper §8).
//
// SAFETY OF THE RELAY'S COINS
// - Only vote() on the configured polls contract, only for the configured poll ids.
// - Every ballot is simulated first (eth_call). The contract verifies the proof there, so a
//   ballot that would fail costs nothing and is refused.
// - A gas cap per ballot. The key is a test-only key holding test coins only.
//
// Configuration (Cloudflare "Variables and secrets"):
//   RELAY_KEY  (secret)  private key of the relay's test-only account
//   RPC_URL             e.g. https://sepolia.base.org
//   CHAIN_ID            e.g. 84532
//   POLLS               the ProofOfOnePolls address
//   POLL_IDS            comma-separated poll ids the relay accepts, e.g. "2"
import { ethers } from "ethers";

const ABI = [
  "function vote(uint256 pollId, uint256 nf, uint256[16] ct, uint256[16] prev, uint256[2] a, uint256[2][2] b, uint256[2] c)",
  // the contract's errors that a ballot can meet, so that a refusal can say why
  "error InvalidProof()", "error PollNotOpen()", "error RevoteCapReached()", "error BadPrevious()", "error NotInvited()",
];
const GAS_CAP = 900000n; // a single ballot uses about 520,000 gas in the reference tests
const CORS = { "access-control-allow-origin": "*", "access-control-allow-methods": "POST, GET, OPTIONS", "access-control-allow-headers": "content-type" };
const reply = (status, body) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json", ...CORS } });

const isUint = (x) => typeof x === "string" && /^[0-9]{1,78}$/.test(x) && BigInt(x) < 2n ** 256n;
const uints = (a, n) => Array.isArray(a) && a.length === n && a.every(isUint);

// Checks the shape of a ballot request; returns the vote() arguments or throws.
export function parseBallot(body, allowedPolls) {
  const { pollId, nf, ct, prev, a, b, c } = body || {};
  if (!isUint(pollId) || !allowedPolls.includes(pollId)) throw new Error("this relay does not accept ballots for that poll");
  if (!isUint(nf) || !uints(ct, 16) || !uints(prev, 16) || !uints(a, 2) || !uints(c, 2) || !Array.isArray(b) || b.length !== 2 || !b.every((r) => uints(r, 2)))
    throw new Error("malformed ballot");
  return [pollId, nf, ct, prev, a, b, c];
}

export async function handle(request, env, deps = {}) {
  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS });
  const allowed = String(env.POLL_IDS || "").split(",").map((s) => s.trim()).filter(Boolean);
  const provider = deps.provider || new ethers.JsonRpcProvider(env.RPC_URL, Number(env.CHAIN_ID), { staticNetwork: true });
  const wallet = new ethers.Wallet(env.RELAY_KEY, provider);
  if (request.method === "GET") {
    // Status, so the page can tell whether the relay is up and still has coins.
    const bal = await provider.getBalance(wallet.address);
    return reply(200, { relay: wallet.address, chainId: String(env.CHAIN_ID), polls: env.POLLS, pollIds: allowed, balance: ethers.formatEther(bal) });
  }
  if (request.method !== "POST") return reply(405, { error: "use POST" });
  let args;
  try { args = parseBallot(await request.json(), allowed); } catch (e) { return reply(400, { error: e.message }); }
  const polls = new ethers.Contract(env.POLLS, ABI, wallet);
  try {
    const gas = await polls.vote.estimateGas(...args);   // eth_call: the contract checks the proof
    if (gas > GAS_CAP) return reply(400, { error: "ballot needs too much gas" });
    // Two ballots arriving together can be given the same nonce; the second is retried once.
    for (let attempt = 0; ; attempt++) {
      try {
        const tx = await polls.vote(...args, { gasLimit: gas + gas / 5n });
        return reply(202, { tx: tx.hash });
      } catch (e) {
        if (attempt === 0 && /nonce|replacement/i.test(e.shortMessage || e.message || "")) continue;
        throw e;
      }
    }
  } catch (e) {
    const why = e.revert ? e.revert.name : e.shortMessage || "rejected";
    return reply(400, { error: "the network would reject this ballot: " + why });
  }
}

export default { fetch: (request, env) => handle(request, env) };
