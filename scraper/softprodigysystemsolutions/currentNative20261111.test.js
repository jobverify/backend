import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { gunzipSync } from 'node:zlib'
import test from 'node:test'
import { run, HOMEPAGE_URL, KEKA_BOARD_URL, KEKA_ACTIVE_JOBS_API_URL } from './script.js'
import { readInventoryEvidence } from '../../scraper-support/utils/inventoryEvidence.js'
import { normalizeScrapedJob } from '../../scraper-support/utils/normalizeScrapedJob.js'

const fixture = JSON.parse(gunzipSync(readFileSync(new URL('./test-data/current-native-20261111.json.gz', import.meta.url))))
const CLIENT = 'https://cdn.keka.com/careers/v/2026/scripts/app/app.min.js'
const ACCOUNT = KEKA_BOARD_URL + 'api/organization/default/careerportalinfo'
const DETAIL = KEKA_BOARD_URL + 'jobdetails/135020'
const response = (url, value, mime = 'text/html', status = 200) => {
  const reply = new Response(typeof value === 'string' ? value : JSON.stringify(value), { status, headers: { 'content-type': mime } })
  Object.defineProperty(reply, 'url', { value: url })
  return reply
}
const exercise = ({ homepage = fixture.homepage, portal = fixture.portal, client = fixture.client,
  account = fixture.account, rows = fixture.rows, detail = fixture.detail, denied = false, signal, onAudit,
  closingChange = null, calls = new Map() } = {}) => run({
  fetchText: async url => url === HOMEPAGE_URL ? homepage : portal,
  fetchJson: async () => structuredClone(rows),
  fetchImpl: async (url, init) => {
    assert.equal(init.method, 'GET')
    const count = (calls.get(url) || 0) + 1
    calls.set(url, count)
    if (url === HOMEPAGE_URL) return response(url, count > 1 && closingChange === 'handoff'
      ? homepage.replaceAll('href="https://softprodigy.keka.com/careers/"', 'hidden href="https://softprodigy.keka.com/careers/"') : homepage)
    if (url === KEKA_BOARD_URL) return response(url, portal)
    if (url === CLIENT) return response(url, client, 'application/x-javascript')
    if (url === ACCOUNT) return response(url, count > 1 && closingChange === 'account' ? { ...account, companyWebsite: 'https://other.example/' } : account, 'application/json')
    if (url === KEKA_ACTIVE_JOBS_API_URL) return response(url, denied ? 'Denied' : count > 1 && closingChange === 'removed-role' ? rows.slice(1) : rows,
      denied ? 'text/html' : 'application/json', denied ? 403 : 200)
    if (url === DETAIL) return response(url, count > 1 && closingChange === 'detail' ? detail.replace('MBA preferred but not mandatory', 'MBA required') : detail)
    throw Error('Unexpected native request: ' + url)
  },
  now: () => '2026-11-11T03:30:00.000Z', signal, onAudit,
})

test('current declared legacy Keka client qualifies only the role whose own full criteria explicitly name India', async () => {
  const jobs = await exercise()
  assert.equal(jobs.length, 1)
  const [job] = jobs
  assert.equal(job.jobId, '135020')
  assert.equal(job.company, 'SoftProdigy System Solutions Pvt. Ltd.')
  assert.equal(job.country, 'India')
  assert.equal(job.city, 'Mohali')
  assert.equal(job.source, 'softprodigysystemsolutions')
  assert.equal(job.applyUrl, DETAIL)
  assert.equal(job.postingDate, '2026-09-16T08:20:45.340Z')
  assert.equal(job.sourceNativePublishedOn, '2026-09-16T08:20:45.34Z')
  assert.equal(job.experienceRequired, null)
  assert.match(job.jobDescription, /6-8 years in digital marketing/)
  assert.match(job.jobDescription, /MBA preferred but not mandatory/)
  assert.equal(job.closingDate, null)
  assert.equal(job.sourceScopeComplete, false)
  assert.equal(job.lifecycleCleanupAllowed, false)
  assert.equal(readInventoryEvidence(jobs).listingComplete, false)
  assert.equal(readInventoryEvidence(jobs).reportedTotal, null)
})

test('conflicting native sidebar and full-role experience cannot become a resolved public range', async () => {
  const [job] = await exercise()
  assert.equal(job.sourceNativeRecord.experience, '6-7')
  assert.match(job.sourceNativeDescriptionHtml, /6-8 years in digital marketing/)
  assert.match(job.jobDescription, /6-8 years in digital marketing/)
  assert.match(job.jobDescription, /Experience listed in job summary: 6-7/)
  assert.equal(job.experienceRequired, null)
  assert.equal(job.sourceExperienceRequired, null)
  assert.equal(job.sourceExperienceScopeUnresolved, true)
  assert.equal(job.publicExperienceChecked, false)
  assert.equal(job.skipPublicExperienceEnrichment, true)
  const normalized = normalizeScrapedJob(job)
  assert.equal(normalized.experienceRequired, null)
  assert.equal(normalized.experienceProfile.minimumYears, null)
  assert.equal(normalized.experienceProfile.maximumYears, null)
  assert.notEqual(normalized.experienceProfile.confidence, 'high')
  assert.deepEqual(normalized.experienceYears, [])
  assert.match(normalized.sourceDescription, /6-8 years in digital marketing/)
  assert.match(normalized.sourceDescription, /Experience listed in job summary: 6-7/)
})

test('a role with only a city and no explicit country cannot inherit the publisher country', async () => {
  await assert.rejects(exercise({ rows: fixture.rows.slice(1) }), /qualified|country|India/i)
})

test('a nonexistent native calendar day cannot be normalized into a different original publication date', async () => {
  const rows = structuredClone(fixture.rows)
  rows[0].publishedOn = '2026-02-30T08:20:45.34Z'
  await assert.rejects(exercise({ rows }), /publication|date/i)
})

test('structured foreign country and an India description are contradictory', async () => {
  const rows = structuredClone(fixture.rows)
  rows[0].jobLocations = [{ city: 'Mohali', countryName: 'Singapore', countryCode: 'SG' }]
  await assert.rejects(exercise({ rows }), /country|contradictory|location/i)
})

test('the native account cannot move to another publisher or tenant', async () => {
  await assert.rejects(exercise({ account: { ...fixture.account, name: 'Other Employer' } }), /employer|account|publisher/i)
  await assert.rejects(exercise({ account: { ...fixture.account, careersPortalDomain: 'other.keka.com' } }), /employer|account|publisher/i)
})

test('a truncated full hosted role cannot qualify the intact listing description', async () => {
  const finalCriterion = '6-8 years of overall digital marketing experience, including SEO/SMO/PPC hands-on work.'
  assert(fixture.detail.includes(finalCriterion))
  const detail = fixture.detail.replace(finalCriterion, '')
  await assert.rejects(exercise({ detail }), /content|criteria|description/i)
})

test('a changed current public Keka executable cannot authorize historical API routes', async () => {
  await assert.rejects(exercise({ client: fixture.client + '\nchanged();' }), /client|renderer|contract/i)
})

test('an HTTP denial or an empty native inventory cannot be promoted to successful zero', async () => {
  await assert.rejects(exercise({ denied: true }), error => error.status === 403)
  await assert.rejects(exercise({ rows: [] }), /inventory|roles|qualified/i)
})

test('an inert first-party handoff does not bind the exact native employer', async () => {
  const homepage = fixture.homepage.replaceAll('href="https://softprodigy.keka.com/careers/"', 'hidden href="https://softprodigy.keka.com/careers/"')
  await assert.rejects(exercise({ homepage }), /handoff|binding/i)
})

test('cancellation prevents every current source request', async () => {
  const reason = Error('cancel SoftProdigy source')
  await assert.rejects(exercise({ signal: AbortSignal.abort(reason) }), error => error === reason)
})

for (const closingChange of ['handoff', 'account', 'removed-role', 'detail']) {
  test('a positive native role is withheld when closing ' + closingChange + ' changes', async () => {
    await assert.rejects(exercise({ closingChange }), /handoff|account|employer|closing|criteria|description/i)
  })
}
