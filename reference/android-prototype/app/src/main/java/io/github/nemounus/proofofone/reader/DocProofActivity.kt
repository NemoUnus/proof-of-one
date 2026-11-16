// SPDX-License-Identifier: Apache-2.0
// Proof of One — enrolment proof test with a real passport (Decision Log #57, challenge 2).
// Builds the input of π_doc from the chip data read on the previous screen (DocInput), then
// makes the proof on the phone with the native prover: the witness from the circuit's
// witness graph, a check of every constraint, the Groth16 proof (TEST-ONLY key), and its
// verification. The proof's outputs are compared with the values read directly from the
// passport's machine-readable zone.
//
// TEST ONLY: the tree of checked signers holds this passport's signer alone, so the proof
// does not show that the signer is trusted. Nothing is stored or sent: the chip data stays
// in memory, the shared result holds numbers and yes/no only.
package io.github.nemounus.proofofone.reader

import android.app.Activity
import android.app.ActivityManager
import android.content.Intent
import android.graphics.Typeface
import android.os.Build
import android.os.Bundle
import android.view.View
import android.view.WindowManager
import android.widget.Button
import android.widget.LinearLayout
import android.widget.ScrollView
import android.widget.TextView
import org.json.JSONObject
import java.io.File
import java.math.BigInteger
import java.security.SecureRandom
import java.time.LocalDate
import java.time.ZoneOffset
import kotlin.concurrent.thread

/** The chip data, held in memory between the reader screen and this test only. */
object DocStore {
    @Volatile var chip: DocInput.Chip? = null
}

class DocProofActivity : Activity() {
    private lateinit var status: TextView
    private lateinit var report: TextView
    private lateinit var start: Button
    private lateinit var share: Button
    private var built: DocInput.Built? = null
    private var shareText = ""
    private var runs = 0

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        window.setFlags(WindowManager.LayoutParams.FLAG_SECURE, WindowManager.LayoutParams.FLAG_SECURE)
        val pad = (16 * resources.displayMetrics.density).toInt()
        val col = LinearLayout(this).apply { orientation = LinearLayout.VERTICAL; setPadding(pad, pad, pad, pad) }
        col.addView(TextView(this).apply { text = "Enrolment proof test"; textSize = 20f; setTypeface(null, Typeface.BOLD) })
        col.addView(TextView(this).apply {
            text = "Makes the enrolment proof from this passport's chip data, on this phone. Test only: the key is a TEST-ONLY key, " +
                "and the list of trusted signers holds only this passport's signer. Nothing is stored or sent.\n\n" +
                "The first run copies about 220 MB and prepares the key (one to two minutes). Keep the screen on."
            setPadding(0, pad / 2, 0, 0)
        })
        start = Button(this).apply { text = "Make the enrolment proof"; setOnClickListener { run() } }
        col.addView(start)
        status = TextView(this).apply { textSize = 16f; setPadding(0, pad / 2, 0, 0) }
        col.addView(status)
        report = TextView(this).apply { typeface = Typeface.MONOSPACE; textSize = 12f; setTextIsSelectable(true); setPadding(0, pad, 0, 0) }
        col.addView(report)
        share = Button(this).apply {
            text = "Share the result"; visibility = View.GONE
            setOnClickListener {
                startActivity(Intent.createChooser(Intent(Intent.ACTION_SEND).apply { type = "text/plain"; putExtra(Intent.EXTRA_TEXT, shareText) }, "Share"))
            }
        }
        col.addView(share)
        setContentView(ScrollView(this).apply { addView(col) })

        val chip = DocStore.chip
        if (chip == null) { status.text = "Read a passport first."; start.isEnabled = false; return }
        try {
            val rnd = SecureRandom()
            // Random commitment, challenge and face blinding, as in a real enrolment.
            built = DocInput.build(chip, LocalDate.now(ZoneOffset.UTC), BigInteger(200, rnd), BigInteger(200, rnd), BigInteger(128, rnd))
            status.text = "Input ready (suite ${built!!.suite.id}). Tap the button."
        } catch (e: IllegalArgumentException) {
            status.text = "This passport does not fit the proof yet: ${e.message}"
            start.isEnabled = false
        }
    }

    /** Copies an asset to app storage once (streamed, so it never sits whole in the Java heap). */
    private fun file(name: String): String {
        val f = File(filesDir, name)
        if (!f.exists() || f.length() == 0L) {
            val tmp = File(filesDir, "$name.part")
            assets.open(name).use { i -> tmp.outputStream().use { o -> i.copyTo(o, 1 shl 20) } }
            tmp.renameTo(f)
        }
        return f.absolutePath
    }

    private fun run() {
        val b = built ?: return
        start.isEnabled = false; share.visibility = View.GONE; report.text = ""
        window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
        status.text = "Preparing the files (first time only)…"
        thread {
            try {
                val pk = file("doc_s2_pk_c.bin"); val m = file("doc_s2_matrices.gzdata")
                val g = file("document_s2.graph"); val t = file("dsc_test_tree_s2.graph")
                runOnUiThread { status.text = "Reading the key, computing the witness and proving… keep the screen on." }
                val r = JSONObject(NativeProver.proveDocInputs(pk, m, g, t, b.json))
                runs++
                fun s(ms: Long) = String.format("%.1f s", ms / 1000.0)
                val mem = ActivityManager.MemoryInfo().also { (getSystemService(ACTIVITY_SERVICE) as ActivityManager).getMemoryInfo(it) }
                val lines = mutableListOf(
                    "Proof of One enrolment proof test v0.1 (real passport, run $runs)",
                    "proof: pi_doc suite ${b.suite.id}, 749,147 constraints, TEST-ONLY key and one-signer test tree",
                    "input: eContent ${b.eLen}/${DocInput.MAX_E} B, signed attributes ${b.saLen}/${DocInput.MAX_SA} B after padding",
                )
                val ok: Boolean
                if (r.has("error")) {
                    ok = false
                    lines += "error: ${r.getString("error")}"
                } else {
                    val pub = r.getJSONArray("public")
                    val e = b.expected
                    val match = pub.getString(0) == e.birthDay.toString() && pub.getString(1) == e.sexCode.toString() &&
                        pub.getString(2) == e.natCode.toString() && pub.getString(3) == e.expMonth.toString()
                    ok = r.getBoolean("verified") && match
                    lines += "witness on the phone: ${s(r.getLong("witnessMs"))}"
                    lines += "proof: ${s(r.getLong("proveMs"))}"
                    lines += "key and matrices loading: ${s(r.getLong("loadMs"))}"
                    lines += "verified on the phone: ${if (r.getBoolean("verified")) "yes" else "NO"}"
                    lines += "outputs equal the passport's own values (birth date, sex, nationality, expiry month): ${if (match) "yes" else "NO"}"
                    lines += "test tree used: ${if (r.optBoolean("testTree")) "yes" else "no"}"
                    lines += "peak memory of the app: ${r.getLong("peakMb")} MB"
                }
                lines += "cores: ${Runtime.getRuntime().availableProcessors()}, memory: ${String.format("%.1f", mem.totalMem / 1073741824.0)} GB"
                lines += "phone: ${Build.MANUFACTURER} ${Build.MODEL}, Android ${Build.VERSION.RELEASE}"
                shareText = lines.joinToString("\n")
                runOnUiThread {
                    status.text = if (ok) "Enrolment proof made and verified on this phone." else "The proof could not be made. See below, and please share the result."
                    report.text = shareText; share.visibility = View.VISIBLE
                }
            } catch (e: Throwable) {
                runOnUiThread { status.text = "Error: ${e.javaClass.simpleName}: ${e.message}" }
            } finally {
                runOnUiThread { start.isEnabled = true; window.clearFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON) }
            }
        }
    }

    override fun onDestroy() {
        super.onDestroy(); built = null
    }
}
