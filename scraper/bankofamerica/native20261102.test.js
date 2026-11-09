import assert from 'node:assert/strict'
import fs from 'node:fs'
import { gunzipSync } from 'node:zlib'
import test from 'node:test'
import { run } from './script.js'
import { readInventoryEvidence } from '../../scraper-support/utils/inventoryEvidence.js'
import { extractionDetailHealth } from '../../scraper-support/utils/extractionDetailHealth.js'

const native = JSON.parse(gunzipSync(fs.readFileSync(new URL('./test-data/native-20261102.json.gz', import.meta.url))))
const options = ({ mismatch, missing, country, drift } = {}) => {
  let fullReads = 0
  return { maxPages: 20, fetchJson: async url => {
    const receipt = native.find(row => row.url === url)
    assert.ok(receipt, url)
    const payload = JSON.parse(receipt.body)
    if (url.includes('rows=135') && ++fullReads > 1 && drift) payload.jobsList[0].postingTitle += ' changed'
    return payload
  }, fetchText: async url => {
    let html = native.find(row => row.url === url)?.body || assert.fail(url)
    if (url.includes('/26035575/') && mismatch) html = html.replace('data-jobRequisitionID="26035575"', 'data-jobRequisitionID="unrelated"')
    if (url.includes('/26035575/') && missing) html = html.replace('data-jobRequisitionID="26035575"', '')
    if (url.includes('/26035575/') && country) html = html.replace('data-jobCountry="India"', 'data-jobCountry="United States"').replace('data-jobCountryName="India"', 'data-jobCountryName="United States"')
    return html
  } }
}

test('Bank of America reconciles the current135 native India details, unique roles and closing total despite the broken offset API', async () => {
  const jobs = await run(options())
  assert.equal(jobs.length, 135)
  assert.equal(new Set(jobs.map(job => job.jobId)).size, 135)
  assert.equal(readInventoryEvidence(jobs).listingComplete, true)
  assert.equal(readInventoryEvidence(jobs).reportedTotal, 135)
  assert.match(readInventoryEvidence(jobs).reason, /closing/)
  assert.equal(extractionDetailHealth(jobs).complete, true)
})
for (const defect of ['mismatch', 'missing', 'country']) test(`Bank of America withholds ${defect} detail instead of trusting the India listing`, async () => {
  const jobs = await run(options({ [defect]: true }))
  assert.equal(jobs.length, 134)
  assert.equal(jobs.some(job => job.jobId === '26035575' || job.jobId === 'unrelated'), false)
  assert.equal(readInventoryEvidence(jobs).status, 'coverage-gap')
  assert.equal(jobs[0].nativeCollectionEvidence.failures[0].stage, 'native-detail')
})
test('Bank of America retains a closing-inventory gap on a changed native title', async () => {
  const jobs = await run(options({ drift: true }))
  assert.equal(readInventoryEvidence(jobs).listingComplete, false)
})
