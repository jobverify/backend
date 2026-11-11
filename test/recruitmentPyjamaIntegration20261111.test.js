import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { gunzipSync } from 'node:zlib'
import { createHash } from 'node:crypto'
import { createVerifiedRecruitmentScraper, RECRUITMENT_OBSERVATIONS } from '../scraper-support/utils/verifiedRecruitment.js'
import { readInventoryEvidence } from '../scraper-support/utils/inventoryEvidence.js'
import { getScraperCatalog } from '../scraper-support/providers/index.js'
import { readNativeDocument } from '../scraper-support/utils/activeNativeHtml.js'

const provider = getScraperCatalog().find(row => row.source === 'kukufm')
const fixture = JSON.parse(gunzipSync(readFileSync(new URL('./fixtures/recruitment-pyjama-kukufm-20261111.json.gz', import.meta.url))))
const captured = new Map(fixture.responses.map(row => {
  const body = Buffer.from(row.bodyBase64, 'base64')
  assert.equal(createHash('sha256').update(body).digest('hex'), row.sha256)
  return [row.requestedURL, { ...row, body: body.toString('utf8') }]
}))
const navigation = JSON.parse(gunzipSync(readFileSync(new URL('./fixtures/recruitment-pyjama-publisher-navigation-20261111.json.gz', import.meta.url))))
for (const row of navigation.responses) {
  assert.equal(createHash('sha256').update(row.html).digest('hex'), row.bodySHA256)
  captured.set(row.requestedURL, { ...row, body: row.html, contentType: 'text/html' })
}
const ids = ['425673', '425392', '425389', '425354', '424561']
const listURL = 'https://api.pyjamahr.com/api/career/jobs/?company_uuid=8B92017E1E&page=1&is_careers_page=true'
const replay = (change = (_, body) => body) => {
  const calls = [], counts = new Map()
  return { calls, fetchImpl: async (url, init) => {
    const row = captured.get(url)
    assert.ok(row, 'Only captured current publisher declarations may be requested: ' + url)
    const count = (counts.get(url) || 0) + 1
    counts.set(url, count); calls.push({ url, cache: init.cache })
    const response = new Response(change(url, row.body, count), {
      status: row.status, headers: { 'content-type': row.contentType },
    })
    Object.defineProperty(response, 'url', { value: row.finalURL })
    return response
  } }
}
const run = (r, limits = {}) => createVerifiedRecruitmentScraper(provider)
  .run({ fetchImpl: r.fetchImpl, maxDetails: 5, now: () => '2026-11-11T03:30:00.000Z', ...limits })

test('current Kuku FM handoff reaches complete native India criteria through the shared reader', async t => {
  t.mock.method(globalThis, 'fetch', () => assert.fail('Captured integration forbids uncontrolled HTTP'))
  const r = replay(), jobs = await run(r)
  assert.deepEqual(jobs.map(job => job.jobId), ids)
  for (const job of jobs) {
    const original = job.nativeSourceRecord.nativeDetail
    assert.equal(job.country, 'India')
    assert.equal(job.nativeHiringOrganization.name, 'Kuku FM')
    assert.equal(job.nativeLegalEmployer, null)
    assert.ok(job.jobDescription.startsWith(original.description))
    const document = readNativeDocument(job.jobDescription)
    const visibleCriteria = document.text(document.nodes(node => node.tag === 'root')[0])
    for (const question of original.job_screening_questions) {
      assert.ok(visibleCriteria.includes(question.question), 'Retain the exact published application screening condition')
      for (const choice of question.choices) assert.ok(visibleCriteria.includes(choice), 'Retain current published response choices')
    }
    assert.equal(job.postingDate, null)
    assert.equal(job.closingDate, original.valid_through)
    assert.equal(job.nativeSourceRecord.nativeCreatedAt, original.created_at)
    assert.equal(job.nativeSourceRecord.nativeClosingContext.currentPublisherHandoffRechecked, true)
    assert.equal(job.lifecycleCleanupAllowed, false)
    assert.equal(job.sourceScopeComplete, false)
  }
  assert.equal(jobs[RECRUITMENT_OBSERVATIONS].nativeRecords, 79)
  assert.equal(jobs[RECRUITMENT_OBSERVATIONS].nativeInventoryReads[0].reportedTotal, 79)
  assert.equal(readInventoryEvidence(jobs).listingComplete, false)
  assert.ok(r.calls.length <= 48)
})

test('the small recovery request cap retains one real native role and explicit unread listing evidence', async t => {
  t.mock.method(globalThis, 'fetch', () => assert.fail('Captured integration forbids uncontrolled HTTP'))
  const r = replay(), jobs = await run(r, { maxRequests: 16, maxPages: 6, maxDetails: 8 })
  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].jobId, ids[0])
  const inventory = jobs[RECRUITMENT_OBSERVATIONS].nativeInventoryReads[0]
  assert.equal(inventory.nativeListingTruncated, true)
  assert.ok(inventory.nativeUnreadNext)
  assert.equal(inventory.reportedTotal, 79)
  assert.equal(inventory.listingComplete, false)
  assert.ok(r.calls.length <= 16)
})

test('closing native Pyjama listing drift cannot expose staged source records', async t => {
  t.mock.method(globalThis, 'fetch', () => assert.fail('Captured integration forbids uncontrolled HTTP'))
  const r = replay((url, body, count) => {
    if (url !== listURL || count !== 2) return body
    const payload = JSON.parse(body)
    payload.results[0].title = 'A changed native role'
    return JSON.stringify(payload)
  })
  const jobs = await run(r)
  assert.equal(jobs.length, 0)
  assert.ok(jobs[RECRUITMENT_OBSERVATIONS].failures.some(row => row.stage === 'native-pyjama'))
  assert.equal(readInventoryEvidence(jobs).listingComplete, false)
})
