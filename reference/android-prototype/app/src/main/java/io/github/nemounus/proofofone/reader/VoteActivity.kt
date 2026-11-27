// SPDX-License-Identifier: Apache-2.0
// Proof of One — answering a poll (app v0.12, look of v0.13; Decision #62).
//
// 1. From the contracts, read directly (Chain.kt; v0.14, review of deployment 5): the poll's
//    tally key, times, policy, context hash and metadataHash, the newest identity root and
//    leaf count, the revocation root, and the ballot recorded for this member's nullifier.
//    From the relay's /state, only the bulky public lists (identity leaves, revoked handles),
//    which the native code checks against those roots, and the poll's text, shown only if the
//    Keccak-256 of its exact bytes equals metadataHash. Nothing the relay says decides what the
//    phone encrypts to, proves against or shows.
// 2. The recorded answer is found from the contract's ballot hash alone: the ballot's random
//    values come from the member's secret, the poll and a revision number, so a phone that got
//    the identity back (password, new phone) recomputes them (#62, principle 2). The answer is
//    shown on this screen only; nothing about it is written to the shared result.
// 3. A new or changed answer: π_vote proved on the phone with the newest identity root (any
//    root the registry has held is accepted, so a member registered after the poll opened can
//    answer it, principle 1), with the next revision's random values; a changed answer hands
//    the replaced ballot (rebuilt from the secret) to the contract, which subtracts it.
// 4. Sent through the relay; the phone then reads the recorded ballot back from the chain and
//    checks that it opens to the answer chosen.
// Before a ballot is proved, the member's face is checked on the phone against the chip photo's
// template (FaceCheckActivity; v0.16, Decisions #54 and #67): a deterrent, not a defence.
// 5. A closed poll shows its result instead (v0.15): the counts the contract accepted with a
//    valid proof of the count (getResult), as bars; and, if this member's ballot is on the
//    ledger, that it is counted, with the recorded answer shown on this phone only (R1). Before
//    the trustees publish, "waiting for the count".
// The secrets stay in member.json; the relay sees the nullifier, the ciphertexts and the proof,
// as everyone does on the ledger, and the phone's network address.
package io.github.nemounus.proofofone.reader

import android.app.Activity
import android.content.Intent
import android.graphics.Typeface
import android.os.Build
import android.os.Bundle
import android.view.View
import android.view.WindowInsets
import android.view.WindowManager
import android.widget.Button
import android.widget.LinearLayout
import android.widget.RadioButton
import android.widget.RadioGroup
import android.widget.ScrollView
import android.widget.TextView
import org.json.JSONArray
import org.json.JSONObject
import java.time.Instant
import java.time.ZoneId
import java.time.format.DateTimeFormatter

class VoteActivity : Activity() {
    private lateinit var col: LinearLayout
    private lateinit var status: TextView
    private lateinit var question: TextView
    private lateinit var recordedView: TextView
    private lateinit var options: RadioGroup
    private lateinit var send: Button
    private lateinit var share: Button
    private lateinit var summary: TextView      // result view: "n people answered · closed …"
    private lateinit var bars: LinearLayout     // result view: one row and bar per option
    private lateinit var after: LinearLayout    // result view: "your answer is counted", the note
    private val log = mutableListOf("Proof of One pilot ballot (app v0.17.1)")
    private var pendingChoice = -1
    @Volatile private var busy = false

    // what the screen was loaded with
    private var member: JSONObject? = null
    private var memberId: String? = null   // whose member file [member] is (review F17)
    private var st: JSONObject? = null
    private var nf: String? = null
    private var recorded: JSONObject? = null   // {choice, revision, ct} or {choice: null}

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        pendingChoice = savedInstanceState?.getInt("pendingChoice", -1) ?: -1   // kept if the screen is rebuilt during the face check (F17)
        window.addFlags(WindowManager.LayoutParams.FLAG_SECURE) // the answer is on screen: no screenshots
        L10n.load(this)
        if (!Profiles.guard(this)) return
        val pg = Ui.page(this, L10n.t(if (intent.getBooleanExtra("result", false)) "resultTitle" else "voteTitle"), 0) {
            Ui.menu(this, listOf(L10n.t("language") to { Ui.language(this) }, L10n.t("shareResult") to { shareLog() }))
        }
        val c = Ui.c(this)
        col = pg.content
        val qcard = Ui.card(this)
        question = Ui.heading(this, "").apply { visibility = View.GONE }
        qcard.addView(question)
        summary = Ui.note(this, "").apply { visibility = View.GONE }
        qcard.addView(summary)
        options = RadioGroup(this).apply { visibility = View.GONE; setOnCheckedChangeListener { _, _ -> Profiles.touch() } }   // choosing counts as use
        qcard.addView(options)
        bars = LinearLayout(this).apply { orientation = LinearLayout.VERTICAL; visibility = View.GONE }
        qcard.addView(bars)
        col.addView(qcard)
        after = LinearLayout(this).apply { orientation = LinearLayout.VERTICAL; visibility = View.GONE }
        col.addView(after)
        recordedView = Ui.body(this, "").apply { typeface = Ui.font(context, true); setTextColor(c.heading); visibility = View.GONE }
        col.addView(recordedView)
        status = Ui.status(this)
        col.addView(status)
        share = Ui.secondary(this, L10n.t("shareResult")) { shareLog() }.apply { visibility = View.GONE }
        send = Ui.primary(this, "") { submit() }.apply { visibility = View.GONE }
        pg.bottom.addView(share)
        pg.bottom.addView(send)
        load()
    }

    private fun shareLog() = startActivity(Intent.createChooser(Intent(Intent.ACTION_SEND).apply { type = "text/plain"; putExtra(Intent.EXTRA_TEXT, log.joinToString("\n")) }, "Share result"))
    private fun say(s: String) = runOnUiThread { status.text = s }
    private fun fail(e: Throwable, stage: String) {
        val msg = when (e) {
            is java.io.IOException -> L10n.t("voteOffline")
            is EnrolService.Failure -> L10n.t("voteFailed", e.message ?: "HTTP ${e.status}")
            else -> L10n.t("voteFailed", e.message ?: e.javaClass.simpleName)
        }
        log += "FAILED at $stage: ${e.javaClass.simpleName}: ${e.message}"
        runOnUiThread { status.text = msg; share.visibility = View.VISIBLE; send.isEnabled = true }
    }

    private fun native(op: String, data: JSONObject): JSONObject {
        val r = JSONObject(NativeProver.ballotOp(op, data.toString()))
        if (r.has("error")) throw Refused(r.getString("error"))
        return r
    }
    class Refused(message: String) : Exception(message)

    private fun pollOf(s: JSONObject) = s.getJSONObject("poll")

    class NoPoll : Exception()
    private val chain by lazy { Chain() }
    private val STATES = listOf("None", "Open", "Published", "Final", "Withheld", "Rejected")

    /**
     * The poll as the phone may rely on it: values from the chain, lists from the relay checked
     * against the chain, the text only if its hash is the poll's. Same shape as the relay's
     * /state, so that the rest of the screen reads one object.
     */
    private fun verifiedState(pollId: String, nf: String): JSONObject {
        val polls = Chain.POLLS
        val pid = java.math.BigInteger(pollId)
        val cp = chain.poll(polls, pid)
        if (cp.state == 0) throw NoPoll()
        val identity = chain.address(polls, "identity"); val revocation = chain.address(polls, "revocation")
        val n = chain.uint(identity, "leafCount").toInt()
        val idRoot = chain.uint(identity, "root")
        val revRoot = chain.uint(revocation, "root")
        val slot = chain.ballot(polls, pid, java.math.BigInteger(nf))
        // A published result: the counts the contract accepted with a valid proof of the count.
        val res = if (cp.state == 3) chain.result(polls, pid) else null
        if (res != null) log += "chain: result of poll $pollId read from the contract: ${res.counts.joinToString("·")}"
        // Statistics from public counters (Decision #66, point 1), for a closed poll.
        val closedNow = cp.state != 1 || System.currentTimeMillis() / 1000 >= cp.closeTime
        val stats = if (!closedNow) null else JSONObject()
            .put("voters", chain.uintOf(polls, "distinctVoters", pid).toString())
            .put("submissions", chain.uintOf(polls, "totalSubmissions", pid).toString())
            .put("members", n.toString())
        val s = EnrolService(Registration.RELAY).state(pollId, null)
        if (!s.optString("polls").equals(polls, ignoreCase = true)) error("the relay serves another polls contract than this app's")
        val all = s.getJSONObject("identity").getJSONArray("leaves")
        if (all.length() < n) throw java.io.IOException("the relay's list of members is behind the ledger; try again in a minute")
        val leaves = JSONArray(); for (i in 0 until n) leaves.put(all.getString(i))   // the newest root: all n leaves (review A4/F-03)
        val entry = s.optJSONObject("text")
        val textJson = entry?.optString("textJson").orEmpty()
        val textOk = textJson.isNotEmpty() && Chain.hex(Keccak.k256(textJson.toByteArray(Charsets.UTF_8))) == cp.metadataHash
        log += "chain: poll ${pollId} read from the contract; ${n} members; text ${if (textOk) "matches the poll's hash" else "NOT verified"}"
        return JSONObject()
            .put("poll", JSONObject().put("pollId", pollId).put("state", STATES.getOrElse(cp.state) { cp.state.toString() })
                .put("PK", JSONArray().put(cp.PK.first.toString()).put(cp.PK.second.toString()))
                .put("openTime", cp.openTime.toString()).put("closeTime", cp.closeTime.toString()).put("ctxHash", cp.ctxHash.toString())
                .put("maxRevotes", cp.maxRevotes)
                .put("policy", JSONObject().put("maxBirthDay", cp.maxBirthDay.toString()).put("minBirthDay", cp.minBirthDay.toString())
                    .put("minExpiryMonth", cp.minExpiryMonth.toString()).put("requiredNat", cp.requiredNat.toString())))
            .put("identity", JSONObject().put("root", idRoot.toString()).put("leaves", leaves))
            .put("revocation", JSONObject().put("root", revRoot.toString()).put("revoked", s.getJSONObject("revocation").getJSONArray("revoked")))
            .put("ballot", JSONObject().put("ballotHash", slot.ballotHash).put("count", slot.count))
            .put("verifiedText", if (textOk) JSONObject(textJson) else JSONObject.NULL)
            .put("stats", stats ?: JSONObject.NULL)
            .put("result", if (res != null) JSONArray(res.counts.map { it.toString() }) else JSONObject.NULL)
            .put("now", System.currentTimeMillis() / 1000)
    }

    /** Reads the poll and the answer recorded for this member. */
    private fun load() {
        say(L10n.t("voteLoading"))
        Thread {
            try {
                val m = Profiles.read()
                if (m.optJSONObject("registered") == null) { say(L10n.t("voteNotRegistered")); return@Thread }
                member = m; memberId = Profiles.current
                val relay = EnrolService(Registration.RELAY)
                // The poll chosen in the list (PollsActivity, v0.15); otherwise the relay's first.
                val pollId = intent.getStringExtra("pollId") ?: run {
                    val ids = relay.status().optJSONArray("pollIds")
                    if (ids == null || ids.length() == 0) { say(L10n.t("voteNoPoll")); return@Thread }
                    ids.getString(0)
                }
                val n = native("nullifier", JSONObject().put("member", m.getJSONObject("member")).put("pollId", pollId)).getString("nf")
                nf = n
                val s = try { verifiedState(pollId, n) } catch (e: NoPoll) { say(L10n.t("voteNoPoll")); return@Thread }
                st = s
                val p = pollOf(s)
                log += "poll ${p.getString("pollId")}: ${s.getJSONObject("identity").getJSONArray("leaves").length()} members on the ledger"
                val b = s.optJSONObject("ballot")
                recorded = if (b != null && b.optInt("count") > 0) native("recorded", JSONObject()
                    .put("member", JSONObject().put("s", m.getJSONObject("member").getString("s")))
                    .put("poll", JSONObject().put("pollId", p.getString("pollId")).put("PK", p.getJSONArray("PK")))
                    .put("count", b.getInt("count")).put("ballotHash", b.getString("ballotHash"))) else null
                runOnUiThread { show(s) }
            } catch (e: Throwable) { fail(e, "load") }
        }.start()
    }

    private fun textOf(s: JSONObject): JSONObject? {
        val t = s.optJSONObject("verifiedText") ?: return null
        return t.optJSONObject(L10n.lang) ?: t.optJSONObject("en")
    }

    private fun show(s: JSONObject) {
        val p = pollOf(s)
        val text = textOf(s)
        val opts: JSONArray = text?.optJSONArray("options") ?: JSONArray((1..4).map { "${L10n.t("voteOption")} $it" })
        val close = p.getString("closeTime").toLong()
        val open = p.getString("openTime").toLong()
        val now = s.optLong("now", System.currentTimeMillis() / 1000)
        fun time(sec: Long) = Instant.ofEpochSecond(sec).atZone(ZoneId.systemDefault()).format(DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm"))
        question.text = text?.optString("question") ?: "Poll ${p.getString("pollId")}"
        question.visibility = View.VISIBLE
        options.removeAllViews()
        val pal = Ui.c(this)
        for (i in 0 until opts.length()) options.addView(RadioButton(this).apply {
            id = 1000 + i; this.text = opts.getString(i); textSize = 17f; typeface = Ui.font(context); setTextColor(pal.text)
            buttonTintList = android.content.res.ColorStateList.valueOf(pal.primary)
            minHeight = Ui.dp(context, 52); setPadding(Ui.dp(context, 8), 0, Ui.dp(context, 8), 0)
        })
        options.visibility = View.VISIBLE
        val r = recorded
        val count = s.optJSONObject("ballot")?.optInt("count") ?: 0
        when {
            r != null && !r.isNull("choice") -> {
                val c = r.getInt("choice")
                recordedView.text = L10n.t("voteRecorded", opts.getString(c))
                options.check(1000 + c)
            }
            count > 0 -> recordedView.text = L10n.t("voteForeign")
            else -> recordedView.text = L10n.t("voteNone")
        }
        recordedView.visibility = View.VISIBLE
        val state = p.optString("state")
        when {
            state != "Open" || now >= close -> showResult(s, opts, state, time(close).substring(0, 10), text != null)
            now < open -> status.text = L10n.t("voteNotOpen", time(open))
            text == null -> {   // the relay's text does not match the poll's hash: nothing to choose from (review B1/F-02)
                status.text = L10n.t("voteTextUnverified")
                for (i in 0 until options.childCount) options.getChildAt(i).isEnabled = false
            }
            count > 0 && (r == null || r.isNull("choice")) -> {
                status.text = L10n.t("voteClosesAt", time(close))
                for (i in 0 until options.childCount) options.getChildAt(i).isEnabled = false
            }
            else -> {
                status.text = L10n.t("voteClosesAt", time(close))
                send.text = L10n.t(if (count > 0) "voteChange" else "voteSend")
                send.visibility = View.VISIBLE
            }
        }
    }

    /** The result view of a closed poll (v0.15). */
    private fun showResult(s: JSONObject, opts: JSONArray, state: String, closed: String, textOk: Boolean) {
        val pal = Ui.c(this)
        options.visibility = View.GONE; recordedView.visibility = View.GONE; send.visibility = View.GONE
        status.visibility = View.GONE
        bars.removeAllViews(); after.removeAllViews()
        bars.visibility = View.VISIBLE; after.visibility = View.VISIBLE; summary.visibility = View.VISIBLE
        val r = recorded
        val mine = if (r != null && !r.isNull("choice")) r.getInt("choice") else null
        val counts = s.optJSONArray("result")
        if (!textOk) bars.addView(Ui.note(this, L10n.t("voteTextUnverified")))
        s.optJSONObject("stats")?.let { st -> after.addView(statsCard(st)) }
        when {
            state == "Final" && counts != null -> {
                val n = (0 until counts.length()).map { counts.getString(it).toLong() }
                val total = n.sum()
                val top = n.maxOrNull() ?: 0L
                summary.text = L10n.t("resultSummary", Ui.digits(total.toString()), closed)
                for (i in 0 until minOf(n.size, opts.length())) {
                    val lead = total > 0 && n[i] == top
                    val frac = if (total > 0) n[i].toFloat() / total else 0f
                    val row = LinearLayout(this).apply { orientation = LinearLayout.HORIZONTAL; setPadding(0, Ui.dp(context, 12), 0, Ui.dp(context, 4)) }
                    row.addView(Ui.body(this, opts.getString(i) + if (lead) " ✓" else "").apply { if (lead) { typeface = Ui.font(context, true); setTextColor(pal.primary) } },
                        LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f))
                    row.addView(Ui.note(this, "${Math.round(frac * 100)}% (${n[i]})").apply {
                        layoutDirection = View.LAYOUT_DIRECTION_LTR; setPadding(Ui.dp(context, 10), Ui.dp(context, 4), 0, 0) })
                    bars.addView(row)
                    bars.addView(Ui.Bar(this, frac, lead))
                }
                if (mine != null) after.addView(countedCard(opts.optString(mine)))
                else if ((s.optJSONObject("ballot")?.optInt("count") ?: 0) == 0) after.addView(Ui.note(this, L10n.t("resultNotAnswered")))
                after.addView(Ui.note(this, L10n.t("resultNote")).apply { setPadding(0, Ui.dp(context, 12), 0, 0) })
            }
            state == "Open" -> {   // closed, not yet counted
                summary.text = L10n.t("pollClosedOn", closed)
                bars.addView(Ui.body(this, L10n.t("pollResultWait").replaceFirstChar { it.uppercase() }).apply { typeface = Ui.font(context, true); setPadding(0, Ui.dp(context, 12), 0, 0) })
                bars.addView(Ui.note(this, L10n.t("resultWait")))
                if (mine != null) after.addView(Ui.note(this, L10n.t("resultYours", opts.optString(mine))).apply { setPadding(0, Ui.dp(context, 8), 0, 0) })
            }
            else -> {   // withheld: not published in time
                summary.text = L10n.t("pollClosedOn", closed)
                bars.addView(Ui.body(this, L10n.t("resultNone")).apply { setPadding(0, Ui.dp(context, 12), 0, 0) })
            }
        }
    }

    /**
     * Statistics from the contract's public counters (Decision #66, point 1): how many took part
     * of the memberships registered so far, and how many times answers were changed. Which
     * answer anyone changed from or to is never known.
     */
    private fun statsCard(st: JSONObject) = Ui.card(this, tint = true).apply {
        val voters = st.getString("voters").toLong(); val subs = st.getString("submissions").toLong(); val members = st.getString("members").toLong()
        val pct = if (members > 0) Math.round(100.0 * voters / members) else 0
        addView(Ui.note(context, L10n.t("statsTitle")).apply { typeface = Ui.font(context, true) })
        addView(Ui.body(context, L10n.t("statTook", Ui.digits(voters.toString()), Ui.digits(members.toString()), Ui.digits(pct.toString()))))
        addView(Ui.body(context, L10n.t("statChanges", Ui.digits(maxOf(0L, subs - voters).toString()))))
    }

    /** The green card: this member's ballot is in the published result; its answer, on this phone only. */
    private fun countedCard(answer: String) = Ui.card(this).apply {
        val pal = Ui.c(context)
        background = android.graphics.drawable.GradientDrawable().apply {
            setColor((pal.good and 0x00FFFFFF) or 0x1A000000); cornerRadius = Ui.dp(context, 12).toFloat()
            setStroke(Ui.dp(context, 1), (pal.good and 0x00FFFFFF) or 0x55000000)
        }
        addView(Ui.body(context, "✓ " + L10n.t("resultCounted")).apply { typeface = Ui.font(context, true); setTextColor(pal.good) })
        addView(Ui.note(context, L10n.t("resultYours", answer)).apply { setTextColor(pal.text) })
    }

    private val idle = Profiles.IdleWatch(this) { busy }   // N11: the recorded answer is not left on screen
    override fun onResume() { super.onResume(); idle.start(); if (!busy && !Profiles.isOpen()) Profiles.guard(this) }
    override fun onPause() { super.onPause(); idle.stop() }
    override fun onSaveInstanceState(out: Bundle) { super.onSaveInstanceState(out); out.putInt("pendingChoice", pendingChoice) }

    /** The answer is chosen: first the face check on the phone (v0.16), then the ballot. */
    private fun submit() {
        val choice = options.checkedRadioButtonId - 1000
        if (choice < 0) { say(L10n.t("voteChoose")); return }
        val r = recorded
        if (r != null && !r.isNull("choice") && r.getInt("choice") == choice) { say(L10n.t("voteSame")); return }
        if (busy) return
        pendingChoice = choice
        @Suppress("DEPRECATION") startActivityForResult(Intent(this, FaceCheckActivity::class.java), 7)
    }

    @Deprecated("Deprecated in Java")
    override fun onActivityResult(requestCode: Int, resultCode: Int, data: Intent?) {
        @Suppress("DEPRECATION") super.onActivityResult(requestCode, resultCode, data)
        if (requestCode != 7) return
        if (resultCode != RESULT_OK) { say(L10n.t("faceCheckNeeded")); return }
        // F17: the member may have closed (five minutes) while the camera was open, or the screen
        // may have been rebuilt and not be loaded yet: then nothing is sent, and the member is told.
        if (!Profiles.isOpen()) { Profiles.guard(this); return }
        if (member == null || st == null || nf == null || pendingChoice < 0) { say(L10n.t("voteAgain")); return }
        if (Profiles.current != memberId) { finish(); return }   // another member is open now
        member = Profiles.read()
        log += "face check before the ballot: passed on the phone (similarity %.1f, threshold %.2f); no face data sent".format(
            java.util.Locale.ROOT, data?.getFloatExtra("similarity", 0f) ?: 0f, FaceMatcher.THRESHOLD)
        runOnUiThread { status.text = L10n.t("faceCheckOk") }
        cast(pendingChoice)
    }

    private fun cast(choice: Int) {
        if (choice < 0 || busy) return
        busy = true; send.isEnabled = false
        Thread {
            var stage = "state"
            try {
                val m = member!!
                val relay = EnrolService(Registration.RELAY)
                val p0 = pollOf(st!!)
                // Fresh state from the chain: the newest roots, and the count of ballots recorded for nf.
                val s = verifiedState(p0.getString("pollId"), nf!!)
                if (s.isNull("verifiedText")) { say(L10n.t("voteTextUnverified")); return@Thread }
                val p = pollOf(s)
                val count = s.optJSONObject("ballot")?.optInt("count") ?: 0
                val rec = if (count > 0) native("recorded", JSONObject()
                    .put("member", JSONObject().put("s", m.getJSONObject("member").getString("s")))
                    .put("poll", JSONObject().put("pollId", p.getString("pollId")).put("PK", p.getJSONArray("PK")))
                    .put("count", count).put("ballotHash", s.getJSONObject("ballot").getString("ballotHash"))) else null
                if (rec != null && rec.isNull("choice")) { say(L10n.t("voteForeign")); return@Thread }
                stage = "paths"; say(L10n.t("voteProving"))
                val leaf = m.getJSONObject("registered").getString("leaf")
                val idPath = native("identityPath", JSONObject().put("leaves", s.getJSONObject("identity").getJSONArray("leaves"))
                    .put("leaf", leaf).put("idRoot", s.getJSONObject("identity").getString("root")))
                val rev = native("revocation", JSONObject().put("revoked", s.getJSONObject("revocation").getJSONArray("revoked"))
                    .put("rn", m.getJSONObject("credential").getString("rn")).put("revRoot", s.getJSONObject("revocation").getString("root")))
                stage = "input"
                val pollData = JSONObject().put("pollId", p.getString("pollId")).put("PK", p.getJSONArray("PK"))
                    .put("idRoot", s.getJSONObject("identity").getString("root")).put("revRoot", s.getJSONObject("revocation").getString("root"))
                    .put("ctxHash", p.getString("ctxHash")).put("openTime", p.getString("openTime")).put("policy", p.getJSONObject("policy"))
                val built = try {
                    native("input", JSONObject().put("member", m.getJSONObject("member")).put("attrs", m.getJSONObject("attrs"))
                        .put("credential", m.getJSONObject("credential")).put("poll", pollData)
                        .put("idPath", idPath).put("rev", rev).put("choice", choice).put("revision", count))
                } catch (e: Refused) {
                    val msg = e.message ?: ""
                    say(when {
                        "issued after the poll opened" in msg -> L10n.t("voteLate")
                        "age range" in msg || "policy" in msg -> L10n.t("voteNotEligible")
                        else -> L10n.t("voteFailed", msg)
                    }); log += "refused on the phone: $msg"; runOnUiThread { share.visibility = View.VISIBLE }; return@Thread
                }
                if (built.getString("nf") != nf) error("nullifier mismatch")
                stage = "prove"
                val graph = assets.open("ballot.graph").use { it.readBytes() }
                val zkey = assets.open("ballot_test.zkey").use { it.readBytes() }
                val t0 = System.nanoTime()
                val out = JSONObject(NativeProver.prove(graph, zkey, built.getJSONObject("input").toString()))
                if (out.has("error")) error("π_vote: " + out.getString("error"))
                val ms = (System.nanoTime() - t0) / 1_000_000
                val pub = out.getJSONArray("public")
                if (!out.optBoolean("verified") || pub.getString(1) != nf || pub.getString(2) != s.getJSONObject("identity").getString("root"))
                    error("π_vote did not verify on the phone")
                log += "π_vote made and verified on the phone in $ms ms (${if (count > 0) "a changed answer" else "a first answer"})"
                val pr = out.getJSONObject("proof")
                val a = pr.getJSONArray("pi_a"); val b = pr.getJSONArray("pi_b"); val c = pr.getJSONArray("pi_c")
                fun g2(i: Int) = JSONArray().put(b.getJSONArray(i).getString(1)).put(b.getJSONArray(i).getString(0))
                val prev = rec?.getJSONArray("ct") ?: JSONArray((1..16).map { "0" })
                val body = JSONObject().put("pollId", p.getString("pollId")).put("nf", nf).put("idRoot", s.getJSONObject("identity").getString("root"))
                    .put("ct", built.getJSONArray("ct")).put("prev", prev)
                    .put("a", JSONArray().put(a.getString(0)).put(a.getString(1))).put("b", JSONArray().put(g2(0)).put(g2(1)))
                    .put("c", JSONArray().put(c.getString(0)).put(c.getString(1)))
                stage = "send"; say(L10n.t("voteSending"))
                relay.vote(body)
                log += "sent through the relay"
                // Read the recorded ballot back until it is in a block (about a minute at most).
                stage = "confirm"; say(L10n.t("voteConfirming"))
                var mine: JSONObject? = null
                for (i in 0 until 20) {
                    Thread.sleep(4000)
                    val slot = try { chain.ballot(Chain.POLLS, java.math.BigInteger(p.getString("pollId")), java.math.BigInteger(nf)) } catch (e: java.io.IOException) { continue }
                    if (slot.count <= count) continue
                    mine = native("recorded", JSONObject()
                        .put("member", JSONObject().put("s", m.getJSONObject("member").getString("s")))
                        .put("poll", JSONObject().put("pollId", p.getString("pollId")).put("PK", p.getJSONArray("PK")))
                        .put("count", slot.count).put("ballotHash", slot.ballotHash))
                    st = try { verifiedState(p.getString("pollId"), nf!!) } catch (e: Exception) { st }
                    break
                }
                if (mine == null) { say(L10n.t("voteNotYet")); log += "not yet in a block after 80 s"; runOnUiThread { share.visibility = View.VISIBLE }; return@Thread }
                val ok = !mine.isNull("choice") && mine.getInt("choice") == choice
                log += if (ok) "recorded on the ledger and read back from the chain: it opens to the answer chosen on this phone" else "recorded ballot does NOT open to the answer chosen"
                recorded = mine
                runOnUiThread {
                    show(st!!)
                    status.text = if (ok) L10n.t("voteDone") else L10n.t("voteFailed", "the recorded ballot differs")
                    share.visibility = View.VISIBLE
                }
            } catch (e: Throwable) { fail(e, stage) } finally { busy = false; runOnUiThread { send.isEnabled = true } }
        }.start()
    }
}
