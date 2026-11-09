import assert from 'node:assert/strict'
import fs from 'node:fs'
import { gunzipSync } from 'node:zlib'
import test from 'node:test'
import { run } from './script.js'
import { readInventoryEvidence } from '../../scraper-support/utils/inventoryEvidence.js'
import { extractionDetailHealth } from '../../scraper-support/utils/extractionDetailHealth.js'

const native = JSON.parse(gunzipSync(fs.readFileSync(new URL('./test-data/native-20261102.json.gz', import.meta.url))))
const fake = ({ missing, mismatch, changedClosing } = {}) => {
  const requests = []
  let listingPass = 0
  return { requests, fetchImpl: async url => {
    requests.push(url)
    if (url === 'https://www.bny.com/corporate/global/en/careers.html') return { ok: true, text: async () => native.official }
    if (url.endsWith('/sites/BNY-Careers/')) return { ok: true, text: async () => native.site }
    const receipt = native.responses.find(row => row.url === url)
    assert.ok(receipt, `Unexpected native BNY URL ${url}`)
    if (url.includes('offset=0,')) listingPass += 1
    if (url.includes(`/recruitingCEJobRequisitionDetails/${missing}?`)) return { ok: false, status: 404 }
    const body = structuredClone(receipt.body)
    if (url.includes(`/recruitingCEJobRequisitionDetails/${mismatch}?`)) body.Id = 'unrelated-native-id'
    if (changedClosing && listingPass > 1 && url.includes('offset=0,')) body.items[0].requisitionList[0].Title += ' changed'
    return { ok: true, json: async () => body }
  } }
}

test('BNY returns 139 complete native India criteria and reconciles official binding, counts and closing identities', async () => {
  const fetcher = fake()
  const jobs = await run({ ...fetcher, maxPages: 20 })
  assert.equal(jobs.length, 139)
  assert.equal(new Set(jobs.map(job => job.jobId)).size, 139)
  assert.match(jobs.find(job => job.jobId === '78009').location, /Chennai/)
  assert.match(jobs[0].jobDescription, /Bachelor/)
  assert.equal(readInventoryEvidence(jobs).listingComplete, true)
  assert.equal(readInventoryEvidence(jobs).reportedTotal, 139)
  assert.match(readInventoryEvidence(jobs).reason, /closing/)
  assert.equal(extractionDetailHealth(jobs).complete, true)
})

for (const defect of ['missing', 'mismatch']) test(`BNY quarantines ${defect} full detail and preserves native failure evidence`, async () => {
  const jobs = await run({ ...fake({ [defect]: '73755' }), maxPages: 20 })
  assert.equal(jobs.length, 138)
  assert.equal(jobs.some(job => job.jobId === '73755' || job.jobId === 'unrelated-native-id'), false)
  assert.equal(readInventoryEvidence(jobs).status, 'coverage-gap')
  assert.equal(jobs[0].nativeCollectionEvidence.failures[0].jobId, '73755')
})

test('BNY retains an incomplete inventory when the closing native title changes', async () => {
  const jobs = await run({ ...fake({ changedClosing: true }), maxPages: 20 })
  assert.equal(readInventoryEvidence(jobs).status, 'coverage-gap')
  assert.equal(readInventoryEvidence(jobs).listingComplete, false)
})
