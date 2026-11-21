// SPDX-License-Identifier: Apache-2.0
// Proof of One — enrolment with the pilot's service (Decision Log #57, #58; design
// docs/specs/pilot-enrolment-service-v0.1.md). From the chip data read on the first screen:
//   1. the signer's certificate to /signer, and its path in the tree of checked signers;
//   2. a session (fresh challenge, the issuing state's rule);
//   3. the member's secrets, made here (only the commitment cm leaves the phone);
//   4. the keyed fingerprints: blinded points to /evaluate, the answers checked (DLEQ);
//   5. π_doc on this phone, with the real tree path, challenge and date;
//   6. /enrol: the service checks π_doc and the fingerprints, and signs the credential.
// The secrets and the credential are kept in this app's private storage (member.json);
// uninstalling the app deletes them. The face, MRZ, document number, personal number and
// name never leave the phone. TEST: TEST-ONLY proving key, test network, pilot service.
package io.github.nemounus.proofofone.reader

import android.app.Activity
import android.content.Intent
import android.graphics.Typeface
import android.os.Bundle
import android.util.Base64
import android.view.View
import android.view.WindowManager
import android.widget.Button
import android.widget.LinearLayout
import android.widget.ScrollView
import android.widget.TextView
import org.json.JSONArray
import org.json.JSONObject
import java.io.File
import java.math.BigInteger
import java.security.SecureRandom
import java.time.LocalDate
import kotlin.concurrent.thread

class EnrolActivity : Activity() {
    private lateinit var status: TextView
    private lateinit var report: TextView
    private lateinit var start: Button
    private lateinit var share: Button
    private var shareText = ""

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        window.setFlags(WindowManager.LayoutParams.FLAG_SECURE, WindowManager.LayoutParams.FLAG_SECURE)
        val pad = (16 * resources.displayMetrics.density).toInt()
        val col = LinearLayout(this).apply { orientation = LinearLayout.VERTICAL; setPadding(pad, pad, pad, pad) }
        col.addView(TextView(this).apply { text = "Enrol with the pilot service"; textSize = 20f; setTypeface(null, Typeface.BOLD) })
        col.addView(TextView(this).apply {
            text = "Enrols this passport with the pilot's enrolment service (test network, TEST-ONLY keys). " +
                "Sent: the signer's certificate (public), the issuing state, two blinded points, the enrolment proof and its public values " +
                "(birth date, sex, nationality, expiry month, keyed fingerprints). Never sent: the photo, the MRZ, the document number, the personal number, the name.\n\n" +
                "A passport can be enrolled once. Use a VPN if the service is blocked where you are. Keep the screen on (one to three minutes)."
            setPadding(0, pad / 2, 0, 0)
        })
        start = Button(this).apply { text = "Enrol"; setOnClickListener { run() } }
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
        when {
            memberFile().exists() -> { status.text = "This phone already holds an enrolled identity (member.json)."; start.isEnabled = false }
            DocStore.chip == null -> { status.text = "Read a passport first."; start.isEnabled = false }
            DocStore.chip?.dscDer == null -> { status.text = "The chip's signer certificate was not read. Read the passport again."; start.isEnabled = false }
        }
    }

    private fun memberFile() = File(filesDir, "member.json")

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
        val chip = DocStore.chip ?: return
        start.isEnabled = false; share.visibility = View.GONE; report.text = ""
        window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
        val log = mutableListOf("Proof of One pilot enrolment v0.8")
        fun step(s: String) = runOnUiThread { status.text = s }
        thread {
            var stage = "start"
            try {
                val rnd = SecureRandom()
                val hexOf = { x: ByteArray -> x.joinToString("") { "%02x".format(it) } }
                val (suite, why) = DocInput.suiteOf(chip)
                require(suite != null) { "this passport does not fit the proof yet: $why" }
                // The files first: copying takes a minute the first time, and a session lasts 10.
                stage = "files"; step("Preparing the files (first time only)…")
                val pk = file("doc_s2_pk_c.bin"); val m = file("doc_s2_matrices.gzdata")
                val g = file("document_s2.graph"); val t = file("dsc_test_tree_s2.graph"); val h = file("fp_helper.graph")
                require(suite.id == 2) { "the app carries the suite-2 proving key only" }
                val svc = EnrolService()
                val t0 = System.currentTimeMillis()
                stage = "info"; step("Contacting the service…")
                val info = svc.info()
                log += "service: reached; ${info.getInt("enrolments")} enrolments before this one"
                stage = "signer"; step("Checking the passport's signer with the service…")
                val sg = svc.signer(Base64.encodeToString(chip.dscDer, Base64.NO_WRAP), suite.id)
                val path = svc.path(sg.getString("leaf"))
                log += "signer: accepted (${if (sg.getBoolean("added")) "added to the tree now" else "already in the tree"}; tree position ${sg.getInt("index")})"
                stage = "session"; step("Opening a session…")
                val ses = svc.session(DocInput.issuerOf(chip.dg1))
                val rule = ses.getJSONObject("rule")
                val pathNo = rule.getString("path").toInt(); val pnSrc = rule.getString("pnSrc").toInt()
                val pnTag = if (pnSrc == 1) rule.getString("pnTag").toInt() else null
                log += "rule of the issuing state: person-key path $pathNo" + if (pnTag != null) ", number in DG13" else ""
                val today = LocalDate.of(1900, 1, 1).plusDays(ses.getString("today").toLong())
                require(today.year.toString() == ses.getString("currentYear")) { "the service's date and year disagree" }
                // The member's secrets: only cm leaves the phone.
                stage = "member"
                val rb = ByteArray(192).also { rnd.nextBytes(it) }
                val member = JSONObject(NativeProver.memberNew(hexOf(rb)))
                if (member.has("error")) error("member secrets: " + member.getString("error"))
                val rFace = BigInteger(128, rnd)
                val built = DocInput.build(chip, today, BigInteger(member.getString("cm")), BigInteger(ses.getString("challenge")), rFace, pnTag)
                // Keyed fingerprints.
                stage = "fingerprints"; step("Computing the document fingerprints with the service…")
                val prep = JSONObject(NativeProver.fpPrepare(h, hexOf(chip.dg1), today.year, pathNo, if (pnTag != null) hexOf(chip.dg13!!) else "", pnTag ?: 0))
                if (prep.has("error")) error("fingerprint, round 1: " + prep.getString("error"))
                val ans = svc.evaluate(ses.getString("session"), prep.getJSONArray("pB"), prep.getJSONArray("dB"))
                val keys = NativeProver.fpComplete(h, prep.toString(), info.getJSONArray("K").toString(), ans.toString())
                if (JSONObject(keys).has("error")) error("fingerprint, round 2: " + JSONObject(keys).getString("error"))
                log += "fingerprints: the service's answers verified (DLEQ) under its published key"
                // π_doc with the real tree path.
                stage = "proof"; step("Making the enrolment proof… keep the screen on.")
                val sib = path.getJSONArray("siblings"); val idx = path.getJSONArray("pathIndex")
                val input = DocInput.withTree(DocInput.withKeys(built.json, keys), path.getString("root"),
                    List(sib.length()) { sib.getString(it) }, List(idx.length()) { idx.getString(it) })
                val r = JSONObject(NativeProver.proveDocInputs(pk, m, g, t, input))
                if (r.has("error")) error("proof: " + r.getString("error"))
                require(r.getBoolean("verified")) { "the proof did not verify on the phone" }
                require(!r.optBoolean("testTree")) { "the test tree was used" }
                log += "proof: made and verified on the phone in ${r.getLong("witnessMs") + r.getLong("proveMs")} ms"
                // Enrol.
                stage = "enrol"; step("Sending the proof to the service…")
                val pub = r.getJSONArray("public")
                val res = svc.enrol(ses.getString("session"), r.getJSONObject("proof"), pub)
                val cred = res.getJSONObject("credential")
                val e = built.expected
                val saved = JSONObject()
                    .put("version", 1).put("service", EnrolService.BASE).put("enrolledDay", ses.getString("today"))
                    .put("member", member).put("rFace", rFace.toString())
                    .put("attrs", JSONObject().put("birthDay", e.birthDay.toString()).put("sexCode", e.sexCode.toString())
                        .put("natCode", e.natCode.toString()).put("expMonth", e.expMonth.toString()))
                    .put("credential", cred).put("msg", res.getString("msg"))
                    .put("serviceKeys", JSONObject().put("K", info.getJSONArray("K")).put("A", info.getJSONArray("A")).put("keyLeaf", info.getString("keyLeaf")))
                val tmp = File(filesDir, "member.json.part")
                tmp.writeText(saved.toString()); tmp.renameTo(memberFile())
                log += "ENROLLED: credential signed by the service and kept on this phone (member.json)"
                log += "credential key equals the published key: ${if (cred.getJSONArray("A").toString() == info.getJSONArray("A").toString()) "yes" else "NO"}"
                log += "total time: ${(System.currentTimeMillis() - t0) / 1000} s (after the files)"
                shareText = log.joinToString("\n")
                runOnUiThread { status.text = "Enrolled. The credential is kept on this phone."; report.text = shareText; share.visibility = View.VISIBLE }
            } catch (e: EnrolService.Failure) {
                log += "REFUSED at step '$stage' (HTTP ${e.status}): ${e.message}"
                shareText = log.joinToString("\n")
                runOnUiThread { status.text = "The service refused: ${e.message}"; report.text = shareText; share.visibility = View.VISIBLE; start.isEnabled = true }
            } catch (e: Throwable) {
                log += "ERROR at step '$stage': ${e.javaClass.simpleName}: ${e.message}"
                shareText = log.joinToString("\n")
                runOnUiThread { status.text = "Error at step '$stage': ${e.message}"; report.text = shareText; share.visibility = View.VISIBLE; start.isEnabled = !memberFile().exists() }
            } finally {
                runOnUiThread { window.clearFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON) }
            }
        }
    }
}
