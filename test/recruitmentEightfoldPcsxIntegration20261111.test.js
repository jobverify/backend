import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { gunzipSync } from 'node:zlib'
import { createHash } from 'node:crypto'
import { getScraperCatalog } from '../scraper-support/providers/index.js'
import { createVerifiedRecruitmentScraper, RECRUITMENT_OBSERVATIONS } from '../scraper-support/utils/verifiedRecruitment.js'
import { readInventoryEvidence } from '../scraper-support/utils/inventoryEvidence.js'
import { normalizeScrapedJob } from '../scraper-support/utils/normalizeScrapedJob.js'

const provider = getScraperCatalog().find(row => row.source === 'dsmfirmenich')
const fixture = JSON.parse(gunzipSync(readFileSync(new URL('./fixtures/recruitment-eightfold-pcsx-dsm-20261111.json.gz', import.meta.url))))
const captured = new Map()
for (const original of fixture.responses) {
  const bytes = Buffer.from(original.bodyBase64, 'base64')
  assert.equal(createHash('sha256').update(bytes).digest('hex'), original.bodySHA256)
  const row = { ...original, contentType: original.contentType || original.headers?.['content-type'], body: bytes.toString('utf8') }
  const rows = captured.get(row.requestedURL) || []
  rows.push(row); captured.set(row.requestedURL, rows)
}
for (const rows of captured.values()) rows.sort((a, b) => (a.phase === 'opening' ? 0 : 1) - (b.phase === 'opening' ? 0 : 1))
const corporateURL = 'https://careers.dsm-firmenich.com/en/careers.html'
const boardURL = 'https://jobs.dsm-firmenich.com/careers'
const roleURL = 'https://jobs.dsm-firmenich.com/careers/job/562949974226258'
const ownURL = 'https://jobs.dsm-firmenich.com/api/pcsx/position_details?position_id=562949974226258&domain=dsm.com&hl=en'
const native = JSON.parse(captured.get(ownURL)[0].body).data

const replay = (change = (_, body) => body, alterResponse = (_, result) => result) => {
  const calls = [], counts = new Map()
  return { calls, fetchImpl: async (url, init) => {
    const rows = captured.get(url)
    assert.ok(rows, 'Only the captured current public DSM transaction may be requested: ' + url)
    const count = (counts.get(url) || 0) + 1
    assert.ok(count <= rows.length, 'No uncontrolled repeated public request: ' + url)
    counts.set(url, count)
    const row = rows[count - 1]
    calls.push({ url, method: init.method || 'GET', cache: init.cache, phase: row.phase })
    const result = alterResponse(url, { status: row.status, finalURL: row.finalURL, contentType: row.contentType }, count)
    const response = new Response(change(url, row.body, count), { status: result.status, headers: { 'content-type': result.contentType } })
    Object.defineProperty(response, 'url', { value: result.finalURL })
    return response
  } }
}
const run = (r, limits = {}) => createVerifiedRecruitmentScraper(provider).run({
  fetchImpl: r.fetchImpl, maxPages: 2, maxDetails: 1, maxRequests: 16,
  now: () => '2026-11-11T06:10:00.000Z', ...limits,
})
const forbidUncontrolledFetch = t => t.mock.method(globalThis, 'fetch', () => assert.fail('Fixture replay forbids uncontrolled HTTP'))
const held = async (r, limits) => {
  try {
    const jobs = await run(r, limits)
    assert.equal(jobs.length, 0)
    return { observations: jobs[RECRUITMENT_OBSERVATIONS] }
  } catch (error) {
    if (error.softFailure !== true || !error.recruitmentObservations) throw error
    return { observations: error.recruitmentObservations, error }
  }
}

test('registered DSM discovery retains its actual complete India role through the distinct PWA program', async t => {
  forbidUncontrolledFetch(t)
  const r = replay(), jobs = await run(r)
  assert.equal(jobs.length, 1)
  const job = jobs[0]
  assert.equal(job.jobId, '562949974226258')
  assert.equal(job.title, 'Technical Consultant - SAP EHS/PLM')
  assert.equal(job.sourceUrl, roleURL)
  assert.equal(job.country, 'India')
  assert.equal(job.nativeHiringOrganization.name, 'dsm-firmenich')
  assert.equal(job.nativeLegalEmployer, null)
  assert.ok(job.jobDescription.startsWith(native.jobDescription), 'Retain the entire unchanged primary native criteria')
  assert.equal(job.sourceDescription, job.jobDescription)
  assert.equal(job.nativeSourceRecord.originalNativeRole.jobDescription, native.jobDescription)
  assert.equal(job.postingDate, null)
  assert.equal(job.postedAt, null)
  assert.equal(job.closingDate, null)
  assert.equal(job.remoteStatus, null)
  assert.equal(job.sourceRemoteStatusUnresolved, true)
  assert.equal(job.sourceDetailComplete, true)
  assert.equal(job.sourceScopeComplete, false)
  assert.equal(job.sourceListingComplete, false)
  assert.equal(job.lifecycleCleanupAllowed, false)
  assert.equal(job.applicationVisited, false)
  assert.equal(readInventoryEvidence(jobs).listingComplete, false)
  assert.ok(jobs[RECRUITMENT_OBSERVATIONS].nativeInventoryReads.some(row => row.kind === 'eightfold-pcsx'))
  assert.ok(r.calls.length <= 16)
  assert.ok(r.calls.every(call => call.method === 'GET'))
  assert.ok(r.calls.filter(call => call.phase === 'closing').length >= 7)
  assert.ok(r.calls.filter(call => call.phase === 'closing').every(call => call.cache === 'no-store'))
})

test('normal DSM processing retains unknown employer publication and original complete criteria', async t => {
  forbidUncontrolledFetch(t)
  const [job] = await run(replay())
  const normalized = normalizeScrapedJob(job, provider)
  assert.equal(normalized.employerPostedAt, null)
  assert.equal(normalized.postedAtProvenance, 'observation')
  assert.equal(normalized.nativePostingDate, null)
  assert.equal(normalized.remoteStatus, null)
  assert.equal(normalized.sourceRemoteStatusUnresolved, true)
  assert.equal(normalized.sourceDescription, job.sourceDescription)
  assert.ok(normalized.sourceDescription.startsWith(native.jobDescription))
})

test('actual company and benefits conditions remain available alongside the entire primary DSM job description', async t => {
  forbidUncontrolledFetch(t)
  const [job] = await run(replay())
  assert.ok(job.jobDescription.startsWith(native.jobDescription), 'The unmodified primary native job description is retained in full')
  assert.ok(job.jobDescription.includes('Company and benefits'))
  assert.ok(job.jobDescription.includes('Our teams are on site at least 60% of the time to connect, depending on the role.'),
    'Do not omit the actual published role-dependent company attendance condition')
  assert.equal(job.sourceDescription, job.jobDescription)
  assert.equal(job.nativeSourceRecord.originalNativeRole.jobDescription, native.jobDescription)
  const normalized = normalizeScrapedJob(job, provider)
  assert.equal(normalized.sourceDescription, job.sourceDescription)
  assert.equal(normalized.remoteStatus, null, 'A role-dependent company condition does not establish this role exact arrangement')
})

test('duplicate own-role JSON identity cannot be erased before the PWA reader validates it', async t => {
  forbidUncontrolledFetch(t)
  const r = replay((url, body) => {
    if (url !== ownURL) return body
    const serialized = JSON.stringify(JSON.parse(body))
    const changed = serialized.replace('"id":562949974226258', '"id":1,"id":562949974226258')
    assert.notEqual(changed, serialized, 'Change the actual original own-role identity key')
    assert.equal(JSON.parse(changed).data.id, native.id)
    return changed
  })
  const result = await held(r)
  assert.ok(result.observations.failures.some(row => row.stage === 'native-eightfold'))
})

test('closing PWA own-role criteria drift withholds the staged complete role', async t => {
  forbidUncontrolledFetch(t)
  const r = replay((url, body, count) => {
    if (url !== ownURL || count !== 2) return body
    const model = JSON.parse(body)
    model.data.jobDescription += '<p>Additional mandatory requirement: eight years of regulated manufacturing experience.</p>'
    return JSON.stringify(model)
  })
  const result = await held(r)
  assert.ok(result.observations.failures.some(row => row.stage === 'native-eightfold'))
})

test('loss of the active closing DSM corporate handoff cannot authorize native output', async t => {
  forbidUncontrolledFetch(t)
  const r = replay((url, body, count) => {
    if (url !== corporateURL || count !== 2) return body
    const changed = body.replaceAll(boardURL, 'https://another-employer.example/careers')
    assert.notEqual(changed, body, 'Remove the actual published current employer handoff')
    return changed
  })
  const result = await held(r)
  assert.ok(result.observations.failures.some(row => row.stage === 'native-eightfold'))
})

test('PWA native JSON must retain its exact response identity and JSON media type', async t => {
  forbidUncontrolledFetch(t)
  for (const change of [
    result => ({ ...result, finalURL: ownURL.replace('562949974226258', '1') }),
    result => ({ ...result, contentType: 'text/html' }),
  ]) {
    const result = await held(replay(undefined, (url, response) => url === ownURL ? change(response) : response))
    assert.ok(result.observations.failures.some(row => row.stage === 'native-eightfold'))
  }
})

test('insufficient total reserve cannot expose a DSM role before all closing reads complete', async t => {
  forbidUncontrolledFetch(t)
  const r = replay(), result = await held(r, { maxRequests: 15 })
  assert.ok(r.calls.length <= 15)
  assert.ok(result.observations.nativeInventoryReads.some(row => row.kind === 'eightfold-pcsx')
    || result.observations.failures.some(row => row.stage === 'native-eightfold'))
})
