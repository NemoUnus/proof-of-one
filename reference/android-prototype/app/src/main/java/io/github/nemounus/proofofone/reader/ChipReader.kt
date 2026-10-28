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

    class Result(val report: String, val dscPem: String?, val ok: Boolean)

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

        // 4. SOD signature under the DSC carried in the SOD.
        val dsc: X509Certificate? = sod.docSigningCertificate
        var sigOk = false
        var signedAttrLen = -1
        var sigAlg = "?"
        try {
            val cms = CMSSignedData(stripTag(sodBytes))
            val signer = cms.signerInfos.signers.first()
            signedAttrLen = signer.encodedSignedAttributes?.size ?: -1
            sigAlg = signer.encryptionAlgOID
            sigOk = dsc != null && signer.verify(JcaSimpleSignerInfoVerifierBuilder().setProvider("BC").build(dsc))
        } catch (e: Exception) {
            r.appendLine("signature check error: ${e.message ?: e.javaClass.simpleName}")
        }
        r.appendLine("SOD signature valid under the DSC: ${yes(sigOk)}")
        r.appendLine("signature algorithm OID: $sigAlg; signer digest: ${sod.signerInfoDigestAlgorithm}")
        r.appendLine("eContent ${sod.eContent.size} B, signed attributes $signedAttrLen B")

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
        return Result(r.toString(), pem, ok)
    }

    private fun yes(b: Boolean) = if (b) "yes" else "NO"

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
