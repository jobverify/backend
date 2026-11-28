import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {after, test} from 'node:test'
import {createAaravSolutionsScraper, run, HOMEPAGE_URL, CAREERS_URL} from './script.js'
import {readInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'

const originalFetch = globalThis.fetch
globalThis.fetch = () => { throw Error('Unexpected default network read in captured-response test') }
after(() => { globalThis.fetch = originalFetch })

const fixture = JSON.parse(gunzipSync(readFileSync(new URL('./fixtures/current-structured-20261128.json.gz', import.meta.url))))
const homepage = fixture.packets[0].body, careers = fixture.packets[1].body
const nativeSchemas = html => [...html.matchAll(/<script\b[^>]*\btype=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)]
  .flatMap(match => { const value = JSON.parse(match[1]); return Array.isArray(value) ? value : [value] })
  .filter(value => value['@type'] === 'JobPosting')
const changeSchema = (html, change) => html.replace(/(<script\b[^>]*\btype=["']application\/ld\+json["'][^>]*>)([\s\S]*?)(<\/script>)/gi,
  (full, opening, body, closing) => {
    const value = JSON.parse(body)
    if (!Array.isArray(value) || !value.some(row => row['@type'] === 'JobPosting')) return full
    change(value)
    return opening + JSON.stringify(value) + closing
  })
const reader = (pages = [homepage, careers, homepage, careers]) => {
  const reads = []
  return {reads, fetchPage: async (url, init) => {
    reads.push({url, signal: init?.signal})
    assert.ok(pages.length, 'Unexpected live or uncaptured read')
    return {status: 200, url, html: pages.shift()}
  }}
}
const read = async pages => {
  const io = reader(pages)
  return {jobs: await createAaravSolutionsScraper({now: () => '2026-11-28T03:00:00.000Z'}).run(io), reads: io.reads}
}

test('current genuine native cards retain every authored availability, salary and country criterion', async () => {
  const {jobs, reads} = await read()
  assert.equal(jobs.length, 5)
  assert.equal(reads.length, 4)
  assert.deepEqual(reads.map(row => row.url), [HOMEPAGE_URL, CAREERS_URL, HOMEPAGE_URL, CAREERS_URL])
  for (const job of jobs) {
    assert.match(job.jobDescription, /Availability Immediate to (?:30|60)/)
    assert.match(job.jobDescription, /Salary Competitive, benchmarked to market/)
    assert.match(job.jobDescription, /United States; United Kingdom; Canada; Singapore; India/)
    assert.equal(job.closingDate, '2026-12-31')
    assert.equal(job.city, null)
    assert.equal(job.country, 'India')
    assert.equal(job.sourceDetailComplete, false)
    assert.equal(job.nativeCriteriaTextComplete, true)
    assert.equal(job.sourceScopeComplete, false)
    assert.equal(job.lifecycleCleanupAllowed, false)
    assert.equal(job.sourceApplicationQualificationComplete, false)
    assert.equal(job.sourceRenderedCriteriaComplete, false)
    assert.equal(job.applicationPublicContextValidated, false)
    assert.equal(job.sourceNativeRecord.schema.applicantLocationRequirements.length, 5)
    assert.match(job.sourceNativeRecord.cardHtml, /Immediate to/)
    assert.ok(job.sourceNativeRecord.schema.totalJobOpenings > 0)
  }
  assert.deepEqual(jobs.map(job => job.sourceNativeRecord.schema), nativeSchemas(careers))
  assert.equal(readInventoryEvidence(jobs).listingComplete, false)
  assert.equal(readInventoryEvidence(jobs).lifecycleCleanupAllowed, false)
  assert.equal(jobs.nativeCollectionEvidence.sourceScopeComplete, false)
})

test('exported source entry forwards injected reads and preserves caller cancellation', async () => {
  const io = reader(), controller = new AbortController()
  const previousFetch = globalThis.fetch
  globalThis.fetch = () => { throw Error('Unexpected default network read') }
  try {
    const jobs = await run({...io, signal: controller.signal})
    assert.equal(jobs.length, 5)
    assert.equal(io.reads.length, 4)
    assert.ok(io.reads.every(row => row.signal === controller.signal))
  } finally { globalThis.fetch = previousFetch }
})

test('a pre-aborted caller performs no public read and retains the exact reason', async () => {
  const controller = new AbortController(), reason = Symbol('source cancelled')
  controller.abort(reason)
  let reads = 0
  await assert.rejects(async () => run({signal: controller.signal, fetchPage: async () => { reads++; throw Error('must not read') }}),
    error => error === reason)
  assert.equal(reads, 0)
})

test('late injected data never commits jobs after the caller aborts', async () => {
  const controller = new AbortController(), reason = {reason: 'opaque caller cancellation'}
  const io = reader()
  await assert.rejects(() => createAaravSolutionsScraper().run({signal: controller.signal, fetchPage: async (url, init) => {
    const page = await io.fetchPage(url, init)
    if (url === CAREERS_URL) controller.abort(reason)
    return page
  }}), error => error === reason)
  assert.equal(io.reads.length, 2)
})

for (const [label, mutation] of [
  ['unknown applicant eligibility', rows => { rows[0].applicantLocationRequirements.push({'@type': 'Country', name: 'Atlantis'}) }],
  ['extra workplace country', rows => { rows[0].jobLocation = {address: {addressCountry: 'Germany'}} }],
  ['unknown schema criterion', rows => { rows[0].additionalCountry = 'Germany' }],
  ['wrong employer', rows => { rows[0].hiringOrganization.name = 'Another Employer' }],
  ['foreign employer host', rows => { rows[0].hiringOrganization.sameAs = 'https://aaravsolutions.com.example/' }],
  ['foreign native identity', rows => { rows[0].url = rows[0].url.replace('www.aaravsolutions.com', 'example.com') }],
  ['encoded native fragment', rows => { rows[0].url = rows[0].url.replace('#lead-', '#%6cead-') }],
  ['duplicate native identity', rows => { rows[1].url = rows[0].url }],
  ['native title contradiction', rows => { rows[0].title = 'Another role' }],
  ['native skill contradiction', rows => { rows[0].description += '<p>New required qualification</p>' }],
  ['typed opening count', rows => { rows[0].totalJobOpenings = '1' }],
  ['opening count contradiction', rows => { rows[0].totalJobOpenings = 2 }],
  ['impossible closing date', rows => { rows[0].validThrough = '2026-02-30' }],
  ['unknown native location mode', rows => { rows[0].jobLocationType = 'ON_SITE' }],
  ['native practice contradiction', rows => { rows[0].occupationalCategory = 'Another practice' }],
  ['closing before posting', rows => { rows[0].validThrough = '2026-09-10' }],
]) test(`current native reconciliation rejects ${label}`, async () => {
  const changed = changeSchema(careers, mutation)
  await assert.rejects(() => read([homepage, changed, homepage, changed]), /Aarav/)
})

test('India eligibility is never inferred from the employer or the remote label', async () => {
  const changed = changeSchema(careers, rows => {
    for (const row of rows) row.applicantLocationRequirements = [{ '@type': 'Country', name: 'United States' }]
  })
  await assert.rejects(() => read([homepage, changed, homepage, changed]), /no verified India roles/)
})

test('paired complete raw criteria detect a closing change outside the schema description', async () => {
  const changed = careers.replace('Immediate to 30 days', 'Immediate to 31 days')
  await assert.rejects(() => read([homepage, careers, homepage, changed]), /closing.*criteria.*changed/)
})

test('current criteria lose qualification when a full native metadata box disappears', async () => {
  const changed = careers.replace(/<dl>[\s\S]*?<\/dl>/, '')
  const {jobs} = await read([homepage, changed, homepage, changed])
  assert.equal(jobs[0].sourceDetailComplete, false)
  assert.equal(jobs[0].nativeCriteriaTextComplete, false)
  assert.match(jobs[0].sourceNativeRecord.cardHtml, /ac-apply-box/)
})

for (const [label, changed] of [
  ['native workplace disagreement', careers.replace('<dd>Remote</dd>', '<dd>Germany</dd>')],
  ['unreviewed card geography', careers.replace('class="ac-role"', 'class="ac-role" data-country="Germany"')],
  ['object-supplied criteria', careers.replace('<div class="ac-role-summary">', '<object data="https://another.example/criteria"></object><div class="ac-role-summary">')],
]) test(`current full native role holds ${label}`, async () => {
  await assert.rejects(() => read([homepage, changed, homepage, changed]), /Aarav/)
})

for (const [label, redirected] of [['employer', HOMEPAGE_URL], ['careers', CAREERS_URL]])
  test(`a ${label} response from another origin never establishes first-party authority`, async () => {
    const io = reader()
    await assert.rejects(() => createAaravSolutionsScraper().run({fetchPage: async (url, init) => {
      const page = await io.fetchPage(url, init)
      return url === redirected ? {...page, url: 'https://another.example/careers/'} : page
    }}), /Aarav/)
  })
