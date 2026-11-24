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
// - Only vote() on the configured polls contract, only for the configured poll ids, and
//   register() on the configured identity registry.
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
//   REGISTRY            the IdentityRegistry address; POST /register is accepted only if set
//
// REGISTRATIONS (Decisions #61, #62): POST /register takes {leaf, cn, a, b, c}, a phone's π_reg
// a few minutes after enrolment, and submits register() the same way: simulated first (the
// registry checks the proof there), a gas cap, and nothing else. The registry inserts the
// membership into the identity tree at once (Decision #62), so the member can answer every
// open poll as soon as the transaction is in a block. A credential already used is answered
// with 409 and alreadyRegistered, so that a phone restored from a backup knows it is done.
//
// STATE (Decision #62): GET /state?poll=<id>[&nf=<nullifier>] returns, read from the contracts
// at that moment, everything a phone needs to answer a poll: the identity registry's leaves
// and root, the revoked handles and the revocation root, the poll's public values, the poll's
// text (src/pilot-polls.json, whose hash the poll holds as metadataHash) and, if nf is given,
// the ballot recorded for that nullifier (its hash and count) so that the phone can show the
// recorded answer. Every value is public on the ledger; the relay only saves the phone from
// reading the chain itself. The phone checks the roots it rebuilds against the ones given.
import { ethers } from "ethers";
import PILOT_POLLS from "./pilot-polls.json" with { type: "json" };

const ABI = [
  "function vote(uint256 pollId, uint256 nf, uint256 idRoot, uint256[16] ct, uint256[16] prev, uint256[2] a, uint256[2][2] b, uint256[2] c)",
  "function getPoll(uint256 pollId) view returns (tuple(address creator, uint256 idRoot, uint256 revRoot, uint256 eligible, uint256[2] tallyPK, uint32 maxBirthDay, uint32 minBirthDay, uint32 minExpiryMonth, uint32 requiredNat, uint16 maxRevotes, uint64 openTime, uint64 closeTime, bytes32 metadataHash, uint256 pollHash, bytes32 trusteeKeysHash, uint8 threshold, uint8 trustees, uint64 resultDeadline, uint8 state))",
  "function contextHash(uint256 pollId) view returns (uint256)",
  "function ballots(uint256 pollId, uint256 nf) view returns (bytes28 ballotHash, uint32 count)",
  "function recovered(uint256 pollId, uint256 nf) view returns (bool)",
  "function distinctVoters(uint256 pollId) view returns (uint256)",
  "function identity() view returns (address)",
  "function revocation() view returns (address)",
  // the contract's errors that a ballot can meet, so that a refusal can say why
  "error InvalidProof()", "error PollNotOpen()", "error RevoteCapReached()", "error BadPrevious()", "error NotInvited()", "error UnknownRoot()", "error Recovered()",
];
const IDENTITY_ABI = [
  "function leafCount() view returns (uint256)", "function root() view returns (uint256)",
  "function getLeaves(uint256 start, uint256 count) view returns (uint256[])",
  "function isHistoricalRoot(uint256 root) view returns (bool)",
];
const REVOCATION_ABI = [
  "function revokedCount() view returns (uint256)", "function root() view returns (uint256)",
  "function getRevoked(uint256 start, uint256 count) view returns (uint256[])",
];
const REGISTRY_ABI = [
  "function register(uint256 leaf, uint256 cn, uint256[2] a, uint256[2][2] b, uint256[2] c)",
  "event Registered(uint256 indexed leaf, uint256 indexed cn, uint256 index)",
  "function credentialUsed(uint256 cn) view returns (bool)",
  "error CredentialUsed()", "error InvalidProof()", "error TreeFull()",
];
const REG_GAS_CAP = 2500000n; // a registration with its insertion into the tree uses about 1,580,000 gas
const GAS_CAP = 900000n; // a single ballot uses about 520,000 gas in the reference tests
const CORS = { "access-control-allow-origin": "*", "access-control-allow-methods": "POST, GET, OPTIONS", "access-control-allow-headers": "content-type" };
const reply = (status, body) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json", ...CORS } });

const isUint = (x) => typeof x === "string" && /^[0-9]{1,78}$/.test(x) && BigInt(x) < 2n ** 256n;
const uints = (a, n) => Array.isArray(a) && a.length === n && a.every(isUint);

// Checks the shape of a ballot request; returns the vote() arguments or throws.
export function parseBallot(body, allowedPolls) {
  const { pollId, nf, idRoot, ct, prev, a, b, c } = body || {};
  if (!isUint(pollId) || !allowedPolls.includes(pollId)) throw new Error("this relay does not accept ballots for that poll");
  if (!isUint(nf) || !isUint(idRoot) || !uints(ct, 16) || !uints(prev, 16) || !uints(a, 2) || !uints(c, 2) || !Array.isArray(b) || b.length !== 2 || !b.every((r) => uints(r, 2)))
    throw new Error("malformed ballot");
  return [pollId, nf, idRoot, ct, prev, a, b, c];
}

// Checks the shape of a registration request; returns the register() arguments or throws.
export function parseRegistration(body) {
  const { leaf, cn, a, b, c } = body || {};
  if (!isUint(leaf) || !isUint(cn) || !uints(a, 2) || !uints(c, 2) || !Array.isArray(b) || b.length !== 2 || !b.every((r) => uints(r, 2)))
    throw new Error("malformed registration");
  return [leaf, cn, a, b, c];
}

async function register(request, env, wallet, provider) {
  if (!env.REGISTRY) return reply(404, { error: "this relay does not accept registrations" });
  let args;
  try { args = parseRegistration(await request.json()); } catch (e) { return reply(400, { error: e.message }); }
  const reg = new ethers.Contract(env.REGISTRY, REGISTRY_ABI, wallet);
  // Asked first, since some nodes give no revert reason when a simulation fails.
  if (await reg.credentialUsed(args[1])) return reply(409, { error: "this credential is already registered", alreadyRegistered: true });
  let gas;
  try {
    gas = await reg.register.estimateGas(...args);   // eth_call: the registry checks the proof
  } catch (e) {
    const why = e.revert ? e.revert.name : e.shortMessage || "rejected";
    if (why === "CredentialUsed") return reply(409, { error: "this credential is already registered", alreadyRegistered: true });
    return reply(400, { error: "the network would reject this registration: " + why });
  }
  if (gas > REG_GAS_CAP) return reply(400, { error: "registration needs too much gas" });
  let tx;
  for (let attempt = 0; ; attempt++) {
    try { tx = await reg.register(...args, { gasLimit: gas + gas / 5n }); break; } catch (e) {
      if (attempt === 0 && /nonce|replacement/i.test(e.shortMessage || e.message || "")) continue;
      throw e;
    }
  }
  // Wait briefly for the block, so that the phone learns its position in the registry.
  const rc = await provider.waitForTransaction(tx.hash, 1, 20000).catch(() => null);
  if (!rc) return reply(202, { tx: tx.hash });
  if (rc.status !== 1) return reply(400, { error: "the registration failed on the network", tx: tx.hash });
  const ev = rc.logs.map((l) => { try { return reg.interface.parseLog(l); } catch { return null; } }).find((x) => x && x.name === "Registered");
  return reply(200, { tx: tx.hash, index: ev ? ev.args.index.toString() : null, block: rc.blockNumber });
}

const CHUNK = 500;
async function all(contract, fn, n) {
  const out = [];
  for (let i = 0; i < n; i += CHUNK) out.push(...(await contract[fn](i, Math.min(CHUNK, n - i))).map(String));
  return out;
}

// The poll's text as published with the relay, if any (the poll's metadataHash is the
// Keccak-256 of this entry's canonical JSON; plan7.js and the test check it).
export function pollText(env, pollId) {
  const p = (PILOT_POLLS.polls || []).find((x) => x.polls.toLowerCase() === String(env.POLLS).toLowerCase() && String(x.pollId) === String(pollId));
  return p || null;
}

export async function state(url, env, provider) {
  const pollId = url.searchParams.get("poll"), nf = url.searchParams.get("nf");
  if (!isUint(pollId || "") || (nf !== null && !isUint(nf))) return reply(400, { error: "give poll=<id> and optionally nf=<nullifier>" });
  const polls = new ethers.Contract(env.POLLS, ABI, provider);
  const [idAddr, revAddr, p, ctx] = await Promise.all([polls.identity(), polls.revocation(), polls.getPoll(pollId), polls.contextHash(pollId)]);
  if (Number(p.state) === 0) return reply(404, { error: "no such poll" });
  const identity = new ethers.Contract(idAddr, IDENTITY_ABI, provider), revocation = new ethers.Contract(revAddr, REVOCATION_ABI, provider);
  const [n, idRoot, nr, revRoot, block] = await Promise.all([identity.leafCount(), identity.root(), revocation.revokedCount(), revocation.root(), provider.getBlock("latest")]);
  const [leaves, revoked] = await Promise.all([all(identity, "getLeaves", Number(n)), all(revocation, "getRevoked", Number(nr))]);
  // A registration between the two reads would change the root: read it again if so.
  const idRootAfter = await identity.root();
  if (idRootAfter !== idRoot) return reply(503, { error: "the registry changed while it was being read; try again" });
  let ballot = null;
  if (nf !== null) {
    const [b, rec] = await Promise.all([polls.ballots(pollId, nf), polls.recovered(pollId, nf)]);
    ballot = { ballotHash: b.ballotHash.slice(2), count: Number(b.count), recovered: rec };
  }
  const states = ["None", "Open", "Published", "Final", "Withheld", "Rejected"];
  return reply(200, {
    chainId: String(env.CHAIN_ID), polls: env.POLLS, identityRegistry: idAddr, revocationRegistry: revAddr, now: Number(block.timestamp),
    identity: { root: idRoot.toString(), leaves }, revocation: { root: revRoot.toString(), revoked },
    poll: {
      pollId: String(pollId), state: states[Number(p.state)] || String(p.state), PK: p.tallyPK.map(String), openTime: String(p.openTime), closeTime: String(p.closeTime),
      ctxHash: ctx.toString(), maxRevotes: Number(p.maxRevotes), metadataHash: p.metadataHash, voters: (await polls.distinctVoters(pollId)).toString(),
      policy: { maxBirthDay: String(p.maxBirthDay), minBirthDay: String(p.minBirthDay), minExpiryMonth: String(p.minExpiryMonth), requiredNat: String(p.requiredNat) },
    },
    text: pollText(env, pollId), ballot,
  });
}

export async function handle(request, env, deps = {}) {
  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS });
  const allowed = String(env.POLL_IDS || "").split(",").map((s) => s.trim()).filter(Boolean);
  const provider = deps.provider || new ethers.JsonRpcProvider(env.RPC_URL, Number(env.CHAIN_ID), { staticNetwork: true });
  let wallet;
  try {
    // Pasted keys often carry spaces or a line break, and some wallets export them without 0x.
    const key = String(env.RELAY_KEY || "").replace(/\s+/g, "");
    wallet = new ethers.Wallet(key.startsWith("0x") ? key : "0x" + key, provider);
  } catch (e) {
    return reply(500, { error: "relay not configured: the secret RELAY_KEY is missing or is not a valid private key" });
  }
  if (request.method === "GET") {
    // Status, so the page can tell whether the relay is up and still has coins.
    const url = new URL(request.url);
    if (url.pathname === "/state") return state(url, env, provider);
    const bal = await provider.getBalance(wallet.address);
    return reply(200, { relay: wallet.address, chainId: String(env.CHAIN_ID), polls: env.POLLS, pollIds: allowed, registry: env.REGISTRY || null, balance: ethers.formatEther(bal) });
  }
  if (request.method !== "POST") return reply(405, { error: "use POST" });
  const route = new URL(request.url).pathname;
  if (route === "/register") return register(request, env, wallet, provider);
  let args;
  try { args = parseBallot(await request.json(), allowed); } catch (e) { return reply(400, { error: e.message }); }
  const polls = new ethers.Contract(env.POLLS, ABI, wallet);
  try {
    // Asked first, since some nodes give no revert reason when a simulation fails.
    const identity = new ethers.Contract(await polls.identity(), IDENTITY_ABI, provider);
    if (!(await identity.isHistoricalRoot(args[2]))) return reply(400, { error: "the network would reject this ballot: UnknownRoot (the identity root is not one the registry has held)" });
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

// Any other failure (for example the network node not answering) is reported without detail.
export default {
  fetch: (request, env) => handle(request, env).catch(() => reply(502, { error: "the relay could not reach the network; try again later" })),
};
