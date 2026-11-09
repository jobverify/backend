import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { gunzipSync } from 'node:zlib'
import { createHash } from 'node:crypto'
import manifest from './test-data/manifest-20261103.js'
import { createAdityaBirlaGroupScraper } from './script.js'
import { mapBirlaRole } from './nativeJobs.js'
import { readInventoryEvidence } from '../../scraper-support/utils/inventoryEvidence.js'
import { readSourceObservationEvidence } from '../../scraper-support/utils/sourceObservationEvidence.js'
const zipped = fs.readFileSync(new URL('./test-data/native-20261103.json.gz', import.meta.url))
assert.equal(createHash('sha256').update(zipped).digest('hex'), manifest.fixtureSha256)
const captures = JSON.parse(gunzipSync(zipped))
for (const row of captures) assert.equal(createHash('sha256').update(row.html).digest('hex'), row.sha256)
const fetchText = async (url, options) => {
  const row = captures.findLast(row => row.requestedUrl === url)
  assert.ok(row, 'unrecorded public request ' + url)
  if (url.includes('/api/v3/')) assert.match(options.headers.Authorization, /^Bearer [\w.-]+$/)
  return row.html
}
const listUrl = 'https://careers.adityabirla.com/api/v3/jobs?offset=0&limit=20'
const secondJobCode = JSON.parse(captures.find(row => row.requestedUrl === listUrl).html).data[1].jobCode

test('keeps a native posting code distinct from an unavailable formal requisition identity', () => {
  const row = JSON.parse(captures.find(row => row.requestedUrl === listUrl).html).data[0]
  const job = mapBirlaRole(row)
  assert.equal(job.postingId, row.jobCode)
  assert.equal(job.requisitionId, null)
  assert.equal(job.requisitionCode, null)
  assert.equal(job.nativeJobCode, row.jobCode)
  const known = mapBirlaRole({ ...row, requisitionId: 123456, requisitionCode: 'NATIVE-REQ-01' })
  assert.equal(known.requisitionId, '123456')
  assert.equal(known.requisitionCode, 'NATIVE-REQ-01')
})

test('closing reconciliation includes the native department and formal requisition fields', async () => {
  let reads = 0
  const jobs = await createAdityaBirlaGroupScraper().run({ fetchText: async (url, options) => {
    const html = await fetchText(url, options)
    if (url !== listUrl || ++reads === 1) return html
    const body = JSON.parse(html); body.data[1].functionalArea = 'Changed native department'; body.data[1].requisitionId = 123456
    return JSON.stringify(body)
  } })
  assert.match(readInventoryEvidence(jobs).reason, /closing-native-records-or-criteria-changed/)
})

test('reads all1892 current native records rather than treating the SSR zero as an inventory', async () => {
  let audit
  const jobs = await createAdityaBirlaGroupScraper().run({ fetchText, onAudit: async value => { audit = value } })
  assert.ok(jobs.length > 1700)
  assert.ok(jobs.every(job => job.country === 'India' && job.sourceDetailComplete === true && job.jobDescription))
  assert.equal(readInventoryEvidence(jobs)?.reportedTotal, 1892)
  assert.equal(readSourceObservationEvidence(jobs, 'adityabirlagroup')?.observedRecordCount, 1892)
  assert.equal(audit.nativeRecords.length, 1892)
  assert.equal(new Set(audit.nativeRecords.map(row => row.jobCode)).size, 1892)
  assert.equal(readInventoryEvidence(jobs)?.listingComplete, false, 'empty or uncertain native criteria must retain a gap')
  const first = jobs.find(job => job.jobId === 'ABG110814')
  assert.ok(first.jobDescription.includes('Job Purpose') && first.jobDescription.includes('Stakeholder management'))
  assert.equal(first.requisitionId, null, 'native zero is not a formal requisition identity')
  assert.equal(first.postingDate, '2026-11-02T00:00:00.000Z')
})

test('never includes a native foreign-country role based on India mentioned in its job description', async () => {
  const jobs = await createAdityaBirlaGroupScraper().run({ fetchText: async (url, options) => {
    const html = await fetchText(url, options)
    if (url !== listUrl) return html
    const body = JSON.parse(html); body.data[1].locationHierarchyComplete = 'United States>California>San Francisco'
    return JSON.stringify(body)
  } })
  assert.equal(jobs.some(job => job.jobId === secondJobCode), false)
  assert.ok(jobs.every(job => job.country === 'India'))
})

test('rejects an incomplete native page rather than reconciling a subset of the reported inventory', async () => {
  await assert.rejects(createAdityaBirlaGroupScraper().run({ fetchText: async (url, options) => {
    const html = await fetchText(url, options)
    if (url !== listUrl) return html
    const body = JSON.parse(html); body.data.pop()
    return JSON.stringify(body)
  } }), /count|page|inventory/i)
})

test('keeps caller-capped Aditya Birla extraction explicitly incomplete', async () => {
  const jobs = await createAdityaBirlaGroupScraper().run({ fetchText, maxJobs: 1 })
  assert.equal(jobs.length, 1)
  assert.equal(readInventoryEvidence(jobs)?.reportedTotal, 1892)
  assert.equal(readInventoryEvidence(jobs)?.listingComplete, false)
})

test('propagates audit callback errors once without converting them into upstream unavailability', async () => {
  let calls = 0
  const failure = new Error('certificate audit sink unavailable')
  await assert.rejects(createAdityaBirlaGroupScraper().run({ fetchText, maxPages: 1,
    onAudit: async () => { calls++; throw failure } }), error => error === failure)
  assert.equal(calls, 1)
})

test('continues through a corporate gateway outage only when current native inventory independently verifies', async () => {
  const jobs = await createAdityaBirlaGroupScraper().run({ maxJobs: 1, fetchText: async (url, options) => {
    if (url === 'https://www.adityabirla.com/') throw Object.assign(new Error('HTTP 502'), { status: 502 })
    return fetchText(url, options)
  } })
  assert.equal(jobs.length, 1)
  assert.equal(readInventoryEvidence(jobs)?.reportedTotal, 1892)
  assert.equal(readInventoryEvidence(jobs)?.listingComplete, false)
})
