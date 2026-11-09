import assert from 'node:assert/strict'
import test from 'node:test'
import { runApiPortalScraper } from '../apiPortal/engine.js'
import { assertLegacyParsedOnlyRejected, replayCurrentDeclaredNative } from './declaredNativeCoverageCompatibility20261101.fixtures.js'
import { getScraperCatalog, createCatalogScraper } from '../providers/index.js'
import { readInventoryEvidence, isFreshCompleteInventoryEvidence } from '../utils/inventoryEvidence.js'
import { capturedWatchguardRecords, replayRegisteredWatchguard } from './watchguardRegistered20261031.fixture.js'

// Representative native contracts, not captured live responses. See the public
// Lever Postings API and Greenhouse Job Board API schemas.
const catalog = getScraperCatalog()
const runRegistered = (t, source, payload) => {
  const provider = catalog.find(row => row.source === source)
  assert.ok(provider, `registered provider ${source}`)
  t.mock.method(globalThis, 'fetch', async url => {
    const endpoint = new URL(url)
    assert.equal(endpoint.origin + endpoint.pathname, provider.config.discovery.listingApiUrl)
    return Response.json(payload)
  })
  // Synthetic Lever records exercise the active shared API model, not current employer admission.
  return source === 'asapp' ? runApiPortalScraper({ provider, fetchJson: async (url, options) => (await globalThis.fetch(url, options)).json() }) : createCatalogScraper(provider).run()
}

const leverJob = (board, id, location = 'Bengaluru, India') => ({
  id, text: 'Software Engineer', country: 'IN',
  categories: { location, department: 'Engineering', commitment: 'Full-time' },
  hostedUrl: `https://jobs.lever.co/${board}/${id}`,
  applyUrl: `https://jobs.lever.co/${board}/${id}/apply`,
  descriptionPlain: 'Develop reliable payment services.',
  description: '<p>Develop reliable payment services.</p>',
  lists: [{ text: 'Responsibilities', content: '<li>Maintain payment APIs.</li>' },
    { text: 'Qualifications', content: '<li>Experience with distributed systems.</li>' }],
  additionalPlain: 'Employer benefits include paid leave.',
  additional: '<p>Employer benefits include paid leave.</p>',
})

for (const [source, board] of [['asapp', 'asapp-2']]) {
  test(`${source} shared Lever API compatibility retains every native description section`, async t => {
    const jobs = await runRegistered(t, source, [leverJob(board, 'india-role'),
      { ...leverJob(board, 'foreign-role', 'Boston, United States'), country: 'US' }])
    assert.equal(jobs.length, 1)
    assert.equal(jobs[0].source, source)
    assert.equal(jobs[0].jobId, 'india-role')
    assert.equal(jobs[0].jobDescription, 'Develop reliable payment services.\n\nResponsibilities\n<li>Maintain payment APIs.</li>\n\nQualifications\n<li>Experience with distributed systems.</li>\n\nEmployer benefits include paid leave.')
    assert.equal(jobs[0].postingDate, undefined)
    assert.equal(isFreshCompleteInventoryEvidence(readInventoryEvidence(jobs)), true)
  })

  test(`${source} shared Lever API compatibility native foreign countries cannot inflate the India facet or require foreign descriptions`, async t => {
    const record = { ...leverJob(board, 'foreign-only', 'Padova'), country: 'IT',
      descriptionPlain: '', description: '', lists: [], additionalPlain: '', additional: '' }
    const jobs = await runRegistered(t, source, [record])
    assert.equal(jobs.length, 0)
    assert.equal(readInventoryEvidence(jobs).indiaFacetCount, 0)
    assert.equal(readInventoryEvidence(jobs).listingComplete, true)
  })

  test(`${source} shared Lever API compatibility contradictory native country and India location cannot certify a source check`, async t => {
    await assert.rejects(runRegistered(t, source, [{ ...leverJob(board, 'contradictory'), country: 'US' }]), /contradictory country\/location/i)
  })

  test(`${source} shared Lever API compatibility an unresolved alternate location keeps the India facet unknown`, async t => {
    const record = { ...leverJob(board, 'ambiguous', 'Boston, United States'), country: 'US' }
    record.categories.allLocations = ['Boston, United States', 'Remote']
    const jobs = await runRegistered(t, source, [record])
    assert.equal(jobs.length, 0)
    assert.equal(readInventoryEvidence(jobs).listingComplete, false)
    assert.equal(readInventoryEvidence(jobs).indiaFacetCount, null)
  })
}

// WatchGuard's registered source now binds native HTTP/role-schema provenance
// and leaves employer scope unresolved. Bare JSON mapper fixtures cannot stand
// in for that source or certify complete inventory. Keep the four contracts at
// the current registered boundary, using its existing transport-qualified data.
test('watchguard registered reader retains all captured native criteria without certifying source scope', async () => {
  const original = capturedWatchguardRecords()
  const { jobs, audit, calls } = await replayRegisteredWatchguard()
  assert.equal(jobs.length, 0)
  assert.equal(calls.length, 33)
  assert.deepEqual(audit.originalOpening, original)
  assert.deepEqual(audit.originalClosing, original)
  assert.equal(audit.nativeRecords.length, 31)
  for (const [index, role] of audit.nativeRecords.entries()) {
    const raw = original[index]
    assert.deepEqual(role.sourceNativeRecord, raw)
    const introduction = [raw.descriptionPlain, raw.description, raw.descriptionBodyPlain].find(value => value?.trim())
    if (introduction) assert.ok(role.jobDescription.includes(introduction.trim()))
    for (const section of raw.lists) {
      if (section.content?.trim()) assert.ok(role.jobDescription.includes(section.content.trim()), `Missing native criteria for ${raw.id}`)
    }
    const additional = [raw.additionalPlain, raw.additional].find(value => value?.trim())
    if (additional) assert.ok(role.jobDescription.includes(additional.trim()))
  }
  assert.equal(audit.nativeRecords[0].postingDate, '2026-10-15')
  assert.equal(audit.nativeRecords[0].nativeCreatedAt, 1792068974364)
  const evidence = readInventoryEvidence(jobs)
  assert.equal(evidence.status, 'discovery-only')
  assert.equal(evidence.listingComplete, false)
  assert.equal(evidence.reportedTotal, null)
  assert.equal(evidence.indiaFacetCount, null)
  assert.equal(evidence.reason, 'watchguard-publication-provenance-source-scope-unresolved:lever-public-posting-api-incomplete:native-location-scope-unresolved;provider-source-scope-unresolved;api-portal-incomplete-listing-or-role-details:native-location-scope-unresolved;inner-source-listing-incomplete')
  assert.equal(audit.lifecycleCleanupAllowed, false)
})

test('watchguard registered foreign role retains native provenance while the authoritative India count stays unknown', async () => {
  const record = capturedWatchguardRecords().find(row => row.country === 'IT' && row.categories.location === 'Padova')
  assert.ok(record)
  const { jobs, audit, calls } = await replayRegisteredWatchguard({ selectedRecords: [record] })
  assert.equal(jobs.length, 0)
  assert.equal(calls.length, 3)
  assert.equal(audit.strongestEngineEvidence.indiaFacetCount, 0)
  assert.deepEqual(audit.nativeRecords[0].sourceNativeRecord, record)
  assert.equal(readInventoryEvidence(jobs).indiaFacetCount, null)
  assert.equal(readInventoryEvidence(jobs).reportedTotal, null)
  assert.equal(readInventoryEvidence(jobs).listingComplete, false)
  assert.equal(readInventoryEvidence(jobs).reason, 'watchguard-publication-provenance-source-scope-unresolved:lever-public-posting-api-incomplete:provider-source-scope-unresolved')
})

test('watchguard registered native country and India location conflict still rejects the source', async () => {
  const record = capturedWatchguardRecords()[0]
  // Controlled contradiction of the real ES record, rejected before role HTML.
  record.categories.location = 'Bengaluru, India'
  record.categories.allLocations = ['Bengaluru, India']
  await assert.rejects(replayRegisteredWatchguard({ selectedRecords: [record] }), /contradictory country\/location/i)
})

test('watchguard actual unresolved alternate location cannot inherit the primary native country', async () => {
  const record = capturedWatchguardRecords().find(row => row.country === 'US'
    && row.categories.location === 'Seattle, Washington' && row.categories.allLocations.length === 2)
  assert.ok(record)
  assert.deepEqual(record.categories.allLocations, ['Seattle, Washington', 'Miami, FL'])
  const { jobs, audit } = await replayRegisteredWatchguard({ selectedRecords: [record] })
  assert.equal(jobs.length, 0)
  assert.equal(audit.strongestEngineEvidence.listingComplete, false)
  assert.equal(audit.strongestEngineEvidence.indiaFacetCount, null)
  assert.deepEqual(audit.nativeRecords[0].sourceNativeLocationAlternatives, ['Seattle, Washington', 'Miami, FL'])
  assert.equal(readInventoryEvidence(jobs).listingComplete, false)
  assert.equal(readInventoryEvidence(jobs).indiaFacetCount, null)
  assert.equal(readInventoryEvidence(jobs).reason, 'watchguard-publication-provenance-source-scope-unresolved:lever-public-posting-api-incomplete:native-location-scope-unresolved;provider-source-scope-unresolved;api-portal-incomplete-listing-or-role-details:native-location-scope-unresolved;inner-source-listing-incomplete')
})

test('Lever HTML sections survive empty plain-text variants', async t => {
  const row = { ...leverJob('asapp-2', 'html-role'), descriptionPlain: ' ', additionalPlain: '',
    description: '<p>Build employer infrastructure.</p>', additional: '<p>Paid annual leave.</p>' }
  const jobs = await runRegistered(t, 'asapp', [row])
  assert.match(jobs[0].jobDescription, /^<p>Build employer infrastructure\.<\/p>/)
  assert.match(jobs[0].jobDescription, /Maintain payment APIs/)
  assert.match(jobs[0].jobDescription, /<p>Paid annual leave\.<\/p>$/)
  assert.equal(readInventoryEvidence(jobs).listingComplete, true)
})

test('Lever section headings alone do not manufacture a description', async t => {
  const row = { ...leverJob('asapp-2', 'empty-role'), descriptionPlain: '', description: '<p> </p>',
    additionalPlain: '', additional: '', lists: [{ text: 'Responsibilities', content: '<ul></ul>' }] }
  const jobs = await runRegistered(t, 'asapp', [row])
  assert.equal(jobs[0].jobDescription, null)
  assert.equal(readInventoryEvidence(jobs).listingComplete, false)
  assert.equal(jobs[0].sourceListingComplete, false)
})

const greenhouseJob = (id, location = 'Bengaluru, India') => ({
  id, internal_job_id: id + 100, title: 'Software Engineer', location: { name: location },
  absolute_url: `https://job-boards.greenhouse.io/cloudflare/jobs/${id}`,
  content: '<p>Develop and operate edge network services.</p>',
})

test('Cloudflare reconciles the native total without requiring a non-native hasMore flag', async t => {
  const jobs = await runRegistered(t, 'cloudflare', { jobs: [greenhouseJob(1), greenhouseJob(2, 'Austin, United States')], meta: { total: 2 } })
  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].jobId, 1)
  assert.equal(readInventoryEvidence(jobs).reportedTotal, 2)
  assert.equal(isFreshCompleteInventoryEvidence(readInventoryEvidence(jobs)), true)
  assert.notEqual(jobs[0].sourceListingComplete, false)
})

test('Cloudflare missing native total cannot authorize empty inventory', async t => {
  const jobs = await runRegistered(t, 'cloudflare', { jobs: [] })
  assert.equal(jobs.length, 0)
  assert.equal(readInventoryEvidence(jobs).listingComplete, false)
  assert.equal(readInventoryEvidence(jobs).reportedTotal, null)
})

test('Cloudflare truncated listing cannot authorize cleanup', async t => {
  const jobs = await runRegistered(t, 'cloudflare', { jobs: [greenhouseJob(1)], meta: { total: 2 } })
  assert.equal(jobs.length, 1)
  assert.equal(readInventoryEvidence(jobs).listingComplete, false)
  assert.equal(jobs[0].sourceListingComplete, false)
})

test('Cloudflare does not select Indiana or Indianapolis through an India substring match', async t => {
  const jobs = await runRegistered(t, 'cloudflare', { jobs: [greenhouseJob(1),
    greenhouseJob(2, 'Indiana, United States'), greenhouseJob(3, 'Indianapolis, United States')], meta: { total: 3 } })
  assert.deepEqual(jobs.map(job => job.jobId), [1])
  assert.equal(readInventoryEvidence(jobs).reportedTotal, 3)
})

test('ASAPP registered reader rejects the retained parsed-only API fixture before transport', async () => {
  await assertLegacyParsedOnlyRejected('asapp', { fetchJson: async () => [leverJob('asapp-2', 'india-role')] })
})

test('ASAPP registered original HTTP replay retains native criteria while source totals remain unknown', async () => {
  const { audit } = await replayCurrentDeclaredNative('asapp')
  assert.ok(audit.observations.length > 0)
  assert.equal(audit.authoritativeSourceTotal, null)
  assert.equal(audit.authoritativeIndiaFacetCount, null)
})
