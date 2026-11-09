import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { setTimeout as delay } from 'node:timers/promises'
import { gunzipSync } from 'node:zlib'

import { createCatalogScraper, getScraperCatalog } from '../providers/index.js'
import { readInventoryEvidence } from '../utils/inventoryEvidence.js'

const capturedPage = JSON.parse(gunzipSync(readFileSync(
  new URL('../../scraper/quboleindia/fixtures.json.gz', import.meta.url),
))).response
const currentCareersPage = () => ({
  status: capturedPage.status,
  url: capturedPage.finalUrl,
  html: Buffer.from(capturedPage.bodyBase64, 'base64').toString('utf8'),
  fetchedAt: capturedPage.startedAt,
})

const settleWithin = async (operation) => {
  let timer
  try {
    return await Promise.race([
      operation,
      new Promise((_, reject) => { timer = setTimeout(() => reject(Error('test guard: read did not settle')), 400) }),
    ])
  } finally { clearTimeout(timer) }
}

const OFFICIAL_CAREERS_HTML = `
<!doctype html>
<html lang="en-US">
  <head>
    <title>Careers | Open Job Opportunities at Qubole</title>
    <meta
      name="description"
      content="Careers: Check out our open career opportunities. We are always hiring opportunistically for the best engineers at all of our locations."
    />
    <link rel="canonical" href="https://www.qubole.com/company/careers" />
  </head>
  <body>
    <main>
      <h1>Careers</h1>
      <p>Check out our open career opportunities.</p>
      <p>We are always hiring opportunistically for the best engineers at all of our locations.</p>
      <a class="careerbtn" href="https://www.qubole.com/company/careers">View Open Positions</a>
    </main>
  </body>
</html>
`

const PUBLIC_JOBS_HTML = `
<!doctype html>
<html lang="en-US">
  <head>
    <title>Careers | Open Job Opportunities at Qubole</title>
  </head>
  <body>
    <main>
      <h1>Current Openings</h1>
      <script type="application/ld+json">
        {"@context":"https://schema.org","@type":"JobPosting","title":"Senior Data Engineer"}
      </script>
      <a class="careerbtn" href="https://boards.greenhouse.io/qubole/jobs/12345">View Open Positions</a>
    </main>
  </body>
</html>
`

const loadScriptModule = async () => {
  try {
    return await import('../../scraper/quboleindia/script.js')
  } catch {
    assert.fail('Expected Qubole India scraper module at ../../scraper/quboleindia/script.js')
  }
}

test('Qubole India sentinel helpers stay pinned to the verified self-looping official careers page', async () => {
  const quboleIndia = await loadScriptModule()

  assert.equal(quboleIndia.SOURCE, 'quboleindia')
  assert.equal(quboleIndia.COMPANY, 'Qubole India')
  assert.equal(quboleIndia.OFFICIAL_BRAND_NAME, 'Qubole')
  assert.equal(quboleIndia.VERIFIED_ON, '2026-07-17')
  assert.equal(quboleIndia.HOMEPAGE_URL, 'https://www.qubole.com/')
  assert.equal(quboleIndia.CAREERS_URL, 'https://www.qubole.com/company/careers')
  assert.equal(
    quboleIndia.extractOpenPositionsUrl(OFFICIAL_CAREERS_HTML),
    'https://www.qubole.com/company/careers',
  )
  assert.equal(quboleIndia.hasOfficialCareersPageSignal(OFFICIAL_CAREERS_HTML), true)
  assert.equal(quboleIndia.pageExposesPublicJobListings(OFFICIAL_CAREERS_HTML), false)
  assert.equal(quboleIndia.pageExposesPublicJobListings(PUBLIC_JOBS_HTML), true)
})

test('Qubole India returns [] when the verified first-party careers page still self-loops its open positions CTA', async () => {
  const quboleIndia = await loadScriptModule()
  const requestedUrls = []

  const jobs = await quboleIndia.createQuboleIndiaScraper().run({
    fetchPage: async (url) => {
      requestedUrls.push(url)
      return { status: 200, url, html: OFFICIAL_CAREERS_HTML }
    },
  })

  assert.deepEqual(requestedUrls, [quboleIndia.CAREERS_URL])
  assert.deepEqual(jobs, [])
})

test('Qubole India fails closed when the verified careers page drifts or starts exposing public jobs', async () => {
  const quboleIndia = await loadScriptModule()

  await assert.rejects(
    quboleIndia.createQuboleIndiaScraper().run({
      fetchPage: async (url) => ({
        status: 200,
        url,
        html: '<html><body><h1>Unexpected</h1></body></html>',
      }),
    }),
    /verified official careers page/i,
  )

  await assert.rejects(
    quboleIndia.createQuboleIndiaScraper().run({
      fetchPage: async (url) => ({
        status: 200,
        url,
        html: PUBLIC_JOBS_HTML,
      }),
    }),
    /careers page now appears to expose public jobs/i,
  )
})

test('Qubole India does not start transport for an already cancelled caller, preserving opaque and falsey reasons', async () => {
  const { run } = await loadScriptModule()
  const opaque = new Proxy({}, { get() { throw Error('opaque cancellation reason must not be inspected') } })
  for (const reason of [opaque, null, false, 0, '']) {
    const controller = new AbortController()
    controller.abort(reason)
    let requests = 0
    await run({ signal: controller.signal, fetchPage: async () => { requests++; return currentCareersPage() } })
      .then(() => assert.fail('cancelled read must reject'), error => assert.equal(error, reason))
    assert.equal(requests, 0)
  }
})

test('Qubole India bounds a transport that ignores its request signal', async () => {
  const { run } = await loadScriptModule()
  await assert.rejects(settleWithin(run({ requestTimeoutMs: 20, fetchPage: () => new Promise(() => {}) })), /request deadline/i)
})

test('Qubole India applies the source deadline when it is shorter than the request deadline', async () => {
  const { run } = await loadScriptModule()
  await assert.rejects(settleWithin(run({ sourceTimeoutMs: 20, requestTimeoutMs: 100, fetchPage: () => new Promise(() => {}) })), /source deadline/i)
})

test('Qubole India propagates options and settles cancellation when injected transport ignores it', async () => {
  const { run } = await loadScriptModule()
  const controller = new AbortController()
  const reason = Object.freeze({ requested: 'cancel Qubole read' })
  let observed
  const result = run({ signal: controller.signal, maxResponseBytes: 200000, requestTimeoutMs: 100, marker: 'caller-option', fetchPage: (url, options) => {
    observed = { url, options }
    setImmediate(() => controller.abort(reason))
    return new Promise(() => {})
  } })
  await settleWithin(result).then(() => assert.fail('cancelled read must reject'), error => assert.equal(error, reason))
  assert.equal(observed.url, 'https://www.qubole.com/company/careers')
  assert.equal(observed.options.marker, 'caller-option')
  assert.equal(observed.options.maxResponseBytes, 200000)
  assert.equal(observed.options.signal.aborted, true)
})

test('Qubole India cancels a stalled default response body independently of transport cooperation', async t => {
  const { run } = await loadScriptModule()
  const controller = new AbortController()
  const reason = Symbol('cancel stalled body')
  const response = new Response(new ReadableStream({ start() {} }), { status: 200, headers: { 'content-type': 'text/html' } })
  Object.defineProperty(response, 'url', { value: 'https://www.qubole.com/company/careers' })
  t.mock.method(globalThis, 'fetch', async () => {
    setImmediate(() => controller.abort(reason))
    return response
  })
  await settleWithin(run({ signal: controller.signal })).then(() => assert.fail('cancelled read must reject'), error => assert.equal(error, reason))
})

test('Qubole India does not read a response body delivered after the deadline', async t => {
  const { run } = await loadScriptModule()
  const response = new Response(currentCareersPage().html, { headers: { 'content-type': 'text/html' } })
  Object.defineProperty(response, 'url', { value: 'https://www.qubole.com/company/careers' })
  let bodyReads = 0
  const body = response.body
  Object.defineProperty(response, 'body', { get() { bodyReads++; return body } })
  t.mock.method(globalThis, 'fetch', async () => { await delay(45); return response })
  await assert.rejects(settleWithin(run({ requestTimeoutMs: 10 })), /request deadline/i)
  await delay(60)
  assert.equal(bodyReads, 0)
})

test('Qubole India rejects a result after an elapsed deadline even before its timer callback runs', async () => {
  const { run } = await loadScriptModule()
  await assert.rejects(run({ requestTimeoutMs: 10, fetchPage: () => {
    const until = performance.now() + 30
    while (performance.now() < until) {}
    return currentCareersPage()
  } }), /request deadline/i)
})

test('Qubole India bounds default response bytes while streaming and cancels the reader on overflow', async t => {
  const { run } = await loadScriptModule()
  let cancelled = false
  const response = new Response(new ReadableStream({
    start(controller) { controller.enqueue(new TextEncoder().encode('€'.repeat(100))) },
    cancel() { cancelled = true },
  }), { headers: { 'content-type': 'text/html' } })
  Object.defineProperty(response, 'url', { value: 'https://www.qubole.com/company/careers' })
  t.mock.method(globalThis, 'fetch', async () => response)
  await assert.rejects(settleWithin(run({ maxResponseBytes: 250 })), /body.*limit|byte.*limit/i)
  assert.equal(cancelled, true)
})

test('Qubole India enforces the byte limit for injected page reads', async () => {
  const { run } = await loadScriptModule()
  await assert.rejects(run({ maxResponseBytes: 100, fetchPage: async () => currentCareersPage() }), /body.*limit|byte.*limit/i)
})

test('Qubole India enforces a zero request or page budget before public transport starts', async () => {
  const { run } = await loadScriptModule()
  for (const limits of [{ maxRequests: 0 }, { maxPages: 0 }]) {
    let requests = 0
    await assert.rejects(run({ ...limits, fetchPage: async () => { requests++; return currentCareersPage() } }), /request.*limit|page.*limit/i)
    assert.equal(requests, 0)
  }
})

test('Qubole India retains unknown native counts and the captured source clock through registered execution', async () => {
  const provider = getScraperCatalog().find(provider => provider.source === 'quboleindia')
  assert.ok(provider)
  const jobs = await createCatalogScraper(provider).run({ fetchPage: async () => currentCareersPage() })
  assert.deepEqual(jobs, [])
  const evidence = readInventoryEvidence(jobs)
  assert.equal(evidence?.status, 'discovery-only')
  assert.equal(evidence.listingComplete, false)
  assert.equal(evidence.reportedTotal, null)
  assert.equal(evidence.indiaFacetCount, null)
  assert.equal(evidence.verifiedAt, capturedPage.startedAt)
})

test('Qubole India fails closed for a new active native handoff even while the original self-loop CTA remains', async () => {
  const { run } = await loadScriptModule()
  const page = currentCareersPage()
  // Controlled drift of a genuine body; this URL is never requested or bound.
  page.html = page.html.replace('</body>', '<a href="https://jobs.ashbyhq.com/unreviewed-publisher/new-opening">View new opportunities</a></body>')
  await assert.rejects(run({ fetchPage: async () => page }), /careers page now appears to expose public jobs/i)
})

test('Qubole India ignores inert native handoff controls when preserving its unresolved sentinel outcome', async () => {
  const { run } = await loadScriptModule()
  const page = currentCareersPage()
  page.html = page.html.replace('</body>', '<template><a href="https://jobs.ashbyhq.com/unreviewed-publisher/new-opening">View new opportunities</a></template></body>')
  const jobs = await run({ fetchPage: async () => page })
  assert.equal(jobs.length, 0)
  assert.equal(readInventoryEvidence(jobs).listingComplete, false)
  assert.equal(readInventoryEvidence(jobs).reportedTotal, null)
})

for (const [label, status, mime] of [['denied status', 403, 'text/html'], ['unexpected MIME', 200, 'application/json']]) {
  test(`Qubole India cancels an unused default response body after ${label}`, async t => {
    const { run } = await loadScriptModule()
    let cancelled = false
    const response = new Response(new ReadableStream({
      start(controller) { controller.enqueue(new TextEncoder().encode(currentCareersPage().html)) },
      cancel() { cancelled = true },
    }), { status, headers: { 'content-type': mime } })
    Object.defineProperty(response, 'url', { value: 'https://www.qubole.com/company/careers' })
    t.mock.method(globalThis, 'fetch', async () => response)
    await assert.rejects(run(), /verified official careers page|expected HTML/i)
    assert.equal(cancelled, true)
  })
}
