import assert from 'node:assert/strict'
import fs from 'node:fs'
import { gunzipSync } from 'node:zlib'
import test from 'node:test'
import { createMyCaptainScraper, HOMEPAGE_URL } from './script.js'
import { readInventoryEvidence } from '../../scraper-support/utils/inventoryEvidence.js'

const packet = name => JSON.parse(gunzipSync(fs.readFileSync(new URL(`./test-inputs/${name}-20261031.json.gz`, import.meta.url))))
const native = new Map(['home', 'careers'].map(name => {
  const page = packet(name)
  return [page.url, { status: page.status, url: page.finalUrl, html: page.body, headers: {} }]
}))

test('MyCaptain cancellation before a request cannot fetch or become a successful empty inventory', async () => {
  const reason = new Error('caller timeout cancellation')
  await assert.rejects(createMyCaptainScraper().run({ signal: AbortSignal.abort(reason),
    fetchPage: async () => assert.fail('cancelled source must not fetch') }), error => error === reason)
})

test('MyCaptain forwards cancellation and retains its exact cause during native reads', async () => {
  const controller = new AbortController(), reason = new Error('native request timeout cancellation')
  await assert.rejects(createMyCaptainScraper().run({ signal: controller.signal,
    fetchPage: async (url, options = {}) => {
      assert.equal(url, HOMEPAGE_URL)
      assert.equal(options.signal, controller.signal)
      controller.abort(reason)
      throw reason
    } }), error => error === reason)
})

test('MyCaptain transient transport failure remains unavailable instead of returning a numeric zero', async () => {
  const reason = new Error('fetch failed: Connect Timeout Error')
  await assert.rejects(createMyCaptainScraper().run({ fetchPage: async () => { throw reason } }), error => error === reason)
})

test('a paused MyCaptain deployment reports an unavailable inventory and bounded retry policy', async () => {
  await assert.rejects(createMyCaptainScraper().run({ fetchPage: async url => ({ status: 402, url,
    headers: { server: 'Vercel' }, html: '<title>Deployment Paused</title><h1>Deployment Paused</h1><p>This deployment is temporarily paused</p>' }) }), error => {
    assert.equal(error.softFailure, true)
    assert.equal(error.failureKind, 'upstream_inventory_unavailable')
    assert.equal(error.abortRetries, true)
    assert.equal(error.status, 402)
    return true
  })
})

test('current MyCaptain cards retain missing application and content facts without asserting a complete inventory', async () => {
  const jobs = await createMyCaptainScraper().run({ fetchPage: async url => structuredClone(native.get(url)),
    now: () => packet('careers').capturedAt })
  assert.equal(jobs.length, 3)
  assert.ok(jobs.every(job => job.applyUrl === null && job.jobDescription === null))
  assert.ok(jobs.every(job => job.sourceListingComplete === false && job.sourceDetailComplete === false))
  assert.equal(readInventoryEvidence(jobs)?.status, 'coverage-gap')
  assert.equal(readInventoryEvidence(jobs)?.reportedTotal, null)
  assert.equal(readInventoryEvidence(jobs)?.indiaFacetCount, null)
})
