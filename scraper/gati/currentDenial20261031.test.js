import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { gunzipSync } from 'node:zlib'
import { run } from './script.js'

const packets = JSON.parse(gunzipSync(readFileSync(new URL('./test-inputs/native-denial-20261031.json.gz', import.meta.url))))
const replay = (change = packet => packet) => {
  const calls = [], counts = new Map()
  return { calls, fetchImpl: async (url, init) => {
    calls.push({ url, method: init.method })
    const index = counts.get(url) || 0
    counts.set(url, index + 1)
    const captured = packets.filter(packet => packet.url === url)[index]
    assert.ok(captured, 'Unexpected current Gati request: ' + url)
    const packet = change(structuredClone(captured)), headers = new Headers({ 'content-type': packet.contentType })
    if (packet.location) headers.set('location', packet.location)
    if (url.endsWith('/careers/allJobs')) headers.set('set-cookie', 'PHPSESSID=public-fixture-session; Path=/; Secure')
    const response = new Response(packet.body || '', { status: packet.status, headers })
    Object.defineProperty(response, 'url', { value: packet.finalUrl })
    return response
  } }
}

test('the first Gati HTTP403 stops the source as an unavailable public API, with no empty-inventory claim', async () => {
  const options = replay()
  await assert.rejects(run(options), error => {
    assert.equal(error.softFailure, true)
    assert.equal(error.failureKind, 'blocked_or_access_denied')
    assert.equal(error.status, 403)
    assert.equal(error.abortRetries, true)
    assert.equal(error.inventoryEvidence.listingComplete, false)
    assert.equal(error.inventoryEvidence.reportedTotal, null)
    assert.equal(error.inventoryEvidence.indiaFacetCount, null)
    assert.equal(error.lifecycleCleanupAllowed, false)
    assert.equal(error.receipts.filter(receipt => receipt.status === 403).length, 1)
    assert.equal(error.receipts.some(receipt => receipt.recoveredByFreshSessionRetry === true), false)
    return true
  })
  assert.equal(options.calls.length, 8)
  assert.ok(options.calls.every(call => call.method === 'GET'))
  assert.equal(options.calls.some(call => call.url.includes('job?page=')), false)
})

test('an HTTP200 page with invalid native JSON MIME remains a hard contract failure', async () => {
  const options = replay(packet => packet.status === 403 ? { ...packet, status: 200 } : packet)
  await assert.rejects(run(options), error => {
    assert.match(error.message, /JSON content type changed/)
    assert.notEqual(error.softFailure, true)
    return true
  })
})
