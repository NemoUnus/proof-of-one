// SPDX-License-Identifier: Apache-2.0
package io.github.nemounus.proofofone.reader

import android.nfc.TagLostException
import android.nfc.tech.IsoDep
import net.sf.scuba.smartcards.CardService
import net.sf.scuba.smartcards.CardServiceException
import net.sf.scuba.smartcards.CommandAPDU
import net.sf.scuba.smartcards.ResponseAPDU
import java.io.IOException

/** Connects JMRTD to the phone's NFC chip interface (ISO 14443-4, IsoDep). */
class IsoDepCardService(private val isoDep: IsoDep) : CardService() {

    override fun open() {
        if (isOpen()) return
        try {
            isoDep.connect()
            isoDep.timeout = 10_000
        } catch (e: IOException) {
            throw CardServiceException("could not connect to the chip: ${e.message}")
        }
    }

    override fun isOpen(): Boolean = isoDep.isConnected

    override fun transmit(command: CommandAPDU): ResponseAPDU {
        try {
            return ResponseAPDU(isoDep.transceive(command.bytes))
        } catch (e: IOException) {
            throw CardServiceException("chip connection lost: ${e.message}")
        }
    }

    override fun getATR(): ByteArray? = isoDep.historicalBytes ?: isoDep.hiLayerResponse

    override fun isExtendedAPDULengthSupported(): Boolean = isoDep.isExtendedLengthApduSupported

    override fun close() {
        try { isoDep.close() } catch (_: IOException) { }
    }

    override fun isConnectionLost(e: Exception?): Boolean =
        e is TagLostException || e?.cause is TagLostException || !isoDep.isConnected
}
