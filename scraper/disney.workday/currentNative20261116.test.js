import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { gunzipSync } from 'node:zlib'
import { run } from './script.js'
import { readInventoryEvidence } from '../../scraper-support/utils/inventoryEvidence.js'

const records = JSON.parse(gunzipSync(readFileSync(new URL('./fixtures/current-native-http-20261116.json.gz', import.meta.url))))

// The supplied failure has no raw date value. This current successful snapshot
// is characterization evidence; it does not claim a guessed historical repair.
test('all 26 current Disney India details retain their native original dates through the unchanged parser', async () => {
  let reads = 0
  const jobs = await run({ now: '2026-11-16T18:00:00.000Z', fetch: async (url, init) => {
    const row = records[reads++]
    assert.ok(row, 'Only current observed public Radancy requests are available')
    assert.equal(url, row.requestedURL)
    assert.equal(init.method, 'GET')
    return { status: row.status, url: row.finalURL, text: async () => row.body }
  } })
  assert.equal(reads, 33)
  assert.equal(jobs.length, 26)
  assert.equal(new Set(jobs.map(job => job.jobId)).size, 26)
  assert.ok(jobs.every(job => job.country === 'India' && job.sourceDetailComplete === true
    && job.sourceListingComplete === false && job.lifecycleCleanupAllowed === false))
  for (const job of jobs) {
    assert.match(job.nativePublicationDate, /^\d{1,2}\/\d{1,2}\/\d{4}$/)
    const [month, day, year] = job.nativePublicationDate.split('/').map(Number)
    assert.equal(job.postedAt, `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}T00:00:00.000Z`)
  }
  const evidence = readInventoryEvidence(jobs)
  assert.equal(evidence.status, 'coverage-gap')
  assert.equal(evidence.listingComplete, false)
  assert.equal(evidence.indiaFacetCount, 26)
})
