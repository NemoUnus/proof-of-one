// SPDX-License-Identifier: Apache-2.0
// Proof of One — the app's first screen (v0.13: one task per screen, Decision #64).
//
// Joining has six numbered steps. This screen holds steps 1, 2 and 6 and, once joined, the
// member's home; EnrolActivity holds steps 3–5:
//   (welcome, once) → 1 passport details → 2 reading the chip → [3 information and consent →
//   4 face check → 5 password and enrolment] → 6 registration on the public ledger → home.
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

class MainActivity : Activity(), NfcAdapter.ReaderCallback {

    private enum class P { WELCOME, DETAILS, CHIP, REG, HOME, OLD }
    private var page: P? = null
    private var nfc: NfcAdapter? = null
    private var key: BACKey? = null
    private var shareText = ""
    private var reenrol = false            // an older membership chose to enrol again
    private val timer = android.os.Handler(android.os.Looper.getMainLooper())

    // views of the current page (replaced when the page changes)
    private var status: TextView? = null
    private var report: TextView? = null
    private var docNo: EditText? = null
    private var birth: EditText? = null
    private var expiry: EditText? = null

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
        route()
        nfc?.enableReaderMode(this, this,
            NfcAdapter.FLAG_READER_NFC_A or NfcAdapter.FLAG_READER_NFC_B or NfcAdapter.FLAG_READER_SKIP_NDEF_CHECK, null)
    }

    override fun onPause() {
        super.onPause()
        timer.removeCallbacksAndMessages(null)
        nfc?.disableReaderMode(this)
    }

    private fun t(k: String, vararg a: Any) = L10n.t(k, *a)
    private val prefs get() = getSharedPreferences("prefs", Context.MODE_PRIVATE)

    /** Which page the member's state calls for. */
    private fun route() {
        val want = when (Registration.state(this)) {
            is Registration.State.None -> if (page == P.DETAILS || page == P.CHIP) page!! else if (prefs.getBoolean("welcomed", false)) P.DETAILS else P.WELCOME
            is Registration.State.Old -> if (reenrol && (page == P.DETAILS || page == P.CHIP)) page!! else P.OLD
            is Registration.State.Waiting -> P.REG
            is Registration.State.Done -> P.HOME
        }
        if (want != page) show(want)
        if (want == P.REG || want == P.HOME) checkRegistration()
    }

    private fun menu() {
        val items = mutableListOf<Pair<String, () -> Unit>>(t("language") to { Ui.language(this) })
        if (shareText.isNotEmpty()) items += t("shareReport") to { share(shareText) }
        if (FaceStore.chipPhoto != null) items += "Face check test (chip photo vs. a selfie)" to { startActivity(Intent(this, FaceActivity::class.java)) }
        if (DocStore.chip != null) items += "Enrolment proof test (from this passport)" to { startActivity(Intent(this, DocProofActivity::class.java)) }
        items += "Ballot proof benchmark (native prover)" to { startActivity(Intent(this, ProverActivity::class.java)) }
        Ui.menu(this, items)
    }

    private fun share(s: String) = startActivity(Intent.createChooser(Intent(Intent.ACTION_SEND).apply {
        type = "text/plain"; putExtra(Intent.EXTRA_TEXT, s)
    }, "Share report"))

    private fun show(p: P) {
        page = p
        status = null; report = null; docNo = null; birth = null; expiry = null
        when (p) {
            P.WELCOME -> welcome()
            P.DETAILS -> details()
            P.CHIP -> chip()
            P.REG -> reg()
            P.HOME -> home()
            P.OLD -> old()
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
        pg.content.addView(Ui.symbol(this, "▭ ⟿ ▢", c.primary))
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
        shareText = result.report + (result.dscPem?.let { "\n$it\n" } ?: "")
        FaceStore.chipPhoto = result.faceImage; FaceStore.chipMime = result.faceMime
        DocStore.chip = result.chip; DocStore.genuine = result.ok
        val ready = result.ok && result.chip?.dscDer != null
        runOnUiThread {
            val st = status ?: return@runOnUiThread
            val b = chipBottom ?: return@runOnUiThread
            b.removeAllViews()
            if (ready) {
                Ui.say(st, t("doneOk"), 1)
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
        pg.content.addView(Ui.symbol(this, "↻", Ui.c(this).accent))
        pg.content.addView(Ui.body(this, t("regOld")))
        pg.bottom.addView(Ui.primary(this, t("enrolAgain")) { reenrol = true; show(P.DETAILS) })
    }

    // ---- step 6: registration on the public ledger
    private fun reg() {
        val pg = Ui.page(this, t("st6Title"), 6) { menu() }
        pg.content.addView(Ui.symbol(this, "⧗", Ui.c(this).primary))
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
        pg.content.addView(card)
        numberCard(pg.content)
        val polls = Ui.card(this)
        polls.addView(Ui.heading(this, t("pollsBtn")))
        polls.addView(Ui.body(this, t("pollsIntro")))
        pg.content.addView(polls)
        pg.bottom.addView(Ui.primary(this, t("pollsBtn")) { startActivity(Intent(this, VoteActivity::class.java)) })
    }

    /** The member number (Decision #59), shown with the warning to keep it private. */
    private fun numberCard(parent: android.widget.LinearLayout) {
        val n = try { JSONObject(File(filesDir, "member.json").readText()).optString("number") } catch (e: Exception) { "" }
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
                    timer.postDelayed({ checkRegistration() }, wait + 500)   // registers while the app stays open
                    return
                }
                if (registering) return
                registering = true
                say(t("regRunning"))
                Thread {
                    try {
                        val line = Registration.run(this)
                        shareText = "Proof of One registration (app v0.13)\n$line"
                        registryChecked = true
                        runOnUiThread { checkRegistration() }
                    } catch (e: Registration.NotReady) {
                        say(t("regNotReady"), 2)
                    } catch (e: java.io.IOException) {
                        say(t("regOffline"), 2)
                    } catch (e: Throwable) {
                        shareText = "Proof of One registration (app v0.13)\nFAILED: ${e.javaClass.simpleName}: ${e.message}"
                        say(t("regFailed", e.message ?: e.javaClass.simpleName), 2)
                    } finally { registering = false }
                }.start()
            }
        }
    }
}
