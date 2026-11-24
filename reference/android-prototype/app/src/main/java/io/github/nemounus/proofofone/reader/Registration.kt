// SPDX-License-Identifier: Apache-2.0
// Proof of One — registration on the public ledger (Decisions #61 and #62). After enrolment the
// phone picks a random moment 1–10 minutes later; when it has passed (while the app is open,
// or the next time it is opened), the phone proves π_reg (reference/enrolment-circuit,
// circuits/registration.circom) from what it kept in member.json and sends only (leaf, cn,
// proof) through the relay to the identity registry, which inserts the membership into the
// identity tree at once: from then on the member can answer every open poll (#62, principle 1).
// The service that signed the credential cannot recognise leaf or cn. In the pilot the same
// operator runs the service and the relay; with a delay of minutes it can more easily link a
// person to their registry entry, never to their answers (#62).
package io.github.nemounus.proofofone.reader

import android.content.Context
import org.json.JSONArray
import org.json.JSONObject
import java.io.File
import java.security.SecureRandom
import java.time.LocalDate

object Registration {
    const val RELAY = "https://proof-of-one-relay.nemounus.workers.dev"
    private const val MINUTE = 60_000L
    /** member.json "version" from which credentials carry notBefore (Decision #62, app v0.12). */
    const val FORMAT = 3

    /** The moment after which the phone registers: now + 1 min + a uniform random part of 9 min. */
    fun pickTime(): Long = System.currentTimeMillis() + MINUTE + (SecureRandom().nextDouble() * 9 * MINUTE).toLong()

    sealed class State {
        object None : State()                                // no membership on this phone
        object Old : State()                                 // made before Decision #62: enrol again
        class Waiting(val after: Long) : State()
        class Done(val index: String?, val registry: String?) : State()
    }

    fun memberFile(ctx: Context) = File(ctx.filesDir, "member.json")

    fun state(ctx: Context): State {
        val f = memberFile(ctx); if (!f.exists()) return State.None
        val m = JSONObject(f.readText())
        if (m.optInt("version", 0) < FORMAT) return State.Old
        m.optJSONObject("registered")?.let { return State.Done(it.optString("index").ifEmpty { null }, it.optString("registry").ifEmpty { null }) }
        return State.Waiting(m.optLong("registerAfter", 0L))
    }

    @Synchronized
    private fun save(ctx: Context, m: JSONObject) {
        val tmp = File(ctx.filesDir, "member.json.part"); tmp.writeText(m.toString()); tmp.renameTo(memberFile(ctx))
    }

    /** The relay now names another identity registry (a new deployment): register there too. */
    fun registryChanged(ctx: Context) {
        val f = memberFile(ctx); if (!f.exists()) return
        val m = JSONObject(f.readText())
        m.remove("registered"); save(ctx, m.put("registerAfter", 0L))
    }

    class NotReady(message: String) : Exception(message)

    /**
     * Registers now. Returns a line for the shared result. Throws NotReady when the service has
     * not published its key set yet, EnrolService.Failure on a refusal, IOException offline.
     */
    @Synchronized
    fun run(ctx: Context): String {
        val m = JSONObject(memberFile(ctx).readText())
        if (m.has("registered")) return "already registered"
        val registry = EnrolService(RELAY).status().optString("registry").ifEmpty { throw NotReady("the relay accepts no registrations") }
        val keySet = EnrolService().info().optJSONObject("keySet") ?: throw NotReady("the key set is not published yet")
        val data = JSONObject().put("member", m.getJSONObject("member")).put("attrs", m.getJSONObject("attrs"))
            .put("credential", m.getJSONObject("credential")).put("keySet", keySet)
        val ri = JSONObject(NativeProver.regInput(data.toString()))
        if (ri.has("error")) error("registration input: " + ri.getString("error"))
        val graph = ctx.assets.open("registration.graph").use { it.readBytes() }
        val zkey = ctx.assets.open("registration_test.zkey").use { it.readBytes() }
        val t0 = System.nanoTime()
        val out = JSONObject(NativeProver.prove(graph, zkey, ri.getJSONObject("input").toString()))
        if (out.has("error")) error("π_reg: " + out.getString("error"))
        val ms = (System.nanoTime() - t0) / 1_000_000
        val pub = out.getJSONArray("public")
        val leaf = ri.getString("leaf"); val cn = ri.getString("cn")
        if (!out.optBoolean("verified") || pub.getString(0) != leaf || pub.getString(1) != cn || pub.getString(2) != keySet.getString("root"))
            error("π_reg did not verify on the phone")
        val p = out.getJSONObject("proof")
        val a = p.getJSONArray("pi_a"); val b = p.getJSONArray("pi_b"); val c = p.getJSONArray("pi_c")
        // the verifier contract takes G2 coordinates in the other order
        fun g2(i: Int) = JSONArray().put(b.getJSONArray(i).getString(1)).put(b.getJSONArray(i).getString(0))
        val body = JSONObject().put("leaf", leaf).put("cn", cn)
            .put("a", JSONArray().put(a.getString(0)).put(a.getString(1)))
            .put("b", JSONArray().put(g2(0)).put(g2(1)))
            .put("c", JSONArray().put(c.getString(0)).put(c.getString(1)))
        val r = try { EnrolService(RELAY).register(body) } catch (e: EnrolService.Failure) {
            if (e.body?.optBoolean("alreadyRegistered") == true) JSONObject().put("already", true) else throw e
        }
        val rec = JSONObject().put("leaf", leaf).put("day", LocalDate.now().toString()).put("registry", registry.lowercase())
            .put("tx", r.optString("tx")).put("index", r.optString("index"))
        save(ctx, m.put("registered", rec))
        return if (r.optBoolean("already")) "registration: this credential was already on the ledger (restored membership)"
        else "registration: π_reg made and verified on the phone in $ms ms; sent through the relay; position ${r.optString("index", "pending")}"
    }
}
