import assert from 'node:assert/strict'
import test from 'node:test'
import { fixture, replay, editHTML, editJSON } from './fixtureReplay.js'
import { getScraperCatalog, createCatalogScraper } from '../../providers/index.js'
import { normalizeScrapedJob } from '../../utils/normalizeScrapedJob.js'
import { isIndiaJob } from '../../utils/indiaLocationFilter.js'
import { readInventoryEvidence } from '../../utils/inventoryEvidence.js'
import { readSourceObservationEvidence } from '../../utils/sourceObservationEvidence.js'

globalThis.fetch = async () => { throw Error('Offline original entities only: network and website execution prohibited') }
const catalog = getScraperCatalog()
const provider = source => catalog.find(p => p.source === source)
const run = (source, r, options = {}) => createCatalogScraper(provider(source)).run({ ...r.options, ...options })

for (const source of ['pathai', 'lyft']) test(source + ': registered reader retains every published native and linked own-route original before India selection', async () => {
  const r = replay(), expected = fixture.oracle[source], profile = fixture.profiles[source]
  let jobs, error
  try { jobs = await run(source, r) } catch (caught) { error = caught }
  assert.equal(r.audits.length, 1, 'Every original must reach an awaited audit; old failure: ' + error?.message)
  assert.ifError(error)
  const audit = r.audits[0]
  assert.equal(audit.countryFilter, 'India')
  assert.equal(audit.observations.length, expected.records.length)
  assert.deepEqual(audit.observations.map(job => job.jobId), expected.records.map(row => row.id))
  assert.deepEqual(jobs.map(job => job.jobId), expected.records.filter(row => row.indiaCandidate).map(row => row.id))
  assert.deepEqual(r.records[0], audit.observations)
  for (const original of expected.records) {
    const job = audit.observations.find(job => job.jobId === original.id)
    assert.equal(job.company, profile.publisherName)
    assert.equal(job.title, original.title)
    assert.deepEqual(job.sourceNativeListingRecord, original.originalListing)
    assert.deepEqual(job.sourceNativeRecord, original.originalNative)
    assert.equal(job.internalJobId, original.originalNative.internal_job_id)
    assert.equal(job.requisitionId, original.originalNative.requisition_id)
    assert.equal(job.sourceUrl, original.originalNative.absolute_url)
    assert.equal(job.applyUrl, original.originalNative.absolute_url)
    assert.equal(job.sourceResolvedNativePostURI, original.resolvedOwnURI)
    assert.deepEqual(job.sourceNativeRoleRouteChain, original.ownRouteChain)
    assert.equal(job.sourceNativeRoleRouteQualified, true, job.sourceNativeIssues?.join(';'))
    assert.equal(job.sourceNativeOwnHostedPageReadThisRun, true)
    assert.equal(job.sourceNativeHostedPageActivationVerified, false)
    assert.equal(job.sourceCurrentNativePostingIdentityQualified, true)
    for (const [key, value] of Object.entries(original.expectedFields)) assert.deepEqual(job[key], value, source + '/' + original.id + ': ' + key)
    for (const [key, value] of Object.entries(original.expectedGeography)) assert.deepEqual(job[key], value, source + '/' + original.id + ': ' + key)
    for (const fact of original.criteriaFacts) assert.ok(!fact || job.jobDescription?.includes(fact), source + '/' + original.id + ': complete criteria/pay required')
    assert.equal(job.sourceScopeComplete, false);assert.equal(job.sourceDetailComplete, false);assert.equal(job.lifecycleCleanupAllowed, false)
    const normalized = normalizeScrapedJob(job, provider(source))
    assert.equal(normalized.sourceDescription, job.jobDescription)
    assert.equal(normalized.company, profile.publisherName)
    assert.equal(normalized.postedAt.toISOString(), new Date(original.expectedFields.sourcePostingDate).toISOString())
    assert.equal(isIndiaJob(normalized), job.country === 'India')
    if (!job.country) { assert.equal(job.city, null);assert.equal(job.location, null);assert.deepEqual(job.locations, []) }
    if (!job.remoteStatus) assert.notEqual(normalized.remoteStatus, 'On-site')
  }
  if (source === 'pathai') {
    assert.deepEqual(audit.opening.originalNativeDepartments, expected.originalDepartments)
    assert.equal(audit.closing.nativeDepartmentHierarchyQualified, true)
  }
  for (const phase of [audit.opening, audit.closing]) assert.equal(phase.qualified, true, JSON.stringify(phase.issues))
  assert.equal(readInventoryEvidence(jobs).listingComplete, false)
  assert.equal(readInventoryEvidence(jobs).reportedTotal, null)
  assert.equal(readSourceObservationEvidence(jobs, source).observedRecordCount, expected.records.length)
  assert.ok(r.requests.every(url => !/\/apply\b|\/application\b|job_app|application-form|graphql/.test(url)))
  assert.doesNotThrow(() => JSON.stringify(audit))
})

test('PathAI follows only actual published matching-ID redirects and holds a changed closing renderer declaration', async () => {
  const source = 'pathai', first = fixture.oracle[source].records[0], profile = fixture.profiles[source]
  const r = replay((url, page, visit) => url === first.resolvedOwnURI && visit === 2
    ? editHTML(page, raw => raw.replace(profile.ownRoute.scriptURL, 'https://example.invalid/inert-not-a-declaration.js')) : page)
  await run(source, r)
  const job = r.audits[0].observations.find(job => job.jobId === first.id)
  assert.ok(job.jobDescription)
  assert.equal(job.sourceCurrentNativePostingIdentityQualified, false)
  assert.ok(r.requests.includes(first.ownRouteChain[0].url))
  assert.ok(r.requests.includes(first.resolvedOwnURI))
  assert.ok(!r.requests.some(url => url.includes('example.invalid')))
})

test('Lyft holds changed closing own-route title without discarding earlier native criteria', async () => {
  const source = 'lyft', first = fixture.oracle[source].records[0]
  const r = replay((url, page, visit) => url === first.resolvedOwnURI && visit === 2
    ? editHTML(page, raw => raw.replace('<title>Lyft ', '<title>Other employer ')) : page)
  await run(source, r)
  const job = r.audits[0].observations.find(job => job.jobId === first.id)
  assert.ok(job.jobDescription)
  assert.equal(job.sourceCurrentNativePostingIdentityQualified, false)
  assert.equal(job.sourceScopeComplete, false)
})

test('PathAI departments are read independently; an incomplete wider count preserves per-post pairs without zero authority', async () => {
  const source = 'pathai', profile = fixture.profiles[source]
  const r = replay((url, page) => url === profile.publicAPIURL ? editJSON(page, value => { value.meta.total += 1 }) : page)
  const jobs = await run(source, r)
  assert.equal(r.audits[0].observations.length, 10)
  assert.ok(r.requests.includes(profile.publicDepartmentIndexURL))
  assert.equal(r.audits[0].closing.nativeListingComplete, false)
  assert.ok(r.audits[0].observations.every(job => job.sourceCurrentNativePostingIdentityQualified))
  assert.equal(readInventoryEvidence(jobs).reportedTotal, null)
})

test('native and own-route originals reach detached awaited observers before a zero cap', async () => {
  const r = replay(), events = []
  const jobs = await run('pathai', r, { maxJobs: 0,
    onAudit: async audit => { await Promise.resolve();events.push('audit');audit.observations[0].title = 'sink edit' },
    onRecords: async rows => { await Promise.resolve();events.push('records');assert.equal(rows.length, 10);assert.notEqual(rows[0].title, 'sink edit') } })
  assert.equal(jobs.length, 0)
  assert.deepEqual(events, ['audit', 'records'])
})

test('invalid limits, parsed-only input and pre-aborted work fail before any public GET', async () => {
  for (const source of ['pathai', 'lyft']) {
    for (const maxJobs of [-1, Infinity, 1.5, '1']) { const r = replay();await assert.rejects(run(source, r, { maxJobs }), /maxJobs/);assert.equal(r.requests.length, 0) }
    const r = replay()
    await assert.rejects(createCatalogScraper(provider(source)).run({ fetchJson: r.options.fetchJson }), /original HTTP/)
    await assert.rejects(run(source, r, { signal: AbortSignal.abort(Error('cancelled')) }), /cancelled/)
    assert.equal(r.requests.length, 0)
  }
})
