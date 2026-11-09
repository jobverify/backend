import fs from 'node:fs'
import assert from 'node:assert/strict'
import test from 'node:test'
import { gunzipSync } from 'node:zlib'
import { run } from './script.js'
import { readSourceObservationEvidence } from '../../scraper-support/utils/sourceObservationEvidence.js'

const packets = JSON.parse(gunzipSync(fs.readFileSync(new URL('./test-data/native-inputs-20261031.json.gz', import.meta.url)))).packets
const responseFor = (packet, overrides = {}) => {
  const response = new Response(overrides.body ?? packet.body, { status: overrides.status ?? packet.status, headers: { 'Content-Type': overrides.contentType ?? packet.headers['content-type'] } })
  Object.defineProperty(response, 'url', { value: overrides.finalUrl ?? packet.finalUrl })
  return response
}

test('default native transport traverses captured104 records with zero live HTTP and retained counts', async t => {
  const calls = []
  t.mock.method(globalThis, 'fetch', async (url, init) => {
    init.signal.throwIfAborted()
    calls.push(String(url))
    const address = new URL(url)
    const packet = packets.find(p => p.url === String(url)) || (address.pathname.endsWith('/postings') ? packets[Number(address.searchParams.get('offset')) === 100 ? 3 : 2] : null)
    assert.ok(packet, 'Uncaptured default request: ' + url)
    return responseFor(packet)
  })
  const jobs = await run()
  assert.equal(jobs.length, 0)
  assert.equal(calls.length, 6)
  assert.equal(readSourceObservationEvidence(jobs, 'etihadairways').observedRecordCount, 104)
})

for (const [name, overrides, message] of [
  ['changed response URL', { finalUrl: 'https://careers.etihad.com/other' }, /response.*URL|URL.*mismatch/i],
  ['non-HTML primary response', { contentType: 'application/json' }, /content.type|HTML/i],
  ['over-budget streaming body', { body: packets[0].body + ' '.repeat(2 * 1024 * 1024) }, /body.*(?:limit|ceiling|budget)/i],
]) test('default transport stops at ' + name + ' before a second native request', async t => {
  let calls = 0
  t.mock.method(globalThis, 'fetch', async () => {
    calls++
    if (calls !== 1) throw new Error('Unexpected second request')
    return responseFor(packets[0], overrides)
  })
  await assert.rejects(run(), message)
  assert.equal(calls, 1)
})

test('owned body deadline cancels a stalled native stream and preserves the exact frozen cause', async t => {
  const originalTimeout = AbortSignal.timeout.bind(AbortSignal), controller = new AbortController()
  const reason = Object.freeze(new DOMException('owned native body deadline', 'TimeoutError'))
  t.mock.method(AbortSignal, 'timeout', ms => ms === 15000 ? controller.signal : originalTimeout(ms))
  let streamController, cancelled = 0, timer
  t.mock.method(globalThis, 'fetch', async () => {
    const stream = new ReadableStream({ start(value) { streamController = value; timer = setTimeout(() => controller.abort(reason), 5) }, cancel() { cancelled++ } })
    return responseFor(packets[0], { body: stream })
  })
  const pending = run().then(value => ({ value }), error => ({ error }))
  let ceiling
  try {
    const settled = await Promise.race([pending, new Promise(resolve => { ceiling = setTimeout(() => resolve({ timedOut: true }), 100) })])
    assert.equal(settled.timedOut, undefined, 'Owned deadline must interrupt the body read')
    assert.equal(settled.error, reason)
    assert.equal(cancelled, 1)
  } finally {
    clearTimeout(timer)
    clearTimeout(ceiling)
    try { streamController.close() } catch { /* Already cancelled by the native boundary. */ }
    await pending
  }
})

test('caller cancellation during native request spacing retains the exact reason', async t => {
  const controller = new AbortController(), reason = Object.freeze(new Error('cancel while pacing'))
  let calls = 0, timer
  t.mock.method(globalThis, 'fetch', async () => {
    calls++
    timer = setTimeout(() => controller.abort(reason), 5)
    return responseFor(packets[0])
  })
  try { await assert.rejects(run({ signal: controller.signal }), error => error === reason) }
  finally { clearTimeout(timer) }
  assert.equal(calls, 1)
})
