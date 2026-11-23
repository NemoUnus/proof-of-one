// SPDX-License-Identifier: Apache-2.0
// Proof of One — enrolment with the pilot's service (Decision Log #57, #58, #59; design
// docs/specs/pilot-enrolment-service-v0.1.md). First, the face check (v0.10, #57 (3)): a
// selfie is compared with the chip photo on this phone (FaceMatcher.THRESHOLD); the selfie is
// deleted at once and no face data is sent. Enrolment (and restore) starts only once it has
// passed. A check on the phone can be bypassed by a modified app; in the pilot it is a
// safeguard for honest use, not a defence. Then, from the chip data read on the first screen:
//   1. the signer's certificate to /signer, and its path in the tree of checked signers;
//   2. a session (fresh challenge, the issuing state's rule);
//   3. the member's secrets, made here (only the commitment cm leaves the phone);
//   4. the keyed fingerprints: blinded points to /evaluate, the answers checked (DLEQ); from
//      the person key's OPRF value, the member number and the backup seed (#59);
//   5. π_doc on this phone, with the real tree path, challenge and date;
//   6. /enrol: the service checks π_doc and the fingerprints, and signs the credential;
//   7. /backup: the member file, encrypted under the member's password and the backup seed.
// When the person is already enrolled, the service answers with the encrypted backup instead,
// and the member's password restores the same membership on this phone (#59).
// The secrets and the credential are kept in this app's private storage (member.json);
// uninstalling the app deletes them. The face, MRZ, document number, personal number and
// name never leave the phone. TEST: TEST-ONLY proving key, test network, pilot service.
package io.github.nemounus.proofofone.reader

import android.app.Activity
import android.content.Intent
import android.graphics.Typeface
import android.os.Bundle
import android.provider.MediaStore
import android.text.InputType
import android.util.Base64
import android.view.View
import android.view.WindowManager
import android.widget.Button
import android.widget.EditText
import android.widget.LinearLayout
import android.widget.ScrollView
import android.widget.TextView
import androidx.core.content.FileProvider
import org.json.JSONObject
import java.io.File
import java.math.BigInteger
import java.security.SecureRandom
import java.time.LocalDate
import kotlin.concurrent.thread

class EnrolActivity : Activity() {
    private lateinit var status: TextView
    private lateinit var numberView: TextView
    private lateinit var report: TextView
    private lateinit var pw1: EditText
    private lateinit var pw2: EditText
    private lateinit var start: Button
    private lateinit var restore: Button
    private lateinit var share: Button
    private var shareText = ""
    // kept for a retried restore after a wrong password
    private var pendingBackup: String? = null
    private var pendingSeed: String? = null
    private var restoreTries = 0
    // the face check (v0.10)
    private lateinit var faceStatus: TextView
    private lateinit var selfieBtn: Button
    private var matcher: FaceMatcher? = null
    private var chipFace: FaceMatcher.Face? = null
    private var faceOk = false
    private var faceSim = 0f
    private var faceTries = 0
    private val selfie by lazy { File(cacheDir, "enrol_selfie.jpg") }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        L10n.load(this)
        window.setFlags(WindowManager.LayoutParams.FLAG_SECURE, WindowManager.LayoutParams.FLAG_SECURE)
        fun t(k: String, vararg a: Any) = L10n.t(k, *a)
        val pad = (16 * resources.displayMetrics.density).toInt()
        val col = LinearLayout(this).apply { orientation = LinearLayout.VERTICAL; setPadding(pad, pad, pad, pad) }
        L10n.dir(col)
        col.addView(L10n.picker(this))
        col.addView(TextView(this).apply { text = t("enrolTitle"); textSize = 20f; setTypeface(null, Typeface.BOLD) })
        if (t("draft").isNotEmpty()) col.addView(TextView(this).apply { text = t("draft"); textSize = 12f })
        col.addView(TextView(this).apply { text = t("enrolIntro"); setPadding(0, pad / 2, 0, 0) })
        fun heading(k: String) = TextView(this).apply { text = t(k); textSize = 17f; setTypeface(null, Typeface.BOLD); setPadding(0, pad, 0, 0) }
        col.addView(heading("faceStep"))
        col.addView(TextView(this).apply { text = t("faceIntro"); setPadding(0, pad / 2, 0, 0) })
        selfieBtn = Button(this).apply { text = t("takeSelfie"); isEnabled = false; setOnClickListener { takeSelfie() } }
        col.addView(selfieBtn)
        faceStatus = TextView(this).apply { textSize = 16f; setPadding(0, pad / 4, 0, 0) }
        col.addView(faceStatus)
        col.addView(heading("pwStep"))
        col.addView(TextView(this).apply { text = t("pwLabel"); setPadding(0, pad / 2, 0, 0) })
        fun pw(hint: String) = EditText(this).apply { this.hint = hint; inputType = InputType.TYPE_CLASS_TEXT or InputType.TYPE_TEXT_VARIATION_PASSWORD }
        pw1 = pw(t("pw1")); col.addView(pw1)
        pw2 = pw(t("pw2")); col.addView(pw2)
        start = Button(this).apply { text = t("enrol"); isEnabled = false; setOnClickListener { run() } }
        col.addView(start)
        restore = Button(this).apply { text = t("restore"); visibility = View.GONE; setOnClickListener { retryRestore() } }
        col.addView(restore)
        status = TextView(this).apply { textSize = 16f; setPadding(0, pad / 2, 0, 0) }
        col.addView(status)
        numberView = TextView(this).apply { textSize = 18f; setTypeface(null, Typeface.BOLD); setTextIsSelectable(true); setPadding(0, pad / 2, 0, 0); visibility = View.GONE }
        col.addView(numberView)
        report = TextView(this).apply {
            typeface = Typeface.MONOSPACE; textSize = 12f; setTextIsSelectable(true); setPadding(0, pad, 0, 0)
            layoutDirection = View.LAYOUT_DIRECTION_LTR; textDirection = View.TEXT_DIRECTION_LTR
        }
        col.addView(report)
        share = Button(this).apply {
            text = t("shareResult"); visibility = View.GONE
            setOnClickListener {
                startActivity(Intent.createChooser(Intent(Intent.ACTION_SEND).apply { type = "text/plain"; putExtra(Intent.EXTRA_TEXT, shareText) }, "Share"))
            }
        }
        col.addView(share)
        setContentView(ScrollView(this).apply { addView(col) })
        when {
            memberFile().exists() -> { status.text = t("alreadyHere"); showNumber(JSONObject(memberFile().readText()).optString("number")) }
            DocStore.chip == null -> status.text = t("readFirst")
            DocStore.chip?.dscDer == null -> status.text = t("noCert")
            // Clear reasons first, on the phone, before the face check (v0.10.1).
            !DocStore.genuine -> status.text = t("notGenuine")
            DocInput.suiteOf(DocStore.chip!!).first == null -> status.text = t("unsupported")
            expired(DocStore.chip!!) -> status.text = t("expired")
            FaceStore.chipPhoto == null -> faceStatus.text = t("faceNoPhoto")
            else -> { faceStatus.text = t("facePrep"); thread { prepareChipFace() } }
        }
    }

    /** The expiry date in the MRZ is before today (π_doc would refuse it: document_core, step 6). */
    private fun expired(c: DocInput.Chip): Boolean = try {
        val now = LocalDate.now()
        DocInput.expected(c.dg1, now.year).expiryDay < DocInput.dayNumber(now.year, now.monthValue, now.dayOfMonth)
    } catch (e: Exception) { false }

    /** A refusal of the service, in words the member can act on; the report keeps the details. */
    private fun explain(e: EnrolService.Failure, stage: String): String {
        val m = e.message ?: ""
        return when {
            "not part of the pilot" in m -> L10n.t("notInPilot")
            "used up" in m || "too many new signers" in m -> L10n.t("busyToday")
            "session expired" in m -> L10n.t("sessionExpired")
            "document is already enrolled" in m -> L10n.t("already")
            stage == "signer" || "signer" in m -> L10n.t("signerRefused")
            "test network did not answer" in m || e.status >= 500 -> L10n.t("serviceBusy")
            else -> L10n.t("refused", m)
        }
    }

    // The chip photo's face, once per screen (and again if Android closed the screen while the
    // camera app was open).
    @Synchronized private fun prepareChipFace(): Boolean {
        chipFace?.let { return true }
        return try {
            val bytes = FaceStore.chipPhoto ?: error("no chip photo")
            val m = matcher ?: FaceMatcher(this).also { matcher = it }
            val f = m.analyse(FaceMatcher.decodeChip(bytes, FaceStore.chipMime))
            chipFace = f
            runOnUiThread {
                if (f == null) faceStatus.text = L10n.t("faceNoChipFace")
                else if (!faceOk) { faceStatus.text = L10n.t("faceReady"); selfieBtn.isEnabled = true }
            }
            f != null
        } catch (e: Throwable) {
            runOnUiThread { faceStatus.text = L10n.t("faceError", e.message ?: e.javaClass.simpleName) }
            false
        }
    }

    private fun takeSelfie() {
        val uri = FileProvider.getUriForFile(this, "$packageName.files", selfie)
        val i = Intent(MediaStore.ACTION_IMAGE_CAPTURE).apply {
            putExtra(MediaStore.EXTRA_OUTPUT, uri)
            putExtra("android.intent.extras.CAMERA_FACING", 1)          // front camera, where supported
            putExtra("android.intent.extras.LENS_FACING_FRONT", 1)
            putExtra("android.intent.extra.USE_FRONT_CAMERA", true)
            addFlags(Intent.FLAG_GRANT_WRITE_URI_PERMISSION or Intent.FLAG_GRANT_READ_URI_PERMISSION)
        }
        @Suppress("DEPRECATION") startActivityForResult(i, 1)
    }

    @Deprecated("Deprecated in Java")
    override fun onActivityResult(requestCode: Int, resultCode: Int, data: Intent?) {
        @Suppress("DEPRECATION") super.onActivityResult(requestCode, resultCode, data)
        if (requestCode != 1) return
        if (resultCode != RESULT_OK || !selfie.exists()) { faceStatus.text = L10n.t("faceNoSelfie"); selfie.delete(); return }
        faceStatus.text = L10n.t("faceComparing"); selfieBtn.isEnabled = false
        thread {
            try {
                val bm = try { FaceMatcher.loadSelfie(selfie) } finally { selfie.delete() }
                if (!prepareChipFace()) return@thread
                val f = matcher!!.analyse(bm)
                faceTries++
                val sim = f?.let { FaceMatcher.cosine(chipFace!!.embedding, it.embedding) }
                runOnUiThread {
                    selfieBtn.isEnabled = true
                    when {
                        sim == null -> faceStatus.text = L10n.t("faceNone")
                        sim >= FaceMatcher.THRESHOLD -> {
                            faceOk = true; faceSim = sim
                            faceStatus.text = L10n.t("facePass"); selfieBtn.isEnabled = false
                            start.isEnabled = !memberFile().exists() && DocStore.chip?.dscDer != null
                        }
                        else -> faceStatus.text = L10n.t("faceFail")
                    }
                }
            } catch (e: Throwable) {
                runOnUiThread { selfieBtn.isEnabled = true; faceStatus.text = L10n.t("faceError", e.message ?: e.javaClass.simpleName) }
            }
        }
    }

    override fun onDestroy() {
        super.onDestroy(); selfie.delete(); matcher?.close()
    }

    private fun memberFile() = File(filesDir, "member.json")
    // A restored membership registers again after its own random delay; if the old phone
    // had already registered it, the relay answers "already registered" and nothing is sent.
    private fun restored(plain: String, day: LocalDate): String =
        JSONObject(plain).put("restoredDay", day.toString()).put("registerAfter", Registration.pickTime()).toString()
    private fun saveMember(j: String) { val tmp = File(filesDir, "member.json.part"); tmp.writeText(j); tmp.renameTo(memberFile()) }

    private fun showNumber(n: String?) {
        if (n.isNullOrEmpty()) return
        numberView.text = "${L10n.t("yourNumber")}\n$n\n${L10n.t("numberPrivate")}"
        numberView.visibility = View.VISIBLE
    }

    private fun file(name: String): String {
        val f = File(filesDir, name)
        if (!f.exists() || f.length() == 0L) {
            val tmp = File(filesDir, "$name.part")
            assets.open(name).use { i -> tmp.outputStream().use { o -> i.copyTo(o, 1 shl 20) } }
            tmp.renameTo(f)
        }
        return f.absolutePath
    }

    private fun retryRestore() {
        val blob = pendingBackup ?: return
        val seed = pendingSeed ?: return
        val pw = pw1.text.toString()
        restore.isEnabled = false
        thread {
            val plain = Backup.open(blob, pw, seed)
            runOnUiThread {
                restore.isEnabled = true
                restoreTries++
                if (plain == null) {
                    status.text = L10n.t("wrongPw")
                    shareText += "\nretry $restoreTries: backup not opened (password)"; report.text = shareText
                    return@runOnUiThread
                }
                saveMember(restored(plain, LocalDate.now()))
                shareText += "\nretry $restoreTries: RESTORED with the password"; report.text = shareText
                pendingBackup = null; pendingSeed = null
                pw1.text.clear(); pw2.text.clear()
                restore.visibility = View.GONE
                status.text = L10n.t("restored")
                showNumber(JSONObject(plain).optString("number"))
            }
        }
    }

    private fun run() {
        val chip = DocStore.chip ?: return
        fun t(k: String, vararg a: Any) = L10n.t(k, *a)
        if (!faceOk) { status.text = t("faceFirst"); return }
        val password = pw1.text.toString()
        if (password.length < 8) { status.text = t("pwShort"); return }
        if (password != pw2.text.toString()) { status.text = t("pwDiffer"); return }
        start.isEnabled = false; share.visibility = View.GONE; report.text = ""
        window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
        val log = mutableListOf("Proof of One pilot enrolment v0.11",
            "face check: passed on the phone (similarity %.2f, threshold %.2f, %d selfie%s); no face data sent".format(
                java.util.Locale.ROOT, faceSim, FaceMatcher.THRESHOLD, faceTries, if (faceTries == 1) "" else "s"))
        fun step(s: String) = runOnUiThread { status.text = s }
        thread {
            var stage = "start"
            var number: String? = null
            try {
                val rnd = SecureRandom()
                val hexOf = { x: ByteArray -> x.joinToString("") { "%02x".format(it) } }
                val (suite, why) = DocInput.suiteOf(chip)
                require(suite != null) { "this passport does not fit the proof yet: $why" }
                // The files first: copying takes a minute the first time, and a session lasts 10.
                stage = "files"; step(t("sFiles"))
                val pk = file("doc_s2_pk_c.bin"); val m = file("doc_s2_matrices.gzdata")
                val g = file("document_s2.graph"); val tt = file("dsc_test_tree_s2.graph"); val h = file("fp_helper.graph")
                require(suite.id == 2) { "the app carries the suite-2 proving key only" }
                val svc = EnrolService()
                val t0 = System.currentTimeMillis()
                stage = "info"; step(t("sService"))
                val info = svc.info()
                log += "service: reached; ${info.getInt("enrolments")} enrolments before this one"
                stage = "signer"; step(t("sSigner"))
                val sg = svc.signer(Base64.encodeToString(chip.dscDer, Base64.NO_WRAP), suite.id)
                val path = svc.path(sg.getString("leaf"))
                log += "signer: accepted (${if (sg.getBoolean("added")) "added to the tree now" else "already in the tree"}; tree position ${sg.getInt("index")})"
                stage = "session"; step(t("sService"))
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
                // Keyed fingerprints, then the member number and backup seed (#59).
                stage = "fingerprints"; step(t("sKeys"))
                val prep = JSONObject(NativeProver.fpPrepare(h, hexOf(chip.dg1), today.year, pathNo, if (pnTag != null) hexOf(chip.dg13!!) else "", pnTag ?: 0))
                if (prep.has("error")) error("fingerprint, round 1: " + prep.getString("error"))
                val ans = svc.evaluate(ses.getString("session"), prep.getJSONArray("pB"), prep.getJSONArray("dB"))
                val keys = NativeProver.fpComplete(h, prep.toString(), info.getJSONArray("K").toString(), ans.toString())
                if (JSONObject(keys).has("error")) error("fingerprint, round 2: " + JSONObject(keys).getString("error"))
                val mem = JSONObject(NativeProver.fpMember(prep.toString(), ans.toString()))
                if (mem.has("error")) error("member number: " + mem.getString("error"))
                number = mem.getString("memberNumber")
                val backupSeed = mem.getString("backupSeed")
                log += "fingerprints: the service's answers verified (DLEQ) under its published key"
                // π_doc with the real tree path.
                stage = "proof"; step(t("sProof"))
                val sib = path.getJSONArray("siblings"); val idx = path.getJSONArray("pathIndex")
                val input = DocInput.withTree(DocInput.withKeys(built.json, keys), path.getString("root"),
                    List(sib.length()) { sib.getString(it) }, List(idx.length()) { idx.getString(it) })
                val r = JSONObject(NativeProver.proveDocInputs(pk, m, g, tt, input))
                if (r.has("error")) error("proof: " + r.getString("error"))
                require(r.getBoolean("verified")) { "the proof did not verify on the phone" }
                require(!r.optBoolean("testTree")) { "the test tree was used" }
                log += "proof: made and verified on the phone in ${r.getLong("witnessMs") + r.getLong("proveMs")} ms"
                // Enrol, or learn that this person is already enrolled.
                stage = "enrol"; step(t("sSend"))
                val res = try {
                    svc.enrol(ses.getString("session"), r.getJSONObject("proof"), r.getJSONArray("public"))
                } catch (e: EnrolService.Failure) {
                    val b = e.body
                    if (e.status == 409 && b != null && b.optBoolean("alreadyEnrolled")) {
                        log += "ALREADY ENROLLED: the service recognised this person" + if (b.isNull("backup")) " (no backup kept)" else " (encrypted backup returned)"
                        val blob = if (b.isNull("backup")) null else b.getString("backup")
                        val plain = blob?.let { Backup.open(it, password, backupSeed) }
                        if (plain != null) saveMember(restored(plain, today))
                        log += if (plain != null) "RESTORED with the password" else if (blob != null) "backup not opened (password)" else "nothing to restore"
                        shareText = log.joinToString("\n")
                        runOnUiThread {
                            showNumber(number)
                            status.text = t("already") + "\n\n" + when {
                                plain != null -> t("restored")
                                blob != null -> { pendingBackup = blob; pendingSeed = backupSeed; restore.visibility = View.VISIBLE; t("wrongPw") + " " + t("restoreAsk") }
                                else -> t("noBackup")
                            }
                            report.text = shareText; share.visibility = View.VISIBLE
                            if (plain != null) { pw1.text.clear(); pw2.text.clear() }
                        }
                        return@thread
                    }
                    throw e
                }
                val cred = res.getJSONObject("credential")
                val e = built.expected
                val saved = JSONObject()
                    .put("version", 2).put("service", EnrolService.BASE).put("enrolledDay", ses.getString("today"))
                    .put("number", number)
                    .put("member", member).put("rFace", rFace.toString())
                    .put("attrs", JSONObject().put("birthDay", e.birthDay.toString()).put("sexCode", e.sexCode.toString())
                        .put("natCode", e.natCode.toString()).put("expMonth", e.expMonth.toString()))
                    .put("credential", cred).put("msg", res.getString("msg"))
                    .put("serviceKeys", JSONObject().put("K", info.getJSONArray("K")).put("A", info.getJSONArray("A")).put("keyLeaf", info.getString("keyLeaf")))
                    .put("registerAfter", Registration.pickTime())
                saveMember(saved.toString())
                log += "ENROLLED: credential signed by the service and kept on this phone (member.json)"
                log += "credential key equals the published key: ${if (cred.getJSONArray("A").toString() == info.getJSONArray("A").toString()) "yes" else "NO"}"
                // The encrypted backup, in the same session (#59).
                stage = "backup"; step(t("sBackup"))
                val backedUp = try { svc.backup(ses.getString("session"), Backup.seal(saved.toString(), password, backupSeed)); true }
                    catch (x: Exception) { log += "backup NOT stored: ${x.message}"; false }
                if (backedUp) log += "backup: stored, encrypted (Argon2id + AES-GCM)"
                log += "registration on the ledger: automatic, at the first opening of the app after a random delay of 2-26 h (Decision #61)"
                log += "total time: ${(System.currentTimeMillis() - t0) / 1000} s (after the files)"
                shareText = log.joinToString("\n")
                runOnUiThread {
                    status.text = if (backedUp) t("enrolled") else t("noBackupStored")
                    showNumber(number)
                    pw1.text.clear(); pw2.text.clear()
                    report.text = shareText; share.visibility = View.VISIBLE
                }
            } catch (e: EnrolService.Failure) {
                log += "REFUSED at step '$stage' (HTTP ${e.status}): ${e.message}"
                shareText = log.joinToString("\n")
                runOnUiThread { status.text = explain(e, stage); report.text = shareText; share.visibility = View.VISIBLE; start.isEnabled = !memberFile().exists() }
            } catch (e: Throwable) {
                log += "ERROR at step '$stage': ${e.javaClass.simpleName}: ${e.message}"
                shareText = log.joinToString("\n")
                val why = when {
                    e is java.io.IOException -> t("noService")
                    stage == "proof" -> t("proofFail")
                    else -> t("error", stage, e.message ?: "")
                }
                runOnUiThread { status.text = why; report.text = shareText; share.visibility = View.VISIBLE; start.isEnabled = !memberFile().exists() }
            } finally {
                runOnUiThread { window.clearFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON) }
            }
        }
    }
}
