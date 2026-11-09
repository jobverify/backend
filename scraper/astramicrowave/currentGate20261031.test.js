import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { gunzipSync } from 'node:zlib'
import { createAstraMicrowaveScraper, isSucuriJavascriptGatePage, HOMEPAGE_URL, ROBOTS_URL } from './script.js'
import { readInventoryEvidence } from '../../scraper-support/utils/inventoryEvidence.js'

const packets = JSON.parse(gunzipSync(readFileSync(new URL('./test-inputs/sucuri-gates-20261031.json.gz', import.meta.url))))

test('current opaque Sucuri gates are classified without interpreting their challenge program', () => {
  for (const packet of packets) assert.equal(isSucuriJavascriptGatePage({ status: packet.status, url: packet.finalUrl, html: packet.body }), true)
})

test('a gated crawl resource retains public denial diagnostics and unknown inventory', async () => {
  const calls = [], packet = packets[0]
  await assert.rejects(createAstraMicrowaveScraper().run({ fetchPage: async url => {
    calls.push(url)
    return { status: 307, url, html: packet.body }
  } }), error => {
    assert.equal(error.code, 'ASTRA_MICROWAVE_COVERAGE_GAP')
    assert.equal(error.softFailure, true)
    assert.equal(error.failureKind, 'blocked_or_access_denied')
    assert.equal(error.status, 307)
    assert.equal(error.inventoryEvidence.listingComplete, false)
    assert.equal(error.inventoryEvidence.reportedTotal, null)
    assert.equal(error.inventoryEvidence.indiaFacetCount, null)
    return true
  })
  assert.deepEqual(calls, [HOMEPAGE_URL, ROBOTS_URL])
})

test('an already cancelled Astra caller makes no public request', async () => {
  const controller = new AbortController(), reason = Error('cancel Astra inspection')
  controller.abort(reason)
  let calls = 0
  await assert.rejects(createAstraMicrowaveScraper().run({ signal: controller.signal, fetchPage: async () => { calls++; throw Error('unexpected request') } }), error => error === reason)
  assert.equal(calls, 0)
})

test('a transport abort retains the caller reason after a public read starts', async () => {
  const controller = new AbortController(), reason = Error('cancel started Astra request')
  await assert.rejects(createAstraMicrowaveScraper().run({ signal: controller.signal, fetchPage: async (url, options) => {
    assert.equal(options.signal, controller.signal)
    controller.abort(reason)
    throw new DOMException('The operation was aborted', 'AbortError')
  } }), error => error === reason)
})

test('the complete current crawl remains a coverage gap when the native hiring pages are gated', async () => {
  const current = JSON.parse(gunzipSync(readFileSync(new URL('./test-inputs/current-crawl-20261031.json.gz', import.meta.url)))), calls = []
  const jobs = await createAstraMicrowaveScraper().run({ fetchPage: async url => {
    calls.push(url)
    const packet = current.find(packet => packet.url === url)
    assert.ok(packet, 'Unexpected public Astra URL: ' + url)
    return { status: packet.status, url: packet.finalUrl, html: packet.body }
  } })
  assert.equal(calls.length, 12)
  assert.equal(jobs.length, 0)
  assert.equal(readInventoryEvidence(jobs).status, 'coverage-gap')
  assert.equal(readInventoryEvidence(jobs).listingComplete, false)
  assert.equal(readInventoryEvidence(jobs).reportedTotal, null)
  assert.equal(readInventoryEvidence(jobs).indiaFacetCount, null)
  assert.equal(jobs.sourceAudit.lifecycleCleanupAllowed, false)
})

test('Sucuri-like text in a successful hiring page cannot establish the known gate', () => {
  const packet = packets[0]
  assert.equal(isSucuriJavascriptGatePage({ status: 200, html: packet.body }), false)
  assert.equal(isSucuriJavascriptGatePage({ status: 307, html: packet.body.replace('</html>', '<h1>Current openings</h1></html>') }), false)
})
