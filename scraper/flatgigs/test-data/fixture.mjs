import fs from 'node:fs'
import assert from 'node:assert/strict'
import { gunzipSync } from 'node:zlib'
import { createHash } from 'node:crypto'
export const fixture = JSON.parse(gunzipSync(fs.readFileSync(new URL('./current-native-20261031.json.gz', import.meta.url))))
export const packets = fixture.packets.map(packet => {
  const bytes = Buffer.from(packet.rawBodyBase64, 'base64')
  assert.equal(bytes.length, packet.metadata.bytes)
  assert.equal(createHash('sha256').update(bytes).digest('hex'), packet.metadata.sha256)
  return { ...packet.metadata, body: bytes.toString('utf8') }
})
export const [primary, redirect, client, titles, details] = packets
const data = packet => JSON.parse(packet.body.slice(packet.body.indexOf('{'), packet.body.lastIndexOf('}') + 1))
export const titleData = data(titles), detailData = data(details)
export const clone = value => structuredClone(value)
export const jsonp = value => 'whrcallback(' + JSON.stringify(value) + ');'
export const changedPacket = (packet, body) => ({ ...packet, body, bytes: Buffer.byteLength(body), sha256: createHash('sha256').update(body).digest('hex') })
export const fixtureReader = (changes = {}, sequence = packets) => {
  const seen = []
  const read = async (url, options = {}) => {
    options.signal?.throwIfAborted()
    seen.push({ url, method: options.method || 'GET' })
    const replacement = changes[url]
    if (replacement instanceof Error) throw replacement
    const recorded = sequence[seen.length - 1]
    if (!recorded) throw Object.assign(new Error('No retained response for native request ' + seen.length), { code: 'CONTROLLED_MISSING_RETAINED_RESPONSE' })
    assert.equal(recorded.url, url, 'Native request order/URL changed')
    const packet = replacement || recorded
    return clone(packet)
  }
  return { read, seen }
}
