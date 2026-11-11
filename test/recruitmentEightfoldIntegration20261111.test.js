import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { gunzipSync } from 'node:zlib'
import { createHash } from 'node:crypto'
import { getScraperCatalog } from '../scraper-support/providers/index.js'
import { createVerifiedRecruitmentScraper, RECRUITMENT_OBSERVATIONS } from '../scraper-support/utils/verifiedRecruitment.js'
import { readInventoryEvidence } from '../scraper-support/utils/inventoryEvidence.js'
import { normalizeScrapedJob } from '../scraper-support/utils/normalizeScrapedJob.js'

const provider = getScraperCatalog().find(row => row.source === 'bayer')
const fixture = JSON.parse(gunzipSync(readFileSync(new URL('./fixtures/recruitment-eightfold-classic-20261111.json.gz', import.meta.url))))
const captured = new Map()
for (const original of fixture.responses) {
  const bytes = Buffer.from(original.bodyBase64, 'base64')
  assert.equal(createHash('sha256').update(bytes).digest('hex'), original.bodySHA256)
  const row = { ...original, body: bytes.toString('utf8') }
  const rows = captured.get(row.requestedURL) || []
  rows.push(row); captured.set(row.requestedURL, rows)
}
const ownURL = 'https://talent.bayer.com/api/apply/v2/jobs/562949978833200?domain=bayer.com'
const roleURL = 'https://talent.bayer.com/careers/job/562949978833200'
const corporateURL = 'https://www.bayer.in/en-in/careers'
const native = JSON.parse(captured.get(ownURL)[0].body)

const replay = (change = (_, body) => body, alterResponse = (_, result) => result) => {
  const calls = [], counts = new Map()
  return { calls, fetchImpl: async (url, init) => {
    const rows = captured.get(url)
    assert.ok(rows, 'Only the captured current public declaration transaction may be requested: ' + url)
    const count = (counts.get(url) || 0) + 1
    assert.ok(count <= rows.length, 'No uncontrolled repeated public request: ' + url)
    counts.set(url, count)
    const row = rows[count - 1]
    calls.push({ url, method: init.method || 'GET', cache: init.cache, phase: row.phase, redirect: init.redirect })
    const result = alterResponse(url, { status: row.status, finalURL: row.finalURL, contentType: row.contentType }, count)
    const response = new Response(change(url, row.body, count), { status: result.status, headers: { 'content-type': result.contentType } })
    Object.defineProperty(response, 'url', { value: result.finalURL })
    return response
  } }
}
const run = (r, limits = {}) => createVerifiedRecruitmentScraper(provider).run({
  fetchImpl: r.fetchImpl, maxPages: 2, maxDetails: 1, maxRequests: 16,
  now: () => '2026-11-11T05:50:00.000Z', ...limits,
})
const forbidUncontrolledFetch = t => t.mock.method(globalThis, 'fetch', () => assert.fail('Current transaction replay forbids uncontrolled HTTP'))
const held = async (r, limits) => {
  try {
    const jobs = await run(r, limits)
    assert.equal(jobs.length, 0)
    return { jobs, observations: jobs[RECRUITMENT_OBSERVATIONS] }
  } catch (error) {
    if (error.softFailure !== true || !error.recruitmentObservations) throw error
    return { jobs: [], observations: error.recruitmentObservations, error }
  }
}

test('registered Bayer discovery retains one actual complete India role through its current declared Eightfold program', async t => {
  forbidUncontrolledFetch(t)
  const r = replay(), jobs = await run(r)
  assert.equal(jobs.length, 1)
  const job = jobs[0]
  assert.equal(job.jobId, '562949978833200')
  assert.equal(job.title, 'Principal Product Manager IT/OT D-Hub')
  assert.equal(job.sourceUrl, roleURL)
  assert.equal(job.country, 'India')
  assert.equal(job.nativeHiringOrganization.name, 'Bayer')
  assert.equal(job.nativeLegalEmployer, null)
  assert.equal(job.jobDescription, native.job_description, 'Retain the entire original rendered native criteria, including every condition')
  assert.equal(job.sourceDescription, native.job_description)
  assert.equal(job.postingDate, null, 'A native modification projected into schema metadata is not original publication')
  assert.equal(job.postedAt, null)
  assert.equal(job.closingDate, null, 'Generated 180-day expiry is not a real application deadline')
  assert.equal(job.remoteStatus, null)
  assert.equal(job.sourceRemoteStatusUnresolved, true)
  assert.equal(job.sourcePublicationDateUnavailable, true)
  assert.equal(job.sourceDetailComplete, true)
  assert.equal(job.sourceScopeComplete, false)
  assert.equal(job.sourceListingComplete, false)
  assert.equal(job.lifecycleCleanupAllowed, false)
  assert.equal(job.applicationVisited, false)
  assert.ok(JSON.stringify(job.nativeSourceRecord).includes('896367'), 'Preserve the original ATS requisition')
  assert.ok(JSON.stringify(job.nativeSourceRecord).includes('1793955952'), 'Preserve raw update evidence separately')
  assert.equal(readInventoryEvidence(jobs).listingComplete, false)
  assert.ok(jobs[RECRUITMENT_OBSERVATIONS].nativeInventoryReads.some(row => row.kind?.includes('eightfold')))
  assert.ok(r.calls.length <= 16)
  assert.ok(r.calls.every(call => call.method === 'GET'))
  assert.ok(r.calls.filter(call => call.phase === 'closing').length >= 6)
  assert.ok(r.calls.filter(call => call.phase === 'closing').every(call => call.cache === 'no-store'))
})

test('normal processing retains unknown Bayer employer publication and work arrangement', async t => {
  forbidUncontrolledFetch(t)
  const [job] = await run(replay())
  const normalized = normalizeScrapedJob(job, provider)
  assert.equal(normalized.employerPostedAt, null)
  assert.equal(normalized.postedAtProvenance, 'observation', 'Scrape time is only the existing observation fallback')
  assert.equal(normalized.nativePostingDate, null)
  assert.equal(normalized.sourcePublicationDateUnavailable, true)
  assert.equal(normalized.remoteStatus, null, 'An India city cannot supply an unverified work arrangement')
  assert.equal(normalized.sourceRemoteStatusUnresolved, true)
  assert.equal(normalized.sourceDescription, native.job_description, 'Normal processing retains the entire unmodified original criteria')
})

test('raw native JSON identity duplicates survive shared transport and cannot expose a staged Bayer role', async t => {
  forbidUncontrolledFetch(t)
  const r = replay((url, body) => {
    if (url !== ownURL) return body
    const parsed = JSON.parse(body), serialized = JSON.stringify(parsed)
    const changed = serialized.replace('"id":562949978833200', '"id":1,"id":562949978833200')
    assert.notEqual(changed, serialized, 'Mutate the actual original native JSON identity')
    assert.equal(JSON.parse(changed).id, parsed.id, 'Ordinary JSON.parse would hide the original conflicting key')
    return changed
  })
  const result = await held(r)
  assert.ok(result.observations.failures.some(row => row.stage === 'native-eightfold'))
})

test('parsed-only JSON injection cannot manufacture original native JSON evidence', async t => {
  forbidUncontrolledFetch(t)
  const r = replay((url, body) => {
    if (url !== ownURL) return body
    const serialized = JSON.stringify(JSON.parse(body))
    const changed = serialized.replace('"id":562949978833200', '"id":1,"id":562949978833200')
    assert.notEqual(changed, serialized)
    return changed
  })
  const result = await held(r, { fetchImpl: undefined,
    fetchPage: async (url, init) => {
      const response = await r.fetchImpl(url, init)
      return { status: response.status, url: response.url, html: await response.text(), contentType: response.headers.get('content-type') }
    },
    fetchJson: async (url, init) => (await r.fetchImpl(url, init)).json(),
  })
  assert.ok(result.observations.failures.some(row => row.stage === 'native-eightfold'))
})

test('a raw native transport takes precedence over a supplied parsed JSON hook', async t => {
  forbidUncontrolledFetch(t)
  const r = replay(), jobs = await run(r, { fetchJson: async () => ({ ...native, id: 1 }) })
  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].jobId, '562949978833200')
  assert.equal(jobs[0].jobDescription, native.job_description)
})

test('closing own-role criteria changes withhold the staged full Eightfold role', async t => {
  forbidUncontrolledFetch(t)
  const r = replay((url, body, count) => {
    if (url !== ownURL || count !== 2) return body
    const parsed = JSON.parse(body)
    parsed.job_description += '<p>Additional mandatory requirement: five years of regulated manufacturing experience.</p>'
    return JSON.stringify(parsed)
  })
  const result = await held(r)
  assert.ok(result.observations.failures.some(row => row.stage === 'native-eightfold'))
})

test('loss of the actual closing corporate account handoff cannot authorize native Bayer output', async t => {
  forbidUncontrolledFetch(t)
  const r = replay((url, body, count) => {
    if (url !== corporateURL || count !== 2) return body
    const changed = body.replaceAll('https://talent.bayer.com/careers?domain=bayer.com', 'https://talent.bayer.com/careers?domain=another-employer.example')
    assert.notEqual(changed, body, 'Change the actual active published account declaration')
    return changed
  })
  const result = await held(r)
  assert.ok(result.observations.failures.some(row => row.stage === 'native-eightfold'))
})

test('native Eightfold JSON requires its exact current response URL and JSON content type', async t => {
  forbidUncontrolledFetch(t)
  for (const change of [
    result => ({ ...result, finalURL: 'https://talent.bayer.com/api/apply/v2/jobs/1?domain=bayer.com' }),
    result => ({ ...result, contentType: 'text/html' }),
  ]) {
    const r = replay(undefined, (url, result) => url === ownURL ? change(result) : result)
    const result = await held(r)
    assert.ok(result.observations.failures.some(row => row.stage === 'native-eightfold'))
  }
})

test('insufficient closing reserve yields no Eightfold jobs and respects the total shared request cap', async t => {
  forbidUncontrolledFetch(t)
  const r = replay(), result = await held(r, { maxRequests: 12 })
  assert.ok(r.calls.length <= 12)
  assert.ok(result.observations.nativeInventoryReads.some(row => row.kind?.includes('eightfold'))
    || result.observations.failures.some(row => row.stage === 'native-eightfold'))
})
