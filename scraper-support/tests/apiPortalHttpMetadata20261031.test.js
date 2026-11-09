import assert from 'node:assert/strict'
import test from 'node:test'
import { createCatalogScraper } from '../providers/index.js'
import { pacingProvider, pacingPayload } from './apiPortalPacing20261031.fixture.js'

test('registered generic API fetch retains HTTP 429 status and the actual Retry-After delay', async t => {
  let calls = 0
  t.mock.method(globalThis, 'fetch', async () => { calls++; return new Response(null, { status: 429, headers: { 'Retry-After': '0.08' } }) })
  await assert.rejects(createCatalogScraper(pacingProvider(undefined, { detail: false })).run(), error => {
    assert.equal(error.status, 429)
    assert.equal(error.retryAfter, '0.08')
    assert.equal(error.retryDelayMs, 80)
    return true
  })
  assert.equal(calls, 1)
})

test('generic API fetch preserves HTTP-date Retry-After on HTTP 503', async t => {
  t.mock.method(Date, 'now', () => Date.UTC(2026, 9, 31, 6))
  t.mock.method(globalThis, 'fetch', async () => new Response(null, { status: 503, headers: { 'Retry-After': 'Sat, 31 Oct 2026 06:00:02 GMT' } }))
  await assert.rejects(createCatalogScraper(pacingProvider(undefined, { detail: false })).run(), error => {
    assert.equal(error.status, 503)
    assert.equal(error.retryAfter, 'Sat, 31 Oct 2026 06:00:02 GMT')
    assert.equal(error.retryDelayMs, 2000)
    return true
  })
})

test('generic API fetch retains an invalid Retry-After without inventing a delay', async t => {
  t.mock.method(globalThis, 'fetch', async () => new Response(null, { status: 429, headers: { 'Retry-After': 'not-a-date' } }))
  await assert.rejects(createCatalogScraper(pacingProvider(undefined, { detail: false })).run(), error => {
    assert.equal(error.status, 429)
    assert.equal(error.retryAfter, 'not-a-date')
    assert.equal(error.retryDelayMs, undefined)
    return true
  })
})

test('generic API HTTP metadata does not change successful request method, headers or JSON payloads', async t => {
  const provider = pacingProvider(undefined, { detail: false })
  provider.config.request = { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Native-Client': 'public' }, body: { offset: 0 } }
  t.mock.method(globalThis, 'fetch', async (url, init) => {
    assert.equal(url, 'https://careers.pacing.invalid/api/jobs')
    assert.equal(init.method, 'POST')
    assert.deepEqual(init.headers, provider.config.request.headers)
    assert.equal(init.body, '{"offset":0}')
    return Response.json(pacingPayload(url))
  })
  const jobs = await createCatalogScraper(provider).run()
  assert.deepEqual(jobs.map(job => job.jobId), ['one', 'two', 'three'])
})
