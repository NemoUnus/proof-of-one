// SPDX-License-Identifier: Apache-2.0
// Proof of One — the client of the pilot's enrolment service
// (reference/enrol-service; docs/specs/pilot-enrolment-service-v0.1.md). Plain HTTPS with
// JSON; the only server the app talks to. Nothing personal is sent: the signer's
// certificate (public), the issuing state, blinded points, π_doc and its public signals.
package io.github.nemounus.proofofone.reader

import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URL

class EnrolService(private val base: String = BASE) {
    companion object { const val BASE = "https://proof-of-one-enrol.nemounus.workers.dev" }

    /** A refusal or failure, with the service's own message where it gave one. */
    class Failure(val status: Int, message: String, val body: JSONObject? = null) : Exception(message)

    private fun call(method: String, path: String, body: JSONObject? = null): JSONObject {
        val c = (URL(base + path).openConnection() as HttpURLConnection).apply {
            requestMethod = method; connectTimeout = 20000; readTimeout = 60000; useCaches = false
            setRequestProperty("accept", "application/json")
            if (body != null) { doOutput = true; setRequestProperty("content-type", "application/json") }
        }
        try {
            if (body != null) c.outputStream.use { it.write(body.toString().toByteArray()) }
            val code = c.responseCode
            val text = (if (code in 200..299) c.inputStream else c.errorStream)?.bufferedReader()?.use { it.readText() } ?: ""
            val j = try { JSONObject(text) } catch (e: Exception) { throw Failure(code, "unexpected answer (HTTP $code)") }
            if (code !in 200..299) throw Failure(code, j.optString("error", "HTTP $code"), j)
            return j
        } finally { c.disconnect() }
    }

    fun info() = call("GET", "/info")
    fun session(issuer: String) = call("POST", "/session", JSONObject().put("issuer", issuer))
    fun signer(dscBase64: String, suite: Int) = call("POST", "/signer", JSONObject().put("dsc", dscBase64).put("suite", suite))
    fun path(leaf: String) = call("GET", "/path?leaf=$leaf")
    fun evaluate(session: String, pB: Any, dB: Any) = call("POST", "/evaluate", JSONObject().put("session", session).put("pB", pB).put("dB", dB))
    /** On the relay (Decision #61): a registration on the identity registry. */
    fun register(body: JSONObject) = call("POST", "/register", body)
    /** On the relay: its configuration (the polls it accepts, the identity registry). */
    fun status() = call("GET", "/")
    /** On the relay (v0.15): the texts of the polls it accepts; checked against the chain by the app. */
    fun polls() = call("GET", "/polls")
    /** On the relay (Decision #62): the registries, the poll and its text, and the ballot recorded for nf. */
    fun state(pollId: String, nf: String?) = call("GET", "/state?poll=$pollId" + (nf?.let { "&nf=$it" } ?: ""))
    /** On the relay: a ballot. */
    fun vote(body: JSONObject) = call("POST", "/", body)
    fun backup(session: String, blob: String) = call("POST", "/backup", JSONObject().put("session", session).put("backup", blob))
    fun enrol(session: String, proof: JSONObject, publicSignals: Any) =
        call("POST", "/enrol", JSONObject().put("session", session).put("proof", proof).put("publicSignals", publicSignals))
}
