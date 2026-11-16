// SPDX-License-Identifier: Apache-2.0
// Checks the phone's π_doc input builder (app/.../DocInput.kt) against the reference in
// JavaScript (reference/document-circuit/src/document.js) on synthetic passports:
//   (cd ../document-circuit && node scripts/doc-input-vectors.js /tmp/vectors)
//   kotlinc test/DocInputCheck.kt app/src/main/java/io/github/nemounus/proofofone/reader/DocInput.kt -include-runtime -d /tmp/check.jar
//   java -cp /tmp/check.jar DocInputCheckKt /tmp/vectors
// Each built input must equal the reference byte for byte.
import io.github.nemounus.proofofone.reader.DocInput
import java.io.File
import java.math.BigInteger
import java.time.LocalDate
import kotlin.system.exitProcess

fun main(args: Array<String>) {
    val dir = File(args.getOrElse(0) { "vectors" })
    var bad = 0
    val files = dir.listFiles { f -> f.name.endsWith(".chip") }!!.sortedBy { it.name }
    for (f in files) {
        val kv = f.readLines().filter { it.contains('=') }.associate { it.substringBefore('=') to it.substringAfter('=') }
        fun hex(k: String) = kv.getValue(k).chunked(2).map { it.toInt(16).toByte() }.toByteArray()
        val chip = DocInput.Chip(hex("dg1"), hex("eContent"), hex("signedAttrs"), hex("signature"),
            BigInteger(kv.getValue("modulus"), 16), BigInteger(kv.getValue("exponent"), 16),
            kv.getValue("ldsHash"), kv.getValue("sigHash"), kv.getValue("sigOid"))
        val built = DocInput.build(chip, LocalDate.parse(kv.getValue("today")))
        val want = File(dir, f.name.removeSuffix(".chip") + ".json").readText()
        val ok = built.json == want
        if (!ok) bad++
        println("${f.name}: suite ${built.suite.id}, eContent ${built.eLen} B padded, signed attributes ${built.saLen} B padded: " + if (ok) "identical" else "DIFFERENT")
    }
    // Documents the circuits do not cover are refused with a reason.
    val k = files.first { it.name.startsWith("s2") }
    val kv = k.readLines().filter { it.contains('=') }.associate { it.substringBefore('=') to it.substringAfter('=') }
    fun hex(x: String) = kv.getValue(x).chunked(2).map { it.toInt(16).toByte() }.toByteArray()
    val even = DocInput.Chip(hex("dg1"), hex("eContent"), hex("signedAttrs"), hex("signature"), BigInteger(kv.getValue("modulus"), 16),
        BigInteger.valueOf(65536), "SHA-1", "SHA-1", "1.2.840.113549.1.1.1")
    val pss = DocInput.Chip(even.dg1, even.eContent, even.signedAttrs, even.signature, even.modulus, BigInteger.valueOf(65537), "SHA-1", "SHA-1", "1.2.840.113549.1.1.10")
    for ((name, c) in listOf("even exponent" to even, "RSA-PSS" to pss)) {
        val refused = try { DocInput.build(c, LocalDate.of(2026, 11, 16)); false } catch (e: IllegalArgumentException) { println("$name: refused (${e.message})"); true }
        if (!refused) { bad++; println("$name: NOT refused") }
    }
    if (bad > 0) { println("$bad problem(s)"); exitProcess(1) }
    println("all identical")
}
