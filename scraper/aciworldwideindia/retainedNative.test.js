import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { gunzipSync } from 'node:zlib'
import { createHash } from 'node:crypto'
import { buildScrapers } from '../../scraper-support/providers/index.js'
import { readInventoryEvidence } from '../../scraper-support/utils/inventoryEvidence.js'
import { readSourceObservationEvidence } from '../../scraper-support/utils/sourceObservationEvidence.js'
import { extractionDetailHealth } from '../../scraper-support/utils/extractionDetailHealth.js'
import { extractionRawJobMetrics } from '../../scraper-support/utils/extractionRawJobMetrics.js'

// Break caught: declaring complete after the real Oracle offset24 short page,
// losing raw/health evidence in registration, or treating replay as a new check.
test('ACI replays the retained 56 public GET bodies with the original clock and stable 121 of 123 discrepancy', async () => {
  const fixture = JSON.parse(gunzipSync(readFileSync(new URL('./public-native-20261105.fixture.json.gz', import.meta.url))))
  assert.equal(fixture.frames.length, 56)
  for (const frame of fixture.frames) {
    const body = Buffer.from(fixture.bodies[frame.sha256])
    assert.equal(createHash('sha256').update(body).digest('hex'), frame.sha256)
    assert.equal(body.length, frame.bytes)
    assert.equal(frame.status, 200)
    assert.equal(frame.method, 'GET')
  }
  let cursor = 0, report
  const scraper = buildScrapers().find(scraper => scraper.name === 'aciworldwideindia')
  const jobs = await scraper.run({ maxPages: 10, maxNativeJobs: 300, maxJobs: 100, maxRequests: 90,
    now: () => fixture.originalVerifiedAt, onReport: value => { report = value },
    fetchPage: async (url, init) => {
      const frame = fixture.frames[cursor++]
      assert.equal(url, frame?.url)
      assert.equal(init.method, 'GET')
      assert.equal(init.credentials, 'omit')
      return { status: frame.status, url: frame.finalUrl, contentType: frame.contentType,
        body: fixture.bodies[frame.sha256] }
    } })
  assert.equal(cursor, 56)
  assert.equal(jobs.length, 34)
  assert.equal(report.observedListingCount, 121)
  assert.equal(report.reportedTotal, 123)
  assert.equal(report.observedIndiaListingCount, 34)
  assert.equal(report.nonIndiaListingCount, 87)
  assert.deepEqual(report.openingPages.map(page => page.rows), [24, 22, 24, 24, 24, 3])
  assert.deepEqual(report.closingPages, report.openingPages)
  assert.equal(report.closingInventoryMatches, true)
  assert.equal(report.nativeCountReconciled, false)
  assert.equal(report.delegation.unresolved.length, 0)
  assert.equal(new Set(report.delegation.pages.flatMap(page => page.searchViews)).size, 18)
  assert.equal(readInventoryEvidence(jobs).verifiedAt, fixture.originalVerifiedAt)
  assert.equal(readInventoryEvidence(jobs).listingComplete, false)
  assert.equal(readInventoryEvidence(jobs).reason, 'native-inventory-count-unreconciled')
  assert.equal(readSourceObservationEvidence(jobs, 'aciworldwideindia').observedVacancyCount, 121)
  assert.deepEqual(extractionRawJobMetrics({ source: 'aciworldwideindia' }, jobs, readInventoryEvidence(jobs)),
    { rawJobs: 123, rawJobsBasis: 'inventory-reported-total' })
  assert.equal(extractionDetailHealth(jobs).complete, false)
  assert.equal(extractionDetailHealth(jobs).nativeCollections.length, 1)
  assert.equal(extractionDetailHealth(jobs).nativeCollections[0].closingInventoryMatches, true)
  assert.ok(jobs.every(job => job.country === 'India' && job.sourceDetailComplete === true))
  assert.ok(jobs.every(job => job.sourceScopeComplete === false && job.lifecycleCleanupAllowed === false))
})
