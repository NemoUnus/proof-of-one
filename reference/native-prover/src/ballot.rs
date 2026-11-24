// SPDX-License-Identifier: Apache-2.0
// The phone's ballot (Decision #45, #61; ballot-circuit/circuits/ballot.circom): the inputs
// of π_vote, as buildBallot in ballot-circuit/src/ballot.js makes them, from what the phone
// kept at enrolment (member.json) and a poll's published values; the member's path in the
// identity tree at the poll's snapshot; and the non-revocation witness. Checked against the
// reference by the vote-check binary in the Android workflow.
use crate::fingerprint::{add, dec, g8, mul, Pt};
use ark_bn254::Fr;
use ark_ff::{PrimeField, Zero};
use ark_ed_on_bn254::Fr as Sc;
use serde_json::{json, Value};
use std::str::FromStr;

type Error = Box<dyn std::error::Error + Send + Sync>;

const K: usize = 4;
const DEPTH: usize = 32;
const TAG_NULLIFIER: u64 = 1;
const TAG_POLL: u64 = 7;

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

/// The member's path in the identity tree as it was when the poll opened: the poll's idRoot
/// is the root of the first n published leaves for some n (the registry's leafCount then).
/// `v`: {leaves: [...], leaf, idRoot}. Returns {siblings, pathIndex, index, n}.
pub fn identity_path(v: &Value) -> Result<Value, Error> {
    let leaves = frs(get(v, "leaves")?)?;
    let leaf = num(v, "leaf")?;
    let root = num(v, "idRoot")?;
    let index = leaves.iter().position(|l| *l == leaf).ok_or("this membership is not in the published identity tree yet")?;
    // n runs over batch boundaries (multiples of 4) and the full length
    let mut ns: Vec<usize> = (1..=leaves.len() / 4).map(|b| b * 4).collect();
    ns.push(leaves.len());
    for n in ns.into_iter().rev() {
        if n <= index { break; }
        let t = Tree::new(leaves[..n].to_vec())?;
        if t.root()? == root {
            let (s, p) = t.path(index)?;
            return Ok(json!({ "siblings": strs(&s), "pathIndex": strs(&p), "index": index, "n": n }));
        }
    }
    Err("this membership was not yet in the identity tree when the poll opened".into())
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

/// π_vote's inputs. `v` holds:
///   member {s, salt}, attrs {birthDay, sexCode, natCode, expMonth}, credential {rn}
///   poll {pollId, PK: [x, y], idRoot, revRoot, ctxHash,
///         policy {maxBirthDay, minBirthDay, minExpiryMonth, requiredNat}}
///   idPath {siblings, pathIndex}, rev {lowValue, nextValue, siblings, pathIndex}
///   choice (0..3), and either rand (hex, at least 4 × 64 bytes) or r (4 decimal scalars, tests)
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

    let r: Vec<Sc> = if let Some(rs) = v.get("r") {
        rs.as_array().ok_or("r: array expected")?.iter()
            .map(|x| x.as_str().and_then(|t| Sc::from_str(t).ok()).ok_or_else(|| Error::from("r: scalar expected"))).collect::<Result<_, _>>()?
    } else {
        let hex = get(v, "rand")?.as_str().ok_or("rand: hex expected")?;
        let b: Vec<u8> = (0..hex.len() / 2).map(|i| u8::from_str_radix(&hex[2 * i..2 * i + 2], 16)).collect::<Result<_, _>>().map_err(|_| "rand: hex expected")?;
        if b.len() < 64 * K { return Err("rand: too short".into()); }
        (0..K).map(|j| Sc::from_le_bytes_mod_order(&b[64 * j..64 * (j + 1)])).collect()
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
    let poll_id = num(poll, "pollId")?;
    let nf = h(&[Fr::from(TAG_NULLIFIER), poll_id, s_fr])?;
    let (id_root, rev_root, ctx) = (num(poll, "idRoot")?, num(poll, "revRoot")?, num(poll, "ctxHash")?);
    let h1 = h(&[id_root, rev_root, poll_id, pk.0, pk.1])?;
    let h2 = h(&[Fr::from(max_bd as u64), Fr::from(min_bd as u64), Fr::from(min_exp as u64), Fr::from(req as u64), ctx])?;
    let poll_hash = h(&[Fr::from(TAG_POLL), h1, h2])?;
    let _ = s;
    let input = json!({
        "pollHash": dec(&poll_hash), "idRoot": dec(&id_root), "revRoot": dec(&rev_root), "pollId": dec(&poll_id), "nf": dec(&nf),
        "PK": pj(&pk), "maxBirthDay": max_bd.to_string(), "minBirthDay": min_bd.to_string(), "minExpiryMonth": min_exp.to_string(),
        "requiredNat": req.to_string(), "ctxHash": dec(&ctx),
        "CA": ca.iter().map(pj).collect::<Vec<_>>(), "CB": cb.iter().map(pj).collect::<Vec<_>>(),
        "s": dec(&s_fr), "birthDay": bd.to_string(), "sexCode": big(at, "sexCode")?.to_string(),
        "nat": [nat.to_string(), "0", "0"], "exp": [exp.to_string(), "0", "0"], "docSel": ["1", "0", "0"],
        "salt": dec(&num(m, "salt")?), "rn": dec(&num(get(v, "credential")?, "rn")?),
        "idSiblings": strs(&frs(get(idp, "siblings")?)?), "idPathIndex": strs(&frs(get(idp, "pathIndex")?)?),
        "lowValue": dec(&num(rev, "lowValue")?), "nextValue": dec(&num(rev, "nextValue")?),
        "revSiblings": strs(&frs(get(rev, "siblings")?)?), "revPathIndex": strs(&frs(get(rev, "pathIndex")?)?),
        "v": (0..K).map(|j| if j == choice { "1" } else { "0" }).collect::<Vec<_>>(),
        "r": r.iter().map(|x| dec(x)).collect::<Vec<_>>(),
    });
    Ok(json!({
        "input": input, "nf": dec(&nf),
        "C": (0..K).map(|j| json!({ "A": pj(&ca[j]), "B": pj(&cb[j]) })).collect::<Vec<_>>(),
        "r": r.iter().map(|x| dec(x)).collect::<Vec<_>>(),
    }))
}
