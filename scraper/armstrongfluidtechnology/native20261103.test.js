import assert from 'node:assert/strict'
import fs from 'node:fs'
import { gunzipSync } from 'node:zlib'
import test from 'node:test'
import { run, buildCareersPageUrl } from './script.js'
import { readInventoryEvidence } from '../../scraper-support/utils/inventoryEvidence.js'
import { extractionDetailHealth } from '../../scraper-support/utils/extractionDetailHealth.js'
import { normalizeScrapedJob } from '../../scraper-support/utils/normalizeScrapedJob.js'
import { buildDescriptionSourceUpdate } from '../../src/services/jobDescriptionPolicy.js'

const native = JSON.parse(gunzipSync(fs.readFileSync(new URL('./test-data/native-20261103.json.gz', import.meta.url))))
const india = native.details.find(row => row.body.result.jobOpening.location.addressCountry === 'India')
const replay = ({ missingCountry = false, mismatch = false, drift = false } = {}) => {
  let listReads = 0
  return {
    fetchText: async url => url === buildCareersPageUrl() ? native.company : url === 'https://armstrongfluidtechnology.bamboohr.com/careers/' ? native.board : assert.fail(url),
    fetchJson: async url => {
      if (url.endsWith('/careers/list')) {
        const list = structuredClone(native.listing)
        if (++listReads > 1 && drift) list.result[0].jobOpeningName += ' changed'
        return list
      }
      const record = native.details.find(row => row.url === url)
      assert.ok(record, url)
      const body = structuredClone(record.body)
      if (record.id === india.id && missingCountry) body.result.jobOpening.location.addressCountry = null
      if (record.id === india.id && mismatch) body.result.jobOpening.jobOpeningShareUrl = 'https://armstrongfluidtechnology.bamboohr.com/careers/999999'
      return body
    },
  }
}

test('Armstrong recovers34 full native India roles from158 current open BambooHR positions with country and closing proof', async () => {
  const jobs = await run(replay())
  assert.equal(jobs.length, 34)
  assert.equal(new Set(jobs.map(job => job.jobId)).size, 34)
  assert.ok(jobs.every(job => job.country === 'India' && job.sourceDetailComplete))
  const inventory = readInventoryEvidence(jobs)
  assert.equal(inventory.listingComplete, true)
  assert.equal(inventory.reportedTotal, 158)
  assert.equal(inventory.indiaFacetCount, 34)
  assert.match(inventory.reason, /closing/)
  assert.equal(extractionDetailHealth(jobs).complete, true)
  for (const job of jobs) assert.doesNotThrow(() => buildDescriptionSourceUpdate(normalizeScrapedJob(job, { source: 'armstrongfluidtechnology', companyName: job.company }), null))
})

for (const defect of ['missingCountry', 'mismatch']) test(`Armstrong withholds native ${defect} instead of manufacturing India or binding a different role`, async () => {
  const jobs = await run(replay({ [defect]: true }))
  assert.equal(jobs.length, 33)
  assert.equal(jobs.some(job => job.jobId === india.id), false)
  assert.equal(readInventoryEvidence(jobs).listingComplete, false)
  assert.equal(jobs[0].nativeCollectionEvidence.failures.length, 1)
})

test('Armstrong preserves a closing-inventory gap when native role data change', async () => {
  const jobs = await run(replay({ drift: true }))
  assert.equal(readInventoryEvidence(jobs).listingComplete, false)
})

test('Armstrong caller cancellation settles native fetch overrides which ignore their signal', async () => {
  const controller = new AbortController(), reason = Error('stop Armstrong')
  const options = replay()
  options.fetchJson = () => { controller.abort(reason); return new Promise(() => {}) }
  await assert.rejects(run({ ...options, signal: controller.signal }), error => error === reason)
})
