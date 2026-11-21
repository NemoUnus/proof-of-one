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
    const val MAX_DG13 = 512

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
        val dg13: ByteArray? = null, // DG13 (national use), where the chip has it and its hash matched
        val dscDer: ByteArray? = null, // the document signer's certificate (DER), sent to the enrolment service's /signer
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
    /**
     * `pnTag`: when the issuer's rule takes the personal number from DG13, the field's tag
     * (spec §3; π_doc step 8a); otherwise null.
     */
    fun build(c: Chip, today: LocalDate, cm: BigInteger = BigInteger.ONE, challenge: BigInteger = BigInteger.ONE,
              rFace: BigInteger = BigInteger.valueOf(7), pnTag: Int? = null): Built {
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
        // DG13 (step 8a): when unused, zeros of padded length 64, and DG1's entry
        if (pnTag != null) {
            val d13 = c.dg13 ?: throw IllegalArgumentException("the rule needs DG13, which this chip does not have")
            val p13 = shaPad(d13, MAX_DG13)
            val d13Off = indexOf(c.eContent, bytes(0x30, 5 + hl, 0x02, 0x01, 0x0D, 0x04, hl) + MessageDigest.getInstance(s.hash).digest(d13))
            require(d13Off >= 0) { "the DG13 hash entry was not found in the security object" }
            dg13Field(d13, pnTag) // checks the field is there exactly once
            put("pnTag", str(pnTag)); put("dg13", arr(p13.first)); put("d13Len", str(p13.second)); put("d13Off", str(d13Off))
        } else {
            put("pnTag", str(0)); put("dg13", arr(List(MAX_DG13) { 0 })); put("d13Len", str(64)); put("d13Off", str(dg1Off))
        }
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

    /** The fields (tag, value) of DG13, walked from the first as the circuit does. */
    fun dg13Fields(b: ByteArray): List<Pair<Int, ByteArray>> {
        val u = { i: Int -> b[i].toInt() and 0xff }
        require(b.size >= 4 && u(0) == 0x6D) { "not a DG13" }
        val (cs, clen) = when {
            u(1) < 0x80 -> 2 to u(1)
            u(1) == 0x81 -> 3 to u(2)
            u(1) == 0x82 -> 4 to u(2) * 256 + u(3)
            else -> throw IllegalArgumentException("DG13 length")
        }
        val end = cs + clen
        require(end <= b.size) { "DG13 too short" }
        val out = mutableListOf<Pair<Int, ByteArray>>()
        var i = cs
        while (i < end) {
            val two = u(i) and 0x1F == 0x1F
            val tl = if (two) 2 else 1
            val t = if (two) u(i) * 256 + u(i + 1) else u(i)
            val lb = u(i + tl)
            val (l, hlen) = when { lb < 0x80 -> lb to tl + 1; lb == 0x81 -> u(i + tl + 1) to tl + 2; else -> throw IllegalArgumentException("DG13 field length") }
            out += t to b.copyOfRange(i + hlen, i + hlen + l)
            i += hlen + l
        }
        require(i == end) { "DG13 fields do not end with the data group" }
        return out
    }

    /** The field under `tag`, which must be there exactly once and be 1 to 31 bytes long. */
    fun dg13Field(b: ByteArray, tag: Int): ByteArray {
        val hits = dg13Fields(b).filter { it.first == tag }
        require(hits.size == 1) { "DG13 field %X not found exactly once".format(tag) }
        require(hits[0].second.size in 1..31) { "DG13 field length out of range" }
        return hits[0].second
    }

    /**
     * TEST SCREEN ONLY: the tag of a DG13 field that holds exactly ten ASCII digits (as the
     * national numbers seen so far do), or null. In the pilot the rule comes from the
     * service for each issuing state; this guess lets the test screen try the DG13 path.
     */
    fun pnTagGuess(dg13: ByteArray?): Int? = dg13?.let {
        try { dg13Fields(it).filter { (_, v) -> v.size <= 31 && v.count { x -> x in 0x30..0x39 } == 10 }.singleOrNull()?.first } catch (e: IllegalArgumentException) { null }
    }

    /** The input with the signer's path in the tree of checked signers (from the enrolment service's /path). */
    fun withTree(json: String, root: String, siblings: List<String>, pathIndex: List<String>): String {
        require(json.endsWith("}") && siblings.size == DEPTH && pathIndex.size == DEPTH) { "bad tree path" }
        fun arr(xs: List<String>) = xs.joinToString(",", "[", "]") { "\"$it\"" }
        return json.dropLast(1) + ",\"dscRoot\":\"$root\",\"dscSiblings\":${arr(siblings)},\"dscPathIndex\":${arr(pathIndex)}}"
    }
    /** The issuing state of a TD3 passport, from the MRZ (line 1, characters 3–5). */
    fun issuerOf(dg1: ByteArray): String = String(dg1, 5 + 2, 3, Charsets.US_ASCII)
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
