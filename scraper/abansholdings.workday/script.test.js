import fs from 'node:fs'
import { gunzipSync } from 'node:zlib'
import test from 'node:test'
import assert from 'node:assert/strict'
import { run } from './script.js'
import { readInventoryEvidence, isFreshCompleteInventoryEvidence } from '../../scraper-support/utils/inventoryEvidence.js'

const root = 'https://abansfinserv.com/'
const careers = 'https://abanscareers.com/'
const openings = careers + 'career-openings.aspx'
const native = 'https://abans.keka.com/careers'
const identifier = '7f72cc0e-e77b-4832-9d67-8b9c42a4da9d'
const active = native + '/api/embedjobs/default/active/' + identifier
const renderer = native + '/api/embedjobs/js/' + identifier
const fixture = () => JSON.parse(gunzipSync(fs.readFileSync(new URL('./fixtures/current-native-20261024.json.gz', import.meta.url))))
const options = f => {
  let reads = 0
  return { now: () => f.capturedAt, fetchPage: async url => {
    assert.ok(Object.hasOwn(f.pages, url), 'Unobserved public page ' + url)
    return f.pages[url]
  }, fetchJson: async url => {
    if (url === active) return ++reads === 1 ? f.first : f.last
    if (url === native + '/api/organization/default/careerportalinfo') return f.organization
    assert.equal(url, native + '/api/embedjobs/grouplinkstatus/' + identifier)
    return f.groupLink
  } }
}

test('Abans extracts ten proven India roles with original native publisher, full HTML and dates without claiming Holdings-only completeness', async () => {
  const f = fixture(), jobs = await run(options(f))
  assert.equal(jobs.length, 10)
  for (const job of jobs) {
    const record = f.first.find(row => String(row.id) === job.jobId)
    assert.ok(record)
    assert.equal(job.company, 'ABANS GROUP')
    assert.equal(job.country, 'India')
    assert.equal(job.sourceDescription, record.description)
    assert.ok(job.jobDescription.length > 500)
    assert.equal(job.postingDate, new Date(record.publishedOn).toISOString())
    assert.equal(job.nativePublishedOn, record.publishedOn)
    assert.equal(job.applyUrl, native + '/jobdetails/' + record.id)
    assert.equal(job.sourceScopeComplete, false)
    assert.equal(job.sourceListingComplete, false)
    assert.equal(job.lifecycleCleanupAllowed, false)
  }
  assert.ok(!jobs.some(job => job.jobId === '163213'), 'Missing native geography is not inferred from headquarters or narrative mentions')
  const evidence = readInventoryEvidence(jobs)
  assert.equal(evidence.listingComplete, false)
  assert.equal(evidence.reportedTotal, null)
  assert.equal(evidence.indiaFacetCount, null)
  assert.equal(isFreshCompleteInventoryEvidence(evidence), false)
})

for (const [name, change] of [
  ['missing corporate delegation', f => { f.pages[root].html = '<title>Abans</title>' }],
  ['inactive career delegation', f => { f.pages[openings].html = '<title>Current Openings - Abans Careers</title><object data="/existing.pdf"><a href="https://abans.keka.com/careers">Click Here</a></object>' }],
  ['unrelated first-party final URL', f => { f.pages[careers].finalUrl = 'https://unrelated.example/careers' }],
  ['wrong native organization', f => { f.organization.name = 'Other Employer' }],
  ['wrong native reciprocal company website', f => { f.organization.companyWebsite = 'https://unrelated.example/' }],
  ['wrong native portal domain', f => { f.organization.careersPortalDomain = 'other.keka.com' }],
  ['unreviewed linked-group contract', f => { f.groupLink.isGroupLinked = true }],
  ['changed renderer inventory contract', f => { f.pages[renderer].html = f.pages[renderer].html.replace('api/embedjobs/${portalName}/active/', 'api/embedjobs/${portalName}/paginated/') }],
  ['failed native payload', f => { f.first = { error: 'unavailable' } }],
  ['repeated native job identity', f => { f.first[1].id = f.first[0].id }],
  ['contradictory native country', f => { f.first[0].jobLocations[0].countryName = 'United States' }],
  ['missing full native description', f => { f.first[0].description = '<template>Not active role content</template>' }],
  ['missing original native publication date', f => { f.first[0].publishedOn = null }],
  ['final native inventory drift', f => { f.last[0].title += ' changed' }],
]) test('Abans rejects ' + name + ' without certifying source inventory', async () => {
  const f = fixture(); change(f)
  await assert.rejects(run(options(f)))
})

test('Abans preserves cancellation at the official response boundary before another request', async () => {
  const f = fixture(), controller = new AbortController(), reason = new Error('cancel Abans after corporate response')
  let calls = 0
  await assert.rejects(run({ signal: controller.signal, fetchPage: async () => { calls++; controller.abort(reason); return f.pages[root] }, fetchJson: async () => assert.fail('must not request native inventory') }), error => error === reason)
  assert.equal(calls, 1)
})

test('Abans refuses caller caps and preserves blocked HTTP stage and final URL', async () => {
  await assert.rejects(run({ ...options(fixture()), maxJobs: 1 }), /cap|limit/i)
  await assert.rejects(run({ fetchPage: async () => ({ status: 403, finalUrl: root, html: '<title>Forbidden</title>' }) }), error => error.softFailure === true && error.failureKind === 'blocked_or_access_denied' && error.stage === 'official-corporate' && error.finalUrl === root)
})

for (const publishedOn of [
  '2026-09-31T00:00:00Z', '2026-02-29T00:00:00Z', '2024-02-30T00:00:00Z',
  '2026-04-31T00:00:00+05:30', '2026-10-01T24:00:00Z', '2026-10-01T12:60:00Z',
  '2026-10-01T12:00:60Z', '2026-10-01T00:00:00+24:00',
  '2026-10-01', '2026-10-01T09:11:52.773', '2040-01-01T00:00:00Z',
]) test('Abans rejects non-native, invalid-calendar or future publication timestamp ' + publishedOn, async () => {
  const f = fixture()
  for (const rows of [f.first, f.last]) rows.find(row => row.id === 163779).publishedOn = publishedOn
  await assert.rejects(run(options(f)), /publication date/i)
})

test('Abans retains a legitimate native timezone literal and its exact publication instant', async () => {
  const f = fixture(), publishedOn = '2026-10-01T14:41:52.7730000+05:30'
  for (const rows of [f.first, f.last]) rows.find(row => row.id === 163779).publishedOn = publishedOn
  const job = (await run(options(f))).find(row => row.jobId === '163779')
  assert.equal(job.nativePublishedOn, publishedOn)
  assert.equal(job.postingDate, '2026-10-01T09:11:52.773Z')
})
