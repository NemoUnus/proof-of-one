// SPDX-License-Identifier: Apache-2.0
// The phone's ballot (Decision #45, #61; ballot-circuit/circuits/ballot.circom): the inputs
// of π_vote, as buildBallot in ballot-circuit/src/ballot.js makes them, from what the phone
// kept at enrolment (member.json) and a poll's published values; the member's path in the
// identity tree at the poll's snapshot; and the non-revocation witness. Checked against the
// reference by the vote-check binary in the Android workflow.
use crate::fingerprint::{add, dec, g8, mul, Pt};
use ark_bn254::Fr;
use ark_ff::{BigInteger, PrimeField, Zero};
use ark_ed_on_bn254::Fr as Sc;
use serde_json::{json, Value};
use std::str::FromStr;

type Error = Box<dyn std::error::Error + Send + Sync>;

const K: usize = 4;
const DEPTH: usize = 32;
const TAG_NULLIFIER: u64 = 1;
const TAG_POLL: u64 = 7;
const TAG_BALLOT_RAND: u64 = 15;

fn h(xs: &[Fr]) -> Result<Fr, Error> { crate::poseidon::hash(xs).map_err(|e| e.into()) }
fn get<'a>(v: &'a Value, k: &str) -> Result<&'a Value, Error> { v.get(k).ok_or_else(|| format!("{} missing", k).into()) }
fn num(v: &Value, k: &str) -> Result<Fr, Error> {
    let x = get(v, k)?;
    let t = x.as_str().map(|s| s.to_string()).or_else(|| x.as_u64().map(|n| n.to_string())).ok_or(format!("{}: decimal expected", k))?;
    Fr::from_str(&t).map_err(|_| format!("{}: not a field element", k).into())
}
fn big(v: &Value, k: &str) -> Result<u128, Error> {
    let x = get(v, k)?;
    x.as_str().and_then(|s| s.parse().ok()).or_else(|| x.as_u64().map(|n| n as u128)).ok_or_else(|| format!("{}: small number expected", k).into())
}
fn frs(v: &Value) -> Result<Vec<Fr>, Error> {
    v.as_array().ok_or("array expected")?.iter().map(|x| {
        let t = x.as_str().map(|s| s.to_string()).or_else(|| x.as_u64().map(|n| n.to_string())).ok_or("decimal expected")?;
        Fr::from_str(&t).map_err(|_| Error::from("not a field element"))
    }).collect()
}
fn pt(v: &Value) -> Result<Pt, Error> { let a = frs(v)?; if a.len() != 2 { return Err("[x, y] expected".into()) } Ok((a[0], a[1])) }
fn pj(p: &Pt) -> Value { json!([dec(&p.0), dec(&p.1)]) }
fn strs(xs: &[Fr]) -> Vec<String> { xs.iter().map(dec).collect() }

/// A binary Poseidon tree with empty leaves 0, as IncrementalTree in trees.js.
struct Tree { leaves: Vec<Fr>, zeros: Vec<Fr> }
impl Tree {
    fn new(leaves: Vec<Fr>) -> Result<Tree, Error> {
        let mut zeros = vec![Fr::zero()];
        for i in 0..DEPTH { let z = h(&[zeros[i], zeros[i]])?; zeros.push(z); }
        Ok(Tree { leaves, zeros })
    }
    fn levels(&self) -> Result<Vec<Vec<Fr>>, Error> {
        let mut lv = vec![self.leaves.clone()];
        for d in 0..DEPTH {
            let cur = &lv[d];
            let mut next = Vec::with_capacity(cur.len() / 2 + 1);
            for i in (0..cur.len()).step_by(2) {
                let r = if i + 1 < cur.len() { cur[i + 1] } else { self.zeros[d] };
                next.push(h(&[cur[i], r])?);
            }
            lv.push(next);
        }
        Ok(lv)
    }
    fn root(&self) -> Result<Fr, Error> { Ok(self.levels()?[DEPTH].first().copied().unwrap_or(self.zeros[DEPTH])) }
    fn path(&self, index: usize) -> Result<(Vec<Fr>, Vec<Fr>), Error> {
        let lv = self.levels()?;
        let (mut s, mut p, mut i) = (vec![], vec![], index);
        for d in 0..DEPTH {
            let sib = i ^ 1;
            s.push(if sib < lv[d].len() { lv[d][sib] } else { self.zeros[d] });
            p.push(Fr::from((i & 1) as u64));
            i >>= 1;
        }
        Ok((s, p))
    }
}

/// The member's path in the identity tree for a root the registry has held (Decision #62):
/// every registration enters the tree at once, so a root is the root of the first n leaves for
/// some n. The app passes the newest root, which it has checked against the chain; the fast
/// path builds the tree once. Any other root is looked up among the prefix roots, computed
/// incrementally (DEPTH hashes per leaf), so that a wrong root costs O(n), not O(n²) (review
/// of deployment 5, C3). `v`: {leaves: [...], leaf, idRoot}. Returns {siblings, pathIndex, index, n}.
pub fn identity_path(v: &Value) -> Result<Value, Error> {
    let leaves = frs(get(v, "leaves")?)?;
    let leaf = num(v, "leaf")?;
    let root = num(v, "idRoot")?;
    let index = leaves.iter().position(|l| *l == leaf).ok_or("this membership is not in the published identity tree yet")?;
    let full = Tree::new(leaves.clone())?;
    let n = if full.root()? == root { leaves.len() } else {
        let mut filled = vec![Fr::zero(); DEPTH];
        let mut found = None;
        for (i, l) in leaves.iter().enumerate() {
            let mut cur = *l;
            for d in 0..DEPTH {
                if (i >> d) & 1 == 0 { filled[d] = cur; cur = h(&[cur, full.zeros[d]])?; } else { cur = h(&[filled[d], cur])?; }
            }
            if i >= index && cur == root { found = Some(i + 1); break; }
        }
        found.ok_or("the identity root given is not a root of the published leaves that holds this membership")?
    };
    let t = if n == leaves.len() { full } else { Tree::new(leaves[..n].to_vec())? };
    let (s, p) = t.path(index)?;
    Ok(json!({ "siblings": strs(&s), "pathIndex": strs(&p), "index": index, "n": n }))
}

/// Non-revocation witness for rn in the revocation tree rebuilt from the revoked handles in
/// the order they were revoked (RevocationTree in trees.js). `v`: {revoked: [...], rn, revRoot}.
pub fn revocation_witness(v: &Value) -> Result<Value, Error> {
    let revoked = frs(get(v, "revoked")?)?;
    let rn = num(v, "rn")?;
    let root = num(v, "revRoot")?;
    let lt = |a: &Fr, b: &Fr| a.into_bigint() < b.into_bigint();
    let mut entries: Vec<(Fr, Fr)> = vec![(Fr::zero(), Fr::zero())];
    let mut leaves = vec![h(&[Fr::zero(), Fr::zero()])?];
    let low_index = |e: &Vec<(Fr, Fr)>, x: &Fr| e.iter().position(|(val, next)| lt(val, x) && (next.is_zero() || lt(x, next)));
    for x in revoked {
        if entries.iter().any(|(val, _)| *val == x) { return Err("a handle is revoked twice in the published list".into()); }
        let li = low_index(&entries, &x).ok_or("bad revocation list")?;
        let low_next = entries[li].1;
        entries.push((x, low_next));
        leaves.push(h(&[x, low_next])?);
        entries[li].1 = x;
        leaves[li] = h(&[entries[li].0, x])?;
    }
    let t = Tree::new(leaves)?;
    if t.root()? != root { return Err("the published revocations do not give the poll's revocation root".into()); }
    let li = low_index(&entries, &rn).ok_or("this membership has been revoked")?;
    let (s, p) = t.path(li)?;
    Ok(json!({ "lowValue": dec(&entries[li].0), "nextValue": dec(&entries[li].1), "siblings": strs(&s), "pathIndex": strs(&p) }))
}

/// The ballot's random values from the member's secret (Decision #62; ballotRandomness in
/// ballot.js): r_j = H(15, s, pollId, revision, choice, j) mod ℓ. A phone that restored the
/// identity recomputes them to open the ballot recorded for it. The choice is an input so that
/// two ballots with equal values always have equal plaintexts (identical ballots); two
/// different answers never share values, whatever revision a phone uses (review of deployment
/// 5, A2/F-01).
pub fn ballot_randomness(s: &Fr, poll_id: &Fr, revision: u64, choice: usize) -> Result<Vec<Sc>, Error> {
    if choice >= K { return Err("choice out of range".into()); }
    (0..K).map(|j| {
        let x = h(&[Fr::from(TAG_BALLOT_RAND), *s, *poll_id, Fr::from(revision), Fr::from(choice as u64), Fr::from(j as u64)])?;
        let r = Sc::from_le_bytes_mod_order(&x.into_bigint().to_bytes_le());
        if r.is_zero() { return Err("zero ballot randomness".into()); }
        Ok(r)
    }).collect()
}

/// π_vote's inputs. `v` holds:
///   member {s, salt}, attrs {birthDay, sexCode, natCode, expMonth, notBefore?}, credential {rn}
///   poll {pollId, PK: [x, y], idRoot, revRoot, ctxHash, openTime,
///         policy {maxBirthDay, minBirthDay, minExpiryMonth, requiredNat}}
///   (idRoot: the root the path below leads to, any root the registry has held; Decision #62)
///   idPath {siblings, pathIndex}, rev {lowValue, nextValue, siblings, pathIndex}
///   choice (0..3), and revision (randomness from the secret), or r (4 decimal scalars, tests)
/// Returns {input, nf, C: [{A, B}], r: [...]}; nf, C and r form the phone's receipt.
pub fn ballot_input(v: &Value) -> Result<Value, Error> {
    let m = get(v, "member")?; let at = get(v, "attrs")?; let poll = get(v, "poll")?; let pol = get(poll, "policy")?;
    let idp = get(v, "idPath")?; let rev = get(v, "rev")?;
    let choice = get(v, "choice")?.as_u64().ok_or("choice: number expected")? as usize;
    if choice >= K { return Err("choice out of range".into()); }
    let s = Sc::from_str(get(m, "s")?.as_str().ok_or("s: decimal expected")?).map_err(|_| "s: bad scalar")?;
    let s_fr = num(m, "s")?;
    let (bd, exp) = (big(at, "birthDay")?, big(at, "expMonth")?);
    let (max_bd, min_bd, min_exp, req) = (big(pol, "maxBirthDay")?, big(pol, "minBirthDay").unwrap_or(0), big(pol, "minExpiryMonth")?, big(pol, "requiredNat")?);
    let nat = big(at, "natCode")?;
    if bd > max_bd || bd < min_bd { return Err("outside this poll's age range".into()); }
    if !(req == 0 || nat == req) || exp < min_exp { return Err("no document satisfies this poll's policy".into()); }
    let not_before = if at.get("notBefore").is_some() { big(at, "notBefore")? } else { 0 };
    let open_time = big(poll, "openTime")?;
    if not_before > open_time { return Err("this identity was issued after the poll opened".into()); }

    let poll_id = num(poll, "pollId")?;
    let r: Vec<Sc> = if let Some(rs) = v.get("r") {
        rs.as_array().ok_or("r: array expected")?.iter()
            .map(|x| x.as_str().and_then(|t| Sc::from_str(t).ok()).ok_or_else(|| Error::from("r: scalar expected"))).collect::<Result<_, _>>()?
    } else {
        let rev = get(v, "revision")?.as_u64().ok_or("revision: number expected")?;
        ballot_randomness(&s_fr, &poll_id, rev, choice)?
    };
    if r.len() != K || r.iter().any(|x| x.is_zero()) { return Err("r: four non-zero scalars expected".into()); }

    let pk = pt(get(poll, "PK")?)?;
    let g = g8();
    let mut ca = vec![]; let mut cb = vec![];
    for j in 0..K {
        let a = mul(&g, &r[j]);
        let rp = mul(&pk, &r[j]);
        let b = if j == choice { add(&g, &rp) } else { rp };
        ca.push(a); cb.push(b);
    }
    let nf = h(&[Fr::from(TAG_NULLIFIER), poll_id, s_fr])?;
    let (id_root, rev_root, ctx) = (num(poll, "idRoot")?, num(poll, "revRoot")?, num(poll, "ctxHash")?);
    let h1 = h(&[rev_root, poll_id, pk.0, pk.1, Fr::from(open_time as u64)])?;
    let h2 = h(&[Fr::from(max_bd as u64), Fr::from(min_bd as u64), Fr::from(min_exp as u64), Fr::from(req as u64), ctx])?;
    let poll_hash = h(&[Fr::from(TAG_POLL), h1, h2])?;
    let _ = s;
    let input = json!({
        "pollHash": dec(&poll_hash), "idRoot": dec(&id_root), "openTime": open_time.to_string(), "revRoot": dec(&rev_root), "pollId": dec(&poll_id), "nf": dec(&nf),
        "PK": pj(&pk), "maxBirthDay": max_bd.to_string(), "minBirthDay": min_bd.to_string(), "minExpiryMonth": min_exp.to_string(),
        "requiredNat": req.to_string(), "ctxHash": dec(&ctx),
        "CA": ca.iter().map(pj).collect::<Vec<_>>(), "CB": cb.iter().map(pj).collect::<Vec<_>>(),
        "s": dec(&s_fr), "birthDay": bd.to_string(), "sexCode": big(at, "sexCode")?.to_string(),
        "nat": [nat.to_string(), "0", "0"], "exp": [exp.to_string(), "0", "0"], "docSel": ["1", "0", "0"], "notBefore": not_before.to_string(),
        "salt": dec(&num(m, "salt")?), "rn": dec(&num(get(v, "credential")?, "rn")?),
        "idSiblings": strs(&frs(get(idp, "siblings")?)?), "idPathIndex": strs(&frs(get(idp, "pathIndex")?)?),
        "lowValue": dec(&num(rev, "lowValue")?), "nextValue": dec(&num(rev, "nextValue")?),
        "revSiblings": strs(&frs(get(rev, "siblings")?)?), "revPathIndex": strs(&frs(get(rev, "pathIndex")?)?),
        "v": (0..K).map(|j| if j == choice { "1" } else { "0" }).collect::<Vec<_>>(),
        "r": r.iter().map(|x| dec(x)).collect::<Vec<_>>(),
    });
    let ct: Vec<String> = ca.iter().chain(cb.iter()).flat_map(|p| [dec(&p.0), dec(&p.1)]).collect();
    Ok(json!({
        "input": input, "nf": dec(&nf), "ct": ct,
        "C": (0..K).map(|j| json!({ "A": pj(&ca[j]), "B": pj(&cb[j]) })).collect::<Vec<_>>(),
        "r": r.iter().map(|x| dec(x)).collect::<Vec<_>>(),
    }))
}

/// The member's nullifier in a poll, nf = H(1, pollId, s): the key under which the contract
/// keeps the member's ballot. `v`: {member {s}, pollId}. Returns {nf}.
pub fn nullifier(v: &Value) -> Result<Value, Error> {
    let nf = h(&[Fr::from(TAG_NULLIFIER), num(v, "pollId")?, num(get(v, "member")?, "s")?])?;
    Ok(json!({ "nf": dec(&nf) }))
}

/// Keccak-256, as the polls contract hashes a ballot (`_ctHash`).
fn keccak256(data: &[u8]) -> [u8; 32] {
    const RATE: usize = 136;
    let mut st = [0u64; 25];
    let mut buf = data.to_vec();
    buf.push(0x01);
    while buf.len() % RATE != 0 { buf.push(0); }
    let last = buf.len() - 1;
    buf[last] |= 0x80;
    for block in buf.chunks(RATE) {
        for (i, lane) in block.chunks(8).enumerate() {
            st[i] ^= u64::from_le_bytes(lane.try_into().unwrap());
        }
        keccak::f1600(&mut st);
    }
    let mut out = [0u8; 32];
    for i in 0..4 { out[8 * i..8 * i + 8].copy_from_slice(&st[i].to_le_bytes()); }
    out
}

fn be32(x: &Fr) -> [u8; 32] {
    let mut b = x.into_bigint().to_bytes_be();
    while b.len() < 32 { b.insert(0, 0); }
    b.try_into().unwrap()
}

/// The ballot hash the contract keeps for a nullifier (`ballots(pollId, nf).ballotHash`):
/// the first 28 bytes of Keccak-256 over A_j.x, A_j.y, B_j.x, B_j.y for each option j.
pub fn ballot_hash(ca: &[Pt], cb: &[Pt]) -> String {
    let mut data = Vec::with_capacity(32 * 4 * K);
    for j in 0..K { for v in [ca[j].0, ca[j].1, cb[j].0, cb[j].1] { data.extend_from_slice(&be32(&v)); } }
    let h = keccak256(&data);
    h[..28].iter().map(|b| format!("{:02x}", b)).collect()
}

/// Decision #62, principle 2: the answer recorded for this member, found without a stored
/// receipt. `v`: {member {s}, poll {pollId, PK}, count (ballots recorded for the nullifier),
/// ballotHash (hex of the 28 bytes the contract keeps)}. Tries every answer with the
/// randomness of each revision and answer, newest revision first. Returns {choice, revision, ct} if this
/// membership made the recorded ballot, or {choice: null} if it did not (for example a
/// ballot made with another phone's random values, or by someone who took the phone).
pub fn recorded_answer(v: &Value) -> Result<Value, Error> {
    let m = get(v, "member")?; let poll = get(v, "poll")?;
    let s = num(m, "s")?; let poll_id = num(poll, "pollId")?;
    let pk = pt(get(poll, "PK")?)?;
    let count = get(v, "count")?.as_u64().ok_or("count: number expected")?;
    let want = get(v, "ballotHash")?.as_str().ok_or("ballotHash: hex expected")?.trim_start_matches("0x").to_lowercase();
    // At most the contract's cap of changes: a larger count is not believed (a relay could send one).
    if count > 64 { return Err("count: more ballots than any poll allows".into()); }
    let g = g8();
    for rev in (0..count).rev() {
        for choice in 0..K {
            let r = ballot_randomness(&s, &poll_id, rev, choice)?;
            let ca: Vec<Pt> = r.iter().map(|x| mul(&g, x)).collect();
            let rp: Vec<Pt> = r.iter().map(|x| mul(&pk, x)).collect();
            let cb: Vec<Pt> = (0..K).map(|j| if j == choice { add(&g, &rp[j]) } else { rp[j] }).collect();
            if ballot_hash(&ca, &cb) == want {
                let ct: Vec<String> = ca.iter().chain(cb.iter()).flat_map(|p| [dec(&p.0), dec(&p.1)]).collect();
                return Ok(json!({ "choice": choice, "revision": rev, "ct": ct }));
            }
        }
    }
    Ok(json!({ "choice": null }))
}

