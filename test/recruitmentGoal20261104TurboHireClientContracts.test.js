import assert from 'node:assert/strict'
import test from 'node:test'
import fs from 'node:fs'
import { gunzipSync } from 'node:zlib'
import { createHash } from 'node:crypto'
import { getScraperCatalog, createCatalogScraper } from '../scraper-support/providers/index.js'
import { readInventoryEvidence } from '../scraper-support/utils/inventoryEvidence.js'

const production = JSON.parse(gunzipSync(fs.readFileSync(new URL('./test-data/recruitmentGoal20261104/native-production.json.gz', import.meta.url))))
const empty = JSON.parse(gunzipSync(fs.readFileSync(new URL('./test-data/recruitmentGoal20261104/turbohire-current-empty-boards.json.gz', import.meta.url))))
const captures = [...production.sources.filter(row => ['monocept','byteridge'].includes(row.source)), ...empty.sources]
const key = (url, init = {}) => (init.method || 'GET') + ':' + url + ':' + (init.body || '')
const replay = async (source, modify = () => {}) => {
  const capture = captures.find(row => row.source === source), queues = new Map(), reads = []
  for (const receipt of capture.requests) {
    const id = key(receipt.requestedURL, { method: receipt.method, body: receipt.body }), rows = queues.get(id) || []
    rows.push(receipt); queues.set(id, rows)
  }
  const fetchImpl = async (url, init = {}) => {
    assert.equal(init.method || 'GET', ['POST'].includes(init.method) ? 'POST' : 'GET')
    assert.equal(init.redirect, 'manual')
    const receipt = queues.get(key(String(url), init))?.shift()
    assert.ok(receipt, 'An unrecorded public route was requested: ' + url)
    reads.push(String(url))
    const response = { text: receipt.text, status: receipt.status, contentType: receipt.contentType }
    modify({ url: String(url), response, reads })
    const result = new Response(response.text, { status: response.status, headers: { 'content-type': response.contentType } })
    Object.defineProperty(result, 'url', { value: receipt.finalURL })
    return result
  }
  const provider = getScraperCatalog().find(row => row.source === source)
  const jobs = await createCatalogScraper(provider).run({ now: () => capture.completedAt, fetchImpl, requestIntervalMs: 0 })
  return { jobs, reads, capture }
}

test('all four current client runs retain their original public response bytes and production pacing', () => {
  for (const capture of captures) {
    const prior = new Map()
    for (const receipt of capture.requests) {
      assert.equal(receipt.replayed, false)
      assert.equal(createHash('sha256').update(receipt.text).digest('hex'), receipt.bodySHA256)
      const origin = new URL(receipt.requestedURL).origin, started = Date.parse(receipt.startedAt)
      if (prior.has(origin)) assert.ok(started - prior.get(origin) >= 850, 'Production public reads must retain their per-origin pacing')
      prior.set(origin, started)
    }
  }
})

for (const [source, count] of [['monocept',7], ['byteridge',5]]) test(source + ' replays the current declared clients and retains full original role and closing models', async () => {
  const { jobs, reads, capture } = await replay(source)
  assert.equal(jobs.length, count)
  assert.equal(reads.length, capture.requests.length)
  for (const job of jobs) {
    assert.equal(job.sourceScopeComplete, false)
    assert.equal(job.lifecycleCleanupAllowed, false)
    assert.equal(job.nativeRoleClosingReconciled, true)
    assert.equal(job.jobId, job.nativeSourceRecord.nativeDetail.JobId)
    assert.equal(job.postingDate, job.nativeSourceRecord.nativeDetail.PublishedDates.CAREERPAGE)
    assert.equal(job.firstEverPostedAt, null)
    assert.ok(job.sourceDescription.length > 500)
    assert.deepEqual(job.nativeHiringOrganization, job.nativeSourceRecord.nativeJobPosting.hiringOrganization)
    assert.equal(Object.keys(job.nativeSourceRecord.nativePublisher.clients).length, 6)
  }
  assert.equal(readInventoryEvidence(jobs).status, 'coverage-gap')
})

for (const source of ['ola','olaelectric']) test(source + ' current zero board remains an unresolved company inventory', async () => {
  const { jobs, reads, capture } = await replay(source)
  assert.equal(jobs.length, 0)
  assert.equal(reads.length, capture.requests.length)
  const observed = jobs[Symbol.for('jobverify.verified-recruitment-observations')]
  assert.equal(observed.nativeBoardEmpty, true)
  assert.equal(observed.sourceScopeComplete, false)
  assert.equal(readInventoryEvidence(jobs).status, 'coverage-gap')
  assert.match(readInventoryEvidence(jobs).reason, /shared-tenant-brand-and-legal-employer-scope-unresolved/)
  assert.ok(!reads.some(url => /runtime-main\.26de|main\.a1c3|175d834e4511513f235afe074baa9e4d/.test(url)))
})

test('new bootstrap filenames cannot replace exact current client byte validation', async () => {
  let lastRead
  await assert.rejects(replay('monocept', ({ url, response, reads }) => {
    if (url.includes('/main.b92aa5cb7a0a7499e689.chunk.js')) { response.text += '\n'; lastRead = reads.at(-1) }
  }), /unreviewed current native client bytes/)
  assert.match(lastRead, /main\.b92aa5/)
})

test('an HTML fallback at the new current runtime URL is refused', async () => {
  await assert.rejects(replay('ola', ({ url, response }) => {
    if (url.includes('/runtime-main.1f1316b384bd2bc2fa19.js')) {
      response.contentType = 'text/html'; response.text = '<html><body>Application shell</body></html>'
    }
  }), /public response MIME changed/)
})

test('the current Ola Electric stylesheet is checked by its actual response hash', async () => {
  await assert.rejects(replay('olaelectric', ({ url, response }) => {
    if (url.includes('/ba425f4b503867d814bcd6848d8bb896.min.css')) response.text += '\n'
  }), /advertised public asset bytes changed/)
})

test('Byteridge remote work requires original role-owned India evidence including the empty DTO projection recovery', async () => {
  const { jobs } = await replay('byteridge')
  assert.equal(jobs.filter(job => job.nativeCountryEvidence.explicitRoleLocationForRemote).length, 4)
  const recovered=jobs.find(job => job.jobId === 'd417cd9e-fb63-4401-9df5-352786f05336')
  assert.ok(recovered)
  assert.equal(recovered.nativeCountryEvidence.method,'same-role-visible-remote-india-and-typed-schema')
  assert.equal(recovered.nativeSourceRecord.nativeDetail.Location,'[{}]')
  assert.deepEqual(recovered.nativeLocationAddresses,[])
  assert.equal(recovered.location,'Remote, India');assert.equal(recovered.city,null)
  assert.match(recovered.jobDescription,/Remote \(India\)/)
  assert.match(recovered.jobDescription,/MBA\/PGDM in Human Resources/)
  assert.equal(jobs[0].nativeCollectionEvidence.unresolvedRecords,0)
  assert.equal(jobs[0].nativeCollectionEvidence.sourceScopeComplete,false)
})

test('a changed native employer is withheld while unrelated current roles survive', async () => {
  const id = 'd884baa9-3629-477c-8bcf-238666787f4b'
  const { jobs } = await replay('byteridge', ({ url, response }) => {
    if (url.includes('/api/publicjobs/' + id)) {
      const detail = JSON.parse(response.text); detail.OrgDetails.OrgName = 'Another employer'; response.text = JSON.stringify(detail)
    }
  })
  assert.equal(jobs.length, 4)
  assert.ok(!jobs.some(job => job.jobId === id))
  assert.ok(jobs.every(job => job.nativeRoleClosingReconciled && job.sourceScopeComplete === false))
})
