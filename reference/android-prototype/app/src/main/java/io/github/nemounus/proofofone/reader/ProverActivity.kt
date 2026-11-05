// SPDX-License-Identifier: Apache-2.0
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
import kotlin.concurrent.thread

/**
 * Ballot proof benchmark with the native prover (schedule 1.4-00, implementation note N27):
 * the same proof π_vote, test input and TEST-ONLY proving key as the browser benchmark
 * (reference/phone-bench), made three times, then checked on the phone. Nothing is sent.
 */
class ProverActivity : Activity() {
    private lateinit var status: TextView
    private lateinit var report: TextView
    private lateinit var start: Button
    private lateinit var share: Button
    private var shareText = ""

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        val pad = (16 * resources.displayMetrics.density).toInt()
        val col = LinearLayout(this).apply { orientation = LinearLayout.VERTICAL; setPadding(pad, pad, pad, pad) }
        col.addView(TextView(this).apply { text = "Ballot proof benchmark (native)"; textSize = 20f; setTypeface(null, Typeface.BOLD) })
        col.addView(TextView(this).apply {
            text = "Makes the ballot proof π_vote (32,607 constraints, Groth16) three times with the app's native prover, " +
                "from synthetic test data and a TEST-ONLY key, then checks it. Keep the screen on. Nothing is sent."
            setPadding(0, pad / 2, 0, 0)
        })
        start = Button(this).apply { text = "Start benchmark"; setOnClickListener { run() } }
        col.addView(start)
        status = TextView(this).apply { textSize = 16f; setPadding(0, pad / 2, 0, 0) }
        col.addView(status)
        report = TextView(this).apply { typeface = Typeface.MONOSPACE; textSize = 12f; setTextIsSelectable(true); setPadding(0, pad, 0, 0) }
        col.addView(report)
        share = Button(this).apply {
            text = "Share result"; visibility = View.GONE
            setOnClickListener {
                startActivity(Intent.createChooser(Intent(Intent.ACTION_SEND).apply { type = "text/plain"; putExtra(Intent.EXTRA_TEXT, shareText) }, "Share result"))
            }
        }
        col.addView(share)
        setContentView(ScrollView(this).apply { addView(col) })
    }

    private fun run() {
        start.isEnabled = false; share.visibility = View.GONE; report.text = ""
        window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
        status.text = "Loading the proving key…"
        thread {
            val lines = mutableListOf<String>()
            try {
                val graph = assets.open("ballot.graph").use { it.readBytes() }
                val zkey = assets.open("ballot_test.zkey").use { it.readBytes() }
                val input = assets.open("input.json").use { it.readBytes().toString(Charsets.UTF_8) }
                val times = mutableListOf<Long>()
                var load = 0L
                var verified = true
                for (i in 1..3) {
                    runOnUiThread { status.text = "Proving, run $i of 3…" }
                    val r = JSONObject(NativeProver.prove(graph, zkey, input))
                    if (r.has("error")) throw IllegalStateException(r.getString("error"))
                    if (i == 1) load = r.getLong("loadMs")
                    times += r.getLong("proveMs")
                    verified = verified && r.getBoolean("verified")
                }
                val med = times.sorted()[1]
                val mem = ActivityManager.MemoryInfo().also { (getSystemService(ACTIVITY_SERVICE) as ActivityManager).getMemoryInfo(it) }
                fun s(ms: Long) = String.format("%.1f s", ms / 1000.0)
                lines += "Proof of One phone benchmark v0.1 (native)"
                lines += "proof: pi_vote, 32,607 constraints, Groth16, arkworks + circom-witnesscalc (native)"
                lines += "runs: ${times.joinToString(", ") { s(it) }} (median ${s(med)})"
                lines += "verified: ${if (verified) "yes" else "NO"}"
                lines += "key loading (once): ${s(load)}"
                lines += "cores: ${Runtime.getRuntime().availableProcessors()}, memory: ${String.format("%.1f", mem.totalMem / 1073741824.0)} GB"
                lines += "phone: ${Build.MANUFACTURER} ${Build.MODEL}, Android ${Build.VERSION.RELEASE}"
                shareText = lines.joinToString("\n")
                runOnUiThread {
                    status.text = if (verified) "Proof verified. Median ${s(med)}." else "The proof did not verify. Please report this."
                    report.text = shareText; share.visibility = View.VISIBLE; start.isEnabled = true
                    window.clearFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
                }
            } catch (e: Throwable) {
                runOnUiThread {
                    status.text = "Error: ${e.message}"; start.isEnabled = true
                    window.clearFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
                }
            }
        }
    }
}
