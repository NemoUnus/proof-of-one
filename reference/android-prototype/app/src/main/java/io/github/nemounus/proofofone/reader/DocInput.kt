// SPDX-License-Identifier: Apache-2.0
// Proof of One — the input of the document-validity proof π_doc, built on the phone from the
// chip data (Decision Log #57, challenge 2). A port of buildInput() in
// reference/document-circuit/src/document.js, checked against it on synthetic documents
// (reference/android-prototype/test/DocInputCheck.kt). Plain Kotlin and JDK only, so the
// same code runs in that check and in the app.
//
// What the circuit reads (circuits/lib/document_core.circom): DG1 padded for its hash; the
// LDS security object (eContent) and the signed attributes, each padded for the CMS digest;
// where the DG1 hash, the DG2 hash and the messageDigest sit in them; the RSA signature,
// modulus and exponent in 121-bit limbs; the quotient and remainder of every modular
// multiplication of the RSA check (hints, see circuits/lib/rsa_pkcs1.circom); and the path
// of the signer's key in the tree of checked signers. Without a path, the native prover
// uses a TEST-ONLY tree holding this signer alone.
package io.github.nemounus.proofofone.reader

import java.math.BigInteger
import java.security.MessageDigest
import java.time.LocalDate

object DocInput {
    const val MAX_E = 448
    const val MAX_SA = 192
    const val DEPTH = 16

    /** A circuit suite (document-circuit/src/icao.js, SUITES). */
    class Suite(val id: Int, val hash: String, val k: Int, val maxBits: Int, val fixedE: Long?, val ebits: Int)
    val SUITE_1 = Suite(1, "SHA-256", 17, 2048, 65537L, 0)
    val SUITE_2 = Suite(2, "SHA-1", 26, 3146, null, 17)

    /** The chip data the proof needs, as read and checked by ChipReader. */
    class Chip(
        val dg1: ByteArray,          // DG1 file (TD3: 93 bytes)
        val eContent: ByteArray,     // LDS security object, the signed content of the SOD
        val signedAttrs: ByteArray,  // DER SET of the signed attributes
        val signature: ByteArray,    // RSA signature over the signed attributes
        val modulus: BigInteger,     // DSC public key
        val exponent: BigInteger,
        val ldsHash: String,         // "SHA-1" or "SHA-256" (hashes of the data groups)
        val sigHash: String,         // digest of the CMS signature
        val sigOid: String,          // signature algorithm OID
    )

    /** The suite the chip's signature fits, or a reason why none does. */
    fun suiteOf(c: Chip): Pair<Suite?, String> {
        val rsa = c.sigOid == "1.2.840.113549.1.1.1" || c.sigOid == "1.2.840.113549.1.1.5" || c.sigOid == "1.2.840.113549.1.1.11"
        if (!rsa) return null to "signature algorithm ${c.sigOid} (not RSA PKCS#1 v1.5)"
        val bits = c.modulus.bitLength()
        val e = c.exponent
        for (s in listOf(SUITE_1, SUITE_2)) {
            if (norm(c.ldsHash) != s.hash || norm(c.sigHash) != s.hash || bits > s.maxBits) continue
            if (s.fixedE != null && e != BigInteger.valueOf(s.fixedE)) continue
            if (s.fixedE == null && (e < BigInteger.valueOf(3) || !e.testBit(0) || e.bitLength() > s.ebits)) continue
            return s to "suite ${s.id}"
        }
        return null to "hashes ${c.ldsHash}/${c.sigHash}, RSA-$bits: no circuit for this combination yet"
    }

    private fun norm(h: String) = h.uppercase().replace("SHA1", "SHA-1").replace("SHA256", "SHA-256")

    class Built(val json: String, val suite: Suite, val eLen: Int, val saLen: Int, val expected: Expected)
    class Expected(val birthDay: Long, val sexCode: Long, val natCode: Long, val expMonth: Long, val expiryDay: Long)

    /**
     * The circuit input. `today` is the enrolment date; cm, challenge and rFace are the
     * member's commitment, the service's challenge and the face commitment's blinding.
     * Throws IllegalArgumentException with a reason if the document does not fit.
     */
    fun build(c: Chip, today: LocalDate, cm: BigInteger = BigInteger.ONE, challenge: BigInteger = BigInteger.ONE,
              rFace: BigInteger = BigInteger.valueOf(7)): Built {
        val (s, why) = suiteOf(c)
        require(s != null) { why }
        require(c.dg1.size == 93 && c.dg1[0] == 0x61.toByte()) { "DG1 is not a TD3 passport's (${c.dg1.size} bytes)" }
        val hl = if (s.hash == "SHA-1") 20 else 32
        val dg1 = shaPad(c.dg1, 128)
        val e = shaPad(c.eContent, MAX_E)
        val sa = shaPad(c.signedAttrs, MAX_SA)
        val dg1Off = indexOf(c.eContent, bytes(0x30, 5 + hl, 0x02, 0x01, 0x01, 0x04, hl) + MessageDigest.getInstance(s.hash).digest(c.dg1))
        val dg2Off = indexOf(c.eContent, bytes(0x30, 5 + hl, 0x02, 0x01, 0x02, 0x04, hl))
        val mdOff = indexOf(c.signedAttrs, bytes(0x30, 15 + hl, 0x06, 0x09, 0x2A, 0x86, 0x48, 0x86, 0xF7, 0x0D, 0x01, 0x09, 0x04, 0x31, 2 + hl, 0x04, hl))
        require(dg1Off >= 0) { "the DG1 hash entry was not found in the security object" }
        require(dg2Off >= 0) { "the DG2 hash entry was not found in the security object" }
        require(mdOff >= 0) { "the messageDigest attribute was not found" }
        val sig = BigInteger(1, c.signature)
        val n = c.modulus
        require(sig < n) { "signature not below the modulus" }
        val (q, r) = rsaHints(sig, n, c.exponent, s)
        val year = today.year
        val j = StringBuilder("{")
        fun put(name: String, v: String) { if (j.length > 1) j.append(','); j.append('"').append(name).append("\":").append(v) }
        fun str(x: Any) = "\"$x\""
        fun arr(xs: List<Any>) = xs.joinToString(",", "[", "]") { str(it) }
        put("today", str(dayNumber(today.year, today.monthValue, today.dayOfMonth)))
        put("currentYear", str(year))
        put("cm", str(cm)); put("challenge", str(challenge))
        put("dg1", arr(dg1.first)); put("eContent", arr(e.first)); put("eLen", str(e.second))
        put("dg1Off", str(dg1Off)); put("dg2Off", str(dg2Off))
        put("sa", arr(sa.first)); put("saLen", str(sa.second)); put("mdOff", str(mdOff))
        put("signature", arr(limbs(sig, s.k))); put("modulus", arr(limbs(n, s.k)))
        put("exponent", str(c.exponent)); put("rFace", str(rFace))
        put("rsaQ", q.joinToString(",", "[", "]") { arr(it) })
        put("rsaR", r.joinToString(",", "[", "]") { arr(it) })
        j.append('}')
        return Built(j.toString(), s, e.second, sa.second, expected(c.dg1, year))
    }

    /** SHA-1/SHA-256 padding, then zeros up to `max` bytes; returns the bytes and the padded length. */
    fun shaPad(b: ByteArray, max: Int): Pair<List<Int>, Int> {
        val out = ArrayList<Int>(max)
        b.forEach { out.add(it.toInt() and 0xff) }
        out.add(0x80)
        while (out.size % 64 != 56) out.add(0)
        val bits = b.size.toLong() * 8
        for (i in 7 downTo 0) out.add(((bits shr (8 * i)) and 0xff).toInt())
        val len = out.size
        require(len <= max) { "data too long: $len > $max bytes after padding" }
        while (out.size < max) out.add(0)
        return out to len
    }

    /** k limbs of 121 bits, least significant first. */
    fun limbs(x: BigInteger, k: Int, n: Int = 121): List<BigInteger> {
        val mask = BigInteger.ONE.shiftLeft(n).subtract(BigInteger.ONE)
        var v = x
        val out = (0 until k).map { val l = v.and(mask); v = v.shiftRight(n); l }
        require(v.signum() == 0) { "number too large for $k limbs" }
        return out
    }

    /**
     * Quotient and remainder of each modular multiplication of signature^e mod n, in the
     * circuit's order (document.js, rsaHints): e = 65537: 16 squarings, then × signature;
     * otherwise for each of the suite's exponent bits from the top: a squaring and × signature.
     */
    fun rsaHints(sig: BigInteger, n: BigInteger, e: BigInteger, s: Suite): Pair<List<List<BigInteger>>, List<List<BigInteger>>> {
        val q = mutableListOf<List<BigInteger>>(); val r = mutableListOf<List<BigInteger>>()
        fun mul(a: BigInteger, b: BigInteger): BigInteger {
            val qr = a.multiply(b).divideAndRemainder(n)
            q.add(limbs(qr[0], s.k)); r.add(limbs(qr[1], s.k)); return qr[1]
        }
        if (s.ebits == 0) {
            var acc = sig
            repeat(16) { acc = mul(acc, acc) }
            mul(sig, acc)
        } else {
            var acc = BigInteger.ONE
            for (st in 0 until s.ebits) {
                val sq = mul(acc, acc); val m = mul(sq, sig)
                acc = if (e.testBit(s.ebits - 1 - st)) m else sq
            }
        }
        return q to r
    }

    /**
     * Days since 1900-01-01, as attrs.js dayNumber and the circuit's DayNumber. A day past the
     * month's end (for example 31 April, or 29 February in a common year, which some
     * documents print) rolls over into the next month there too, so it does the same here.
     */
    fun dayNumber(y: Int, m: Int, d: Int): Long =
        LocalDate.of(y, m, 1).plusDays(d - 1L).toEpochDay() - LocalDate.of(1900, 1, 1).toEpochDay()

    /** What the circuit should output, computed directly from the MRZ (document.js, expected). */
    fun expected(dg1: ByteArray, currentYear: Int): Expected {
        val mrz = String(dg1, 5, 88, Charsets.US_ASCII)
        val l2 = mrz.substring(44)
        fun num(a: Int, b: Int) = l2.substring(a, b).toInt()
        val yy = num(13, 15); val cy = currentYear % 100
        val by = if (yy > cy) 1900 + yy else 2000 + yy
        val ey = 2000 + num(21, 23); val em = num(23, 25)
        val nat = l2.substring(10, 13)
        return Expected(
            birthDay = dayNumber(by, num(15, 17), num(17, 19)),
            sexCode = when (l2[20]) { 'M' -> 1L; 'F' -> 2L; else -> 0L },
            natCode = nat[0].code * 65536L + nat[1].code * 256L + nat[2].code,
            expMonth = ey * 12L + em,
            expiryDay = dayNumber(ey, em, num(25, 27)),
        )
    }

    /** The input with the fingerprint inputs (from NativeProver.fpComplete) added. */
    fun withKeys(json: String, keys: String): String {
        require(json.endsWith("}") && keys.startsWith("{") && keys.length > 2) { "bad JSON" }
        return json.dropLast(1) + "," + keys.drop(1)
    }

    /**
     * The person-key path for a TD3 passport (spec §3): 1 if the MRZ optional data (line 2,
     * characters 29–42) holds a personal number, else 2 (name). In the pilot the service
     * decides the path per issuing state; this guess is for the test screen.
     */
    fun pathGuess(dg1: ByteArray): Int {
        val opt = String(dg1, 5 + 44 + 28, 14, Charsets.US_ASCII)
        return if (opt.any { it.isDigit() }) 1 else 2
    }

    private fun bytes(vararg v: Int) = ByteArray(v.size) { v[it].toByte() }

    fun indexOf(h: ByteArray, n: ByteArray): Int {
        outer@ for (i in 0..h.size - n.size) { for (j in n.indices) if (h[i + j] != n[j]) continue@outer; return i }
        return -1
    }
}
