// SPDX-License-Identifier: Apache-2.0
// Proof of One — on-phone face check (test): is the person holding the phone the person in
// the chip photo? Decision Log #57, point 3: the face is compared on the phone only; no face
// data leaves it.
//
// Pipeline (checked against a Python reference, reference/android-prototype/face/ref.py):
//   1. face detection and five landmarks: SCRFD-500M (det_500m.onnx), 640×640 input;
//   2. alignment: a least-squares similarity transform of the five landmarks onto the
//      standard 112×112 template;
//   3. a 512-number embedding: ArcFace MobileFaceNet (w600k_mbf.onnx);
//   4. cosine similarity of the two embeddings.
// Models: InsightFace "buffalo_sc" (code MIT; the pretrained models are for non-commercial
// research use only). Acceptable for the non-commercial pilot; a real release needs a model
// whose licence allows it.
package io.github.nemounus.proofofone.reader

import ai.onnxruntime.OnnxTensor
import ai.onnxruntime.OrtEnvironment
import ai.onnxruntime.OrtSession
import android.content.Context
import android.graphics.Bitmap
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.Matrix
import android.graphics.Paint
import java.nio.FloatBuffer
import kotlin.math.max
import kotlin.math.roundToInt
import kotlin.math.sqrt

class FaceMatcher(ctx: Context) : AutoCloseable {
    class Face(val score: Float, val box: FloatArray, val landmarks: FloatArray, val aligned: Bitmap, val embedding: FloatArray)

    private val env = OrtEnvironment.getEnvironment()
    private val det: OrtSession = env.createSession(ctx.assets.open("det_500m.onnx").readBytes())
    private val rec: OrtSession = env.createSession(ctx.assets.open("w600k_mbf.onnx").readBytes())

    /** The best face in the picture, aligned and embedded; null if no face is found. */
    fun analyse(img: Bitmap): Face? {
        val d = detect(img) ?: return null
        val aligned = align(img, d.second)
        return Face(d.first, d.third, d.second, aligned, embed(aligned))
    }

    // ---- 1. detection (SCRFD): returns (score, 5 landmarks x,y in image pixels, box)
    private fun detect(img: Bitmap): Triple<Float, FloatArray, FloatArray>? {
        val s = 640
        val scale = s.toFloat() / max(img.width, img.height)
        val nw = (img.width * scale).roundToInt().coerceAtLeast(1)
        val nh = (img.height * scale).roundToInt().coerceAtLeast(1)
        val canvas = Bitmap.createBitmap(s, s, Bitmap.Config.ARGB_8888)
        Canvas(canvas).apply { drawColor(Color.BLACK); drawBitmap(Bitmap.createScaledBitmap(img, nw, nh, true), 0f, 0f, null) }
        val input = chw(canvas, 127.5f, 128f)
        val outs = OnnxTensor.createTensor(env, FloatBuffer.wrap(input), longArrayOf(1, 3, s.toLong(), s.toLong())).use { t ->
            det.run(mapOf(det.inputNames.first() to t)).use { r -> (0 until 9).map { (r.get(it) as OnnxTensor).floatBuffer.let { b -> FloatArray(b.remaining()).also { a -> b.get(a) } } } }
        }
        var best: Triple<Float, FloatArray, FloatArray>? = null
        for ((i, stride) in listOf(8, 16, 32).withIndex()) {
            val scores = outs[i]; val boxes = outs[i + 3]; val kps = outs[i + 6]
            val g = s / stride
            var j = 0
            for (k in scores.indices) if (scores[k] > scores[j]) j = k
            if (best != null && scores[j] <= best.first) continue
            val loc = j / 2                        // two anchors per location
            val cx = (loc % g) * stride.toFloat(); val cy = (loc / g) * stride.toFloat()
            val box = floatArrayOf(cx - boxes[4 * j] * stride, cy - boxes[4 * j + 1] * stride, cx + boxes[4 * j + 2] * stride, cy + boxes[4 * j + 3] * stride).map { it / scale }.toFloatArray()
            val lm = FloatArray(10) { m -> ((if (m % 2 == 0) cx else cy) + kps[10 * j + m] * stride) / scale }
            best = Triple(scores[j], lm, box)
        }
        return best?.takeIf { it.first >= 0.5f }
    }

    // ---- 2. alignment onto the 112×112 template (least squares, rotation + scale + shift)
    private fun align(img: Bitmap, lm: FloatArray): Bitmap {
        val ref = floatArrayOf(38.2946f, 51.6963f, 73.5318f, 51.5014f, 56.0252f, 71.7366f, 41.5493f, 92.3655f, 70.7299f, 92.2041f)
        var msx = 0f; var msy = 0f; var mdx = 0f; var mdy = 0f
        for (p in 0 until 5) { msx += lm[2 * p]; msy += lm[2 * p + 1]; mdx += ref[2 * p]; mdy += ref[2 * p + 1] }
        msx /= 5; msy /= 5; mdx /= 5; mdy /= 5
        var a = 0f; var b = 0f; var n = 0f
        for (p in 0 until 5) {
            val sx = lm[2 * p] - msx; val sy = lm[2 * p + 1] - msy; val dx = ref[2 * p] - mdx; val dy = ref[2 * p + 1] - mdy
            a += sx * dx + sy * dy; b += sx * dy - sy * dx; n += sx * sx + sy * sy
        }
        val ca = a / n; val cb = b / n               // [[ca, -cb], [cb, ca]]
        val tx = mdx - (ca * msx - cb * msy); val ty = mdy - (cb * msx + ca * msy)
        val m = Matrix().apply { setValues(floatArrayOf(ca, -cb, tx, cb, ca, ty, 0f, 0f, 1f)) }
        val out = Bitmap.createBitmap(112, 112, Bitmap.Config.ARGB_8888)
        Canvas(out).apply { drawColor(Color.BLACK); drawBitmap(img, m, Paint(Paint.FILTER_BITMAP_FLAG)) }
        return out
    }

    // ---- 3. embedding (ArcFace), normalised to length 1
    private fun embed(face: Bitmap): FloatArray {
        val input = chw(face, 127.5f, 127.5f)
        val e = OnnxTensor.createTensor(env, FloatBuffer.wrap(input), longArrayOf(1, 3, 112, 112)).use { t ->
            rec.run(mapOf(rec.inputNames.first() to t)).use { r -> (r.get(0) as OnnxTensor).floatBuffer.let { b -> FloatArray(b.remaining()).also { a -> b.get(a) } } }
        }
        val norm = sqrt(e.fold(0f) { acc, v -> acc + v * v })
        return FloatArray(e.size) { e[it] / norm }
    }

    /** RGB planes, (value - mean) / std. */
    private fun chw(bm: Bitmap, mean: Float, std: Float): FloatArray {
        val w = bm.width; val h = bm.height; val px = IntArray(w * h); bm.getPixels(px, 0, w, 0, 0, w, h)
        val out = FloatArray(3 * w * h)
        for (i in px.indices) {
            val c = px[i]
            out[i] = (((c shr 16) and 0xff) - mean) / std
            out[w * h + i] = (((c shr 8) and 0xff) - mean) / std
            out[2 * w * h + i] = ((c and 0xff) - mean) / std
        }
        return out
    }

    override fun close() { det.close(); rec.close() }

    companion object {
        fun cosine(a: FloatArray, b: FloatArray): Float = a.indices.fold(0f) { acc, i -> acc + a[i] * b[i] }
    }
}

/** The chip photo, held in memory between the reader screen and the face check only. */
object FaceStore {
    @Volatile var chipPhoto: ByteArray? = null
    @Volatile var chipMime: String? = null
}
