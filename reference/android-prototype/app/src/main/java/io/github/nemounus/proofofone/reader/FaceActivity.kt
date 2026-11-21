// SPDX-License-Identifier: Apache-2.0
// Proof of One — face check test screen (Decision Log #57). Compares the chip photo read on
// the previous screen with a selfie, on the phone, and shows a similarity score, so that the
// threshold can be set from real measurements: the holder, and other people, against the same
// chip photo. Nothing is stored or sent: the selfie file is deleted as soon as it is read, and
// the results that can be shared contain numbers only.
package io.github.nemounus.proofofone.reader

import android.app.Activity
import android.content.Intent
import android.os.Bundle
import android.provider.MediaStore
import android.view.WindowManager
import android.widget.Button
import android.widget.ImageView
import android.widget.LinearLayout
import android.widget.ScrollView
import android.widget.TextView
import androidx.core.content.FileProvider
import java.io.File
import kotlin.concurrent.thread

class FaceActivity : Activity() {
    private lateinit var status: TextView
    private lateinit var chipView: ImageView
    private lateinit var a1: ImageView
    private lateinit var a2: ImageView
    private var chip: FaceMatcher.Face? = null
    private var matcher: FaceMatcher? = null
    private val log = StringBuilder()
    private var trial = 0
    private val selfie by lazy { File(cacheDir, "selfie.jpg") }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        window.setFlags(WindowManager.LayoutParams.FLAG_SECURE, WindowManager.LayoutParams.FLAG_SECURE)
        val pad = (16 * resources.displayMetrics.density).toInt()
        val col = LinearLayout(this).apply { orientation = LinearLayout.VERTICAL; setPadding(pad, pad, pad, pad) }
        col.addView(TextView(this).apply {
            text = "Face check test. The chip photo is compared with a selfie on this phone. Nothing is stored or sent.\n\n" +
                "Please try: (1) the passport holder, two or three times; (2) one or two other people with the same passport. Then share the numbers."
        })
        chipView = ImageView(this).apply { adjustViewBounds = true; maxHeight = 600 }
        col.addView(chipView)
        status = TextView(this).apply { setPadding(0, pad / 2, 0, pad / 2) }
        col.addView(status)
        col.addView(Button(this).apply { text = "Take a selfie"; setOnClickListener { takeSelfie() } })
        val row = LinearLayout(this).apply { orientation = LinearLayout.HORIZONTAL }
        a1 = ImageView(this); a2 = ImageView(this)
        row.addView(a1, LinearLayout.LayoutParams(0, 300, 1f)); row.addView(a2, LinearLayout.LayoutParams(0, 300, 1f))
        col.addView(row)
        col.addView(Button(this).apply {
            text = "Share the numbers"
            setOnClickListener {
                startActivity(Intent.createChooser(Intent(Intent.ACTION_SEND).apply { type = "text/plain"; putExtra(Intent.EXTRA_TEXT, log.toString()) }, "Share"))
            }
        })
        setContentView(ScrollView(this).apply { addView(col) })

        val bytes = FaceStore.chipPhoto
        if (bytes == null) { status.text = "Read a passport first."; return }
        status.text = "Preparing the chip photo…"
        thread {
            try {
                val t0 = System.currentTimeMillis()
                val bm = FaceMatcher.decodeChip(bytes, FaceStore.chipMime)
                val m = FaceMatcher(this).also { matcher = it }
                val f = m.analyse(bm)
                val ms = System.currentTimeMillis() - t0
                log.appendLine("Proof of One face check test v0.1")
                log.appendLine("chip photo: ${FaceStore.chipMime}, ${bm.width}×${bm.height}, ${bytes.size} B; face found: ${f != null}" +
                    (f?.let { " (detector score %.2f)".format(it.score) } ?: "") + "; ${ms} ms")
                runOnUiThread {
                    chipView.setImageBitmap(bm)
                    chip = f
                    status.text = if (f == null) "No face found in the chip photo." else "Chip photo ready (${bm.width}×${bm.height}). Take a selfie."
                    f?.let { a1.setImageBitmap(it.aligned) }
                }
            } catch (e: Throwable) {
                runOnUiThread { status.text = "Could not use the chip photo: ${e.javaClass.simpleName}: ${e.message}" }
                log.appendLine("chip photo error: ${e.javaClass.simpleName}: ${e.message}")
            }
        }
    }

    private fun takeSelfie() {
        if (chip == null) { status.text = "Wait for the chip photo first."; return }
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
        if (requestCode != 1 || resultCode != RESULT_OK || !selfie.exists()) { status.text = "No selfie taken."; selfie.delete(); return }
        status.text = "Comparing…"
        thread {
            try {
                val bm = FaceMatcher.loadSelfie(selfie)
                selfie.delete()
                val t0 = System.currentTimeMillis()
                val f = matcher!!.analyse(bm)
                val ms = System.currentTimeMillis() - t0
                trial++
                if (f == null) {
                    log.appendLine("trial $trial: no face found in the selfie")
                    runOnUiThread { status.text = "No face found in the selfie. Try again, face the camera in good light." }
                    return@thread
                }
                val sim = FaceMatcher.cosine(chip!!.embedding, f.embedding)
                log.appendLine("trial $trial: similarity %.3f (selfie %d×%d, detector %.2f, %d ms)".format(sim, bm.width, bm.height, f.score, ms))
                runOnUiThread {
                    a2.setImageBitmap(f.aligned)
                    status.text = "Trial $trial: similarity %.3f\n\nWrite down who this was (the holder or someone else). The threshold will be set from these numbers.".format(sim)
                }
            } catch (e: Throwable) {
                selfie.delete()
                runOnUiThread { status.text = "Comparison failed: ${e.javaClass.simpleName}: ${e.message}" }
            }
        }
    }

    override fun onDestroy() {
        super.onDestroy(); selfie.delete(); matcher?.close()
    }
}
