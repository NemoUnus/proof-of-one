// SPDX-License-Identifier: Apache-2.0
// Runs Chain.kt (the app's direct reads of the contracts) on a computer against a local chain,
// so that the selectors and the decoding of each answer are checked against the contracts
// themselves. Used by reference/relay/test/pilot.test.mjs, which compares the output with
// what ethers reads. Usage: java -cp chaincheck.jar ChainCheckKt <rpc> <polls> <pollId> <nf> <leaf>
import io.github.nemounus.proofofone.reader.Chain
import io.github.nemounus.proofofone.reader.Keccak
import java.math.BigInteger

fun main(a: Array<String>) {
    val (rpc, polls, pollId, nf, leaf) = a
    val c = Chain(rpc)
    val p = c.poll(polls, BigInteger(pollId))
    val identity = c.address(polls, "identity"); val revocation = c.address(polls, "revocation")
    val slot = c.ballot(polls, BigInteger(pollId), BigInteger(nf))
    val root = c.uint(identity, "root")
    val out = linkedMapOf(
        "chainId" to c.chainId().toString(),
        "identity" to identity, "revocation" to revocation,
        "idRootAtCreation" to p.idRootAtCreation.toString(), "revRootAtCreation" to p.revRootAtCreation.toString(),
        "PKx" to p.PK.first.toString(), "PKy" to p.PK.second.toString(),
        "maxBirthDay" to p.maxBirthDay.toString(), "minBirthDay" to p.minBirthDay.toString(), "minExpiryMonth" to p.minExpiryMonth.toString(),
        "requiredNat" to p.requiredNat.toString(), "maxRevotes" to p.maxRevotes.toString(), "openTime" to p.openTime.toString(),
        "closeTime" to p.closeTime.toString(), "metadataHash" to p.metadataHash, "state" to p.state.toString(), "ctxHash" to p.ctxHash.toString(),
        "leafCount" to c.uint(identity, "leafCount").toString(), "idRoot" to root.toString(),
        "isHistoricalRoot" to c.isHistoricalRoot(identity, root).toString(), "isHistoricalRootBogus" to c.isHistoricalRoot(identity, BigInteger.valueOf(12345)).toString(),
        "revRoot" to c.uint(revocation, "root").toString(),
        "keySetRoot" to c.uint(identity, "keySetRoot").toString(),
        "leafIndex" to (c.findLeaf(identity, BigInteger(leaf))?.toString() ?: "null"),
        "leafAt0" to (c.leafAt(identity, 0)?.toString() ?: "null"),
        "ballotHash" to slot.ballotHash, "count" to slot.count.toString(),
        "keccakAbc" to Chain.hex(Keccak.k256("abc".toByteArray())),
    )
    println("{" + out.entries.joinToString(",") { "\"${it.key}\":\"${it.value}\"" } + "}")
}
