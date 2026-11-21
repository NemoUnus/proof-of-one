// SPDX-License-Identifier: Apache-2.0
package io.github.nemounus.proofofone.reader

import android.app.Activity
import org.json.JSONObject
import java.io.File
import android.content.Intent
import android.graphics.Typeface
import android.nfc.NfcAdapter
import android.nfc.Tag
import android.nfc.tech.IsoDep
import android.os.Build
import android.os.Bundle
import android.text.InputType
import android.view.View
import android.view.WindowInsets
import android.view.WindowManager
import android.widget.Button
import android.widget.EditText
import android.widget.LinearLayout
import android.widget.ScrollView
import android.widget.TextView
import org.bouncycastle.jce.provider.BouncyCastleProvider
import org.jmrtd.BACKey
import java.security.Security

/**
 * Test app for schedule activity 0.8: reads a passport chip and checks it on the phone.
 * The three values from the passport's machine-readable zone open the chip (BAC/PACE);
 * they stay in memory only and are cleared after each read. Only the enrolment screen
 * (EnrolActivity, v0.8) uses the internet, and only to the pilot's enrolment service. The
 * report can be shared by the user; it holds no name, document number or birth date.
 */
class MainActivity : Activity(), NfcAdapter.ReaderCallback {

    private var nfc: NfcAdapter? = null
    private lateinit var docNo: EditText
    private lateinit var birth: EditText
    private lateinit var expiry: EditText
    private lateinit var status: TextView
    private lateinit var report: TextView
    private lateinit var share: Button
    private lateinit var faceBtn: Button
    private lateinit var docBtn: Button
    private lateinit var enrolBtn: Button
    private var key: BACKey? = null
    private var shareText = ""

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        // Use the full Bouncy Castle provider (brainpool curves, RSA-PSS) instead of Android's copy.
        Security.removeProvider("BC")
        Security.insertProviderAt(BouncyCastleProvider(), 1)
        window.addFlags(WindowManager.LayoutParams.FLAG_SECURE) // no screenshots while values are on screen
        nfc = NfcAdapter.getDefaultAdapter(this)
        L10n.load(this)
        fun t(k: String, vararg a: Any) = L10n.t(k, *a)

        val pad = (16 * resources.displayMetrics.density).toInt()
        val col = LinearLayout(this).apply { orientation = LinearLayout.VERTICAL; setPadding(pad, pad, pad, pad) }
        L10n.dir(col)
        col.addView(L10n.picker(this))
        fun label(t: String) = TextView(this).apply { text = t; setPadding(0, pad / 2, 0, 0) }
        fun field(hint: String, digits: Boolean) = EditText(this).apply {
            this.hint = hint
            inputType = if (digits) InputType.TYPE_CLASS_NUMBER else InputType.TYPE_CLASS_TEXT or InputType.TYPE_TEXT_FLAG_CAP_CHARACTERS or InputType.TYPE_TEXT_FLAG_NO_SUGGESTIONS
        }
        col.addView(TextView(this).apply {
            text = t("title"); textSize = 20f; setTypeface(null, Typeface.BOLD)
        })
        if (t("draft").isNotEmpty()) col.addView(TextView(this).apply { text = t("draft"); textSize = 12f })
        // the member number, once enrolled (Decision #59)
        File(filesDir, "member.json").takeIf { it.exists() }?.let { f ->
            val n = try { JSONObject(f.readText()).optString("number") } catch (e: Exception) { "" }
            if (n.isNotEmpty()) col.addView(TextView(this).apply {
                text = "${t("yourNumber")}: $n\n${t("numberPrivate")}"; setTypeface(null, Typeface.BOLD); setPadding(0, pad / 2, 0, 0)
            })
        }
        col.addView(label(t("intro")))
        col.addView(label(t("docNo"))); docNo = field(t("docNoHint"), false); col.addView(docNo)
        col.addView(label(t("birth"))); birth = field(t("dateHint"), true); col.addView(birth)
        col.addView(label(t("expiry"))); expiry = field(t("dateHint"), true); col.addView(expiry)
        // dates and numbers are typed left to right in every language
        for (e in listOf(docNo, birth, expiry)) { e.textDirection = View.TEXT_DIRECTION_LTR }
        col.addView(Button(this).apply { text = t("ready"); setOnClickListener { arm() } })
        status = TextView(this).apply { setPadding(0, pad, 0, 0); textSize = 16f }
        col.addView(status)
        share = Button(this).apply {
            text = t("shareReport"); visibility = View.GONE
            setOnClickListener {
                startActivity(Intent.createChooser(Intent(Intent.ACTION_SEND).apply {
                    type = "text/plain"; putExtra(Intent.EXTRA_TEXT, shareText)
                }, "Share report"))
            }
        }
        col.addView(share)
        enrolBtn = Button(this).apply {
            text = t("enrolBtn"); visibility = View.GONE
            setOnClickListener { startActivity(Intent(this@MainActivity, EnrolActivity::class.java)) }
        }
        col.addView(enrolBtn)
        // Technical test tools (English), folded away so that volunteers do not meet them.
        val tests = LinearLayout(this).apply { orientation = LinearLayout.VERTICAL; visibility = View.GONE }
        col.addView(Button(this).apply {
            text = "▸ " + t("testTools")
            setOnClickListener {
                val open = tests.visibility != View.VISIBLE
                tests.visibility = if (open) View.VISIBLE else View.GONE
                text = (if (open) "▾ " else "▸ ") + t("testTools")
            }
        })
        col.addView(tests)
        faceBtn = Button(this).apply {
            text = "Face check test (chip photo vs. a selfie)"; visibility = View.GONE
            setOnClickListener { startActivity(Intent(this@MainActivity, FaceActivity::class.java)) }
        }
        tests.addView(faceBtn)
        docBtn = Button(this).apply {
            text = "Enrolment proof test (from this passport)"; visibility = View.GONE
            setOnClickListener { startActivity(Intent(this@MainActivity, DocProofActivity::class.java)) }
        }
        tests.addView(docBtn)
        tests.addView(Button(this).apply {
            text = "Ballot proof benchmark (native prover)"
            setOnClickListener { startActivity(Intent(this@MainActivity, ProverActivity::class.java)) }
        })
        report = TextView(this).apply {
            typeface = Typeface.MONOSPACE; textSize = 12f; setTextIsSelectable(true); setPadding(0, pad, 0, 0)
            layoutDirection = View.LAYOUT_DIRECTION_LTR; textDirection = View.TEXT_DIRECTION_LTR // the report stays in English
        }
        col.addView(report)
        val scroll = ScrollView(this).apply { addView(col) }
        // Android 15 draws apps edge to edge: keep the content clear of the status and navigation bars.
        scroll.setOnApplyWindowInsetsListener { v, insets ->
            if (Build.VERSION.SDK_INT >= 30) {
                val b = insets.getInsets(WindowInsets.Type.systemBars() or WindowInsets.Type.ime())
                v.setPadding(b.left, b.top, b.right, b.bottom)
            } else {
                @Suppress("DEPRECATION")
                v.setPadding(insets.systemWindowInsetLeft, insets.systemWindowInsetTop, insets.systemWindowInsetRight, insets.systemWindowInsetBottom)
            }
            insets
        }
        setContentView(scroll)

        status.text = when {
            nfc == null -> t("noNfc")
            nfc?.isEnabled != true -> t("nfcOff")
            else -> t("enterValues")
        }
    }

    private fun arm() {
        val d = docNo.text.toString().trim().uppercase().replace(" ", "")
        val b = birth.text.toString().trim()
        val e = expiry.text.toString().trim()
        if (d.isEmpty() || b.length != 6 || e.length != 6) {
            status.text = L10n.t("checkValues")
            return
        }
        key = BACKey(d, b, e)
        status.text = L10n.t("hold")
        report.text = ""; share.visibility = View.GONE
    }

    override fun onResume() {
        super.onResume()
        nfc?.enableReaderMode(this, this,
            NfcAdapter.FLAG_READER_NFC_A or NfcAdapter.FLAG_READER_NFC_B or NfcAdapter.FLAG_READER_SKIP_NDEF_CHECK, null)
    }

    override fun onPause() {
        super.onPause()
        nfc?.disableReaderMode(this)
    }

    override fun onTagDiscovered(tag: Tag) {
        val k = key ?: run { runOnUiThread { status.text = L10n.t("enterFirst") }; return }
        val iso = IsoDep.get(tag) ?: run { runOnUiThread { status.text = L10n.t("notPassport") }; return }
        runOnUiThread { status.text = L10n.t("reading") }
        val result = try {
            ChipReader(iso, k).read()
        } catch (e: Exception) {
            ChipReader.Result("Reading failed: ${e.javaClass.simpleName}: ${e.message}\n" +
                "Check the three values and try again, holding the passport still.", null, false)
        }
        key = null // the access key is not kept
        shareText = result.report + (result.dscPem?.let { "\n$it\n" } ?: "")
        runOnUiThread {
            docNo.text.clear(); birth.text.clear(); expiry.text.clear()
            status.text = if (result.ok) L10n.t("doneOk") else if (result.chip == null && result.faceImage == null) L10n.t("readFailed") else L10n.t("doneProblems")
            report.text = result.report + (result.onScreenOnly?.let { "\n$it" } ?: "")
            share.visibility = View.VISIBLE
            FaceStore.chipPhoto = result.faceImage; FaceStore.chipMime = result.faceMime
            faceBtn.visibility = if (result.faceImage != null) View.VISIBLE else View.GONE
            DocStore.chip = result.chip
            docBtn.visibility = if (result.chip != null) View.VISIBLE else View.GONE
            enrolBtn.visibility = if (result.chip?.dscDer != null) View.VISIBLE else View.GONE
        }
    }
}
