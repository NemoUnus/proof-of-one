// SPDX-License-Identifier: Apache-2.0
package io.github.nemounus.proofofone.reader

import android.app.Activity
import android.content.Intent
import android.graphics.Typeface
import android.nfc.NfcAdapter
import android.nfc.Tag
import android.nfc.tech.IsoDep
import android.os.Bundle
import android.text.InputType
import android.view.View
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
 * they stay in memory only and are cleared after each read. The app has no internet
 * permission. The report can be shared by the user; it holds no name, document number
 * or birth date.
 */
class MainActivity : Activity(), NfcAdapter.ReaderCallback {

    private var nfc: NfcAdapter? = null
    private lateinit var docNo: EditText
    private lateinit var birth: EditText
    private lateinit var expiry: EditText
    private lateinit var status: TextView
    private lateinit var report: TextView
    private lateinit var share: Button
    private var key: BACKey? = null
    private var shareText = ""

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        // Use the full Bouncy Castle provider (brainpool curves, RSA-PSS) instead of Android's copy.
        Security.removeProvider("BC")
        Security.insertProviderAt(BouncyCastleProvider(), 1)
        window.addFlags(WindowManager.LayoutParams.FLAG_SECURE) // no screenshots while values are on screen
        nfc = NfcAdapter.getDefaultAdapter(this)

        val pad = (16 * resources.displayMetrics.density).toInt()
        val col = LinearLayout(this).apply { orientation = LinearLayout.VERTICAL; setPadding(pad, pad, pad, pad) }
        fun label(t: String) = TextView(this).apply { text = t; setPadding(0, pad / 2, 0, 0) }
        fun field(hint: String, digits: Boolean) = EditText(this).apply {
            this.hint = hint
            inputType = if (digits) InputType.TYPE_CLASS_NUMBER else InputType.TYPE_CLASS_TEXT or InputType.TYPE_TEXT_FLAG_CAP_CHARACTERS or InputType.TYPE_TEXT_FLAG_NO_SUGGESTIONS
        }
        col.addView(TextView(this).apply {
            text = "Proof of One chip reader (test)"; textSize = 20f; setTypeface(null, Typeface.BOLD)
        })
        col.addView(label("Enter three values from the bottom lines of the passport photo page. They are used only to open the chip and are cleared after reading. Nothing is stored or sent."))
        col.addView(label("Document number")); docNo = field("as printed", false); col.addView(docNo)
        col.addView(label("Date of birth (YYMMDD)")); birth = field("for example 850412", true); col.addView(birth)
        col.addView(label("Date of expiry (YYMMDD)")); expiry = field("for example 310415", true); col.addView(expiry)
        col.addView(Button(this).apply { text = "Ready: hold the passport to the phone"; setOnClickListener { arm() } })
        status = TextView(this).apply { setPadding(0, pad, 0, 0); textSize = 16f }
        col.addView(status)
        report = TextView(this).apply { typeface = Typeface.MONOSPACE; textSize = 12f; setTextIsSelectable(true); setPadding(0, pad, 0, 0) }
        col.addView(report)
        share = Button(this).apply {
            text = "Share report and signer certificate"; visibility = View.GONE
            setOnClickListener {
                startActivity(Intent.createChooser(Intent(Intent.ACTION_SEND).apply {
                    type = "text/plain"; putExtra(Intent.EXTRA_TEXT, shareText)
                }, "Share report"))
            }
        }
        col.addView(share)
        setContentView(ScrollView(this).apply { addView(col) })

        status.text = when {
            nfc == null -> "This phone has no NFC reader."
            nfc?.isEnabled != true -> "NFC is off. Turn it on in the phone settings."
            else -> "Enter the three values, then tap Ready."
        }
    }

    private fun arm() {
        val d = docNo.text.toString().trim().uppercase().replace(" ", "")
        val b = birth.text.toString().trim()
        val e = expiry.text.toString().trim()
        if (d.isEmpty() || b.length != 6 || e.length != 6) {
            status.text = "Check the values: document number, and both dates as six digits (YYMMDD)."
            return
        }
        key = BACKey(d, b, e)
        status.text = "Hold the passport flat against the back of the phone and keep still…"
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
        val k = key ?: run { runOnUiThread { status.text = "Enter the values and tap Ready first." }; return }
        val iso = IsoDep.get(tag) ?: run { runOnUiThread { status.text = "This chip is not a passport chip." }; return }
        runOnUiThread { status.text = "Reading the chip… keep still (about 5–20 seconds)." }
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
            status.text = if (result.ok) "Done: the chip data is genuine under its signer certificate." else "Done, with problems (see below)."
            report.text = result.report
            share.visibility = View.VISIBLE
        }
    }
}
