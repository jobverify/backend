import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createHash } from 'node:crypto'
import { setImmediate as immediate } from 'node:timers/promises'
import { createPublicIO } from '../native-sources/publicIO.js'
import { createCommvaultClumioScraper } from '../native-sources/commvaultClumio/nativeCareers.js'
import { createPublicWorkableSource, PUBLIC_WORKABLE_PROFILES } from '../native-sources/publicWorkableSources/nativeCareers.js'

// Only the external HTTP boundary is replaced. Response, ReadableStream, the
// default body readers and both source factories are real. No employer records
// or native inventory fixtures are manufactured by these transport tests.
const cases = [
  { name: 'shared publicIO fallback', url: 'https://synthetic-public-io.invalid/careers',
    accept: 'text/html,application/json,application/rss+xml,*/*;q=0.5', shared: true },
  { name: 'Commvault/Clumio default factory', url: 'https://www.commvault.com/careers/jobs',
    accept: 'text/html,application/json,*/*;q=0.5', factory: () => createCommvaultClumioScraper() },
  { name: 'public Workable default factory', url: 'https://huggingface.co/',
    accept: 'text/html,application/json,text/markdown,*/*;q=0.5',
    factory: () => createPublicWorkableSource(PUBLIC_WORKABLE_PROFILES.find(row => row.source === 'huggingface')) },
]
const responseAt = (url, body, init = {}) => {
  const response = new Response(body, { status: 200, headers: { 'content-type': 'text/plain; charset=utf-8' }, ...init })
  Object.defineProperty(response, 'url', { value: url })
  return response
}
const withDefaultFetch = async (fetchImpl, work) => {
  const original = globalThis.fetch
  globalThis.fetch = fetchImpl
  try { return await work() } finally { globalThis.fetch = original }
}
const invoke = (entry, fetchImpl, signal) => entry.shared
  ? withDefaultFetch(fetchImpl, () => createPublicIO({ signal, allowed: url => url.href === entry.url }).load(entry.url))
  : entry.factory().run({ fetchImpl, signal })
const assertRequest = (entry, url, options, first) => {
  if (first) assert.equal(url, entry.url)
  assert.equal(options.method, 'GET')
  assert.equal(options.redirect, 'manual')
  assert.equal(options.headers.Accept, entry.accept)
  assert.ok(options.signal instanceof AbortSignal)
}

for (const entry of cases) {
  test(`${entry.name} stops an oversized body before EOF and releases it`, { concurrency: false, timeout: 5000 }, async () => {
    const controller = new AbortController(), stop = Symbol('stop-after-one-synthetic-entity')
    const size = 20 * 1024 * 1024
    let calls = 0, pulled = 0, eof = false, cancellations = 0, wholeBodyReads = 0, body
    const fetchImpl = async (url, options) => {
      assertRequest(entry, url, options, calls === 0)
      if (++calls === 2) { controller.abort(stop); throw stop }
      assert.equal(calls, 1)
      body = new ReadableStream({
        pull(stream) {
          if (pulled === size) { eof = true; stream.close(); return }
          const bytes = new Uint8Array(1024 * 1024).fill(97)
          pulled += bytes.byteLength; stream.enqueue(bytes)
        },
        cancel() { cancellations++ },
      })
      const response = responseAt(url, body), original = response.arrayBuffer.bind(response)
      response.arrayBuffer = () => { wholeBodyReads++; return original() }
      return response
    }
    if (entry.shared) {
      const page = await invoke(entry, fetchImpl, controller.signal)
      assert.equal(page.usable, false)
      assert.match(page.error.message, /exceeds input limit/)
    } else await assert.rejects(invoke(entry, fetchImpl, controller.signal), error => error === stop)
    // Returning to full aggregation makes these assertions fail on real streams.
    assert.equal(eof, false)
    assert.ok(pulled < size, `Consumed all ${pulled} bytes before rejecting`)
    assert.equal(wholeBodyReads, 0)
    assert.equal(cancellations, 1)
    assert.equal(body.locked, false)
  })

  test(`${entry.name} settles caller abort while the body and cancellation never settle`, { concurrency: false, timeout: 5000 }, async () => {
    const controller = new AbortController(), reason = entry.shared ? Symbol('caller-abort') : null
    let started
    const consuming = new Promise(resolve => { started = resolve })
    let bodyController, body, cancellations = 0, settled = false, terminalReason
    const fetchImpl = async (url, options) => {
      assertRequest(entry, url, options, true)
      body = new ReadableStream({
        start(stream) { bodyController = stream },
        pull() { return new Promise(() => {}) },
        cancel() { cancellations++; return new Promise(() => {}) },
      })
      const response = responseAt(url, body)
      const arrayBuffer = response.arrayBuffer.bind(response), getReader = body.getReader.bind(body)
      response.arrayBuffer = () => { started(); return arrayBuffer() }
      body.getReader = () => {
        const reader = getReader(), read = reader.read.bind(reader)
        reader.read = () => { started(); return read() }
        return reader
      }
      return response
    }
    const running = invoke(entry, fetchImpl, controller.signal).then(
      () => { settled = true; terminalReason = 'unexpected-success' },
      error => { settled = true; terminalReason = error },
    )
    await consuming
    controller.abort(reason)
    await immediate()
    try {
      assert.equal(settled, true, 'An uncooperative body must not hold the caller after cancellation')
      assert.equal(terminalReason, reason)
      assert.equal(cancellations, 1)
      assert.equal(body.locked, false)
    } finally {
      // Let the old unbounded RED implementation finish without leaking a test.
      bodyController.error(new Error('synthetic test cleanup'))
      await running
    }
  })
}

test('shared default reader preserves the exact16MiB multibyte original entity and provenance', { concurrency: false }, async () => {
  const text = 'é'.repeat(8 * 1024 * 1024), bytes = Buffer.from(text)
  const url = 'https://synthetic-public-io.invalid/exact-boundary'
  await withDefaultFetch(async (requested, options) => {
    assert.equal(requested, url)
    assert.equal(options.headers.Accept, cases[0].accept)
    return responseAt(url, bytes)
  }, async () => {
    const io = createPublicIO({ allowed: parsed => parsed.href === url }), page = await io.load(url)
    assert.equal(page.usable, true)
    assert.equal(page.transportQualified, true)
    assert.equal(page.status, 200)
    assert.equal(page.finalURL, url)
    assert.equal(page.bytes, 16777216)
    assert.equal(page.originalText, text)
    assert.deepEqual(Buffer.from(page.bodyBase64, 'base64'), bytes)
    assert.equal(page.bodySHA256, createHash('sha256').update(bytes).digest('hex'))
  })
})

test('shared default reader retains public URL admission, cached reads and explicit fresh reads', { concurrency: false }, async () => {
  const url = 'https://synthetic-public-io.invalid/cache'
  let requests = 0
  await withDefaultFetch(async requested => {
    assert.equal(requested, url)
    return responseAt(url, 'entity' + ++requests)
  }, async () => {
    const io = createPublicIO({ allowed: parsed => parsed.href === url })
    assert.equal(await io.load('http://synthetic-public-io.invalid/cache'), null)
    assert.equal(await io.load('https://foreign.invalid/cache'), null)
    const first = await io.load(url + '#ignored'), cached = await io.load(url)
    assert.equal(first.originalText, 'entity1')
    assert.equal(cached.originalText, 'entity1')
    assert.equal((await io.load(url, { fresh: true })).originalText, 'entity2')
    assert.equal((await io.load(url)).originalText, 'entity1')
    assert.equal(requests, 2)
    assert.equal(io.rawPages.length, 2)
  })
})

test('shared default reader preserves explicit admitted redirect traversal', { concurrency: false }, async () => {
  const first = 'https://synthetic-public-io.invalid/start', next = 'https://synthetic-public-io.invalid/next'
  const requested = []
  await withDefaultFetch(async (url, options) => {
    assert.equal(options.redirect, 'manual')
    requested.push(url)
    if (url === first) return responseAt(url, 'redirect', { status: 302, headers: { location: '/next' } })
    assert.equal(url, next)
    return responseAt(url, 'original final entity')
  }, async () => {
    const io = createPublicIO({ allowed: parsed => [first, next].includes(parsed.href) })
    const page = await io.follow(first)
    assert.equal(page.originalText, 'original final entity')
    assert.equal(page.finalURL, next)
    assert.equal(page.transportQualified, true)
    assert.deepEqual(requested, [first, next])
  })
})

test('supplied original response transport and literal JSON decoding stay intact', { concurrency: false }, async () => {
  const url = 'https://synthetic-public-io.invalid/injected'
  const io = createPublicIO({ allowed: parsed => parsed.href === url,
    fetchPage: async requested => ({ url: requested, status: 200, headers: { 'content-type': 'application/json' },
      bodyBase64: Buffer.from('{"sample":"original"}').toString('base64') }) })
  const page = await io.load(url, { kind: 'json' })
  assert.equal(page.usable, true)
  assert.equal(page.transportQualified, true)
  const parsed = io.json(page)
  assert.equal(parsed.sample, 'original')
  assert.deepEqual(Object.keys(parsed), ['sample'])
})
