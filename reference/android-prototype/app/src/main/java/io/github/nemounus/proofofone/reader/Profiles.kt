// SPDX-License-Identifier: Apache-2.0
// Proof of One — several members on one phone, each opened with their own password
// (app v0.16; Decisions #54 and #67; v0.17 after the independent review of v0.16).
//
// Up to MAX members. For each, up to three files in the app's private storage:
//   members/<id>.meta.json  label (chosen by the member, kept only here), day added, a random
//                           salt, and a keyed tag of the member number (HMAC-SHA256 under a key
//                           kept in this phone's secure hardware, v0.17), to notice the same
//                           membership restored twice; a copy of the file taken off the phone
//                           cannot be compared with anyone's number (review F5);
//   members/<id>.throttle   wrong passwords so far and the time before the next try, kept on
//                           disk so that leaving the screen or restarting the app does not reset
//                           it (review F2);
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

    /** [numberTag]: HMAC tag of the member number (v0.17); [numberHash]: the unkeyed hash of v0.16, until replaced. */
    class Meta(val id: String, val label: String, val added: String, val salt: ByteArray, val numberTag: String, val numberHash: String)

    // ---- the open member (memory only)
    @Volatile var current: String? = null; private set
    @Volatile private var key: ByteArray? = null
    @Volatile private var plain: JSONObject? = null
    @Volatile private var lastUse = 0L

    private fun dir(ctx: Context) = File(ctx.filesDir, "members").also { it.mkdirs() }
    private fun metaFile(ctx: Context, id: String) = File(dir(ctx), "$id.meta.json")
    private fun encFile(ctx: Context, id: String) = File(dir(ctx), "$id.enc")
    private fun throttleFile(ctx: Context, id: String) = File(dir(ctx), "$id.throttle")

    fun list(ctx: Context): List<Meta> = (dir(ctx).listFiles() ?: emptyArray())
        .filter { it.name.endsWith(".meta.json") }
        .mapNotNull { f -> try { metaOf(JSONObject(f.readText())) } catch (e: Exception) { null } }
        .filter { encFile(ctx, it.id).exists() }
        .sortedBy { it.added + it.id }
    private fun metaOf(j: JSONObject) = Meta(j.getString("id"), j.getString("label"), j.getString("added"),
        android.util.Base64.decode(j.getString("salt"), android.util.Base64.NO_WRAP), j.optString("numberTag"), j.optString("numberHash"))
    fun meta(ctx: Context, id: String): Meta? = list(ctx).firstOrNull { it.id == id }
    private fun metaJson(m: Meta, numberTag: String) = JSONObject().put("id", m.id).put("label", m.label).put("added", m.added)
        .put("salt", android.util.Base64.encodeToString(m.salt, android.util.Base64.NO_WRAP)).put("numberTag", numberTag)

    /** The unkeyed hash of v0.16, only to recognise members saved by v0.16 until they are opened once. */
    private fun numberHash(number: String): String =
        MessageDigest.getInstance("SHA-256").digest(("PoO-number|" + number).toByteArray()).joinToString("") { "%02x".format(it) }
    /** HMAC-SHA256 of the member number under a key that never leaves this phone's secure hardware (review F5). */
    @Synchronized private fun numberKey(): SecretKey {   // made once; a race could make two (review N4)
        val ks = KeyStore.getInstance("AndroidKeyStore").apply { load(null) }
        val alias = "poo-numbers"
        return (ks.getKey(alias, null) as? SecretKey) ?: KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_HMAC_SHA256, "AndroidKeyStore").run {
            init(KeyGenParameterSpec.Builder(alias, KeyProperties.PURPOSE_SIGN).build()); generateKey()
        }
    }
    private fun numberTag(number: String): String {
        val mac = javax.crypto.Mac.getInstance("HmacSHA256").apply { init(numberKey()) }
        return mac.doFinal(("PoO-number|" + number).toByteArray()).joinToString("") { "%02x".format(it) }
    }
    /** The member already on this phone with the same member number, if any. */
    fun withNumber(ctx: Context, number: String): Meta? {
        if (number.isEmpty()) return null
        val tag = try { numberTag(number) } catch (e: Exception) { "" }; val old = numberHash(number)
        // a copy from another phone (no hardware key here) is not the same membership on *this* phone (review N8)
        return list(ctx).firstOrNull { ((tag.isNotEmpty() && it.numberTag == tag) || (it.numberHash.isNotEmpty() && it.numberHash == old)) && hasKey(it.id) }
    }
    private fun hasKey(id: String) = try { KeyStore.getInstance("AndroidKeyStore").apply { load(null) }.containsAlias("poo-member-$id") } catch (e: Exception) { true }

    // ---- keys
    private fun derive(password: String, salt: ByteArray): ByteArray {
        val p = Argon2Parameters.Builder(Argon2Parameters.ARGON2_id).withSalt(salt).withIterations(3).withMemoryAsKB(65536).withParallelism(1).build()
        return ByteArray(32).also { Argon2BytesGenerator().apply { init(p) }.generateBytes(password.toCharArray(), it) }
    }
    private fun hwKey(id: String, create: Boolean): SecretKey {
        val ks = KeyStore.getInstance("AndroidKeyStore").apply { load(null) }
        val alias = "poo-member-$id"
        (ks.getKey(alias, null) as? SecretKey)?.let { return it }
        if (!create) throw OtherPhone()
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
    /** The member file was made on another phone: its hardware key is not on this one (review F4). */
    class OtherPhone : Exception("this member was made on another phone")

    /**
     * Adds a member (after enrolment or restore). It is opened only if the member open now is
     * still [openedAtStart], the one open when the enrolment began (normally none): an enrolment
     * that finishes after someone else has opened their member does not take over the phone
     * (review F3). Returns its id. Slow (Argon2, done before taking the lock): not on the UI thread.
     */
    fun create(ctx: Context, label: String, password: String, member: JSONObject, openedAtStart: String? = null): String {
        val salt = ByteArray(16).also { SecureRandom().nextBytes(it) }
        val kpw = derive(password, salt)
        val tag = try { numberTag(member.optString("number")) } catch (e: Exception) { "" }   // N4: never lose an enrolment over the tag
        synchronized(this) {
            if (list(ctx).size >= MAX) error("this phone already holds $MAX members")
            val id = ByteArray(6).also { SecureRandom().nextBytes(it) }.joinToString("") { "%02x".format(it) }
            val tmp = File(dir(ctx), "$id.enc.part"); tmp.writeBytes(encrypt(id, kpw, member.toString())); tmp.renameTo(encFile(ctx, id))
            metaFile(ctx, id).writeText(JSONObject().put("id", id).put("label", cleanLabel(label).ifEmpty { L10n.t("memberDefault", Ui.digits((list(ctx).size + 1).toString())) })
                .put("added", LocalDate.now().toString()).put("salt", android.util.Base64.encodeToString(salt, android.util.Base64.NO_WRAP))
                .put("numberTag", tag).toString())
            if (current == openedAtStart) {
                lock()   // the member that was open, if any, is closed
                current = id; key = kpw; plain = JSONObject(member.toString()); lastUse = System.currentTimeMillis()
            } else kpw.fill(0)
            return id
        }
    }

    /** The result of a try to open a member. */
    sealed class Opened {
        object Yes : Opened()
        object WrongPassword : Opened()
        /** Too many wrong passwords: the next try is allowed after [seconds]. */
        class Wait(val seconds: Long) : Opened()
        /** The member file was made on another phone (copied by a phone-to-phone transfer). */
        object OtherPhone : Opened()
        object Missing : Opened()
    }

    // The wait after wrong passwords (review F2): from the third wrong password, 30 s, then
    // doubling each time, up to an hour. Counted on disk *before* the slow key step starts, so
    // that stopping the app during it still counts, and cleared only by the right password.
    // The wait runs on the phone's running clock (time since it started), which setting the clock
    // does not change. A restart is recognised by Android's boot count, not by the wall clock
    // (review N1); after a restart the full wait for the failures so far starts again.
    private const val FREE_TRIES = 2
    private fun delayFor(fails: Int): Long =
        if (fails <= FREE_TRIES) 0L else minOf(3_600_000L, 30_000L shl minOf(fails - FREE_TRIES - 1, 7))
    private fun bootCount(ctx: Context): Int =
        try { android.provider.Settings.Global.getInt(ctx.contentResolver, android.provider.Settings.Global.BOOT_COUNT) } catch (e: Exception) { -1 }
    private fun readThrottle(ctx: Context, id: String): JSONObject =
        try { JSONObject(throttleFile(ctx, id).readText()) } catch (e: Exception) { JSONObject().put("fails", 0) }
    private fun writeThrottle(ctx: Context, id: String, fails: Int, wait: Long) {
        val tmp = File(dir(ctx), "$id.throttle.part")
        val now = android.os.SystemClock.elapsedRealtime()
        tmp.writeText(JSONObject().put("fails", fails).put("boot", bootCount(ctx)).put("at", now).put("untilElapsed", now + wait).toString())
        tmp.renameTo(throttleFile(ctx, id))
    }
    /** Seconds before the next try is allowed for this member; 0 if now. */
    fun waitSeconds(ctx: Context, id: String): Long {
        val t = readThrottle(ctx, id)
        val fails = t.optInt("fails")
        if (fails <= FREE_TRIES) return 0L
        val boot = bootCount(ctx); val now = android.os.SystemClock.elapsedRealtime()
        // restarted: another boot count, or (where the phone gives none) a running clock behind the last write
        val restarted = if (boot != -1) t.optInt("boot", -2) != boot else now < t.optLong("at")
        val left = if (!restarted) t.optLong("untilElapsed") - now
            else { writeThrottle(ctx, id, fails, delayFor(fails)); delayFor(fails) }   // the full wait again
        return if (left > 0) (left + 999) / 1000 else 0L
    }
    private fun countTry(ctx: Context, id: String) {
        val fails = readThrottle(ctx, id).optInt("fails") + 1
        writeThrottle(ctx, id, fails, delayFor(fails))
    }
    // one try at a time for each member (review N5): a second try waits for the first and then sees its count
    private val tryLocks = HashMap<String, Any>()
    private fun lockFor(id: String): Any = synchronized(tryLocks) { tryLocks.getOrPut(id) { Any() } }

    /** Opens a member with its password. Slow (Argon2): not on the UI thread. */
    fun unlock(ctx: Context, id: String, password: String): Opened {
        val m = meta(ctx, id) ?: return Opened.Missing
        val (r, kpw, text) = tryPassword(ctx, m, password)
        if (r !is Opened.Yes) return r
        synchronized(this) {
            lock()
            current = id; key = kpw; plain = JSONObject(text!!); lastUse = System.currentTimeMillis()
        }
        // A member saved by v0.16 carries the unkeyed hash of its number: replace it with the keyed tag.
        if (m.numberTag.isEmpty()) try {
            metaFile(ctx, id).writeText(metaJson(m, numberTag(JSONObject(text).optString("number"))).toString())
        } catch (e: Exception) { }
        return Opened.Yes
    }

    /** Checks a member's password with the wait after wrong ones; on success, the key and the decrypted file. */
    private fun tryPassword(ctx: Context, m: Meta, password: String): Triple<Opened, ByteArray?, String?> = synchronized(lockFor(m.id)) {
        waitSeconds(ctx, m.id).let { if (it > 0) return Triple(Opened.Wait(it), null, null) }
        val outer = try { open(hwKey(m.id, false), encFile(ctx, m.id).readBytes()) }
            catch (e: OtherPhone) { return Triple(Opened.OtherPhone, null, null) }
        countTry(ctx, m.id)   // counted before the slow step; cleared below if the password is right
        val kpw = derive(password, m.salt)
        val text = try { String(open(SecretKeySpec(kpw, "AES"), outer), Charsets.UTF_8) }
            catch (e: javax.crypto.AEADBadTagException) { kpw.fill(0); return Triple(Opened.WrongPassword, null, null) }
        throttleFile(ctx, m.id).delete()
        Triple(Opened.Yes, kpw, text)
    }

    /** What happened when the face template was to be added to a member already on the phone (review N3). */
    enum class FaceAdd { ADDED, HAD_ONE }
    /**
     * Adds the chip photo's face template to a member already on this phone that has none (moved
     * from an older version), with that member's own password. The member is not opened, and the
     * member open now, if any, stays open (review N3). Returns the outcome, or the [Opened] that
     * stopped it (wrong password, wait, other phone).
     */
    fun addFace(ctx: Context, id: String, password: String, face: JSONObject): Any {
        val m = meta(ctx, id) ?: return Opened.Missing
        val (r, kpw, text) = tryPassword(ctx, m, password)
        if (r !is Opened.Yes) return r
        try {
            val member = JSONObject(text!!)
            if (member.has("face")) return FaceAdd.HAD_ONE
            member.put("face", face)
            synchronized(this) {
                val tmp = File(dir(ctx), "$id.enc.part"); tmp.writeBytes(encrypt(id, kpw!!, member.toString())); tmp.renameTo(encFile(ctx, id))
                if (current == id) plain = JSONObject(member.toString())
            }
            return FaceAdd.ADDED
        } finally { kpw?.fill(0) }
    }

    fun isOpen(): Boolean {
        if (current != null && System.currentTimeMillis() - lastUse > LOCK_AFTER) lock()
        return current != null && plain != null
    }
    fun touch() { if (current != null) lastUse = System.currentTimeMillis() }

    /** The open member's file (a copy); throws if no member is open. */
    fun read(): JSONObject { touch(); return JSONObject((plain ?: throw Locked()).toString()) }
    class Locked : Exception("no member is open")

    /** Saves the member file of [expectedId], only if that member is still the open one (review F3). */
    @Synchronized
    fun write(ctx: Context, expectedId: String?, member: JSONObject) {
        val id = current ?: throw Locked(); val kpw = key ?: throw Locked()
        if (expectedId == null || id != expectedId) throw Locked()
        val tmp = File(dir(ctx), "$id.enc.part"); tmp.writeBytes(encrypt(id, kpw, member.toString())); tmp.renameTo(encFile(ctx, id))
        plain = JSONObject(member.toString()); touch()
    }

    /** A label as kept: one line, at most 30 characters. */
    fun cleanLabel(s: String) = s.replace(Regex("\\s+"), " ").trim().take(30)

    /**
     * Renames a member (v0.18, founder's proposal). Only the member that is open, so that another
     * user of a shared phone cannot change someone else's label. Keeps every other field of the
     * meta file. Returns false if the label is empty or that member is not open.
     */
    @Synchronized
    fun rename(ctx: Context, id: String, label: String): Boolean {
        val l = cleanLabel(label)
        if (l.isEmpty() || current != id) return false
        val f = metaFile(ctx, id); if (!f.exists()) return false
        val j = JSONObject(f.readText()).put("label", l)
        val tmp = File(dir(ctx), "$id.meta.part"); tmp.writeText(j.toString()); tmp.renameTo(f)
        touch(); return true
    }

    /** Closes the open member, and forgets the last passport read on this phone (review F1). */
    fun lock() {
        key?.fill(0); key = null; plain = null; current = null
        clearChip()
    }

    /**
     * Forgets the last passport read: chip photo and chip data. Called when an enrolment ends,
     * when a member is closed, switched or removed, so that the next person using the phone
     * cannot see them (review F1).
     */
    fun clearChip() {
        FaceStore.clear()
        DocStore.chip = null; DocStore.genuine = false
    }

    /** Removes the open member from this phone (the membership on the ledger is not affected). */
    @Synchronized
    fun removeCurrent(ctx: Context) {
        val id = current ?: return
        remove(ctx, id)
    }

    /**
     * Removes a member from this phone, open or not (review F15): anyone holding the phone could
     * uninstall the app anyway. The membership itself can be restored with the passport and the
     * password, where a backup was stored.
     */
    @Synchronized
    fun remove(ctx: Context, id: String) {
        if (current == id) lock()
        encFile(ctx, id).delete(); metaFile(ctx, id).delete(); throttleFile(ctx, id).delete()
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

    /**
     * For screens that show an open member's polls or answers (review N11): every 20 seconds
     * while the screen is shown, closes it if the member has closed (five minutes without use),
     * unless [busy] (an answer being sent).
     */
    class IdleWatch(private val a: Activity, private val busy: () -> Boolean = { false }) {
        private val h = android.os.Handler(android.os.Looper.getMainLooper())
        private val tick = object : Runnable {
            override fun run() { if (!busy() && !isOpen()) guard(a) else h.postDelayed(this, 20_000L) }
        }
        fun start() { h.removeCallbacks(tick); h.postDelayed(tick, 20_000L) }
        fun stop() = h.removeCallbacks(tick)
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
