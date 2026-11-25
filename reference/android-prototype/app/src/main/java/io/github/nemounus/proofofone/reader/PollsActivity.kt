// SPDX-License-Identifier: Apache-2.0
// Proof of One — the polls, in two screens (app v0.15; founder's proposal, mockups approved).
//
// 1. The categories: polls about the project, social polls, polls about the place where
//    members live, and polls that choose the topics of later polls (v0.16), each with a line
//    of description and the number of its open polls.
// 2. One category's polls, in three groups:
//      - open, not answered yet;
//      - answered, still open (the answer can be changed until the poll closes);
//      - finished: tapping one shows its result (VoteActivity, result view).
// The category is part of each poll's text, whose Keccak-256 the poll holds on the ledger as
// metadataHash: the relay supplies the texts (GET /polls), and a poll is listed only if its text
// matches the hash read from the contract (Chain.kt), as on the poll screen. Whether an answer is
// recorded comes from the contract's ballot slot for the member's nullifier; never which answer.
// Both screens are this one activity: without the "category" extra it shows the categories.
package io.github.nemounus.proofofone.reader

import android.app.Activity
import android.content.Intent
import android.os.Bundle
import android.view.View
import android.view.WindowManager
import android.widget.LinearLayout
import android.widget.TextView
import org.json.JSONObject
import java.math.BigInteger
import java.time.Instant
import java.time.ZoneId
import java.time.format.DateTimeFormatter

class PollsActivity : Activity() {
    private lateinit var list: LinearLayout
    private lateinit var status: TextView
    private var category: String? = null

    /** [state]: the contract's state (1 open, 3 result published, 4 withheld, 5 rejected). */
    private class Item(val pollId: String, val category: String, val question: String, val state: Int,
                       val openTime: Long, val closeTime: Long, val answered: Boolean) {
        fun open(now: Long) = state == 1 && now < closeTime
    }

    companion object {
        /** Category code in the poll's text → title and description keys. A text without one is "project". */
        val CATEGORIES = listOf(
            Triple("project", "catProject", "catProjectDesc"),
            Triple("social", "catSocial", "catSocialDesc"),
            Triple("regional", "catRegional", "catRegionalDesc"),
            // choosing the topics of later polls (Decisions #15 and #18, in a first, simple form)
            Triple("agenda", "catAgenda", "catAgendaDesc"))
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        window.addFlags(WindowManager.LayoutParams.FLAG_SECURE)
        L10n.load(this)
        if (!Profiles.guard(this)) return
        category = intent.getStringExtra("category")
        val title = CATEGORIES.firstOrNull { it.first == category }?.second?.let { L10n.t(it) } ?: L10n.t("pollsBtn")
        val pg = Ui.page(this, title, 0) { Ui.menu(this, listOf(L10n.t("language") to { Ui.language(this) })) }
        list = pg.content
        status = Ui.status(this)
        list.addView(status)
    }

    override fun onResume() {
        super.onResume()
        if (!Profiles.guard(this)) return
        load()   // again after answering, so that the groups are current
    }

    private fun load() {
        status.visibility = View.VISIBLE
        Ui.say(status, L10n.t("voteLoading"))
        for (i in list.childCount - 1 downTo 1) list.removeViewAt(i)
        Thread {
            try {
                val m = Profiles.read()
                val s = m.getJSONObject("member").getString("s")
                val chain = Chain()
                val r = EnrolService(Registration.RELAY).polls()
                if (!r.optString("polls").equals(Chain.POLLS, ignoreCase = true)) error("the relay serves another polls contract than this app's")
                val entries = r.getJSONArray("entries")
                val items = mutableListOf<Item>()
                for (i in 0 until entries.length()) {
                    val e = entries.getJSONObject(i)
                    val pollId = e.getString("pollId")
                    val p = chain.poll(Chain.POLLS, BigInteger(pollId))
                    val textJson = e.optString("textJson")
                    if (p.state == 0 || Chain.hex(Keccak.k256(textJson.toByteArray(Charsets.UTF_8))) != p.metadataHash) continue   // not the poll's text: not listed
                    val text = JSONObject(textJson)
                    val cat = text.optString("category", "project")
                    // The category screen needs only the counts of open polls; the slot is read for one category's polls.
                    if (category != null && cat != category) continue
                    val lang = text.optJSONObject(L10n.lang) ?: text.getJSONObject("en")
                    val answered = if (category == null) false else {
                        val nf = JSONObject(NativeProver.ballotOp("nullifier", JSONObject().put("member", JSONObject().put("s", s)).put("pollId", pollId).toString())).getString("nf")
                        chain.ballot(Chain.POLLS, BigInteger(pollId), BigInteger(nf)).count > 0
                    }
                    items += Item(pollId, cat, lang.getString("question"), p.state, p.openTime, p.closeTime, answered)
                }
                runOnUiThread { if (category == null) showCategories(items) else showCategory(items) }
            } catch (e: java.io.IOException) {
                runOnUiThread { Ui.say(status, L10n.t("voteOffline"), 2) }
            } catch (e: Throwable) {
                runOnUiThread { Ui.say(status, L10n.t("voteFailed", e.message ?: e.javaClass.simpleName), 2) }
            }
        }.start()
    }

    private val now get() = System.currentTimeMillis() / 1000
    private fun time(sec: Long, pattern: String = "yyyy-MM-dd HH:mm") =
        Instant.ofEpochSecond(sec).atZone(ZoneId.systemDefault()).format(DateTimeFormatter.ofPattern(pattern))

    /** Screen 1: the three categories, each with the number of its open polls. */
    private fun showCategories(items: List<Item>) {
        status.visibility = View.GONE
        for ((code, titleKey, descKey) in CATEGORIES) {
            val active = items.count { it.category == code && it.open(now) }
            list.addView(Ui.row(this, L10n.t(titleKey), L10n.t(descKey), if (active > 0) Ui.digits(L10n.t("catActive", active)) else null) {
                startActivity(Intent(this, PollsActivity::class.java).putExtra("category", code))
            })
        }
    }

    /** Screen 2: one category's polls in three groups. */
    private fun showCategory(items: List<Item>) {
        if (items.isEmpty()) { Ui.say(status, L10n.t("catEmpty")); return }
        status.visibility = View.GONE
        val t = now
        val toAnswer = items.filter { it.open(t) && !it.answered }.sortedBy { it.closeTime }
        val answered = items.filter { it.open(t) && it.answered }.sortedBy { it.closeTime }
        val finished = items.filter { !it.open(t) }.sortedByDescending { it.closeTime }
        val good = Ui.c(this).good
        fun section(key: String) = list.addView(Ui.note(this, L10n.t(key)).apply { typeface = Ui.font(context, true); setPadding(0, Ui.dp(context, 14), 0, 0) })
        fun open(item: Item, result: Boolean) =
            startActivity(Intent(this, VoteActivity::class.java).putExtra("pollId", item.pollId).putExtra("result", result))
        if (toAnswer.isNotEmpty()) {
            section("secToAnswer")
            for (item in toAnswer) {
                val line = if (t < item.openTime) L10n.t("pollOpens", time(item.openTime)) else L10n.t("pollUntil", time(item.closeTime))
                list.addView(Ui.row(this, item.question, line, null) { open(item, false) })
            }
        }
        if (answered.isNotEmpty()) {
            section("secAnswered")
            for (item in answered) {
                val line = "✓ " + L10n.t("pollRecorded") + " · " + L10n.t("pollChangeUntil", time(item.closeTime, "yyyy-MM-dd"))
                list.addView(Ui.row(this, item.question, line, null, good) { open(item, false) })
            }
        }
        if (finished.isNotEmpty()) {
            section("secFinished")
            for (item in finished) {
                val outcome = when (item.state) {
                    3 -> L10n.t("pollResultOut")
                    1 -> L10n.t("pollResultWait")
                    else -> L10n.t("pollResultNone")
                }
                val line = L10n.t("pollClosedOn", time(item.closeTime, "yyyy-MM-dd")) + " · " + outcome
                list.addView(Ui.row(this, item.question, line, null) { open(item, true) })
            }
        }
    }
}
