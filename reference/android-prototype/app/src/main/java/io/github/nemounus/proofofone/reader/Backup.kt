// SPDX-License-Identifier: Apache-2.0
// Proof of One — the member's encrypted backup (Decision #59).
//   key  = Argon2id(password, salt = backup seed, 64 MiB, 3 passes) → 32 bytes
//   blob = "v1." + base64(nonce ‖ AES-256-GCM(member.json, aad "PoO-backup-v1"))
// The backup seed comes from the person key's OPRF value, which only the phone obtains
// (native-prover fingerprint.rs, member_seeds): the service keeps the blob but cannot open it,
// and even with the seed a password must still be guessed through Argon2.
package io.github.nemounus.proofofone.reader

import android.util.Base64
import org.bouncycastle.crypto.generators.Argon2BytesGenerator
import org.bouncycastle.crypto.params.Argon2Parameters
import java.math.BigInteger
import java.security.SecureRandom
import javax.crypto.Cipher
import javax.crypto.spec.GCMParameterSpec
import javax.crypto.spec.SecretKeySpec

object Backup {
    private val AAD = "PoO-backup-v1".toByteArray()

    private fun key(password: String, seed: String): ByteArray {
        val s = BigInteger(seed).toByteArray().let { b -> ByteArray(32).also { o -> val t = b.takeLast(32).toByteArray(); System.arraycopy(t, 0, o, 32 - t.size, t.size) } }
        val p = Argon2Parameters.Builder(Argon2Parameters.ARGON2_id).withSalt(s).withIterations(3).withMemoryAsKB(65536).withParallelism(1).build()
        val out = ByteArray(32)
        Argon2BytesGenerator().apply { init(p) }.generateBytes(password.toCharArray(), out)
        return out
    }

    fun seal(plain: String, password: String, seed: String): String {
        val iv = ByteArray(12).also { SecureRandom().nextBytes(it) }
        val c = Cipher.getInstance("AES/GCM/NoPadding")
        c.init(Cipher.ENCRYPT_MODE, SecretKeySpec(key(password, seed), "AES"), GCMParameterSpec(128, iv))
        c.updateAAD(AAD)
        return "v1." + Base64.encodeToString(iv + c.doFinal(plain.toByteArray()), Base64.NO_WRAP)
    }

    /** The member file, or null for a wrong password (or a blob made for another person). */
    fun open(blob: String, password: String, seed: String): String? {
        if (!blob.startsWith("v1.")) return null
        val b = Base64.decode(blob.substring(3), Base64.NO_WRAP)
        if (b.size < 12 + 16) return null
        return try {
            val c = Cipher.getInstance("AES/GCM/NoPadding")
            c.init(Cipher.DECRYPT_MODE, SecretKeySpec(key(password, seed), "AES"), GCMParameterSpec(128, b, 0, 12))
            c.updateAAD(AAD)
            String(c.doFinal(b, 12, b.size - 12))
        } catch (e: javax.crypto.AEADBadTagException) { null }
    }
}
