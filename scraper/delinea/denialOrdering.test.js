import assert from 'node:assert/strict'
import test from 'node:test'
import { createDelineaScraper } from './native.js'
import { createDelineaPublicReader } from './publicRead.js'
import { fixture, transport } from './native.fixtures.js'

const C = 'https://delinea.com/careers'
const F = 'https://api.ashbyhq.com/posting-api/job-board/delinea'
const CHALLENGE = '<title>Just a moment</title><p>Verify you are human</p>'

const syntheticHTTP = ({ status = 403, oversized = false, callbackFailure = false, brokenBody = false } = {}) => {
  const records = [fixture({ id: 'review-first' }), fixture({ id: 'review-denied' }), fixture({ id: 'review-after' })]
  const data = transport(records), calls = []
  const fetchImpl = async (url, options) => {
    calls.push(url)
    assert.equal(options.redirect, 'manual')
    assert.equal(options.credentials, 'omit')
    let body = url === F ? JSON.stringify(await data.fetchJson(url)) : await data.fetchText(url)
    const denied = url === records[1].feed.jobUrl
    if (denied) body = status === 200 ? CHALLENGE : 'Denied'
    const response = new Response(body, { status: denied ? status : 200, headers: {
      'content-type': url === F ? 'application/json' : 'text/html',
      'content-length': String(denied && oversized ? 2097153 : Buffer.byteLength(body)),
    } })
    Object.defineProperty(response, 'url', { value: url })
    if (denied && brokenBody) Object.defineProperty(response, 'body', { value: {
      getReader() { throw new Error('Synthetic denied body stream unavailable') },
    } })
    return response
  }
  return { records, calls, options: { fetchImpl, onNativeResponse: packet => {
    if (callbackFailure && packet.url === records[1].feed.jobUrl) throw new Error('Review capture sink unavailable')
  } } }
}

for (const [name, setup] of [
  ['HTTP403 with an advertised oversized body', { oversized: true }],
  ['HTTP403 with a failing capture callback', { callbackFailure: true }],
  ['HTTP200 challenge with a failing capture callback', { status: 200, callbackFailure: true }],
  ['HTTP403 with an unavailable body stream', { brokenBody: true }],
]) test(name + ' remains terminal before later native details and closing reads', async () => {
  const io = syntheticHTTP(setup)
  let failure
  try { await createDelineaScraper({ maxJobs: null }).run(io.options) } catch (error) { failure = error }
  const index = io.calls.indexOf(io.records[1].feed.jobUrl)
  assert.ok(index >= 0)
  assert.deepEqual(io.calls.slice(index + 1).filter(url => new URL(url).hostname === 'jobs.ashbyhq.com'), [])
  assert.equal(failure?.status, 403)
  assert.match(failure.message, /denied|challenge/i)
})

for (const status of [401, 403, 429]) test('HTTP' + status + ' survives an incomplete injected transport packet and latches its host', async () => {
  let calls = 0
  const reader = createDelineaPublicReader({ transport: async url => {
    calls++
    return { url, status, headers: {}, body: new Uint8Array(), bodyComplete: false }
  } })
  try {
    await assert.rejects(reader.readText(C), error => error.status === status)
    assert.deepEqual(reader.audit.deniedHosts, ['delinea.com'])
    await assert.rejects(reader.readText(C), error => error.status === status)
    assert.equal(calls, 1)
  } finally { reader.dispose() }
})

test('a known challenge in a bounded packet prefix remains terminal when its body exceeds the limit', async () => {
  let calls = 0
  const reader = createDelineaPublicReader({ transport: async url => {
    calls++
    return { url, status: 200, headers: { 'content-type': 'text/html' }, body: Buffer.from(CHALLENGE + 'x'.repeat(2097152)), bodyComplete: true }
  } })
  try {
    await assert.rejects(reader.readText(C), error => error.status === 403)
    assert.deepEqual(reader.audit.deniedHosts, ['delinea.com'])
    await assert.rejects(reader.readText(C), error => error.status === 403)
    assert.equal(calls, 1)
  } finally { reader.dispose() }
})

for (const status of [403, 200]) test('caller cancellation in capture telemetry takes exact precedence over HTTP' + status + ' denial', async () => {
  const controller = new AbortController(), reason = { callerCancelledDuringCapture: status }
  const reader = createDelineaPublicReader({ signal: controller.signal, transport: async url => ({
    url, status, headers: { 'content-type': 'text/html' }, body: Buffer.from(status === 200 ? CHALLENGE : 'Denied'), bodyComplete: true,
  }), onNativeResponse() { controller.abort(reason); throw new Error('Review capture sink unavailable') } })
  try {
    await assert.rejects(reader.readText(C), error => error === reason)
    assert.deepEqual(reader.audit.deniedHosts, ['delinea.com'])
  } finally { reader.dispose() }
})
