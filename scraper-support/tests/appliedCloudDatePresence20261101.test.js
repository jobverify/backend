import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { gunzipSync } from 'node:zlib'
import * as applied from '../../scraper/appliedcloudcomputing/script.js'
import { createCatalogScraper, getScraperCatalog } from '../providers/index.js'
import { analyzePublishableJobs } from '../utils/publishableJobMetrics.js'

const capture = JSON.parse(gunzipSync(readFileSync(new URL('../../scraper/appliedcloudcomputing/native-captures/ownership-20261101.json.gz', import.meta.url))))
const packet = label => capture.packets.find(p => p.label === label)
const originalListing = JSON.parse(packet('listing').bodyUTF8), originalDetail = JSON.parse(packet('detail').bodyUTF8)
const clock = packet('listing').completedAt, provider = getScraperCatalog().find(p => p.source === applied.SOURCE)
const listingURL = applied.PROVIDER_METADATA.config.discovery.listingApiUrl + '?limit=100&country=in&offset=0'
const make = () => ({
  board: packet('official').bodyUTF8,
  // Controlled one-role envelope, not a native complete source inventory.
  listing: { ...structuredClone(originalListing), totalFound: 1, content: [structuredClone(originalListing.content.find(row => row.id === originalDetail.id))] },
  detail: structuredClone(originalDetail),
})
const invoke = (route, data) => (route === 'factory' ? applied.createAppliedCloudComputingScraper() : createCatalogScraper(provider)).run({
  fetchText: async url => { assert.equal(url, applied.BOARD_URL); return data.board },
  fetchJson: async url => { assert.ok(url === listingURL || url === originalListing.content[0].ref); return structuredClone(url === listingURL ? data.listing : data.detail) },
})

for (const [name, value] of [['null', null], ['undefined', undefined]]) test('Applied own detail date ' + name + ' cannot erase the captured August listing date', async t => {
  t.mock.timers.enable({ apis: ['Date'], now: Date.parse(clock) })
  assert.equal(originalDetail.releasedDate, '2026-08-13T07:11:51.063Z')
  for (const route of ['factory', 'registry']) {
    const data = make(); data.detail.releasedDate = value
    const snapshot = structuredClone(data)
    assert.equal(Object.hasOwn(data.detail, 'releasedDate'), true)
    await assert.rejects(invoke(route, data), error => error.code === 'APPLIED_CLOUD_OWNERSHIP_MISMATCH' && error.incompleteScope === true && error.abortRetries === true)
    assert.deepEqual(data, snapshot)
    assert.equal(data.listing.content[0].releasedDate, originalDetail.releasedDate)
  }
})

test('Applied genuinely absent detail date keeps the captured August date and old-publication exclusion', async t => {
  t.mock.timers.enable({ apis: ['Date'], now: Date.parse(clock) })
  for (const route of ['factory', 'registry']) {
    const data = make(); delete data.detail.releasedDate
    const snapshot = structuredClone(data), jobs = await invoke(route, data)
    assert.equal(Object.hasOwn(data.detail, 'releasedDate'), false)
    assert.equal(jobs.length, 1); assert.equal(jobs[0].postingDate, originalDetail.releasedDate)
    assert.equal(jobs[0].jobId, originalDetail.id); assert.equal(jobs[0].title, originalDetail.name)
    assert.equal(jobs[0].applyUrl, originalDetail.applyUrl); assert.equal(jobs[0].sourceUrl, originalDetail.postingUrl)
    assert.equal(jobs[0].jobDescription, originalDetail.jobAd.sections.jobDescription.text)
    const metrics = analyzePublishableJobs(jobs, { now: new Date(clock) })
    assert.equal(metrics.eligibleJobs.length, 0); assert.equal(metrics.filterCounts.old, 1)
    assert.deepEqual(data, snapshot)
  }
  assert.equal(originalListing.content.length, 4); assert.equal(originalListing.totalFound, 4)
  assert.equal(originalDetail.releasedDate, '2026-08-13T07:11:51.063Z')
})
