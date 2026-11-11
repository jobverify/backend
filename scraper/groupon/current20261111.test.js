import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { gunzipSync } from 'node:zlib'
import { createHash } from 'node:crypto'
import { getScraperCatalog, createCatalogScraper } from '../../scraper-support/providers/index.js'
import { readInventoryEvidence } from '../../scraper-support/utils/inventoryEvidence.js'
import { publisher, profileForPublisher, program, loadingContract, profileModuleURL, PRIMARY, API } from './nativeModels.js'

const manifest = JSON.parse(readFileSync(new URL('./test-data-20261111/manifest.json', import.meta.url)))
const bytes = readFileSync(new URL('./test-data-20261111/' + manifest.fixture, import.meta.url))
const sha = value => createHash('sha256').update(value).digest('hex')
assert.equal(sha(bytes), manifest.sha256)
const captured = JSON.parse(gunzipSync(bytes))
const graph = new Map(captured.graphPackets.map(packet => [packet.url, packet]))
const native = new Map(captured.nativePackets.map(packet => [packet.phase + ':' + packet.url, packet]))
const registered = () => createCatalogScraper(getScraperCatalog().find(provider => provider.source === 'groupon'))

function replay(change = value => value) {
  const reads = [], visits = new Map()
  return { reads, options: { fetchResponse: async (url, init) => {
    assert.equal(init.method, 'GET'); assert.equal(init.body, null)
    const visit = (visits.get(url) || 0) + 1
    visits.set(url, visit); reads.push(url)
    const original = graph.get(url) || native.get((visit === 1 ? 'opening:' : 'closing:') + url)
    assert.ok(original, 'Only original current declared public routes may be read: ' + url)
    assert.equal(sha(original.text), original.sha256)
    const body = change(original.text, url, visit)
    return { bytes: Buffer.from(body), html: body, requestedURL: url, finalURL: url, method: 'GET', body: null,
      status: original.status, headers: original.headers, contentType: original.headers['content-type'],
      startedAt: original.startedAt, completedAt: original.completedAt, bodySHA256: sha(body) }
  } } }
}

test.beforeEach(t => t.mock.method(globalThis, 'fetch', async () => { throw Error('No live network in current Groupon replay') }))

test('the newly declared current Groupon graph preserves the exact reviewed GET, complete criteria and office-country contracts', () => {
  const selected = profileForPublisher(publisher(graph.get(PRIMARY).text)), programs = {}
  assert.deepEqual(selected, captured.profile)
  for (const key of Object.keys(selected)) programs[key] = program(graph.get(profileModuleURL(key, selected)).text, key, selected)
  const contract = loadingContract(programs)
  assert.equal(contract.inventoryURL, API)
  assert.equal(contract.method, 'GET')
  assert.equal(contract.officeCountryModels.length, 11)
  assert.equal(contract.publisherProgramsExecuted, false)
})

test('registered current Groupon acquisition preserves all original full native criteria and closing observations while zero remains unqualified', async () => {
  const { options, reads } = replay(), jobs = await registered().run(options)
  const listing = JSON.parse(native.get('opening:' + API).text).jobs
  assert.equal(jobs.length, listing.length)
  assert.equal(jobs.length, 24)
  assert.equal(reads.length, 64)
  for (const job of jobs) {
    const original = JSON.parse(native.get('opening:' + API + '/' + job.jobId).text).job
    assert.equal(job.sourceDescription, original.contentHtml)
    assert.deepEqual(job.nativeScreeningQuestions, original.questions)
    assert.deepEqual(job.nativeSourceRecord.detail, original)
    assert.deepEqual(job.nativeClosingRecord, job.nativeSourceRecord)
    assert.equal(job.nativeRoleClosingReconciled, true)
    assert.equal(job.sourceScopeComplete, false)
    assert.equal(job.lifecycleCleanupAllowed, false)
  }
  const evidence = readInventoryEvidence(jobs)
  assert.equal(evidence.status, 'coverage-gap')
  assert.equal(evidence.listingComplete, false)
  assert.equal(evidence.reportedTotal, null)
  assert.equal(evidence.indiaFacetCount, null)
})

test('a changed byte in the current Groupon own-role renderer is rejected before native inventory reads', async () => {
  const { options, reads } = replay((body, url) => url.endsWith('/' + captured.profile.roles.path) ? body + '\n/* changed current program */' : body)
  await assert.rejects(registered().run(options), /program changed/)
  assert.equal(reads.some(url => url.startsWith(API)), false)
})

test('current Groupon still withholds changed closing native criteria', async () => {
  const id = JSON.parse(native.get('opening:' + API).text).jobs[0].id
  const { options } = replay((body, url, visit) => {
    if (url !== API + '/' + id || visit !== 2) return body
    const payload = JSON.parse(body)
    payload.job.contentHtml += '<p>A new mandatory licence is required.</p>'
    return JSON.stringify(payload)
  })
  await assert.rejects(registered().run(options), /closing whole role/)
})
