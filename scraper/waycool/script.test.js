import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { gunzipSync } from 'node:zlib'
import { createHash } from 'node:crypto'
import { createWayCoolScraper } from './script.js'
import { classifyScraperError } from '../../scraper-support/utils/failureClassification.js'

const gap = error => error.code === 'WAYCOOL_COVERAGE_GAP'
  && error.sourceListingComplete === false && error.lifecycleCleanupAllowed === false
  && error.inventoryEvidence.status === 'coverage-gap'
  && error.inventoryEvidence.listingComplete === false
const officialURL = 'https://waycool.in/career'
const nativeURL = 'https://www.waycool.in/job-opportunities.php'
const official = '<h1>Become a #WayCoolWarrior</h1><a href="https://www.waycool.in/job-opportunities.php">Join Us</a>'
const response = (body, url, status = 200) => ({url,status,text:async () => body})

test('native capture gzip and exact raw bytes match their retained hashes', () => {
  const manifest = JSON.parse(readFileSync(new URL('./fixtures/manifest.json', import.meta.url)))
  for (const fixture of manifest.fixtures) {
    const gzip = readFileSync(new URL('./fixtures/' + fixture.file, import.meta.url)), raw = gunzipSync(gzip)
    assert.equal(createHash('sha256').update(gzip).digest('hex'), fixture.gzipSHA256)
    assert.equal(createHash('sha256').update(raw).digest('hex'), fixture.rawSHA256)
    assert.equal(raw.length, fixture.rawBytes)
    assert.deepEqual(JSON.parse(raw), JSON.parse(readFileSync(new URL('./fixtures/' + fixture.file.replace(/\.gz$/, ''), import.meta.url))))
  }
  assert.equal(manifest.fixtures.flatMap(f => f.responses).length, 5)
})

test('current failed native captures retain unknown counts and prohibit cleanup', async () => {
  const receipts = ['official-responses.json', 'official-www-responses.json'].flatMap(file => JSON.parse(readFileSync(new URL('./fixtures/' + file, import.meta.url))))
  await assert.rejects(createWayCoolScraper().run({fetchImpl:async url => {
    const receipt = receipts.find(r => r.url === url)
    if (!receipt || receipt.error) throw Error(receipt?.error || 'unavailable host variant')
    return response(receipt.body,url,receipt.status)
  }}), error => gap(error) && error.inventoryEvidence.reportedTotal === null
    && error.inventoryEvidence.indiaFacetCount === null && error.nativeAttempts.length === 3
    && error.inventoryEvidence.firstParty === false && error.retainedResponses.length === 1
    && error.retainedResponses[0].status === 404)
})

test('verified official handoff attempts the native endpoint and retains its unavailable receipt', async () => {
  await assert.rejects(createWayCoolScraper().run({fetchImpl:async url => url === officialURL
    ? response(official,url) : response('upstream unavailable',url,503)}), error => gap(error)
      && error.inventoryEvidence.firstParty === true && error.retainedResponses.length === 2
      && error.retainedResponses[1].url === nativeURL && error.retainedResponses[1].status === 503)
})

test('a newly accessible empty or nonempty native document requires verified inventory contracts', async () => {
  for (const body of ['<html>No jobs available</html>', '<h1>Software Engineer</h1><p>India</p>']) {
    await assert.rejects(createWayCoolScraper().run({fetchImpl:async url => response(url === officialURL ? official : body,url)}),
      error => gap(error) && error.inventoryEvidence.firstParty === true && error.retainedResponses.length === 2)
  }
})

test('hidden official handoff cannot establish employer binding', async () => {
  await assert.rejects(createWayCoolScraper().run({fetchImpl:async url => response(url === nativeURL ? '<html></html>'
    : '<section style="content-visibility:hidden">' + official + '</section>',url)}),
    error => gap(error) && error.inventoryEvidence.firstParty === false)
})

test('oversized or redirected documents cannot establish current employer binding', async () => {
  for (const fetchImpl of [async url => response(official,'https://example.com/'), async url => response('x'.repeat(5000001),url)]) {
    await assert.rejects(createWayCoolScraper().run({fetchImpl}), error => gap(error) && !error.inventoryEvidence.firstParty)
  }
})

test('aggregate deadline also bounds an uncooperative response body', async () => {
  await assert.rejects(createWayCoolScraper().run({timeoutMs:10,
    fetchImpl:async url => ({status:200,url,text:() => new Promise(() => {})})}), gap)
})

test('unavailable official inventory rejects with a typed gap instead of reporting zero jobs', async () => {
  await assert.rejects(createWayCoolScraper().run({fetchImpl: async () => { throw Error('offline') }}), error => {
    assert.ok(gap(error))
    assert.equal(error.abortRetries, true)
    assert.deepEqual(classifyScraperError(error), {
      softFailure: true, upstreamOutage: false, failureKind: 'coverage_gap',
    })
    assert.equal(error.inventoryEvidence.reportedTotal, null)
    assert.equal(error.inventoryEvidence.indiaFacetCount, null)
    return true
  })
})

test('caller cancellation preserves the exact reason', async () => {
  const controller = new AbortController(), reason = {reason:'caller cancelled'}
  controller.abort(reason)
  await assert.rejects(createWayCoolScraper().run({signal:controller.signal}), error => error === reason)
})

test('aggregate deadline bounds an uncooperative fetch', async () => {
  const started = Date.now()
  await assert.rejects(createWayCoolScraper().run({fetchImpl: () => new Promise(() => {}), timeoutMs:15}), gap)
  assert.ok(Date.now() - started < 1000)
})

test('cancellation interrupts a pending uncooperative body and preserves exact reason', async () => {
  const controller = new AbortController(), reason = Error('cancel body')
  const pending = createWayCoolScraper().run({signal:controller.signal, fetchImpl:async url => ({status:200,url,text:() => new Promise(() => {})})})
  setTimeout(() => controller.abort(reason), 10)
  await assert.rejects(pending, error => error === reason)
})
