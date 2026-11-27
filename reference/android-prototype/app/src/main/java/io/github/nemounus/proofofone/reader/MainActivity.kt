// SPDX-License-Identifier: Apache-2.0
// Proof of One — the app's first screen (v0.13: one task per screen, Decision #64).
//
// Joining has six numbered steps. This screen holds steps 1, 2 and 6 and, once joined, the
// member's home; EnrolActivity holds steps 3–5:
//   (welcome, once) → 1 passport details → 2 reading the chip → [3 information and consent →
//   4 face check → 5 password and enrolment] → 6 registration on the public ledger → home.
// From v0.16 (Decisions #54 and #67) a phone holds up to four members. With none, the app
// opens on the welcome and step 1; otherwise on the list of members, each opened with their
// own password (the one chosen at enrolment, also used for the backup). A member closes after
// five minutes without use. A membership kept by an older version (member.json) is moved into
// the encrypted store on first start, under a password the member chooses.
// v0.17 (independent review of v0.16): the last passport read is forgotten when a member is
// closed, switched or removed, and the test tools are only in test builds (F1); the wait after
// wrong passwords is kept per member on disk (F2); a member left on the home screen closes after
// five minutes (F12); a closed member can be removed (F15); the move from member.json can be
// repeated safely (F16).
// The three values from the passport's machine-readable zone open the chip (BAC/PACE); they
// stay in memory only and are cleared after each read. The chip is checked on the phone. The
// technical test tools are behind "⋮", with the language. The report that can be shared holds
// no name, document number or birth date.
package io.github.nemounus.proofofone.reader

import android.app.Activity
import android.content.Context
import android.content.Intent
import android.nfc.NfcAdapter
import android.nfc.Tag
import android.nfc.tech.IsoDep
import android.os.Bundle
import android.view.View
import android.view.WindowManager
import android.widget.Button
import android.widget.EditText
import android.widget.TextView
import org.bouncycastle.jce.provider.BouncyCastleProvider
import org.jmrtd.BACKey
import org.json.JSONObject
import java.io.File
import java.security.Security
import kotlin.concurrent.thread

class MainActivity : Activity(), NfcAdapter.ReaderCallback {

    private enum class P { WELCOME, DETAILS, CHIP, REG, HOME, OLD, MEMBERS, UNLOCK, MIGRATE }
    private var page: P? = null
    private var nfc: NfcAdapter? = null
    private var key: BACKey? = null
    private var shareText = ""
    private var adding = false             // enrolling one more member (or the first)
    private var unlockId: String? = null   // the member whose password is being asked
    private val timer = android.os.Handler(android.os.Looper.getMainLooper())

    // views of the current page (replaced when the page changes)
    private var status: TextView? = null
    private var report: TextView? = null
    private var docNo: EditText? = null
    private var birth: EditText? = null
    private var expiry: EditText? = null
    private var pw: EditText? = null

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        // Use the full Bouncy Castle provider (brainpool curves, RSA-PSS) instead of Android's copy.
        Security.removeProvider("BC")
        Security.insertProviderAt(BouncyCastleProvider(), 1)
        window.addFlags(WindowManager.LayoutParams.FLAG_SECURE) // no screenshots while values are on screen
        nfc = NfcAdapter.getDefaultAdapter(this)
        L10n.load(this)
    }

    override fun onResume() {
        super.onResume()
        Profiles.isOpen()   // closes a member left unused for too long
        route()
        watchLock()
        nfc?.enableReaderMode(this, this,
            NfcAdapter.FLAG_READER_NFC_A or NfcAdapter.FLAG_READER_NFC_B or NfcAdapter.FLAG_READER_SKIP_NDEF_CHECK, null)
    }

    override fun onPause() {
        super.onPause()
        timer.removeCallbacksAndMessages(null)
        nfc?.disableReaderMode(this)
    }

    /** While the home screen is shown, checks every 20 seconds whether the member has closed (review F12). */
    private val lockWatch = object : Runnable {
        override fun run() {
            if (page == P.HOME && !Profiles.isOpen()) route()
            lockTimer.postDelayed(this, 20_000L)
        }
    }
    private val lockTimer = android.os.Handler(android.os.Looper.getMainLooper())
    private fun watchLock() { lockTimer.removeCallbacks(lockWatch); lockTimer.postDelayed(lockWatch, 20_000L) }
    override fun onStop() { super.onStop(); lockTimer.removeCallbacks(lockWatch) }

    /** The technical test tools are only in test (debuggable) builds, never in the pilot's (review F1). */
    private val testBuild get() = (applicationInfo.flags and android.content.pm.ApplicationInfo.FLAG_DEBUGGABLE) != 0

    private fun t(k: String, vararg a: Any) = L10n.t(k, *a)
    private val prefs get() = getSharedPreferences("prefs", Context.MODE_PRIVATE)

    /** Which page the members' state calls for. */
    private fun route() {
        val members = Profiles.list(this)
        val enrolling = if (page == P.DETAILS || page == P.CHIP) page!! else if (members.isEmpty() && !prefs.getBoolean("welcomed", false)) P.WELCOME else P.DETAILS
        val want = when {
            Registration.legacyFile(this).exists() || File(filesDir, "member.json.moving").exists() -> P.MIGRATE
            !Profiles.isOpen() -> when {
                adding || members.isEmpty() -> enrolling
                unlockId != null && members.any { it.id == unlockId } -> P.UNLOCK
                else -> P.MEMBERS
            }
            else -> { adding = false; unlockId = null
                when (Registration.state(this)) {
                    is Registration.State.None -> P.MEMBERS
                    is Registration.State.Old -> P.OLD
                    is Registration.State.Waiting -> P.REG
                    is Registration.State.Done -> P.HOME
                } }
        }
        // the chip page after the passport read was forgotten (Back from enrolment): start again from the details (N6)
        if (want == P.CHIP && page == P.CHIP && key == null && DocStore.chip == null) { show(P.DETAILS); return }
        if (want != page) show(want)
        if (want == P.REG || want == P.HOME) checkRegistration()
    }

    private fun menu() {
        val items = mutableListOf<Pair<String, () -> Unit>>(t("language") to { Ui.language(this) })
        if (Profiles.isOpen()) {
            items += t("switchMember") to { Profiles.lock(); route() }
            items += t("removeMember") to { confirmRemove() }
        }
        // the report of the passport just read, or the open member's registration line
        if (shareText.isNotEmpty() && (page == P.CHIP || Profiles.isOpen())) items += t("shareReport") to { share(shareText) }
        if (testBuild) {
            if (FaceStore.chipPhoto != null) items += "Face check test (chip photo vs. a selfie)" to { startActivity(Intent(this, FaceActivity::class.java)) }
            if (DocStore.chip != null) items += "Enrolment proof test (from this passport)" to { startActivity(Intent(this, DocProofActivity::class.java)) }
            items += "Ballot proof benchmark (native prover)" to { startActivity(Intent(this, ProverActivity::class.java)) }
        }
        Ui.menu(this, items)
    }

    private fun share(s: String) = startActivity(Intent.createChooser(Intent(Intent.ACTION_SEND).apply {
        type = "text/plain"; putExtra(Intent.EXTRA_TEXT, s)
    }, "Share report"))

    private fun show(p: P) {
        page = p
        status = null; report = null; docNo = null; birth = null; expiry = null; pw = null
        // pages without an open member: nothing of the last passport or member stays in the menu (F1)
        if (p == P.WELCOME || p == P.DETAILS || p == P.MEMBERS || p == P.UNLOCK || p == P.MIGRATE) {
            shareText = ""
            if (p != P.DETAILS) Profiles.clearChip()
        }
        when (p) {
            P.WELCOME -> welcome()
            P.DETAILS -> details()
            P.CHIP -> chip()
            P.REG -> reg()
            P.HOME -> home()
            P.OLD -> old()
            P.MEMBERS -> members()
            P.UNLOCK -> unlock()
            P.MIGRATE -> migrate()
        }
    }

    // ---- welcome (once)
    private fun welcome() {
        val pg = Ui.page(this, t("appName"), 0) { menu() }
        val c = Ui.c(this)
        pg.content.addView(Ui.Logo(this, 128))
        pg.content.addView(Ui.heading(this, t("welcomeTitle")).apply { gravity = android.view.Gravity.CENTER })
        pg.content.addView(Ui.body(this, t("welcomeBody")))
        val steps = Ui.card(this, tint = true)
        for (i in 1..6) steps.addView(Ui.body(this, "${i}. ${t("st${i}Long")}"))
        pg.content.addView(steps)
        if (t("draft").isNotEmpty()) pg.content.addView(Ui.note(this, t("draft")))
        pg.bottom.addView(Ui.secondary(this, t("language") + ": " + L10n.LANGS.first { it.first == L10n.lang }.second) { Ui.language(this) })
        pg.bottom.addView(Ui.primary(this, t("start")) { prefs.edit().putBoolean("welcomed", true).apply(); show(P.DETAILS) })
    }

    // ---- step 1: the three values of the machine-readable zone
    private fun details() {
        val pg = Ui.page(this, t("st1Title"), 1) { menu() }
        pg.content.addView(Ui.body(this, t("intro")))
        val (b1, e1) = Ui.field(this, t("docNo"), t("docNoHint"))
        val (b2, e2) = Ui.field(this, t("birth"), t("dateHint"), digits = true)
        val (b3, e3) = Ui.field(this, t("expiry"), t("dateHint"), digits = true)
        for (e in listOf(e1, e2, e3)) e.textDirection = View.TEXT_DIRECTION_LTR   // typed left to right in every language
        pg.content.addView(b1); pg.content.addView(b2); pg.content.addView(b3)
        docNo = e1; birth = e2; expiry = e3
        val st = Ui.status(this); status = st; pg.content.addView(st)
        when {
            nfc == null -> Ui.say(st, t("noNfc"), 2)
            nfc?.isEnabled != true -> Ui.say(st, t("nfcOff"), 2)
        }
        if (Profiles.list(this).isNotEmpty()) pg.bottom.addView(Ui.secondary(this, t("back")) { adding = false; route() })
        pg.bottom.addView(Ui.primary(this, t("next")) { arm() })
    }

    private fun arm() {
        val d = docNo?.text.toString().trim().uppercase().replace(" ", "")
        val b = birth?.text.toString().trim()
        val e = expiry?.text.toString().trim()
        if (d.isEmpty() || b.length != 6 || e.length != 6) { status?.let { Ui.say(it, t("checkValues"), 2) }; return }
        key = BACKey(d, b, e)
        show(P.CHIP)
    }

    // ---- step 2: reading the chip
    private fun chip() {
        val pg = Ui.page(this, t("st2Title"), 2) { menu() }
        val c = Ui.c(this)
        pg.content.addView(Ui.body(this, t("hold")))
        pg.content.addView(Ui.note(this, t("chipTip")))
        val st = Ui.status(this); status = st; pg.content.addView(st)
        val rp = Ui.mono(this).apply { visibility = View.GONE }; report = rp
        if (nfc?.isEnabled != true) Ui.say(st, t("nfcOff"), 2)
        pg.bottom.addView(Ui.secondary(this, t("back")) { key = null; show(P.DETAILS) })
        pg.content.addView(rp)
        chipBottom = pg.bottom
    }
    private var chipBottom: android.widget.LinearLayout? = null

    override fun onTagDiscovered(tag: Tag) {
        if (page != P.CHIP) return
        val k = key ?: run { runOnUiThread { status?.let { Ui.say(it, t("enterFirst"), 2) } }; return }
        val iso = IsoDep.get(tag) ?: run { runOnUiThread { status?.let { Ui.say(it, t("notPassport"), 2) } }; return }
        runOnUiThread { status?.let { Ui.say(it, t("reading")) } }
        val result = try {
            ChipReader(iso, k).read()
        } catch (e: Exception) {
            ChipReader.Result("Reading failed: ${e.javaClass.simpleName}: ${e.message}\n" +
                "Check the three values and try again, holding the passport still.", null, false)
        }
        if (result.chip == null && result.faceImage == null) {
            // Nothing read: keep the key for another try, with the passport held still.
            runOnUiThread { status?.let { Ui.say(it, t("readFailed"), 2) } }
            shareText = result.report
            return
        }
        key = null // the access key is not kept
        val ready = result.ok && result.chip?.dscDer != null
        // the signer's certificate only for a passport that could not be used, to find out why (review N13)
        shareText = result.report + (if (!ready) result.dscPem?.let { "\n$it\n" } ?: "" else "")
        FaceStore.set(result.faceImage, result.faceMime)
        DocStore.chip = result.chip; DocStore.genuine = result.ok
        runOnUiThread {
            val st = status ?: return@runOnUiThread
            val b = chipBottom ?: return@runOnUiThread
            b.removeAllViews()
            if (ready) {
                Ui.say(st, t("doneOk"), 1)
                // the photo read from the chip, so the holder sees what was read (v0.17.2, founder's proposal)
                thread {
                    val bm = FaceStore.bitmap() ?: return@thread
                    runOnUiThread {
                        val parent = st.parent as? android.view.ViewGroup ?: return@runOnUiThread
                        if (page != P.CHIP || FaceStore.chipBitmap !== bm || parent.findViewWithTag<View>("chipPhoto") != null) return@runOnUiThread
                        parent.addView(Ui.photo(this, bm, t("chipPhoto")).also { v -> v.tag = "chipPhoto" }, parent.indexOfChild(st))
                    }
                }
                b.addView(Ui.primary(this, t("next")) { startActivity(Intent(this, EnrolActivity::class.java)) })
            } else {
                Ui.say(st, t("doneProblems"), 2)
                report?.text = result.report + (result.onScreenOnly?.let { "\n$it" } ?: "")
                b.addView(Ui.secondary(this, t("showDetails")) { report?.visibility = if (report?.visibility == View.VISIBLE) View.GONE else View.VISIBLE })
                b.addView(Ui.secondary(this, t("shareReport")) { share(shareText) })
                b.addView(Ui.primary(this, t("tryAgain")) { show(P.DETAILS) })
            }
        }
    }

    // ---- an older membership (before v0.12): enrol again
    private fun old() {
        val pg = Ui.page(this, t("appName"), 0) { menu() }
        pg.content.addView(Ui.body(this, t("regOld")))
        pg.bottom.addView(Ui.primary(this, t("enrolAgain")) {
            val label = Profiles.current?.let { Profiles.meta(this, it)?.label } ?: return@primary
            android.app.AlertDialog.Builder(this).setMessage(t("removeAsk", label)).setNegativeButton(t("back"), null)
                .setPositiveButton(t("enrolAgain")) { _, _ -> Profiles.removeCurrent(this); adding = true; show(P.DETAILS) }.show()   // F15: asked first
        })
    }

    // ---- the members of this phone (v0.16)
    private fun members() {
        val pg = Ui.page(this, t("appName"), 0) { menu() }
        val list = Profiles.list(this)
        pg.content.addView(Ui.Logo(this, 72))
        pg.content.addView(Ui.heading(this, t("whichMember")).apply { gravity = android.view.Gravity.CENTER })
        for (m in list) pg.content.addView(Ui.row(this, m.label, t("memberSince", m.added), null) { unlockId = m.id; show(P.UNLOCK) })
        pg.content.addView(Ui.note(this, t("membersNote")).apply { setPadding(0, Ui.dp(context, 12), 0, 0) })
        if (list.size < Profiles.MAX) pg.bottom.addView(Ui.secondary(this, "+ " + t("addMember", list.size, Profiles.MAX)) { adding = true; show(P.DETAILS) })
    }

    // ---- opening a member with their password
    private fun unlock() {
        val m = Profiles.meta(this, unlockId ?: return) ?: run { unlockId = null; route(); return }
        val pg = Ui.page(this, m.label, 0) { menu() }
        pg.content.addView(Ui.Logo(this, 56))
        pg.content.addView(Ui.body(this, t("unlockBody")))
        val (b, e) = Ui.field(this, t("pw1"), "", password = true)
        e.textDirection = View.TEXT_DIRECTION_LTR
        pg.content.addView(b); pw = e
        val st = Ui.status(this); status = st; pg.content.addView(st)
        pg.content.addView(Ui.note(this, t("unlockForgot")).apply { setPadding(0, Ui.dp(context, 14), 0, 0) })
        val open = Ui.primary(this, t("unlockBtn")) {}
        Profiles.waitSeconds(this, m.id).let { if (it > 0) Ui.say(st, t("unlockWait", waitText(it)), 2) }
        open.setOnClickListener {
            Profiles.waitSeconds(this, m.id).let { if (it > 0) { Ui.say(st, t("unlockWait", waitText(it)), 2); return@setOnClickListener } }
            val p = e.text.toString(); if (p.isEmpty()) return@setOnClickListener
            Ui.enable(open, false); Ui.say(st, t("unlocking"))
            Thread {
                val r: Any = try { Profiles.unlock(this, m.id, p) } catch (x: OutOfMemoryError) { "lowMemory" } catch (x: Throwable) { x }
                runOnUiThread {
                    Ui.enable(open, true); e.text.clear()
                    when (r) {
                        is Profiles.Opened.Yes -> { unlockId = null; route() }
                        is Profiles.Opened.WrongPassword -> {
                            val w = Profiles.waitSeconds(this, m.id)
                            Ui.say(st, t("unlockWrong") + if (w > 0) "\n" + t("unlockWait", waitText(w)) else "", 2)
                        }
                        is Profiles.Opened.Wait -> Ui.say(st, t("unlockWait", waitText(r.seconds)), 2)
                        is Profiles.Opened.OtherPhone -> Ui.say(st, t("unlockOtherPhone"), 2)
                        is Profiles.Opened.Missing -> { unlockId = null; route() }
                        "lowMemory" -> Ui.say(st, t("lowMemory"), 2)
                        is Throwable -> Ui.say(st, t("regFailed", r.message ?: r.javaClass.simpleName), 2)
                    }
                }
            }.start()
        }
        pg.bottom.addView(open)
        pg.bottom.addView(Ui.secondary(this, t("backToMembers")) { unlockId = null; show(P.MEMBERS) })
        // F15: a member whose password is forgotten can be removed, after a clear question
        pg.content.addView(Ui.secondary(this, t("removeClosed")) {
            android.app.AlertDialog.Builder(this).setMessage(t("removeAsk", m.label)).setNegativeButton(t("back"), null)
                .setPositiveButton(t("removeMember")) { _, _ -> Profiles.remove(this, m.id); unlockId = null; route() }.show()
        })
    }
    /** A wait as minutes and seconds (m:ss), in the language's digits. */
    private fun waitText(sec: Long) = Ui.digits("%d:%02d".format(java.util.Locale.ROOT, sec / 60, sec % 60))

    // ---- a membership kept by an older version: protect it with a password (once)
    private fun migrate() {
        val pg = Ui.page(this, t("appName"), 0) { menu() }
        pg.content.addView(Ui.body(this, t("migrateBody")))
        val (b0, e0) = Ui.field(this, t("memberLabel"), t("memberLabelHint"))
        e0.setText(t("memberSelf"))
        val (b1, e1) = Ui.field(this, t("pw1"), "", password = true)
        val (b2, e2) = Ui.field(this, t("pw2"), "", password = true)
        pg.content.addView(b0); pg.content.addView(b1); pg.content.addView(b2)
        val st = Ui.status(this); status = st; pg.content.addView(st)
        val go = Ui.primary(this, t("migrateBtn")) {}
        go.setOnClickListener {
            val p1 = e1.text.toString()
            if (p1.length < 8) { Ui.say(st, t("pwShort"), 2); return@setOnClickListener }
            if (p1 != e2.text.toString()) { Ui.say(st, t("pwDiffer"), 2); return@setOnClickListener }
            Ui.enable(go, false); Ui.say(st, t("unlocking"))
            Thread {
                try {
                    // F16: moved aside first, so that a repeated try cannot make the member twice
                    val f = Registration.legacyFile(this)
                    val moving = File(filesDir, "member.json.moving")
                    if (f.exists() && !f.renameTo(moving)) error("member.json could not be moved")
                    val j = JSONObject(moving.readText())
                    val before = Profiles.withNumber(this, j.optString("number"))
                    if (before == null) Profiles.create(this, e0.text.toString(), p1, j)
                    // best effort: overwrite before deleting
                    try { moving.writeBytes(ByteArray(moving.length().toInt())) } catch (x: Exception) { }
                    moving.delete(); File(filesDir, "member.json.part").delete()
                    // moved before (the app stopped half-way): the first password still opens it (N12)
                    runOnUiThread { if (before != null) android.widget.Toast.makeText(this, t("migratedBefore", before.label), android.widget.Toast.LENGTH_LONG).show(); route() }
                } catch (x: OutOfMemoryError) { runOnUiThread { Ui.enable(go, true); Ui.say(st, t("lowMemory"), 2) }
                } catch (x: Throwable) { runOnUiThread { Ui.enable(go, true); Ui.say(st, t("regFailed", x.message ?: x.javaClass.simpleName), 2) } }
            }.start()
        }
        pg.bottom.addView(go)
    }

    private fun confirmRemove() {
        val label = Profiles.current?.let { Profiles.meta(this, it)?.label } ?: return
        android.app.AlertDialog.Builder(this)
            .setMessage(t("removeAsk", label))
            .setNegativeButton(t("back"), null)
            .setPositiveButton(t("removeMember")) { _, _ -> Profiles.removeCurrent(this); route() }
            .show()
    }

    // ---- step 6: registration on the public ledger
    private fun reg() {
        val pg = Ui.page(this, t("st6Title"), 6) { menu() }
        pg.content.addView(Ui.body(this, t("regIntro")))
        val st = Ui.status(this); status = st; pg.content.addView(st)
        numberCard(pg.content)
    }

    // ---- home: the membership and the polls
    private fun home() {
        val pg = Ui.page(this, t("appName"), 0) { menu() }
        val c = Ui.c(this)
        pg.content.addView(Ui.Logo(this, 72))
        val card = Ui.card(this, tint = true)
        card.addView(TextView(this).apply { text = "✓  " + t("memberActive"); textSize = 18f; typeface = Ui.font(context, true); setTextColor(c.good) })
        val st = Ui.note(this, t("regDone")); status = st; card.addView(st)
        Profiles.current?.let { Profiles.meta(this, it) }?.let { m -> card.addView(Ui.note(this, t("memberIs", m.label))) }
        pg.content.addView(card)
        numberCard(pg.content)
        val polls = Ui.card(this)
        polls.addView(Ui.heading(this, t("pollsBtn")))
        polls.addView(Ui.body(this, t("pollsIntro")))
        pg.content.addView(polls)
        pg.bottom.addView(Ui.primary(this, t("pollsBtn")) { startActivity(Intent(this, PollsActivity::class.java)) })
    }

    /** The member number (Decision #59), shown with the warning to keep it private. */
    private fun numberCard(parent: android.widget.LinearLayout) {
        val n = try { Profiles.read().optString("number") } catch (e: Exception) { "" }
        if (n.isEmpty()) return
        val card = Ui.card(this)
        card.addView(Ui.note(this, t("yourNumber")))
        card.addView(TextView(this).apply {
            text = n; textSize = 17f; typeface = android.graphics.Typeface.MONOSPACE; setTextColor(Ui.c(context).heading); setTextIsSelectable(true)
            textDirection = View.TEXT_DIRECTION_LTR
        })
        card.addView(Ui.note(this, t("numberPrivate")))
        parent.addView(card)
    }

    // Decisions #61 and #62: registration on the public ledger, a few minutes after enrolment.
    @Volatile private var registering = false
    @Volatile private var registryChecked = false
    private fun checkRegistration() {
        timer.removeCallbacksAndMessages(null)
        fun say(s: String, kind: Int = 0) = runOnUiThread { status?.let { Ui.say(it, s, kind) } }
        when (val st = Registration.state(this)) {
            is Registration.State.None, is Registration.State.Old -> route()
            is Registration.State.Done -> {
                if (page != P.HOME) { show(P.HOME); return }
                // A new deployment names another registry: register there too (once per start).
                if (!registryChecked) Thread {
                    try {
                        val now = Chain().address(Chain.POLLS, "identity").lowercase()   // the polls contract's registry, from the chain
                        registryChecked = true
                        if (now.isNotEmpty() && now != st.registry) { Registration.registryChanged(this); runOnUiThread { route() } }
                    } catch (e: Exception) { /* offline: checked again next time */ }
                }.start()
            }
            is Registration.State.Waiting -> {
                if (page != P.REG) { show(P.REG) }
                val wait = st.after - System.currentTimeMillis()
                if (wait > 0) {
                    val at = java.time.Instant.ofEpochMilli(st.after).atZone(java.time.ZoneId.systemDefault())
                    say(t("regWaiting", at.format(java.time.format.DateTimeFormatter.ofPattern("HH:mm"))))
                    // registers while the app stays open; checked every minute, which also keeps the
                    // member open while the app waits (members close after five minutes without use)
                    timer.postDelayed({ checkRegistration() }, minOf(wait + 500, 60_000L))
                    return
                }
                if (registering) return
                registering = true
                say(t("regRunning"))
                Thread {
                    try {
                        val line = Registration.run(this)
                        shareText = "Proof of One registration (app v0.17.2)\n$line"
                        registryChecked = true
                        runOnUiThread { checkRegistration() }
                    } catch (e: Registration.NotReady) {
                        say(t("regNotReady"), 2)
                    } catch (e: java.io.IOException) {
                        say(t("regOffline"), 2)
                    } catch (e: Throwable) {
                        shareText = "Proof of One registration (app v0.17.2)\nFAILED: ${e.javaClass.simpleName}: ${e.message}"
                        say(t("regFailed", e.message ?: e.javaClass.simpleName), 2)
                    } finally { registering = false }
                }.start()
            }
        }
    }
}
