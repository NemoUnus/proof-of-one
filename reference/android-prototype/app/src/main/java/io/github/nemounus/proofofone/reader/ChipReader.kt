// SPDX-License-Identifier: Apache-2.0
package io.github.nemounus.proofofone.reader

import android.nfc.tech.IsoDep
import org.bouncycastle.cms.CMSSignedData
import org.bouncycastle.cms.jcajce.JcaSimpleSignerInfoVerifierBuilder
import org.jmrtd.BACKey
import org.jmrtd.PassportService
import org.jmrtd.lds.CardAccessFile
import org.jmrtd.lds.PACEInfo
import org.jmrtd.lds.SODFile
import org.jmrtd.lds.icao.DG1File
import org.jmrtd.lds.icao.DG2File
import java.io.ByteArrayInputStream
import java.security.MessageDigest
import java.security.cert.X509Certificate
import java.security.interfaces.ECPublicKey
import java.security.interfaces.RSAPublicKey
import java.util.Base64

/**
 * Reads a passport chip and checks it on the phone (passive authentication, ICAO 9303-11):
 * the data-group hashes against the security object (SOD), and the SOD signature against the
 * document signer certificate (DSC) it carries. Whether the DSC was issued by a trusted
 * country signing CA is checked outside the phone by the public trust-list tool.
 *
 * Nothing is stored or sent. The report holds no name, document number or birth date.
 */
class ChipReader(private val isoDep: IsoDep, private val key: BACKey) {

    /** faceImage: the chip photo from DG2 (JPEG or JPEG 2000), kept in memory for the face check only.
     *  chip: the data the enrolment proof π_doc needs, kept in memory for the proof test only. */
    class Result(val report: String, val dscPem: String?, val ok: Boolean, val faceImage: ByteArray? = null, val faceMime: String? = null,
                 val chip: DocInput.Chip? = null, val onScreenOnly: String? = null)

    fun read(): Result {
        val r = StringBuilder()
        val t0 = System.currentTimeMillis()
        val service = PassportService(
            IsoDepCardService(isoDep),
            PassportService.NORMAL_MAX_TRANCEIVE_LENGTH,
            PassportService.DEFAULT_MAX_BLOCKSIZE,
            false, false,
        )
        service.open()

        // 1. Access control: PACE if the chip offers it, otherwise BAC.
        var access = "BAC"
        var paceOk = false
        try {
            val cardAccess = CardAccessFile(service.getInputStream(PassportService.EF_CARD_ACCESS, PassportService.DEFAULT_MAX_BLOCKSIZE))
            val pace = cardAccess.securityInfos.filterIsInstance<PACEInfo>().firstOrNull()
            if (pace != null) {
                service.doPACE(key, pace.objectIdentifier, PACEInfo.toParameterSpec(pace.parameterId), pace.parameterId)
                paceOk = true
                access = "PACE (" + pace.objectIdentifier + ")"
            }
        } catch (e: Exception) {
            access = "BAC (PACE not available: " + (e.message ?: e.javaClass.simpleName) + ")"
        }
        service.sendSelectApplet(paceOk)
        if (!paceOk) service.doBAC(key)
        val tAccess = System.currentTimeMillis()

        // 2. Read the files this proof needs.
        fun readFile(fid: Short): ByteArray = service.getInputStream(fid, PassportService.DEFAULT_MAX_BLOCKSIZE).readBytes()
        val dg1Bytes = readFile(PassportService.EF_DG1)
        val sodBytes = readFile(PassportService.EF_SOD)
        val dg2Bytes = readFile(PassportService.EF_DG2)
        // Diagnostic (Decision #43): does the chip carry a personal number outside the MRZ?
        // DG11 is its standard place; DG12 and DG13 are read too, as DG13 is free for national use.
        val extra = sortedMapOf<Int, ByteArray>()
        val sodPeek = SODFile(ByteArrayInputStream(sodBytes)).dataGroupHashes.keys
        for ((n, fid) in listOf(11 to PassportService.EF_DG11, 12 to PassportService.EF_DG12, 13 to PassportService.EF_DG13)) {
            if (n in sodPeek) try { extra[n] = readFile(fid) } catch (e: Exception) { }
        }
        val tRead = System.currentTimeMillis()
        service.close()

        val dg1 = DG1File(ByteArrayInputStream(dg1Bytes))
        val sod = SODFile(ByteArrayInputStream(sodBytes))
        val mrz = dg1.mrzInfo

        r.appendLine("Proof of One chip reader v0.1 (test)")
        r.appendLine("access: $access")
        r.appendLine("time: access ${tAccess - t0} ms, reading ${tRead - tAccess} ms")
        r.appendLine("document: type ${mrz.documentCode.trim()}, issuing state ${mrz.issuingState}, nationality ${mrz.nationality}")
        r.appendLine("sizes: DG1 ${dg1Bytes.size} B, DG2 ${dg2Bytes.size} B, SOD ${sodBytes.size} B")

        // 3. Data-group hashes against the SOD.
        val hashes = sod.dataGroupHashes
        val md = MessageDigest.getInstance(sod.digestAlgorithm)
        val dg1Ok = hashes[1]?.contentEquals(md.digest(dg1Bytes)) == true
        val dg2Ok = hashes[2]?.contentEquals(md.digest(dg2Bytes)) == true
        r.appendLine("data-group hash algorithm: ${sod.digestAlgorithm}")
        r.appendLine("data groups in SOD: ${hashes.keys.sorted().joinToString(",")}" +
            (if (hashes.containsKey(14)) " (DG14: chip authentication)" else "") +
            (if (hashes.containsKey(15)) " (DG15: active authentication)" else ""))
        r.appendLine("DG1 hash matches SOD: ${yes(dg1Ok)}")
        r.appendLine("DG2 hash matches SOD: ${yes(dg2Ok)}")
        // Personal number outside the MRZ: only sizes and counts go into the report; the last
        // three digits of a number found are shown on this phone's screen only, for the holder
        // to compare with their own number.
        val screen = StringBuilder()
        for ((n, b) in extra) {
            val runs = Regex("(?<![0-9])[0-9]{10}(?![0-9])").findAll(String(b, Charsets.ISO_8859_1)).toList()
            val wide = Regex("(?<![0-9])[0-9]{10}(?![0-9])").findAll(String(b, Charsets.UTF_16BE)).count()
            r.appendLine("DG$n: ${b.size} B, hash matches SOD: ${yes(hashes[n]?.contentEquals(md.digest(b)) == true)}; " +
                "runs of exactly 10 digits: ${runs.size}" + (if (runs.isNotEmpty()) " (at byte ${runs.joinToString(", ") { it.range.first.toString() }})" else "") +
                (if (wide > 0) "; as UTF-16: $wide" else "") + "; tags: ${tags(b)}")
            runs.forEach { screen.appendLine("DG$n, byte ${it.range.first}: a 10-digit number ending in …${it.value.takeLast(3)}") }
            // Digits in other encodings, per field: only the field, the encoding and the count go
            // into the report; for a field holding exactly ten digits, the last three on screen only.
            for ((tag, v) in fields(b)) for ((enc, d) in digitsIn(v)) {
                r.appendLine("DG$n field %X: %d digits as %s (of %d bytes)".format(tag, d.length, enc, v.size))
                if (d.length == 10) screen.appendLine("DG$n field %X (%s): ten digits ending in …%s".format(tag, enc, d.takeLast(3)))
            }
        }
        if (extra.isEmpty()) r.appendLine("DG11, DG12, DG13: none on this chip")

        // 4. SOD signature under the DSC carried in the SOD.
        val dsc: X509Certificate? = sod.docSigningCertificate
        var sigOk = false
        var signedAttrLen = -1
        var sigAlg = "?"
        var chip: DocInput.Chip? = null
        try {
            val cms = CMSSignedData(stripTag(sodBytes))
            val signer = cms.signerInfos.signers.first()
            signedAttrLen = signer.encodedSignedAttributes?.size ?: -1
            sigAlg = signer.encryptionAlgOID
            sigOk = dsc != null && signer.verify(JcaSimpleSignerInfoVerifierBuilder().setProvider("BC").build(dsc))
            // The data the enrolment proof needs, exactly as signed (challenge 2).
            val pub = dsc?.publicKey
            val content = cms.signedContent?.content as? ByteArray
            val attrs = signer.encodedSignedAttributes
            if (sigOk && pub is RSAPublicKey && content != null && attrs != null) {
                val d13 = extra[13]?.takeIf { hashes[13]?.contentEquals(md.digest(it)) == true }
                chip = DocInput.Chip(dg1Bytes, content, attrs, signer.signature, pub.modulus, pub.publicExponent,
                    sod.digestAlgorithm, sod.signerInfoDigestAlgorithm, sigAlg, d13, dsc?.encoded)
            }
        } catch (e: Exception) {
            r.appendLine("signature check error: ${e.message ?: e.javaClass.simpleName}")
        }
        r.appendLine("SOD signature valid under the DSC: ${yes(sigOk)}")
        r.appendLine("signature algorithm OID: $sigAlg; signer digest: ${sod.signerInfoDigestAlgorithm}")
        r.appendLine("eContent ${sod.eContent.size} B, signed attributes $signedAttrLen B")
        // Whether the enrolment proof's circuits cover this document (challenge 2).
        r.appendLine("enrolment proof input: " + if (chip == null) "none (signature not valid, or not RSA)" else try {
            val b = DocInput.build(chip, java.time.LocalDate.now(java.time.ZoneOffset.UTC))
            "suite ${b.suite.id}; eContent ${b.eLen}/${DocInput.MAX_E} B and signed attributes ${b.saLen}/${DocInput.MAX_SA} B after padding: fits"
        } catch (e: IllegalArgumentException) { "does not fit: ${e.message}" })

        var pem: String? = null
        if (dsc != null) {
            val fp = MessageDigest.getInstance("SHA-256").digest(dsc.encoded).joinToString("") { "%02x".format(it) }
            r.appendLine("DSC subject: ${dsc.subjectX500Principal.name}")
            r.appendLine("DSC issuer: ${dsc.issuerX500Principal.name}")
            r.appendLine("DSC valid until: ${dsc.notAfter}")
            r.appendLine("DSC key: ${keyDesc(dsc)}")
            r.appendLine("DSC SHA-256: $fp")
            pem = "-----BEGIN CERTIFICATE-----\n" +
                Base64.getMimeEncoder(64, "\n".toByteArray()).encodeToString(dsc.encoded) +
                "\n-----END CERTIFICATE-----"
        }
        r.appendLine("not checked on the phone: DSC issued by a trusted CSCA (checked by the public trust-list tool)")
        val ok = dg1Ok && dg2Ok && sigOk
        r.appendLine("RESULT: " + if (ok) "chip data genuine under its DSC" else "CHECK FAILED")
        // The chip photo, for the on-phone face check only (never stored or sent).
        var face: ByteArray? = null; var mime: String? = null
        try {
            val img = DG2File(ByteArrayInputStream(dg2Bytes)).faceInfos.firstOrNull()?.faceImageInfos?.firstOrNull()
            if (img != null) {
                face = img.imageInputStream.readBytes(); mime = img.mimeType
                r.appendLine("chip photo: ${img.mimeType}, ${img.width}×${img.height}, ${face.size} B")
            }
        } catch (e: Exception) { r.appendLine("chip photo: could not be read (${e.javaClass.simpleName})") }
        return Result(r.toString(), pem, ok, face, mime, if (ok) chip else null,
            screen.toString().ifEmpty { null }?.let { "On this screen only, not in the shared report:\n$it" })
    }

    private fun yes(b: Boolean) = if (b) "yes" else "NO"

    /** The inner fields (tag, value) of a data group's outer template. */
    private fun fields(b: ByteArray): List<Pair<Int, ByteArray>> = try {
        val out = mutableListOf<Pair<Int, ByteArray>>()
        fun tagAt(i: Int): Pair<Int, Int> { var j = i; var t = b[j++].toInt() and 0xff
            if (t and 0x1f == 0x1f) { do { t = (t shl 8) or (b[j].toInt() and 0xff) } while (b[j++].toInt() and 0x80 != 0) }
            return t to (j - i) }
        fun lenAt(i: Int): Pair<Int, Int> { val f = b[i].toInt() and 0xff; if (f < 0x80) return f to 1
            var n = 0; for (k in 1..(f and 0x7f)) n = (n shl 8) or (b[i + k].toInt() and 0xff); return n to 1 + (f and 0x7f) }
        val (_, ot) = tagAt(0); val (olen, ol) = lenAt(ot)
        var i = ot + ol; val end = minOf(b.size, i + olen)
        while (i < end && out.size < 40) {
            val (t, tl) = tagAt(i); val (l, ll) = lenAt(i + tl)
            val s0 = i + tl + ll; out += t to b.copyOfRange(s0, minOf(end, s0 + l)); i = s0 + l
        }
        out
    } catch (e: Exception) { emptyList() }

    /**
     * Decimal digits in a field, by encoding: ASCII; raw bytes 0–9; packed BCD; Arabic-Indic or
     * Extended Arabic-Indic (Persian) digits in UTF-8 or UTF-16. Only encodings that give digits
     * are listed, each with the digits in order.
     */
    private fun digitsIn(v: ByteArray): List<Pair<String, String>> {
        val u = v.map { it.toInt() and 0xff }
        val out = mutableListOf<Pair<String, String>>()
        u.filter { it in 0x30..0x39 }.joinToString("") { (it - 0x30).toString() }.takeIf { it.isNotEmpty() }?.let { out += "ASCII" to it }
        if (u.isNotEmpty() && u.all { it in 0..9 }) out += "raw bytes 0-9" to u.joinToString("")
        if (u.isNotEmpty() && u.all { (it shr 4) <= 9 && (it and 15) <= 9 }) out += "packed BCD" to u.joinToString("") { "${it shr 4}${it and 15}" }
        val sb = StringBuilder(); var i = 0
        while (i + 1 < u.size) { val (a, b2) = u[i] to u[i + 1]
            when { a == 0xD9 && b2 in 0xA0..0xA9 -> { sb.append(b2 - 0xA0); i += 2 }
                   a == 0xDB && b2 in 0xB0..0xB9 -> { sb.append(b2 - 0xB0); i += 2 }
                   else -> i++ } }
        if (sb.isNotEmpty()) out += "Arabic/Persian digits, UTF-8" to sb.toString()
        val sw = StringBuilder(); i = 0
        while (i + 1 < u.size) { val (a, b2) = u[i] to u[i + 1]
            if (a == 0x06 && (b2 in 0x60..0x69 || b2 in 0xF0..0xF9)) sw.append(b2 and 15)
            i += 2 }
        if (sw.isNotEmpty()) out += "Arabic/Persian digits, UTF-16" to sw.toString()
        return out
    }

    /** The tags and lengths inside a data group's outer template (structure only, no values). */
    private fun tags(b: ByteArray): String = try {
        fun tagAt(i: Int): Pair<Int, Int> { // tag, its length in bytes
            var j = i; var t = b[j++].toInt() and 0xff
            if (t and 0x1f == 0x1f) { do { t = (t shl 8) or (b[j].toInt() and 0xff) } while (b[j++].toInt() and 0x80 != 0) }
            return t to (j - i)
        }
        fun lenAt(i: Int): Pair<Int, Int> { // value length, length of the length field
            val f = b[i].toInt() and 0xff
            if (f < 0x80) return f to 1
            var n = 0; for (k in 1..(f and 0x7f)) n = (n shl 8) or (b[i + k].toInt() and 0xff)
            return n to 1 + (f and 0x7f)
        }
        val (_, ot) = tagAt(0); val (olen, ol) = lenAt(ot)
        var i = ot + ol; val end = minOf(b.size, i + olen); val out = mutableListOf<String>()
        while (i < end && out.size < 30) {
            val (t, tl) = tagAt(i); val (l, ll) = lenAt(i + tl)
            out += "%X(%d)".format(t, l); i += tl + ll + l
        }
        out.joinToString(" ")
    } catch (e: Exception) { "unreadable" }

    private fun keyDesc(c: X509Certificate): String = when (val k = c.publicKey) {
        is RSAPublicKey -> "RSA-${k.modulus.bitLength()} e=${k.publicExponent}"
        is ECPublicKey -> "EC-${k.params.curve.field.fieldSize} (${c.sigAlgName})"
        else -> k.algorithm
    }

    /** The SOD is wrapped in an application tag (0x77); the CMS ContentInfo is its value. */
    private fun stripTag(b: ByteArray): ByteArray {
        require(b[0] == 0x77.toByte()) { "SOD does not start with tag 77" }
        var i = 1
        val first = b[i++].toInt() and 0xff
        val len = if (first < 0x80) first else {
            var n = 0
            repeat(first and 0x7f) { n = (n shl 8) or (b[i++].toInt() and 0xff) }
            n
        }
        return b.copyOfRange(i, i + len)
    }
}
