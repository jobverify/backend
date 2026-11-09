import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { gunzipSync } from 'node:zlib'
import { createHash } from 'node:crypto'
import { CAREERS_URL, createCanvaScraper, hasVerifiedCloudflareChallengeSignal } from './script.js'
import { withRetry } from '../../scraper-support/utils/retry.js'

const captured = JSON.parse(gunzipSync(fs.readFileSync(new URL('./fixtures/native-primary-denial-20261031.json.gz', import.meta.url))))
const fixturePage = () => ({ status: captured.status, url: captured.finalURL, headers: new Headers(captured.headers), html: captured.body })
const gap = (error, status) => {
  assert.equal(error.status, status)
  assert.equal(error.abortRetries, true)
  assert.equal(error.inventoryEvidence.status, 'coverage-gap')
  assert.equal(error.inventoryEvidence.listingComplete, false)
  assert.equal(error.inventoryEvidence.reportedTotal, null)
  assert.equal(error.inventoryEvidence.indiaFacetCount, null)
  assert.equal(error.inventoryEvidence.verifiedAt, null)
  return true
}
const board = (page = 1) => `<!doctype html><title>Find Authentic Jobs | Canva Careers${page === 2 ? ' - Page 2' : ''}</title>
<h1>Find Authentic Jobs</h1><p>Location Type Work Type 1 to 20 of 2 Live Results</p>
<article><h2><a href="/en/jobs/${page}/test-engineer/">Test Engineer ${page}</a></h2><ul><li>Pune, India</li><li>Engineering</li></ul></article>
<a href="?page=1"${page === 1 ? ' aria-current="page"' : ''}>1</a><a href="?page=2"${page === 2 ? ' aria-current="page"' : ''}>2</a>`

test('Canva preserves the real primary denial as a gap after exactly one request', async () => {
  assert.equal(captured.status, 403)
  assert.equal(captured.headers['cf-mitigated'], 'challenge')
  assert.equal(createHash('sha256').update(captured.body).digest('hex'), captured.sha256)
  const reads = []
  await assert.rejects(createCanvaScraper().run({ fetchPage: async url => { reads.push(url); return fixturePage() } }), error => gap(error, 403))
  assert.deepEqual(reads, [CAREERS_URL])
})

test('Canva stops the legacy recognized challenge branch before probing another page', async () => {
  const page = { status: 403, url: CAREERS_URL, headers: { server: 'cloudflare', 'cf-ray': 'controlled-test', 'cf-mitigated': 'challenge' }, html: '<title>Just a moment...</title><p>Enable JavaScript and cookies to continue</p><script src="https://challenges.cloudflare.com/controlled.js"></script>' }
  assert.equal(hasVerifiedCloudflareChallengeSignal(page), true)
  let requests = 0
  await assert.rejects(createCanvaScraper().run({ fetchPage: async url => { requests++; return { ...page, url } } }), error => gap(error, 403))
  assert.equal(requests, 1)
})

for (const status of [401, 403, 429]) test('Canva rejects denied HTML with plausible job cards at HTTP ' + status, async () => {
  let requests = 0
  await assert.rejects(createCanvaScraper().run({ fetchPage: async url => {
    requests++
    return { status, url, headers: { 'retry-after': '2' }, html: board() }
  } }), error => {
    gap(error, status)
    if (status === 429) assert.equal(error.retryDelayMs, 2000)
    return true
  })
  assert.equal(requests, 1)
})

test('Canva retains the HTTP status when a later listing page is denied', async () => {
  const reads = []
  await assert.rejects(createCanvaScraper().run({ fetchPage: async url => {
    reads.push(url)
    return reads.length === 1 ? { status: 200, url, headers: {}, html: board() } : { ...fixturePage(), url }
  } }), error => gap(error, 403))
  assert.deepEqual(reads, [CAREERS_URL, CAREERS_URL + '?page=2'])
})

test('Canva default HTTP transport does not automatically follow an unqualified response', async t => {
  const original = globalThis.fetch
  t.after(() => { globalThis.fetch = original })
  const reads = []
  globalThis.fetch = async (url, request) => {
    reads.push({ url, redirect: request.redirect })
    const response = new Response(captured.body, { status: 403, headers: { 'content-type': 'text/html' } })
    Object.defineProperty(response, 'url', { value: url })
    return response
  }
  await assert.rejects(createCanvaScraper().run(), error => gap(error, 403))
  assert.deepEqual(reads, [{ url: CAREERS_URL, redirect: 'manual' }])
})

test('Canva successful controlled listing pages retain their existing extraction behavior', async () => {
  const reads = []
  const jobs = await createCanvaScraper().run({ fetchPage: async url => {
    reads.push(url)
    return { status: 200, url, headers: {}, html: board(reads.length) }
  }, now: () => '2026-07-14T00:00:00.000Z' })
  assert.deepEqual(reads, [CAREERS_URL, CAREERS_URL + '?page=2'])
  assert.deepEqual(jobs.map(job => job.jobId), ['1', '2'])
  assert.ok(jobs.every(job => job.country === 'India' && job.postingDate === null && job.jobDescription === null))
})

for (const status of [403, 429]) test('Canva retains received HTTP ' + status + ' without reading its failing body or retrying', async t => {
  const original = globalThis.fetch
  t.after(() => { globalThis.fetch = original })
  let requests = 0, bodyReads = 0, cancellations = 0
  globalThis.fetch = async url => {
    requests++
    return {
      status, url,
      headers: new Headers({ 'retry-after': '60' }),
      body: { cancel: async () => { cancellations++ } },
      text: async () => { bodyReads++; throw new Error('controlled denied body read failed') },
    }
  }
  await assert.rejects(withRetry(() => createCanvaScraper().run(), { attempts: 2, baseDelayMs: 0 }), error => {
    assert.equal(error.abortRetries, true)
    gap(error.cause, status)
    if (status === 429) assert.equal(error.cause.retryDelayMs, 60000)
    return true
  })
  assert.equal(requests, 1)
  assert.equal(bodyReads, 0)
  assert.equal(cancellations, 1)
})
