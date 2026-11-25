// SPDX-License-Identifier: Apache-2.0
// Proof of One — reading the contracts directly from the public test network (app v0.14).
//
// The independent review of deployment 5 (docs/review/) found that the app believed everything
// the relay said: a dishonest relay could hand the phone its own tally key and read every answer
// (A1), swap the options' labels (B1/F-02), pick an older identity root (A4/F-03), report a ballot
// as recorded when it was not (C1), or keep a member out of the registry (C2). From v0.14 the
// relay only carries the bulky public lists (the identity leaves and the revoked handles) and
// the poll's text; everything that decides what the phone encrypts, proves or shows is read
// here, from the contracts, through a public RPC endpoint, and the relay's lists are checked
// against it:
//   - the poll: tally key, opening and closing times, policy, metadataHash, state (getPoll),
//     and its context hash (contextHash);
//   - the newest identity root and the number of leaves (root, leafCount), and the
//     revocation root (root);
//   - the ballot recorded for the member's nullifier (ballots);
//   - a closed poll's published result: the four counts, which the contract accepted only
//     with a valid proof of the count (getResult; v0.15);
//   - after registration, the member's leaf at its position (getLeaves).
// The poll's text is accepted only if the Keccak-256 of its exact bytes equals metadataHash.
// The RPC endpoint sees the phone's network address and the nullifier it asks about, as the
// relay does; several endpoints and a censorship-resistant transport are for later
// (Decision #34). No library is needed: requests and answers are a few fixed-size words.
package io.github.nemounus.proofofone.reader

import java.math.BigInteger
import java.net.HttpURLConnection
import java.net.URL

class Chain(private val rpc: String = RPC, private val transport: ((String) -> String)? = null) {
    companion object {
        const val RPC = "https://sepolia.base.org"
        const val CHAIN_ID = 84532L
        /** The polls contract of deployment 6 (reference/testnet/web/plan8.json). */
        const val POLLS = "0x50Bd199Ff42FaBa4b4Bf5C545a84E91003D51F5F"

        fun selector(sig: String) = hex(Keccak.k256(sig.toByteArray(Charsets.UTF_8))).substring(0, 8)
        fun word(x: BigInteger) = x.toString(16).padStart(64, '0')
        fun word(x: Long) = word(BigInteger.valueOf(x))
        fun hex(b: ByteArray) = b.joinToString("") { "%02x".format(it) }
        fun words(h: String): List<String> { val s = h.removePrefix("0x"); return (0 until s.length / 64).map { s.substring(it * 64, it * 64 + 64) } }
        fun big(w: String) = BigInteger(w, 16)
        fun addr(w: String) = "0x" + w.substring(24)
    }

    class Poll(val pollId: BigInteger, val idRootAtCreation: BigInteger, val revRootAtCreation: BigInteger, val PK: Pair<BigInteger, BigInteger>,
               val maxBirthDay: Long, val minBirthDay: Long, val minExpiryMonth: Long, val requiredNat: Long, val maxRevotes: Int,
               val openTime: Long, val closeTime: Long, val metadataHash: String, val state: Int, val ctxHash: BigInteger)
    class Slot(val ballotHash: String, val count: Int)
    /** A published result: the count for each option, and when it was published (0: not yet). */
    class Result(val counts: List<BigInteger>, val publishedAt: Long)

    private var id = 0
    /** eth_call on the latest block; returns the result's hex digits. */
    fun call(to: String, data: String): String {
        val body = """{"jsonrpc":"2.0","id":${++id},"method":"eth_call","params":[{"to":"$to","data":"0x$data"},"latest"]}"""
        val out = transport?.invoke(body) ?: post(body)
        Regex("\"error\"\\s*:").find(out)?.let { throw java.io.IOException("the network refused the request: " + out.take(200)) }
        val m = Regex("\"result\"\\s*:\\s*\"0x([0-9a-fA-F]*)\"").find(out) ?: throw java.io.IOException("unexpected answer from the network")
        return m.groupValues[1].lowercase()
    }
    private fun post(body: String): String {
        val c = URL(rpc).openConnection() as HttpURLConnection
        c.requestMethod = "POST"; c.connectTimeout = 20000; c.readTimeout = 30000; c.doOutput = true
        c.setRequestProperty("Content-Type", "application/json")
        c.outputStream.use { it.write(body.toByteArray()) }
        val code = c.responseCode
        val text = (if (code in 200..299) c.inputStream else c.errorStream)?.bufferedReader()?.use { it.readText() } ?: ""
        if (code !in 200..299) throw java.io.IOException("network answered HTTP $code")
        return text
    }
    fun chainId(): Long {
        val body = """{"jsonrpc":"2.0","id":${++id},"method":"eth_chainId","params":[]}"""
        val out = transport?.invoke(body) ?: post(body)
        val m = Regex("\"result\"\\s*:\\s*\"0x([0-9a-fA-F]+)\"").find(out) ?: throw java.io.IOException("unexpected answer from the network")
        return m.groupValues[1].toLong(16)
    }

    fun poll(polls: String, pollId: BigInteger): Poll {
        val w = words(call(polls, selector("getPoll(uint256)") + word(pollId)))
        if (w.size < 20) throw java.io.IOException("unexpected poll record")
        val ctx = big(words(call(polls, selector("contextHash(uint256)") + word(pollId)))[0])
        return Poll(pollId, big(w[1]), big(w[2]), big(w[4]) to big(w[5]), big(w[6]).toLong(), big(w[7]).toLong(), big(w[8]).toLong(), big(w[9]).toLong(),
            big(w[10]).toInt(), big(w[11]).toLong(), big(w[12]).toLong(), w[13], big(w[19]).toInt(), ctx)
    }
    fun address(contract: String, fn: String) = addr(words(call(contract, selector("$fn()")))[0])
    fun uint(contract: String, fn: String) = big(words(call(contract, selector("$fn()")))[0])
    fun isHistoricalRoot(identity: String, root: BigInteger) = big(words(call(identity, selector("isHistoricalRoot(uint256)") + word(root)))[0]).signum() != 0
    fun leafAt(identity: String, index: Long): BigInteger? {
        // getLeaves(start, 1) returns a dynamic array: offset, length, element
        val w = words(call(identity, selector("getLeaves(uint256,uint256)") + word(index) + word(1)))
        return if (w.size >= 3 && big(w[1]) == BigInteger.ONE) big(w[2]) else null
    }
    /** The position of a leaf in the identity registry, searched from the newest, or null. */
    fun findLeaf(identity: String, leaf: BigInteger): Long? {
        val n = uint(identity, "leafCount").toLong()
        var end = n
        while (end > 0) {
            val start = maxOf(0L, end - 100)
            val w = words(call(identity, selector("getLeaves(uint256,uint256)") + word(start) + word(end - start)))
            val len = big(w[1]).toInt()
            for (i in len - 1 downTo 0) if (big(w[2 + i]) == leaf) return start + i
            end = start
        }
        return null
    }
    fun ballot(polls: String, pollId: BigInteger, nf: BigInteger): Slot {
        val w = words(call(polls, selector("ballots(uint256,uint256)") + word(pollId) + word(nf)))
        return Slot(w[0].substring(0, 56), big(w[1]).toInt())
    }
    /**
     * getResult returns a static struct of 16 words: counts[4], finalBallotChain, transcriptHash,
     * archiveHash, D[4][2] (8 words), publishedAt. Only the counts and the time are used here.
     */
    fun result(polls: String, pollId: BigInteger): Result {
        val w = words(call(polls, selector("getResult(uint256)") + word(pollId)))
        if (w.size < 16) throw java.io.IOException("unexpected result record")
        return Result((0 until 4).map { big(w[it]) }, big(w[15]).toLong())
    }
}

/** Keccak-256 (the original padding, as Ethereum uses), for selectors and the poll's text hash. */
object Keccak {
    private val RC = longArrayOf(
        0x0000000000000001L, 0x0000000000008082L, -0x7fffffffffff7f76L, -0x7fffffff7fff8000L, 0x000000000000808bL, 0x0000000080000001L,
        -0x7fffffff7fff7f7fL, -0x7fffffffffff7ff7L, 0x000000000000008aL, 0x0000000000000088L, 0x0000000080008009L, 0x000000008000000aL,
        0x000000008000808bL, -0x7fffffffffffff75L, -0x7fffffffffff7f77L, -0x7fffffffffff7ffdL, -0x7fffffffffff7ffeL, -0x7fffffffffffff80L,
        0x000000000000800aL, -0x7fffffff7ffffff6L, -0x7fffffff7fff7f7fL, -0x7fffffffffff7f80L, 0x0000000080000001L, -0x7fffffff7fff7ff8L)
    private val ROT = intArrayOf(0, 1, 62, 28, 27, 36, 44, 6, 55, 20, 3, 10, 43, 25, 39, 41, 45, 15, 21, 8, 18, 2, 61, 56, 14)
    private fun f(a: LongArray) {
        val b = LongArray(25); val c = LongArray(5); val d = LongArray(5)
        for (round in 0 until 24) {
            for (x in 0 until 5) c[x] = a[x] xor a[x + 5] xor a[x + 10] xor a[x + 15] xor a[x + 20]
            for (x in 0 until 5) d[x] = c[(x + 4) % 5] xor java.lang.Long.rotateLeft(c[(x + 1) % 5], 1)
            for (i in 0 until 25) a[i] = a[i] xor d[i % 5]
            for (x in 0 until 5) for (y in 0 until 5) b[y + 5 * ((2 * x + 3 * y) % 5)] = java.lang.Long.rotateLeft(a[x + 5 * y], ROT[x + 5 * y])
            for (x in 0 until 5) for (y in 0 until 5) a[x + 5 * y] = b[x + 5 * y] xor (b[(x + 1) % 5 + 5 * y].inv() and b[(x + 2) % 5 + 5 * y])
            a[0] = a[0] xor RC[round]
        }
    }
    fun k256(msg: ByteArray): ByteArray {
        val rate = 136
        val padded = ByteArray(((msg.size / rate) + 1) * rate)
        System.arraycopy(msg, 0, padded, 0, msg.size)
        padded[msg.size] = (padded[msg.size].toInt() xor 0x01).toByte()
        padded[padded.size - 1] = (padded[padded.size - 1].toInt() xor 0x80).toByte()
        val a = LongArray(25)
        for (off in padded.indices step rate) {
            for (i in 0 until rate / 8) {
                var lane = 0L
                for (k in 0 until 8) lane = lane or ((padded[off + i * 8 + k].toLong() and 0xff) shl (8 * k))
                a[i] = a[i] xor lane
            }
            f(a)
        }
        val out = ByteArray(32)
        for (i in 0 until 32) out[i] = (a[i / 8] ushr (8 * (i % 8))).toByte()
        return out
    }
}
