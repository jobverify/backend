import assert from 'node:assert/strict'
import test from 'node:test'
import { createDelineaScraper } from './native.js'
import { createDelineaPublicReader } from './publicRead.js'
import { fixture, transport as fixtureTransport } from './native.fixtures.js'

const C = 'https://delinea.com/careers'
const B = 'https://jobs.ashbyhq.com/delinea'
const F = 'https://api.ashbyhq.com/posting-api/job-board/delinea'
const W = 'https://centrify.wd1.myworkdayjobs.com/en-US/External/'
const OUTAGE = 'https://www.myworkday.com/wday/drs/outage?t=centrify&s=external'
const fixedNow = () => '2026-11-01T02:48:17.523Z'

const fakeHttp = (records = [fixture()], { additional = false, change = response => response } = {}) => {
  const io = fixtureTransport(records), calls = [], responses = []
  let bodyReads = 0
  const response = (url, body, status = 200, headers = {}) => {
    const bytes = Buffer.from(body)
    const result = { url, status, ok: status >= 200 && status < 300,
      headers: new Headers({ 'content-type': url === F ? 'application/json' : 'text/html', 'content-length': String(bytes.length), ...headers }),
      body: { getReader() { bodyReads++; return new Response(bytes).body.getReader() } },
      text: async () => { bodyReads++; return body } }
    responses.push({ url, bytes: bytes.length })
    return change(result, body)
  }
  const fetchImpl = async (url, options = {}) => {
    calls.push({ url, redirect: options.redirect, credentials: options.credentials, method: options.method })
    if (url === W) {
      if (options.redirect === 'manual') return response(url, '', 302, { location: OUTAGE })
      // Match ordinary fetch's previous automatic cross-host redirect behavior.
      calls.push({ url: OUTAGE, automaticallyFollowed: true })
      return response(OUTAGE, '<title>Workday maintenance</title>')
    }
    if (additional && url === 'https://delinea.com/fr/careers') return response(url, `<a href="${W}">Apply Today</a>`)
    const body = url === F ? JSON.stringify(await io.fetchJson(url)) : await io.fetchText(url)
    return response(url, additional && url === C ? body + '<a href="https://delinea.com/fr/careers">French</a>' : body)
  }
  return { fetchImpl, calls, responses, bodyReads: () => bodyReads }
}
const execute = async (io, options = {}) => {
  const previous = globalThis.fetch
  globalThis.fetch = io.fetchImpl
  try { return await createDelineaScraper({ maxJobs: null, now: fixedNow }).run({ fetchImpl: io.fetchImpl, ...options }) }
  finally { globalThis.fetch = previous }
}

test('the registered HTTP path captures a current advertised outage redirect without following it', async () => {
  const io = fakeHttp([fixture()], { additional: true })
  const packets = []; let audit
  const jobs = await execute(io, { onNativeResponse: packet => packets.push(packet), onNativeAudit: value => { audit = value } })
  assert.equal(jobs.length, 1)
  assert.equal(io.calls.some(call => call.url === OUTAGE), false)
  assert.ok(io.calls.every(call => call.redirect === 'manual' && call.credentials === 'omit' && call.method === 'GET'))
  assert.ok(packets.some(packet => packet.url === W && packet.status === 302 && packet.headers.location === OUTAGE))
  assert.ok(packets.every(packet => packet.bodyComplete === true && packet.body instanceof Uint8Array && packet.requestedAt && packet.completedAt))
  assert.equal(audit.complete, false)
  assert.equal(audit.fullyHealthyCount, 1)
  assert.equal(jobs[0].sourceScopeComplete, false)
  assert.equal(jobs[0].lifecycleCleanupAllowed, false)
})

test('a successful body from a different response URL cannot establish Delinea identity', async () => {
  const io = fakeHttp([fixture()], { change: response => response.url === C ? { ...response, url: 'https://foreign.invalid/careers' } : response })
  await assert.rejects(execute(io), /response identity|manual response identity/i)
  assert.equal(io.calls.length, 1)
  assert.equal(io.bodyReads(), 0)
})

test('an advertised oversized response is rejected before its body is read', async () => {
  const io = fakeHttp([fixture()], { change: response => {
    if (response.url === C) response.headers.set('content-length', String(2 * 1024 * 1024 + 1))
    return response
  } })
  await assert.rejects(execute(io), /body limit|body bound/i)
  assert.equal(io.calls.length, 1)
  assert.equal(io.bodyReads(), 0)
})

test('compressed metadata cannot hide an oversized decoded response body', async () => {
  const io = fakeHttp([fixture()], { change: response => {
    if (response.url !== C) return response
    const body = '<h1>Delinea</h1>' + 'x'.repeat(2 * 1024 * 1024)
    response.headers.set('content-length', '1'); response.headers.set('content-encoding', 'gzip')
    response.body = { getReader: () => new Response(body).body.getReader() }
    response.text = async () => body + '<a href="https://jobs.ashbyhq.com/delinea">Apply Today</a>'
    return response
  } })
  await assert.rejects(execute(io), /2MiB|body limit|body bound/i)
  assert.equal(io.calls.length, 1)
})

test('caller cancellation stops before a transport that ignores AbortSignal can make a request', async () => {
  const io = fakeHttp(), controller = new AbortController()
  controller.abort(new Error('cancel-delinea-before-read'))
  await assert.rejects(execute(io, { signal: controller.signal }), /cancel-delinea-before-read/)
  assert.equal(io.calls.length, 0)
})

test('a 200 challenge on a native host stops subsequent details and closing requests', async () => {
  const records = [fixture(), fixture({ id: 'synthetic-second' })]
  const io = fakeHttp(records, { change: response => {
    if (response.url !== records[0].feed.jobUrl) return response
    const body = '<title>Just a moment</title><p>Verify you are human</p>'
    response.headers.set('content-length', String(Buffer.byteLength(body)))
    response.body = new Response(body).body
    response.text = async () => body
    return response
  } })
  await assert.rejects(execute(io), /deni|challenge|human/i)
  assert.equal(io.calls.at(-1).url, records[0].feed.jobUrl)
  assert.equal(io.calls.filter(call => call.url === B).length, 1)
  assert.equal(io.calls.some(call => call.url === records[1].feed.jobUrl), false)
})

test('the 96-GET cohort cap retains confirmed India rows and prevents more network reads', async () => {
  const records = Array.from({ length: 98 }, (_, index) => fixture({ id: 'synthetic-india-' + index }))
  const io = fakeHttp(records); let audit
  const jobs = await execute(io, { onNativeAudit: value => { audit = value } })
  assert.ok(io.calls.length <= 96)
  assert.ok(jobs.length > 0 && jobs.length < 98)
  assert.equal(audit.complete, false)
  assert.match(audit.issues.join('; '), /budget|limit/i)
  assert.ok(jobs.every(job => job.sourceListingComplete === false && job.sourceScopeComplete === false && job.lifecycleCleanupAllowed === false))
})

test('the decoded cohort cap reserves the next response before reading beyond 48MiB', async () => {
  const body = Buffer.alloc(2 * 1024 * 1024, 'x'); let requests = 0
  const reader = createDelineaPublicReader({ transport: async url => {
    requests++
    return { url, status: 200, headers: { 'content-type': 'text/html' }, body, bodyComplete: true,
      requestedAt: fixedNow(), completedAt: fixedNow() }
  } })
  try {
    for (let index = 0; index < 24; index++) await reader.readText(C)
    await assert.rejects(reader.readText(C), /48MiB|decoded.*budget/i)
    assert.equal(requests, 24)
    assert.equal(reader.audit.decodedBytes, 48 * 1024 * 1024)
    await assert.rejects(reader.readText(C), /limit|budget/i)
    assert.equal(requests, 24)
  } finally { reader.dispose() }
})

test('the cohort deadline cancels a pending body and releases its reader', async () => {
  const originalSetTimeout = globalThis.setTimeout
  let expire, cancelled = false
  globalThis.setTimeout = (callback, delay, ...args) => {
    if (delay === 180000) expire = callback
    return originalSetTimeout(callback, delay, ...args)
  }
  const io = fakeHttp([fixture()], { change: response => {
    if (response.url !== C) return response
    response.headers.delete('content-length')
    response.body = { getReader() {
      assert.equal(typeof expire, 'function')
      queueMicrotask(expire)
      return new ReadableStream({ cancel() { cancelled = true } }).getReader()
    } }
    return response
  } })
  try {
    await assert.rejects(execute(io), /cohort limit/i)
    assert.equal(cancelled, true)
    assert.equal(io.calls.length, 1)
  } finally { globalThis.setTimeout = originalSetTimeout }
})
