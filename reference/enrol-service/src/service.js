// SPDX-License-Identifier: Apache-2.0
// Proof of One — the pilot's enrolment service (Cloudflare Worker). TEST ONLY.
// Design: docs/specs/pilot-enrolment-service-v0.1.md. It stands in, for the pilot, for the
// attested enclave of the whitepaper (§6–7).
//
//   GET  /info                 public keys, counts
//   POST /session {issuer}     a session with a fresh challenge; the issuer's rule
//   POST /evaluate {session, pB, dB}
//                              the OPRF answers with DLEQ proofs (once per session)
//   POST /enrol {session, proof, publicSignals}
//                              checks π_doc and the session, reserves the two keyed
//                              fingerprints, signs the credential
//   POST /signer {dsc, suite}  checks a document signer's certificate against the CSCAs
//                              held, adds its key to the tree of checked signers
//   GET  /path?leaf=…          the root and a signer's path, for π_doc
//   GET  /signers              the tree: leaves, suites, fingerprints of DSC and CSCA
//
// It never receives the face, the MRZ, the document number, the personal number or the
// name. It stores per member: person key, document key, issuing state, path, time.
// The cryptography is the Rust core in core.wasm (reference/service-core), built and checked
// by the workflow enrol-service.yml; src/worker.js loads it.
//
// Configuration ("Variables and secrets" of the Worker; nothing secret in this repository):
//   OPRF_KEY, CREDENTIAL_KEY, REVOCATION_KEY   (secrets) 64 random bytes each, hex
//   RULES          {"ABC": {"path": 1, "pnSrc": 1, "pnTag": "5F10"}, ...}: the issuing
//                  states accepted, and where their person key comes from (spec §7)
//   CSCA_CERTS     the CSCA certificates the service checks signers against (base64 DER);
//                  only their SHA-256 fingerprints are published
//   DSC_ROOTS      extra accepted roots (comma-separated), for tests; the tree's own roots
//                  are always accepted
//   RPC_URL, DOC_VERIFIER   the test network and π_doc's verifier contract
//   EPOCH, DAILY_SESSIONS   credential epoch ("0"); sessions per day (300)
//   DB             the D1 database (schema.sql)
import { randomHex } from "./core.js";
import { DEPTH, checkSigner } from "./signers.js";
import { fromBase64 } from "./x509.js";

const SESSION_SECONDS = 600;
const SIGNERS_PER_DAY = 100;
const CORS = { "access-control-allow-origin": "*", "access-control-allow-methods": "POST, GET, OPTIONS", "access-control-allow-headers": "content-type" };
const reply = (status, body) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json", ...CORS } });
class Refusal extends Error { constructor(status, msg) { super(msg); this.status = status; } }
const refuse = (status, msg) => { throw new Refusal(status, msg); };

// π_doc's public signals, in order (docs/specs/document-fingerprint-oprf-v0.1.md, §5).
export const SIGNALS = ["birthDay", "sexCode", "natCode", "expMonth", "cFace", "personKey", "documentKey", "issuer",
  "dscRoot", "today", "currentYear", "cm", "challenge", "path", "pB0", "pB1", "pZ0", "pZ1", "dB0", "dB1", "dZ0", "dZ1", "pnSrc", "pnTag"];
const P = 21888242871839275222246405745257275088548364400416034343698204186575808495617n;
const isField = (x) => typeof x === "string" && /^(0|[1-9][0-9]{0,76})$/.test(x) && BigInt(x) < P;
const isUint = (x) => typeof x === "string" && /^(0|[1-9][0-9]{0,77})$/.test(x) && BigInt(x) < 2n ** 256n;
const isPoint = (p) => Array.isArray(p) && p.length === 2 && p.every(isField);

export function natCode(s) {
  if (typeof s !== "string" || !/^[A-Z<]{3}$/.test(s)) refuse(400, "issuer: three capital letters expected");
  return s.charCodeAt(0) * 65536 + s.charCodeAt(1) * 256 + s.charCodeAt(2);
}
// Days since 1 January 1900 (as π_doc's `today`).
export const dayNumber = (ms) => Math.floor(ms / 86400000) + 25567;

function rules(env) {
  let r;
  try { r = JSON.parse(env.RULES || "{}"); } catch { throw new Refusal(500, "service not configured: RULES is not valid JSON"); }
  const out = new Map();
  for (const [code, v] of Object.entries(r)) out.set(natCode(code), { path: String(v.path), pnSrc: String(v.pnSrc ?? 0), pnTag: BigInt("0x" + String(v.pnTag ?? "0")).toString() });
  return out;
}
function secrets(env) {
  const s = { oprf: env.OPRF_KEY, credential: env.CREDENTIAL_KEY, revocation: env.REVOCATION_KEY };
  for (const [k, v] of Object.entries(s)) if (typeof v !== "string" || !/^[0-9a-fA-F]{128}$/.test(v.trim())) throw new Refusal(500, `service not configured: secret for ${k} missing or not 64 bytes of hex`);
  return Object.fromEntries(Object.entries(s).map(([k, v]) => [k, v.trim()]));
}

const getCore = (deps) => deps.core;

async function count(db, name, by = 1) {
  await db.prepare("INSERT INTO counters (name, n) VALUES (?1, ?2) ON CONFLICT(name) DO UPDATE SET n = n + ?2").bind(name, by).run();
}
async function counter(db, name) { return (await db.prepare("SELECT n FROM counters WHERE name = ?1").bind(name).first())?.n ?? 0; }

// Groth16 verification on the test network: DocVerifier.verifyProof by eth_call (free).
const SELECTOR = "4d01c5a0"; // verifyProof(uint256[2],uint256[2][2],uint256[2],uint256[24])
export function verifyCalldata(proof, signals) {
  const { pi_a: a, pi_b: b, pi_c: c } = proof || {};
  const ok = Array.isArray(a) && Array.isArray(c) && Array.isArray(b) && b.length >= 2 && [a[0], a[1], c[0], c[1], b[0][0], b[0][1], b[1][0], b[1][1]].every(isUint);
  if (!ok) refuse(400, "malformed proof");
  // snarkjs gives G2 coordinates as [c0, c1]; the precompile takes [c1, c0]
  const words = [a[0], a[1], b[0][1], b[0][0], b[1][1], b[1][0], c[0], c[1], ...signals];
  return "0x" + SELECTOR + words.map((w) => BigInt(w).toString(16).padStart(64, "0")).join("");
}
async function verifyOnChain(env, deps, data) {
  const doFetch = deps.fetch || fetch;
  const r = await doFetch(env.RPC_URL, { method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "eth_call", params: [{ to: env.DOC_VERIFIER, data }, "latest"] }) });
  const j = await r.json();
  if (j.error || typeof j.result !== "string") refuse(502, "the test network did not answer; try again");
  return BigInt(j.result) === 1n;
}

async function info(env, deps) {
  const pub = getCore(deps).call("public", { secrets: secrets(env) });
  const db = env.DB;
  return { service: "Proof of One pilot enrolment service (TEST)", K: pub.K, A: pub.A, keyLeaf: pub.keyLeaf, epoch: String(env.EPOCH ?? "0"),
    dscRoot: await currentRoot(env, deps), signers: await signerCount(env), docVerifier: env.DOC_VERIFIER || null,
    evaluations: await counter(db, "evaluations"), enrolments: await counter(db, "enrolments") };
}

async function session(env, deps, body, now) {
  const issuer = natCode(body?.issuer);
  const rule = rules(env).get(issuer);
  if (!rule) refuse(403, "documents of this issuing state are not part of the pilot");
  const day = `sessions:${dayNumber(now)}`;
  if ((await counter(env.DB, day)) >= Number(env.DAILY_SESSIONS || 300)) refuse(429, "the pilot's sessions for today are used up; try tomorrow");
  await count(env.DB, day);
  const id = randomHex(16);
  const challenge = (BigInt("0x" + randomHex(31))).toString();
  await env.DB.prepare("DELETE FROM sessions WHERE created < ?1").bind(Math.floor(now / 1000) - SESSION_SECONDS).run();
  await env.DB.prepare("INSERT INTO sessions (id, created, issuer, challenge) VALUES (?1, ?2, ?3, ?4)").bind(id, Math.floor(now / 1000), issuer, challenge).run();
  const d = new Date(now);
  return { session: id, challenge, rule, today: String(dayNumber(now)), currentYear: String(d.getUTCFullYear()), expiresIn: SESSION_SECONDS };
}

async function liveSession(env, id, now) {
  if (typeof id !== "string" || !/^[0-9a-f]{32}$/.test(id)) refuse(400, "session expected");
  const s = await env.DB.prepare("SELECT * FROM sessions WHERE id = ?1").bind(id).first();
  if (!s || s.created < Math.floor(now / 1000) - SESSION_SECONDS) refuse(410, "session expired; start again");
  return s;
}

async function evaluate(env, deps, body, now) {
  const s = await liveSession(env, body?.session, now);
  if (!isPoint(body.pB) || !isPoint(body.dB)) refuse(400, "blinded points expected");
  // one evaluation per session (Decision #53): claim the session before answering
  const claim = await env.DB.prepare("UPDATE sessions SET state = 1, pB = ?2, dB = ?3 WHERE id = ?1 AND state = 0")
    .bind(s.id, JSON.stringify(body.pB), JSON.stringify(body.dB)).run();
  if (claim.meta.changes !== 1) refuse(409, "this session has already been evaluated; start again");
  let ans;
  try { ans = getCore(deps).call("evaluate", { secrets: secrets(env), pB: body.pB, dB: body.dB, rand: randomHex(128) }); }
  catch (e) { if (e instanceof Refusal) throw e; refuse(400, `refused: ${e.message}`); }
  await env.DB.prepare("UPDATE sessions SET pZ = ?2, dZ = ?3 WHERE id = ?1").bind(s.id, JSON.stringify(ans.pZ), JSON.stringify(ans.dZ)).run();
  await count(env.DB, "evaluations", 2);
  return ans;
}

async function enrol(env, deps, body, now) {
  const s = await liveSession(env, body?.session, now);
  if (s.state !== 1) refuse(409, s.state === 0 ? "evaluate first" : "this session has already been used; start again");
  const ps = body.publicSignals;
  if (!Array.isArray(ps) || ps.length !== SIGNALS.length || !ps.every(isField)) refuse(400, `${SIGNALS.length} public signals expected`);
  const v = Object.fromEntries(SIGNALS.map((n, i) => [n, ps[i]]));
  const pB = JSON.parse(s.pB), dB = JSON.parse(s.dB), pZ = JSON.parse(s.pZ), dZ = JSON.parse(s.dZ);
  const same = [[v.challenge, s.challenge], [v.pB0, pB[0]], [v.pB1, pB[1]], [v.dB0, dB[0]], [v.dB1, dB[1]], [v.pZ0, pZ[0]], [v.pZ1, pZ[1]], [v.dZ0, dZ[0]], [v.dZ1, dZ[1]], [v.issuer, String(s.issuer)]];
  if (!same.every(([a, b]) => a === b)) refuse(403, "the proof is not for this session");
  if (Math.abs(Number(v.today) - dayNumber(now)) > 1) refuse(403, "the proof's date is not today");
  if (v.currentYear !== String(new Date((Number(v.today) - 25567) * 86400000).getUTCFullYear())) refuse(403, "the proof's year is not the year of its date");
  const extra = String(env.DSC_ROOTS || "").split(",").map((x) => x.trim()).filter(Boolean);
  const known = extra.includes(v.dscRoot) || (await env.DB.prepare("SELECT 1 AS ok FROM roots WHERE root = ?1").bind(v.dscRoot).first());
  if (!known) refuse(403, "the document's signer is not in the tree of checked signers");
  const rule = rules(env).get(Number(v.issuer));
  if (!rule || v.path !== rule.path || v.pnSrc !== rule.pnSrc || v.pnTag !== rule.pnTag) refuse(403, "the proof does not follow the issuing state's rule");
  // one attempt per session
  const claim = await env.DB.prepare("UPDATE sessions SET state = 2 WHERE id = ?1 AND state = 1").bind(s.id).run();
  if (claim.meta.changes !== 1) refuse(409, "this session has already been used; start again");
  if (!(await verifyOnChain(env, deps, verifyCalldata(body.proof, ps)))) refuse(403, "the enrolment proof does not verify");
  // the credential first (pure), then the reservation, which is the commitment point
  const cred = getCore(deps).call("sign", { secrets: secrets(env), fp: v.personKey, attrs: [v.birthDay, v.sexCode, v.natCode, v.expMonth, "0", "0", "0", "0"],
    cm: v.cm, epoch: String(env.EPOCH ?? "0"), generation: "0", rand: randomHex(64) });
  try {
    await env.DB.prepare("INSERT INTO members (fp, fd, issuer, path, created) VALUES (?1, ?2, ?3, ?4, ?5)")
      .bind(v.personKey, v.documentKey, Number(v.issuer), Number(v.path), Math.floor(now / 1000)).run();
  } catch (e) {
    const m = String(e.message || e);
    if (m.includes("members.fd")) refuse(409, "this document is already enrolled");
    if (m.includes("members.fp")) refuse(409, "this person is already enrolled (a lost phone re-enrols through recovery)");
    throw e;
  }
  await count(env.DB, "enrolments");
  return { credential: { rn: cred.rn, link: "0", epoch: String(env.EPOCH ?? "0"), A: cred.A, R8: cred.R8, S: cred.S }, msg: cred.msg };
}

// ---- the tree of checked signers (design §5)
async function leaves(env) {
  return (await env.DB.prepare("SELECT leaf FROM signers ORDER BY idx").all()).results.map((r) => r.leaf);
}
async function signerCount(env) { return (await env.DB.prepare("SELECT count(*) AS n FROM signers").first()).n; }
async function currentRoot(env, deps) { return getCore(deps).call("tree", { leaves: await leaves(env), depth: DEPTH }).root; }

async function signer(env, deps, body, now) {
  const suite = Number(body?.suite);
  if (suite !== 1 && suite !== 2) refuse(400, "suite 1 or 2 expected");
  if (typeof body?.dsc !== "string" || body.dsc.length > 8000) refuse(400, "the certificate (base64) expected");
  let der;
  try { der = fromBase64(body.dsc); } catch { refuse(400, "the certificate (base64) expected"); }
  let s;
  try { s = await checkSigner(getCore(deps), env, der, suite, now); } catch (e) { refuse(403, e.message); }
  const known = await env.DB.prepare("SELECT idx FROM signers WHERE leaf = ?1").bind(s.leaf).first();
  if (known) return { leaf: s.leaf, index: known.idx, root: await currentRoot(env, deps), added: false };
  const day = `signers:${dayNumber(now)}`;
  if ((await counter(env.DB, day)) >= SIGNERS_PER_DAY) refuse(429, "too many new signers today; try tomorrow");
  await count(env.DB, day);
  const idx = await signerCount(env);
  try {
    await env.DB.prepare("INSERT INTO signers (idx, leaf, suite, dsc, csca, created) VALUES (?1, ?2, ?3, ?4, ?5, ?6)")
      .bind(idx, s.leaf, suite, s.dsc, s.csca, Math.floor(now / 1000)).run();
  } catch { refuse(409, "the tree changed meanwhile; send the certificate again"); }
  const root = await currentRoot(env, deps);
  await env.DB.prepare("INSERT OR IGNORE INTO roots (root, size, created) VALUES (?1, ?2, ?3)").bind(root, idx + 1, Math.floor(now / 1000)).run();
  return { leaf: s.leaf, index: idx, root, added: true };
}

async function signerPath(env, deps, url) {
  const leaf = url.searchParams.get("leaf");
  if (!isField(leaf || "")) refuse(400, "leaf expected");
  const all = await leaves(env);
  const index = all.indexOf(leaf);
  if (index < 0) refuse(404, "this signer is not in the tree; send its certificate to /signer");
  const t = getCore(deps).call("tree", { leaves: all, depth: DEPTH, index });
  return { leaf, index, root: t.root, siblings: t.siblings, pathIndex: t.pathIndex };
}

async function signerList(env, deps) {
  const rows = (await env.DB.prepare("SELECT idx, leaf, suite, dsc, csca, created FROM signers ORDER BY idx").all()).results;
  return { depth: DEPTH, root: await currentRoot(env, deps), signers: rows };
}

export async function handle(request, env, deps = {}) {
  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS });
  const now = deps.now ? deps.now() : Date.now();
  const url = new URL(request.url), path = url.pathname;
  try {
    if (request.method === "GET" && path === "/info") return reply(200, await info(env, deps));
    if (request.method === "GET" && path === "/path") return reply(200, await signerPath(env, deps, url));
    if (request.method === "GET" && path === "/signers") return reply(200, await signerList(env, deps));
    if (request.method !== "POST") return reply(404, { error: "not found" });
    let body;
    try { body = await request.json(); } catch { refuse(400, "JSON expected"); }
    if (path === "/session") return reply(200, await session(env, deps, body, now));
    if (path === "/evaluate") return reply(200, await evaluate(env, deps, body, now));
    if (path === "/enrol") return reply(200, await enrol(env, deps, body, now));
    if (path === "/signer") return reply(200, await signer(env, deps, body, now));
    return reply(404, { error: "not found" });
  } catch (e) {
    if (e instanceof Refusal) return reply(e.status, { error: e.message });
    return reply(500, { error: "internal error" });
  }
}
