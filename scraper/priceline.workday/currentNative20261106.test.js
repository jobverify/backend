import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { gunzipSync } from 'node:zlib'
import { createHash } from 'node:crypto'
import { getScraperCatalog, createCatalogScraper } from '../../scraper-support/providers/index.js'
import { readInventoryEvidence } from '../../scraper-support/utils/inventoryEvidence.js'

const directory = new URL('./test-data-20261106/', import.meta.url)
const manifest = JSON.parse(readFileSync(new URL('manifest.json', directory), 'utf8'))
const key = (url, init) => (init.method || 'GET') + ':' + url + ':' + (init.body || '')
const groups = new Map()
for (const row of manifest.requests) {
  const identity = key(row.url, row)
  if (!groups.has(identity)) groups.set(identity, [])
  groups.get(identity).push(row)
}
const observations = jobs => jobs[Symbol.for('jobverify.verified-recruitment-observations')]
const registered = () => createCatalogScraper(getScraperCatalog().find(row => row.source === 'priceline'))
const replay = mutate => {
  const counts = new Map()
  return async (url, init = {}) => {
    const identity = key(url, init), count = (counts.get(identity) || 0) + 1
    counts.set(identity, count)
    const rows = groups.get(identity)
    assert.ok(rows && rows[count - 1], 'Unexpected native request: ' + identity)
    const row = rows[count - 1]
    const original = gunzipSync(readFileSync(new URL(row.bodySHA256 + '.gz', directory)))
    assert.equal(createHash('sha256').update(original).digest('hex'), row.bodySHA256)
    const body = mutate?.(original.toString(), row, count) ?? original
    const response = new Response(body, { status: row.status, headers: { 'content-type': row.contentType } })
    Object.defineProperty(response, 'url', { value: row.finalURL })
    return response
  }
}
const read = mutate => registered().run({ fetchImpl: replay(mutate), now: () => '2026-11-06T18:00:00.000Z' })

test('Priceline identifies its current publisher first and reconciles all 23 proven India roles', async () => {
  const jobs = await read()
  assert.deepEqual(jobs.map(row => row.jobId).sort(), [...manifest.expectedIndiaIds].sort())
  assert.equal(new Set(jobs.map(row => row.jobId)).size, 23)
  for (const job of jobs) {
    assert.equal(job.country, 'India')
    assert.equal(job.nativeHiringOrganization.name, 'Priceline Technology India LLP')
    assert.equal(job.sourceDescription, job.nativeSourceRecord.jobPostingInfo.jobDescription)
    assert.equal(job.nativeClosingSourceRecord.jobPostingInfo.jobDescription, job.sourceDescription)
    assert.equal(job.sourceNativeClosingContext.selectedReportedTotal, 24)
    assert.equal(job.sourceNativeClosingContext.eachFullRoleRechecked, true)
    assert.equal(job.sourceNativeClosingContext.allSelectedListingPagesRechecked, true)
    assert.equal(job.sourceOfficialBinding.currentHandoffRechecked, true)
    assert.equal(job.sourceScopeComplete, false)
    assert.equal(job.lifecycleCleanupAllowed, false)
    assert.equal(job.applicationVisited, false)
  }
  assert.equal(observations(jobs).nativeRecords, 24)
  assert.ok(observations(jobs).exclusions.some(row => row.country === 'Canada'))
  assert.equal(observations(jobs).nativeSearch.countryProof, false)
  assert.equal(readInventoryEvidence(jobs).status, 'coverage-gap')
  assert.equal(readInventoryEvidence(jobs).reportedTotal, null)
  assert.equal(readInventoryEvidence(jobs).indiaFacetCount, null)
})

test('Priceline withholds a foreign employer on an otherwise matching native role', async () => {
  const jobs = await read((body, row) => {
    if (!row.url.endsWith('/job/Mumbai/Software-Engineer_R5904')) return body
    const detail = JSON.parse(body)
    detail.hiringOrganization.name = 'Unrelated Employer'
    return JSON.stringify(detail)
  })
  assert.equal(jobs.length, 22)
  assert.ok(jobs.every(row => row.jobId !== 'R5904'))
  assert.ok(observations(jobs).unresolved.includes('native-employer-mismatch'))
})

test('Priceline rejects conflicting native countries rather than inferring India from Mumbai', async () => {
  const jobs = await read((body, row) => {
    if (!row.url.endsWith('/job/Mumbai/Software-Engineer_R5904')) return body
    const detail = JSON.parse(body)
    detail.jobPostingInfo.country = 'United States'
    return JSON.stringify(detail)
  })
  assert.equal(jobs.length, 0)
  assert.ok(observations(jobs).failures.some(row => /Contradictory Workday native countries/.test(row.message)))
})

test('Priceline withholds native roles whose application is explicitly disabled', async () => {
  const jobs = await read((body, row) => {
    if (!row.url.endsWith('/job/Mumbai/Software-Engineer_R5904')) return body
    const detail = JSON.parse(body)
    detail.jobPostingInfo.canApply = false
    return JSON.stringify(detail)
  })
  assert.equal(jobs.length, 22)
  assert.ok(jobs.every(row => row.jobId !== 'R5904'))
})

test('Priceline rejects a full native role changed on its closing read', async () => {
  const jobs = await read((body, row, count) => {
    if (!row.url.endsWith('/job/Mumbai/Software-Engineer_R5904') || count !== 2) return body
    const detail = JSON.parse(body)
    detail.jobPostingInfo.jobDescription += '<p>Changed closing requirements.</p>'
    return JSON.stringify(detail)
  })
  assert.equal(jobs.length, 0)
  assert.ok(observations(jobs).failures.some(row => /closing native role context changed/.test(row.message)))
})

test('Priceline rejects a corporate closing page that removes its current Workday handoff', async () => {
  const jobs = await read((body, row, count) => row.url === 'https://careers.priceline.com/job/r5916/' && count === 2
    ? body.replaceAll('https://priceline.wd1.myworkdayjobs.com/', 'https://unrelated.example/') : body)
  assert.equal(jobs.length, 0)
  assert.ok(observations(jobs).failures.some(row => /closing current company handoff changed/.test(row.message)))
})

test('Priceline preserves exact caller cancellation before public requests', async () => {
  const controller = new AbortController(), reason = new Error('cancel current Priceline extraction')
  controller.abort(reason)
  let calls = 0
  await assert.rejects(registered().run({ signal: controller.signal, fetchImpl: async () => { calls++ } }), error => error === reason)
  assert.equal(calls, 0)
})
