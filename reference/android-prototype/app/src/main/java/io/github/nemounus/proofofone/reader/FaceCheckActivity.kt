// SPDX-License-Identifier: Apache-2.0
// Proof of One — the face check before each ballot (app v0.16; Decisions #54 and #67).
//
// A selfie is compared, on this phone only, with the face template of the open member's chip
// photo, kept encrypted in the member's file since enrolment or restore. The selfie file is
// deleted as soon as it is read; nothing about the face is sent. The ballot is sent only if
// the similarity reaches FaceMatcher.THRESHOLD, the same threshold as at enrolment.
// A deterrent only: a modified app can skip this check, and a face shows that the member was
// present, not that the choice was theirs (Decision #54).
package io.github.nemounus.proofofone.reader

import android.app.Activity
import android.content.Intent
import android.graphics.Canvas
import android.graphics.DashPathEffect
import android.graphics.Paint
import android.os.Bundle
import android.provider.MediaStore
import android.view.Gravity
import android.view.View
import android.view.WindowManager
import android.widget.Button
import android.widget.TextView
import androidx.core.content.FileProvider
import java.io.File
import kotlin.concurrent.thread

class FaceCheckActivity : Activity() {
    companion object {
        const val MAX_TRIES = 3
        private const val COOL_DOWN = 10 * 60_000L
        // Failed selfies per member, kept for the app's life (review F13): going back, or turning
        // the phone, does not give new tries; after MAX_TRIES, a ten-minute wait.
        private val failed = HashMap<String, Pair<Int, Long>>()   // member id → (fails, time of the last)
        @Synchronized private fun fails(id: String): Int {
            val (n, at) = failed[id] ?: return 0
            if (System.currentTimeMillis() - at > COOL_DOWN) { failed.remove(id); return 0 }
            return n
        }
        @Synchronized private fun fail(id: String) { failed[id] = (fails(id) + 1) to System.currentTimeMillis() }
        @Synchronized private fun passed(id: String) { failed.remove(id) }
    }
    private var memberId: String? = null
    private lateinit var status: TextView
    private lateinit var take: Button
    private var matcher: FaceMatcher? = null
    private var template: FloatArray? = null
    private val selfie by lazy { File(cacheDir, "check_selfie.jpg") }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        window.addFlags(WindowManager.LayoutParams.FLAG_SECURE)
        L10n.load(this)
        if (!Profiles.guard(this)) return
        val pg = Ui.page(this, L10n.t("faceCheckTitle"), 0)
        pg.content.addView(Oval(this))
        pg.content.addView(Ui.heading(this, L10n.t("faceCheckHead")).apply { gravity = Gravity.CENTER })
        pg.content.addView(Ui.body(this, L10n.t("faceCheckBody")))
        pg.content.addView(Ui.card(this, tint = true).apply { addView(Ui.note(context, L10n.t("faceCheckNote"))) })
        status = Ui.status(this); pg.content.addView(status)
        take = Ui.primary(this, L10n.t("takeSelfie")) { takeSelfie() }
        pg.bottom.addView(take)
        pg.bottom.addView(Ui.secondary(this, L10n.t("cancel")) { setResult(RESULT_CANCELED); finish() })
        template = Profiles.faceTemplate(Profiles.read())
        memberId = Profiles.current
        if (template == null) { Ui.say(status, L10n.t("faceCheckNoTemplate"), 2); Ui.enable(take, false); return }
        if (fails(memberId!!) >= MAX_TRIES) { Ui.say(status, L10n.t("faceCheckGiveUp"), 2); Ui.enable(take, false); return }
        Ui.enable(take, false); Ui.say(status, L10n.t("facePrep"))
        thread {
            try { matcher = FaceMatcher(this); runOnUiThread { Ui.say(status, ""); Ui.enable(take, true) } }
            catch (e: Throwable) { runOnUiThread { Ui.say(status, L10n.t("faceError", e.message ?: e.javaClass.simpleName), 2) } }
        }
    }

    private fun takeSelfie() {
        val uri = FileProvider.getUriForFile(this, "$packageName.files", selfie)
        val i = Intent(MediaStore.ACTION_IMAGE_CAPTURE).apply {
            putExtra(MediaStore.EXTRA_OUTPUT, uri)
            putExtra("android.intent.extras.CAMERA_FACING", 1)
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
        if (resultCode != RESULT_OK || !selfie.exists()) { Ui.say(status, L10n.t("faceNoSelfie"), 2); selfie.delete(); return }
        val m = matcher ?: return
        val t = template ?: return
        Ui.enable(take, false); Ui.say(status, L10n.t("faceComparing"))
        thread {
            val sim = try {
                val bm = try { FaceMatcher.loadSelfie(selfie) } finally { selfie.delete() }
                m.analyse(bm)?.let { FaceMatcher.cosine(t, it.embedding) }
            } catch (e: Throwable) { null }
            runOnUiThread {
                val id = memberId ?: return@runOnUiThread
                // the member may have closed while the camera was open
                if (Profiles.current != id) { setResult(RESULT_CANCELED); finish(); return@runOnUiThread }
                when {
                    sim != null && sim >= FaceMatcher.THRESHOLD -> {
                        passed(id); setResult(RESULT_OK, Intent().putExtra("similarity", sim)); finish()
                    }
                    else -> {
                        fail(id)
                        val left = MAX_TRIES - fails(id)
                        if (left <= 0) Ui.say(status, L10n.t("faceCheckGiveUp"), 2)
                        else { Ui.enable(take, true); Ui.say(status, if (sim == null) L10n.t("faceNone") else L10n.t("faceCheckFail", left), 2) }
                    }
                }
            }
        }
    }

    private val idle = Profiles.IdleWatch(this)
    override fun onResume() { super.onResume(); idle.start() }
    override fun onPause() { super.onPause(); idle.stop() }
    override fun onDestroy() { super.onDestroy(); selfie.delete(); matcher?.close() }

    /** A dashed oval with a simple face, as in the approved mockup. */
    private class Oval(ctx: android.content.Context) : View(ctx) {
        private val line = Paint(Paint.ANTI_ALIAS_FLAG).apply {
            style = Paint.Style.STROKE; color = Ui.c(ctx).primary; strokeWidth = Ui.dp(ctx, 3).toFloat()
            pathEffect = DashPathEffect(floatArrayOf(Ui.dp(ctx, 10).toFloat(), Ui.dp(ctx, 8).toFloat()), 0f)
        }
        private val face = Paint(Paint.ANTI_ALIAS_FLAG).apply { color = Ui.c(ctx).muted; strokeWidth = Ui.dp(ctx, 4).toFloat(); strokeCap = Paint.Cap.ROUND; style = Paint.Style.STROKE }
        override fun onMeasure(w: Int, h: Int) = setMeasuredDimension(View.MeasureSpec.getSize(w), Ui.dp(context, 200))
        override fun onDraw(cv: Canvas) {
            val cx = width / 2f; val d = Ui.dp(context, 1).toFloat()
            cv.drawOval(cx - 62 * d, 18 * d, cx + 62 * d, 178 * d, line)
            face.style = Paint.Style.FILL
            cv.drawCircle(cx - 23 * d, 86 * d, 5 * d, face); cv.drawCircle(cx + 23 * d, 86 * d, 5 * d, face)
            face.style = Paint.Style.STROKE
            val p = android.graphics.Path().apply { moveTo(cx - 23 * d, 128 * d); quadTo(cx, 144 * d, cx + 23 * d, 128 * d) }
            cv.drawPath(p, face)
        }
    }
}
