// SPDX-License-Identifier: Apache-2.0
// Proof of One — enrolment with the pilot's service (Decision Log #57, #58, #59; design
// v0.13: steps 3 to 5 of joining, one screen each: 3 information and consent, 4 face check,
// 5 password and enrolment, then the result;
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
import android.net.Uri
import android.widget.Button
import android.widget.CheckBox
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
    private enum class P { CONSENT, FACE, PASSWORD, DONE, STOP }
    private var page: P? = null
    private var status: TextView? = null
    private var report: TextView? = null
    private var pw1: EditText? = null
    private var pw2: EditText? = null
    private var start: Button? = null
    private var restore: Button? = null
    private var bottom: LinearLayout? = null
    private var shareText = ""
    // kept for a retried restore after a wrong password
    private var pendingBackup: String? = null
    private var pendingSeed: String? = null
    private var restoreTries = 0
    // the face check (v0.10)
    private var faceStatus: TextView? = null
    private var selfieBtn: Button? = null
    private var matcher: FaceMatcher? = null
    private var chipFace: FaceMatcher.Face? = null
    private var faceNote: String? = null
    private var faceOk = false
    @Volatile private var consentOk = false
    private var faceSim = 0f
    private var faceTries = 0
    private val selfie by lazy { File(cacheDir, "enrol_selfie.jpg") }
    // the result, for the last page
    private var doneText = ""
    private var doneGood = true
    private var doneNumber: String? = null

    private fun t(k: String, vararg a: Any) = L10n.t(k, *a)

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        L10n.load(this)
        window.setFlags(WindowManager.LayoutParams.FLAG_SECURE, WindowManager.LayoutParams.FLAG_SECURE)
        when {
            hasMember() -> done(t("alreadyHere"), true, JSONObject(memberFile().readText()).optString("number"))
            DocStore.chip == null -> stop(t("readFirst"))
            DocStore.chip?.dscDer == null -> stop(t("noCert"))
            // Clear reasons first, on the phone, before the face check (v0.10.1).
            !DocStore.genuine -> stop(t("notGenuine"))
            DocInput.suiteOf(DocStore.chip!!).first == null -> stop(t("unsupported"))
            expired(DocStore.chip!!) -> stop(t("expired"))
            FaceStore.chipPhoto == null -> stop(t("faceNoPhoto"))
            else -> { faceNote = t("facePrep"); thread { prepareChipFace() }; consent() }
        }
    }

    private fun menu() = Ui.menu(this, listOfNotNull(
        t("language") to { Ui.language(this) },
        if (shareText.isNotEmpty()) t("shareResult") to { share() } else null))
    private fun share() = startActivity(Intent.createChooser(Intent(Intent.ACTION_SEND).apply { type = "text/plain"; putExtra(Intent.EXTRA_TEXT, shareText) }, "Share"))

    private fun clear() { status = null; report = null; pw1 = null; pw2 = null; start = null; restore = null; faceStatus = null; selfieBtn = null; bottom = null }

    // ---- a reason to stop before step 3
    private fun stop(why: String) {
        page = P.STOP; clear()
        val pg = Ui.page(this, t("enrolTitle"), 2) { menu() }
        pg.content.addView(Ui.symbol(this, "!", Ui.c(this).bad))
        pg.content.addView(Ui.body(this, why))
        pg.bottom.addView(Ui.primary(this, t("back")) { finish() })
    }

    // ---- step 3: information and consent (docs/pilot/consent-v0.3*.md; Decision #57, point 4)
    private fun consent() {
        page = P.CONSENT; clear()
        val pg = Ui.page(this, t("consentStep"), 3) { menu() }
        pg.content.addView(Ui.body(this, t("enrolIntro")))
        val card = Ui.card(this, tint = true)
        card.addView(Ui.body(this, t("consentSummary")))
        card.addView(Ui.secondary(this, t("consentRead")) {
            val f = if (L10n.lang == "fa") "consent-v0.3-fa.md" else "consent-v0.3.md"
            startActivity(Intent(Intent.ACTION_VIEW, Uri.parse("https://github.com/NemoUnus/proof-of-one/blob/main/docs/pilot/$f")))
        })
        pg.content.addView(card)
        val next = Ui.primary(this, t("next")) { if (consentOk) face() }
        pg.content.addView(Ui.check(this, t("consentAgree")) { on -> consentOk = on; Ui.enable(next, on) }.apply { isChecked = consentOk })
        Ui.enable(next, consentOk)
        pg.bottom.addView(next)
    }

    // ---- step 4: the face check, on the phone only
    private fun face() {
        page = P.FACE; clear()
        val pg = Ui.page(this, t("faceStep"), 4) { menu() }
        pg.content.addView(Ui.symbol(this, "◉", Ui.c(this).primary))
        pg.content.addView(Ui.body(this, t("faceIntro")))
        val st = Ui.status(this); faceStatus = st; pg.content.addView(st)
        bottom = pg.bottom
        if (faceOk) { faceDone(); return }
        faceNote?.let { Ui.say(st, it) }
        val b = Ui.primary(this, t("takeSelfie")) { takeSelfie() }
        selfieBtn = b; Ui.enable(b, chipFace != null)
        pg.bottom.addView(Ui.secondary(this, t("back")) { consent() })
        pg.bottom.addView(b)
    }
    private fun faceDone() {
        faceStatus?.let { Ui.say(it, t("facePass"), 1) }
        bottom?.removeAllViews()
        bottom?.addView(Ui.primary(this, t("next")) { password() })
    }

    // ---- step 5: password and enrolment (or restore)
    private fun password() {
        page = P.PASSWORD; clear()
        val pg = Ui.page(this, t("pwStep"), 5) { menu() }
        pg.content.addView(Ui.body(this, t("pwLabel")))
        val (b1, e1) = Ui.field(this, t("pw1"), "", password = true)
        val (b2, e2) = Ui.field(this, t("pw2"), "", password = true)
        pg.content.addView(b1); pg.content.addView(b2); pw1 = e1; pw2 = e2
        val st = Ui.status(this); status = st; pg.content.addView(st)
        val rp = Ui.mono(this).apply { visibility = View.GONE }; report = rp; pg.content.addView(rp)
        bottom = pg.bottom
        val r = Ui.primary(this, t("restore")) { retryRestore() }.apply { visibility = View.GONE }; restore = r
        val s = Ui.primary(this, t("enrol")) { run() }; start = s
        pg.bottom.addView(r); pg.bottom.addView(s)
    }
    private fun showDetailsButton() {
        val b = bottom ?: return
        if (b.findViewWithTag<View>("details") != null) return
        b.addView(Ui.secondary(this, t("shareResult")) { share() }.apply { tag = "details" }, 0)
    }

    // ---- the result
    private fun done(text: String, good: Boolean, number: String?) {
        page = P.DONE; clear()
        doneText = text; doneGood = good; doneNumber = number
        val pg = Ui.page(this, t("enrolledTitle"), 5) { menu() }
        val c = Ui.c(this)
        pg.content.addView(Ui.symbol(this, if (good) "✓" else "!", if (good) c.good else c.accent))
        pg.content.addView(Ui.status(this).also { Ui.say(it, text, if (good) 0 else 2) })
        if (!number.isNullOrEmpty()) {
            val card = Ui.card(this)
            card.addView(Ui.note(this, t("yourNumber")))
            card.addView(TextView(this).apply {
                this.text = number; textSize = 17f; typeface = Typeface.MONOSPACE; setTextColor(c.heading); setTextIsSelectable(true)
                textDirection = View.TEXT_DIRECTION_LTR
            })
            card.addView(Ui.note(this, t("numberPrivate")))
            pg.content.addView(card)
        }
        pg.content.addView(Ui.note(this, t("nextReg")))
        if (shareText.isNotEmpty()) pg.bottom.addView(Ui.secondary(this, t("shareResult")) { share() })
        pg.bottom.addView(Ui.primary(this, t("next")) { finish() })
    }

    private fun hasMember() = memberFile().exists() && Registration.state(this) !is Registration.State.Old

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
                faceNote = if (f == null) L10n.t("faceNoChipFace") else if (!faceOk) L10n.t("faceReady") else null
                if (!faceOk) faceNote?.let { n -> faceStatus?.let { Ui.say(it, n, if (f == null) 2 else 0) } }
                selfieBtn?.let { Ui.enable(it, f != null && !faceOk) }
            }
            f != null
        } catch (e: Throwable) {
            runOnUiThread { faceNote = L10n.t("faceError", e.message ?: e.javaClass.simpleName); faceStatus?.let { Ui.say(it, faceNote!!, 2) } }
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
        if (page != P.FACE) { consentOk = true; face() }   // the screen was rebuilt while the camera was open
        if (resultCode != RESULT_OK || !selfie.exists()) { faceStatus?.let { Ui.say(it, L10n.t("faceNoSelfie"), 2) }; selfie.delete(); return }
        faceStatus?.let { Ui.say(it, L10n.t("faceComparing")) }; selfieBtn?.let { Ui.enable(it, false) }
        thread {
            try {
                val bm = try { FaceMatcher.loadSelfie(selfie) } finally { selfie.delete() }
                if (!prepareChipFace()) return@thread
                val f = matcher!!.analyse(bm)
                faceTries++
                val sim = f?.let { FaceMatcher.cosine(chipFace!!.embedding, it.embedding) }
                runOnUiThread {
                    selfieBtn?.let { Ui.enable(it, true) }
                    when {
                        sim == null -> faceStatus?.let { Ui.say(it, L10n.t("faceNone"), 2) }
                        sim >= FaceMatcher.THRESHOLD -> { faceOk = true; faceSim = sim; faceDone() }
                        else -> faceStatus?.let { Ui.say(it, L10n.t("faceFail"), 2) }
                    }
                }
            } catch (e: Throwable) {
                runOnUiThread { selfieBtn?.let { Ui.enable(it, true) }; faceStatus?.let { Ui.say(it, L10n.t("faceError", e.message ?: e.javaClass.simpleName), 2) } }
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
        val pw = pw1?.text.toString()
        restore?.let { Ui.enable(it, false) }
        thread {
            val plain = Backup.open(blob, pw, seed)
            runOnUiThread {
                restore?.let { Ui.enable(it, true) }
                restoreTries++
                if (plain == null) {
                    status?.let { Ui.say(it, L10n.t("wrongPw"), 2) }
                    shareText += "\nretry $restoreTries: backup not opened (password)"
                    return@runOnUiThread
                }
                saveMember(restored(plain, LocalDate.now()))
                shareText += "\nretry $restoreTries: RESTORED with the password"
                pendingBackup = null; pendingSeed = null
                done(L10n.t("restored"), true, JSONObject(plain).optString("number"))
            }
        }
    }

    private fun run() {
        val chip = DocStore.chip ?: return
        fun t(k: String, vararg a: Any) = L10n.t(k, *a)
        val say = { s: String, k: Int -> status?.let { Ui.say(it, s, k) }; Unit }
        if (!consentOk) { say(t("consentFirst"), 2); return }
        if (!faceOk) { say(t("faceFirst"), 2); return }
        val password = pw1?.text.toString()
        if (password.length < 8) { say(t("pwShort"), 2); return }
        if (password != pw2?.text.toString()) { say(t("pwDiffer"), 2); return }
        start?.let { Ui.enable(it, false) }
        window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
        val log = mutableListOf("Proof of One pilot enrolment v0.13", "consent: information text v0.3 read and agreed",
            "face check: passed on the phone (similarity %.2f, threshold %.2f, %d selfie%s); no face data sent".format(
                java.util.Locale.ROOT, faceSim, FaceMatcher.THRESHOLD, faceTries, if (faceTries == 1) "" else "s"))
        fun step(s: String) = runOnUiThread { status?.let { Ui.say(it, s) } }
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
                            when {
                                plain != null -> done(t("already") + "\n\n" + t("restored"), true, number)
                                blob != null -> {
                                    pendingBackup = blob; pendingSeed = backupSeed
                                    status?.let { Ui.say(it, t("already") + "\n\n" + t("wrongPw") + " " + t("restoreAsk"), 2) }
                                    start?.visibility = View.GONE; restore?.visibility = View.VISIBLE
                                    pw2?.visibility = View.GONE; pw1?.text?.clear()
                                    showDetailsButton()
                                }
                                else -> done(t("already") + "\n\n" + t("noBackup"), false, number)
                            }
                        }
                        return@thread
                    }
                    throw e
                }
                val cred = res.getJSONObject("credential")
                val e = built.expected
                val saved = JSONObject()
                    .put("version", Registration.FORMAT).put("service", EnrolService.BASE).put("enrolledDay", ses.getString("today"))
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
                log += "registration on the ledger: automatic, 1-10 minutes after enrolment (Decision #62)"
                log += "total time: ${(System.currentTimeMillis() - t0) / 1000} s (after the files)"
                shareText = log.joinToString("\n")
                runOnUiThread { done(if (backedUp) t("enrolled") else t("noBackupStored"), backedUp, number) }
            } catch (e: EnrolService.Failure) {
                log += "REFUSED at step '$stage' (HTTP ${e.status}): ${e.message}"
                shareText = log.joinToString("\n")
                runOnUiThread { say(explain(e, stage), 2); showDetailsButton(); start?.let { Ui.enable(it, !hasMember()) } }
            } catch (e: Throwable) {
                log += "ERROR at step '$stage': ${e.javaClass.simpleName}: ${e.message}"
                shareText = log.joinToString("\n")
                val why = when {
                    e is java.io.IOException -> t("noService")
                    stage == "proof" -> t("proofFail")
                    else -> t("error", stage, e.message ?: "")
                }
                runOnUiThread { say(why, 2); showDetailsButton(); start?.let { Ui.enable(it, !hasMember()) } }
            } finally {
                runOnUiThread { window.clearFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON) }
            }
        }
    }
}
