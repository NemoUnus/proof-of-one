// SPDX-License-Identifier: Apache-2.0
// Proof of One — several members on one phone, each opened with their own password
// (app v0.16; Decisions #54 and #67).
//
// Up to MAX members. For each, two files in the app's private storage:
//   members/<id>.meta.json  label (chosen by the member, kept only here), day added, a random
//                           salt, and the SHA-256 of the member number (to notice the same
//                           membership restored twice); nothing else, readable by the app only;
//   members/<id>.enc        the member file (secrets, credential, attributes, registration, and
//                           the face template of the chip photo), encrypted twice:
//     inner = AES-256-GCM under Argon2id(password, salt; 64 MiB, 3 passes) — the member's own
//             password, the same as for the backup (Decision #67, point 2);
//     outer = AES-256-GCM under a key made inside the phone's secure hardware (Android
//             Keystore) for this member, which never leaves it, so that a copied file cannot be
//             attacked away from this phone.
// A wrong password fails the inner tag. While a member is open, the decrypted file and the
// derived key stay in memory only; the member is closed after LOCK_AFTER without use, when
// another member is opened, or when the app's process ends.
// What this protects: another person using the phone cannot open a member without that
// member's password. What it does not: someone who watches the password being typed, or a
// modified app on the same phone (Decision #54: a deterrent, not a defence).
package io.github.nemounus.proofofone.reader

import android.app.Activity
import android.content.Context
import android.content.Intent
import android.security.keystore.KeyGenParameterSpec
import android.security.keystore.KeyProperties
import org.bouncycastle.crypto.generators.Argon2BytesGenerator
import org.bouncycastle.crypto.params.Argon2Parameters
import org.json.JSONObject
import java.io.File
import java.security.KeyStore
import java.security.MessageDigest
import java.security.SecureRandom
import java.time.LocalDate
import javax.crypto.Cipher
import javax.crypto.KeyGenerator
import javax.crypto.SecretKey
import javax.crypto.spec.GCMParameterSpec
import javax.crypto.spec.SecretKeySpec

object Profiles {
    const val MAX = 4
    private const val LOCK_AFTER = 5 * 60_000L
    private val AAD = "PoO-member-v1".toByteArray()

    class Meta(val id: String, val label: String, val added: String, val salt: ByteArray, val numberHash: String)

    // ---- the open member (memory only)
    @Volatile var current: String? = null; private set
    @Volatile private var key: ByteArray? = null
    @Volatile private var plain: JSONObject? = null
    @Volatile private var lastUse = 0L

    private fun dir(ctx: Context) = File(ctx.filesDir, "members").also { it.mkdirs() }
    private fun metaFile(ctx: Context, id: String) = File(dir(ctx), "$id.meta.json")
    private fun encFile(ctx: Context, id: String) = File(dir(ctx), "$id.enc")

    fun list(ctx: Context): List<Meta> = (dir(ctx).listFiles() ?: emptyArray())
        .filter { it.name.endsWith(".meta.json") }
        .mapNotNull { f -> try { metaOf(JSONObject(f.readText())) } catch (e: Exception) { null } }
        .filter { encFile(ctx, it.id).exists() }
        .sortedBy { it.added + it.id }
    private fun metaOf(j: JSONObject) = Meta(j.getString("id"), j.getString("label"), j.getString("added"),
        android.util.Base64.decode(j.getString("salt"), android.util.Base64.NO_WRAP), j.optString("numberHash"))
    fun meta(ctx: Context, id: String): Meta? = list(ctx).firstOrNull { it.id == id }

    fun numberHash(number: String): String =
        MessageDigest.getInstance("SHA-256").digest(("PoO-number|" + number).toByteArray()).joinToString("") { "%02x".format(it) }
    /** The member already on this phone with the same member number, if any. */
    fun withNumber(ctx: Context, number: String): Meta? = number.takeIf { it.isNotEmpty() }?.let { n -> list(ctx).firstOrNull { it.numberHash == numberHash(n) } }

    // ---- keys
    private fun derive(password: String, salt: ByteArray): ByteArray {
        val p = Argon2Parameters.Builder(Argon2Parameters.ARGON2_id).withSalt(salt).withIterations(3).withMemoryAsKB(65536).withParallelism(1).build()
        return ByteArray(32).also { Argon2BytesGenerator().apply { init(p) }.generateBytes(password.toCharArray(), it) }
    }
    private fun hwKey(id: String, create: Boolean): SecretKey {
        val ks = KeyStore.getInstance("AndroidKeyStore").apply { load(null) }
        val alias = "poo-member-$id"
        (ks.getKey(alias, null) as? SecretKey)?.let { return it }
        if (!create) error("this member's hardware key is missing")
        val g = KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES, "AndroidKeyStore")
        g.init(KeyGenParameterSpec.Builder(alias, KeyProperties.PURPOSE_ENCRYPT or KeyProperties.PURPOSE_DECRYPT)
            .setBlockModes(KeyProperties.BLOCK_MODE_GCM).setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE)
            .setKeySize(256).build())
        return g.generateKey()
    }
    private fun seal(k: SecretKey, data: ByteArray, iv: ByteArray? = null): ByteArray {
        val c = Cipher.getInstance("AES/GCM/NoPadding")
        if (iv == null) c.init(Cipher.ENCRYPT_MODE, k) else c.init(Cipher.ENCRYPT_MODE, k, GCMParameterSpec(128, iv))
        c.updateAAD(AAD)
        val ct = c.doFinal(data)
        return byteArrayOf(c.iv.size.toByte()) + c.iv + ct
    }
    private fun open(k: SecretKey, blob: ByteArray): ByteArray {
        val n = blob[0].toInt()
        val c = Cipher.getInstance("AES/GCM/NoPadding")
        c.init(Cipher.DECRYPT_MODE, k, GCMParameterSpec(128, blob.copyOfRange(1, 1 + n)))
        c.updateAAD(AAD)
        return c.doFinal(blob, 1 + n, blob.size - 1 - n)
    }
    private fun encrypt(id: String, kpw: ByteArray, text: String): ByteArray {
        val iv = ByteArray(12).also { SecureRandom().nextBytes(it) }
        val inner = seal(SecretKeySpec(kpw, "AES"), text.toByteArray(Charsets.UTF_8), iv)
        return seal(hwKey(id, true), inner)
    }

    // ---- create, open, read, write, close, remove
    /** Adds a member (after enrolment or restore) and opens it. Returns its id. */
    @Synchronized
    fun create(ctx: Context, label: String, password: String, member: JSONObject): String {
        if (list(ctx).size >= MAX) error("this phone already holds $MAX members")
        val id = ByteArray(6).also { SecureRandom().nextBytes(it) }.joinToString("") { "%02x".format(it) }
        val salt = ByteArray(16).also { SecureRandom().nextBytes(it) }
        val kpw = derive(password, salt)
        val tmp = File(dir(ctx), "$id.enc.part"); tmp.writeBytes(encrypt(id, kpw, member.toString())); tmp.renameTo(encFile(ctx, id))
        metaFile(ctx, id).writeText(JSONObject().put("id", id).put("label", label.trim().ifEmpty { "—" }.take(30))
            .put("added", LocalDate.now().toString()).put("salt", android.util.Base64.encodeToString(salt, android.util.Base64.NO_WRAP))
            .put("numberHash", numberHash(member.optString("number"))).toString())
        lock()   // the member that was open, if any, is closed
        current = id; key = kpw; plain = JSONObject(member.toString()); lastUse = System.currentTimeMillis()
        return id
    }

    /** Opens a member with its password; false if the password is wrong. Slow (Argon2): not on the UI thread. */
    @Synchronized
    fun unlock(ctx: Context, id: String, password: String): Boolean {
        val m = meta(ctx, id) ?: return false
        val kpw = derive(password, m.salt)
        val text = try {
            val inner = open(hwKey(id, false), encFile(ctx, id).readBytes())
            String(open(SecretKeySpec(kpw, "AES"), inner), Charsets.UTF_8)
        } catch (e: javax.crypto.AEADBadTagException) { return false }
        lock()
        current = id; key = kpw; plain = JSONObject(text); lastUse = System.currentTimeMillis()
        return true
    }

    fun isOpen(): Boolean {
        if (current != null && System.currentTimeMillis() - lastUse > LOCK_AFTER) lock()
        return current != null && plain != null
    }
    fun touch() { if (current != null) lastUse = System.currentTimeMillis() }

    /** The open member's file (a copy); throws if no member is open. */
    fun read(): JSONObject { touch(); return JSONObject((plain ?: throw Locked()).toString()) }
    class Locked : Exception("no member is open")

    @Synchronized
    fun write(ctx: Context, member: JSONObject) {
        val id = current ?: throw Locked(); val kpw = key ?: throw Locked()
        val tmp = File(dir(ctx), "$id.enc.part"); tmp.writeBytes(encrypt(id, kpw, member.toString())); tmp.renameTo(encFile(ctx, id))
        plain = JSONObject(member.toString()); touch()
    }

    fun lock() {
        key?.fill(0); key = null; plain = null; current = null
    }

    /** Removes the open member from this phone (the membership on the ledger is not affected). */
    @Synchronized
    fun removeCurrent(ctx: Context) {
        val id = current ?: return
        lock()
        encFile(ctx, id).delete(); metaFile(ctx, id).delete()
        try { KeyStore.getInstance("AndroidKeyStore").apply { load(null) }.deleteEntry("poo-member-$id") } catch (e: Exception) { }
    }

    /**
     * For screens that need an open member: if none is open (closed after a while without use),
     * go back to the first screen, which lists the members. Returns false if it did.
     */
    fun guard(a: Activity): Boolean {
        if (isOpen()) { touch(); return true }
        a.startActivity(Intent(a, MainActivity::class.java).addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP or Intent.FLAG_ACTIVITY_SINGLE_TOP))
        a.finish()
        return false
    }

    // ---- the face template (Decision #67, point 3)
    /** The chip photo's face template, for the member file (never for the backup). */
    fun faceJson(embedding: FloatArray): JSONObject {
        val b = java.nio.ByteBuffer.allocate(embedding.size * 4).order(java.nio.ByteOrder.LITTLE_ENDIAN)
        embedding.forEach { b.putFloat(it) }
        return JSONObject().put("model", "w600k_mbf").put("template", android.util.Base64.encodeToString(b.array(), android.util.Base64.NO_WRAP))
    }
    fun faceTemplate(member: JSONObject): FloatArray? {
        val f = member.optJSONObject("face") ?: return null
        val raw = android.util.Base64.decode(f.getString("template"), android.util.Base64.NO_WRAP)
        val b = java.nio.ByteBuffer.wrap(raw).order(java.nio.ByteOrder.LITTLE_ENDIAN)
        return FloatArray(raw.size / 4) { b.getFloat() }
    }
    /** The member file without the face template: what goes into the encrypted backup. */
    fun withoutFace(member: JSONObject): JSONObject = JSONObject(member.toString()).apply { remove("face") }
}
