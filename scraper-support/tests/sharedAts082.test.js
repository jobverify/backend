import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { gunzipSync } from 'node:zlib'
globalThis.fetch = () => { throw new Error('OFFLINE shared ATS tests require injected transport') }
const { createCatalogScraper, getScraperCatalog, hydrateProviderCatalogEntry } = await import('../providers/index.js')
const { createPublishingGapAtsScraper } = await import('../utils/publishingGapAts.js')
const { readInventoryEvidence, isFreshCompleteInventoryEvidence } = await import('../utils/inventoryEvidence.js')
const { analyzePublishableJobs } = await import('../utils/publishableJobMetrics.js')
const { classifyProviderImplementation } = await import('../../scripts/reportScriptCatalogTopology.js')
const { hasSourceDescription } = await import('../../src/utils/jobSourceContent.js')

const fixtures = JSON.parse(gunzipSync(fs.readFileSync(new URL('./fixtures/sharedAts082.json.gz', import.meta.url))))
// Degreed now has native corporate/board/detail reconciliation, covered in
// scraper/degreed/native.test.js with fresh retained responses and future cases.
// ESW and ExtraHop now verify their current corporate/native protocols. Their
// source-local native tests retain the exact fresh registered responses.
const ids = ['bugcrowd', 'cymulate', 'datagrail']
const unresolvedScopes = new Set(['bugcrowd', 'cymulate'])
// The single-feed captures predate the current Cymulate and DataGrail readers.
const legacyDescriptors = JSON.parse(fs.readFileSync(new URL('../providers/providerExtensions/zzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzz-verified-discovery-adapters-00082.json', import.meta.url)))
const legacyCatalog = new Map(legacyDescriptors.map(row => [row.source, hydrateProviderCatalogEntry(row)]))

for (const source of ['esw', 'extrahop']) test(`${source}: registered native adapter replaces the historical guarded feed with current corporate and geography evidence`, async () => {
  const provider = getScraperCatalog().find(row => row.source === source)
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.sourceScopeComplete, null)
  const current = JSON.parse(gunzipSync(fs.readFileSync(new URL(`../../scraper/${source}/fixtures/registered-native-20261027.json.gz`, import.meta.url))))
  const bodies = new Map(current.responses.map(row => [row.requestedUrl, row.body]))
  let audit
  const jobs = await createCatalogScraper(provider).run({ fetchPage: async url => { assert.ok(bodies.has(url)); return bodies.get(url) }, fetchJson: async url => { assert.ok(bodies.has(url)); return JSON.parse(bodies.get(url)) }, onAudit: value => { audit = value } })
  assert.equal(audit.fullContentCount, source === 'esw' ? 4 : 23)
  assert.equal(audit.healthyNativeCount, source === 'esw' ? 3 : 22)
  assert.equal(jobs.length, 0)
  assert.equal(readInventoryEvidence(jobs).listingComplete, source === 'esw')
  assert.equal(readInventoryEvidence(jobs).reportedTotal, source === 'esw' ? 4 : null)
  assert.equal(readInventoryEvidence(jobs).indiaFacetCount, source === 'esw' ? 0 : null)
})

test('degreed: registered native source replaces the historical shared feed with current full reconciliation', async () => {
  const provider = getScraperCatalog().find(row => row.source === 'degreed')
  assert.equal(provider.adapter, 'script')
  const current = JSON.parse(gunzipSync(fs.readFileSync(new URL('../../scraper/degreed/fixtures/current-native-20261027.json.gz', import.meta.url))))
  const responses = new Map(current.responses.map(row => [row.requestedUrl, row.body]))
  let audit
  const jobs = await createCatalogScraper(provider).run({ onAudit: value => { audit = value }, fetchImpl: async (url, options) => {
    assert.equal(options.method, 'GET')
    assert.ok(responses.has(url), `Unexpected offline Degreed request ${url}`)
    return new Response(responses.get(url))
  } })
  assert.equal(jobs.length, 0)
  assert.equal(audit.nativeJobs.length, 1)
  assert.equal(audit.nativeJobs[0].country, 'United States')
  assert.equal(readInventoryEvidence(jobs).listingComplete, true)
  assert.equal(readInventoryEvidence(jobs).reportedTotal, 1)
  assert.equal(readInventoryEvidence(jobs).indiaFacetCount, 0)
})

for (const source of ids) test(`${source}: ${source === 'bugcrowd' ? 'registered' : 'historical'} shared adapter consumes the complete native feed with guarded scope`, async () => {
  const provider = source === 'bugcrowd' ? getScraperCatalog().find(row => row.source === source) : legacyCatalog.get(source)
  assert.equal(provider.adapter, 'publicAts')
  assert.equal(classifyProviderImplementation(provider).type, 'shared-adapter')
  assert.equal(provider.bindingEvidence.verified, true)
  assert.equal(provider.sourceScopeComplete, false)
  const calls = []
  const jobs = await createCatalogScraper(provider).run({ fetchJson: async url => { calls.push(url); return structuredClone(fixtures[source]) } })
  assert.deepEqual(calls, [`https://boards-api.greenhouse.io/v1/boards/${provider.boardToken}/jobs?content=true`])
  const expected = source === 'bugcrowd' ? 2 : 0
  assert.equal(jobs.length, expected)
  assert.equal(analyzePublishableJobs(jobs).eligibleJobs.length, expected)
  const evidence = readInventoryEvidence(jobs)
  assert.equal(evidence.reportedTotal, fixtures[source].meta.total)
  assert.equal(evidence.indiaFacetCount, unresolvedScopes.has(source) ? null : expected)
  if (unresolvedScopes.has(source)) assert.match(evidence.reason, /native-location-scope-unresolved/)
  assert.equal(evidence.listingComplete, false)
  assert.equal(evidence.status, 'discovery-only')
  assert.equal(isFreshCompleteInventoryEvidence(evidence), false)
  assert.match(evidence.reason, /provider-source-scope-unresolved/)
  for (const job of jobs) {
    const raw = fixtures[source].jobs.find(row => String(row.id) === String(job.jobId))
    assert.ok(raw)
    assert.equal(job.applyUrl, raw.absolute_url)
    assert.equal(new Date(job.postingDate).toISOString(), new Date(raw.first_published).toISOString())
    assert.match(job.jobDescription, /Application Security/)
    assert.match(job.location, /Remote.*India/i)
    assert.equal(job.sourceListingComplete, false)
    assert.equal(job.sourceScopeComplete, false)
    assert.equal(job.lifecycleCleanupAllowed, false)
  }
  const direct = source === 'bugcrowd' ? await import(`../../scraper/${source}/script.js`) : createPublishingGapAtsScraper(provider)
  const directJobs = await direct.run({ fetchJson: async () => structuredClone(fixtures[source]) })
  assert.equal(directJobs.length, expected)
  assert.equal(readInventoryEvidence(directJobs).status, 'discovery-only')
})

test('cymulate: registered native reader reconciles retained corporate, feed and role responses', async () => {
  const { fixture, replay } = await import('../native-sources/declaredJobFeeds/fixtureReplay.js')
  const provider = getScraperCatalog().find(row => row.source === 'cymulate')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.nativeJobFeedProfile, 'cymulate')
  const retained = replay()
  const jobs = await createCatalogScraper(provider).run(retained.options)
  assert.equal(retained.audits.length, 1)
  const audit = retained.audits[0]
  assert.equal(audit.opening.publisherQualified, true)
  assert.equal(audit.closing.publisherQualified, true)
  assert.deepEqual(audit.observations.map(row => row.jobId), fixture.oracle.cymulate.records.map(row => row.id))
  assert.equal(retained.records.length, 1)
  assert.equal(jobs.length, 9, 'Current reader retains unresolved-country candidates without asserting India eligibility')
  assert.ok(jobs.every(job => job.country !== 'India' && job.sourceCountryScopeUnresolved === true))
  assert.ok(jobs.every(job => job.sourceScopeComplete === false && job.lifecycleCleanupAllowed === false))
  assert.equal(readInventoryEvidence(jobs).status, 'discovery-only')
  assert.equal(readInventoryEvidence(jobs).reportedTotal, null)
  assert.equal(isFreshCompleteInventoryEvidence(readInventoryEvidence(jobs)), false)
})

test('datagrail: registered runtime reader requires employer role links before qualifying native scope', async () => {
  const provider = getScraperCatalog().find(row => row.source === 'datagrail')
  assert.equal(provider.adapter, 'publicAts')
  assert.equal(provider.runtimeInventoryVerification.mode, 'role-links-exact')
  const calls = []
  // Synthetic employer markup binds the unchanged archived native response.
  const page = {
    status: 200, url: provider.companyCareerPage,
    html: '<title>DataGrail Careers</title>' + fixtures.datagrail.jobs.map(row => `<a href="${row.absolute_url}">${row.title}</a>`).join(''),
  }
  const options = {
    fetchPage: async url => { calls.push(url); assert.equal(url, provider.companyCareerPage); return page },
    fetchJson: async url => {
      calls.push(url)
      assert.equal(url, `https://boards-api.greenhouse.io/v1/boards/${provider.boardToken}/jobs?content=true`)
      return structuredClone(fixtures.datagrail)
    },
  }
  const jobs = await createCatalogScraper(provider).run(options)
  assert.deepEqual(calls, [provider.companyCareerPage, `https://boards-api.greenhouse.io/v1/boards/${provider.boardToken}/jobs?content=true`])
  assert.equal(jobs.length, 0)
  assert.equal(readInventoryEvidence(jobs).reportedTotal, fixtures.datagrail.jobs.length)
  assert.equal(readInventoryEvidence(jobs).indiaFacetCount, 0)
  assert.equal(isFreshCompleteInventoryEvidence(readInventoryEvidence(jobs)), true)
  const direct = await import('../../scraper/datagrail/script.js')
  const directJobs = await direct.run(options)
  // The standalone factory retains its conservative local descriptor.
  assert.equal(readInventoryEvidence(directJobs).status, 'discovery-only')
  assert.equal(isFreshCompleteInventoryEvidence(readInventoryEvidence(directJobs)), false)
  await assert.rejects(createCatalogScraper(provider).run({
    ...options, fetchPage: async () => ({ ...page, html: '<title>DataGrail Careers</title>' }),
    fetchJson: async () => assert.fail('Unbound employer page must not request the native feed'),
  }), /handoff|binding|scope/i)
})

test('explicit unresolved scope cannot be promoted to complete, including a truly empty native feed', async () => {
  for (const payload of [fixtures.bugcrowd, { jobs: [], meta: { total: 0 } }]) {
    const provider = { source: 'guard', companyName: 'Guard', atsPlatform: 'greenhouse', boardToken: 'bugcrowd', sourceScopeComplete: false }
    const guarded = await createPublishingGapAtsScraper(provider).run({ fetchJson: async () => payload })
    assert.equal(readInventoryEvidence(guarded).listingComplete, false)
    assert.equal(readInventoryEvidence(guarded).status, 'discovery-only')
    const unchangedDefault = await createPublishingGapAtsScraper({ ...provider, sourceScopeComplete: undefined }).run({ fetchJson: async () => payload })
    const defaultEvidence = readInventoryEvidence(unchangedDefault)
    assert.equal(defaultEvidence.listingComplete, payload.jobs.length === 0)
    assert.equal(defaultEvidence.indiaFacetCount, payload.jobs.length === 0 ? 0 : null)
    if (payload.jobs.length) {
      assert.match(defaultEvidence.reason, /native-location-scope-unresolved/)
      assert.ok(unchangedDefault.every(job => job.sourceListingComplete === false))
      assert.equal(isFreshCompleteInventoryEvidence(defaultEvidence), false)
    }
  }
})

test('batch feed failures, truncated totals and missing descriptions retain evidence gaps', async () => {
  const provider = { source: 'guard', companyName: 'Guard', atsPlatform: 'greenhouse', boardToken: 'bugcrowd', sourceScopeComplete: false }
  const run = payload => createPublishingGapAtsScraper(provider).run({ fetchJson: async () => payload })
  await assert.rejects(run({ jobs: [], meta: { total: 8 } }), /Incomplete/)
  await assert.rejects(run({ jobs: [], error: 'upstream failed' }), /Failed/)
  const payload = structuredClone(fixtures.bugcrowd)
  for (const row of payload.jobs) row.content = ''
  const jobs = await run(payload)
  assert.equal(jobs.length, 2)
  assert.equal(analyzePublishableJobs(jobs).eligibleJobs.length, 2)
  assert.ok(jobs.every(job => !hasSourceDescription(job) && !job.jobDescription && !job.sourceDescription))
  assert.ok(jobs.every(job => job.sourceListingComplete === false && job.lifecycleCleanupAllowed === false))
  const evidence = readInventoryEvidence(jobs)
  assert.equal(evidence.listingComplete, false)
  assert.match(evidence.reason, /selected-role-description-unavailable/)
  assert.equal(isFreshCompleteInventoryEvidence(evidence), false)
  await assert.rejects(createPublishingGapAtsScraper(provider).run({ fetchJson: async () => { throw new Error('HTTP 503') } }), /503/)
})
