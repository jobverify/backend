import assert from 'node:assert/strict'
import { fixture, replay, mutateJSON } from './fixtureReplay.js'
import { getScraperCatalog, createCatalogScraper } from '../../providers/index.js'
import { readInventoryEvidence } from '../../utils/inventoryEvidence.js'
import { normalizeScrapedJob } from '../../utils/normalizeScrapedJob.js'
import { isIndiaJob } from '../../utils/indiaLocationFilter.js'
export const assertCurrentProvider = source => {
  const provider = getScraperCatalog().find(provider => provider.source === source)
  assert.ok(provider);assert.equal(provider.adapter, 'script')
  assert.equal(provider.nativeJobFeedProfile, source)
  assert.equal(provider.verifiedOn, null);assert.equal(provider.verifiedPublicJobCount, null);assert.equal(provider.verifiedIndiaJobCount, null)
  assert.equal(provider.verifiedInventoryStatus, 'unverified');assert.equal(provider.boardIdentityVerified, false)
  assert.equal(provider.sourceScopeComplete, false);assert.equal(provider.lifecycleCleanupAllowed, false)
  assert.equal(provider.scraperTimeoutMs, 900000)
  return provider
}
export const checkCurrentReplay = async (source, scenario = 'complete') => {
  const provider = getScraperCatalog().find(provider => provider.source === source), profile = fixture.profiles[source]
  if (scenario === 'abort') {
    const r = replay(), signal = AbortSignal.abort(Error('native replay cancelled'))
    await assert.rejects(createCatalogScraper(provider).run({ ...r.options, signal }), /cancelled/)
    assert.equal(r.requests.length, 0);return
  }
  if (scenario === 'india') {
    const first = fixture.oracle[source].records[0], id = first.id
    const edit = record => { record.location = { name:'Remote India' };record.offices = [];record.metadata = [] }
    const r = replay((url, page) => {
      if (url === profile.publicAPIURL) return mutateJSON(page, value => { value.jobs = [structuredClone(value.jobs[0])];edit(value.jobs[0]);value.meta.total = 1 })
      if (url === profile.publicAPIBase + '/offices') return mutateJSON(page, value => { value.offices = [] })
      if (url === profile.publicAPIBase + '/jobs/' + id + '?pay_transparency=true') return mutateJSON(page, edit)
      return page
    })
    const jobs = await createCatalogScraper(provider).run(r.options)
    assert.equal(jobs.length, 1);assert.equal(r.audits[0].observations.length, 1)
    assert.equal(jobs[0].country, 'India');assert.ok(jobs[0].jobDescription.includes(first.bodyText))
    assert.equal(isIndiaJob(normalizeScrapedJob(jobs[0], provider)), true)
    assert.equal(readInventoryEvidence(jobs).listingComplete, false);return
  }
  const r = replay((url, page, visit) => scenario === 'primary' && url === profile.primaryURL && visit === 2
    ? { ...page, status:502 } : page)
  const jobs = await createCatalogScraper(provider).run({ ...r.options, ...(scenario === 'cap' ? { maxJobs:0 } : {}) })
  assert.equal(r.audits.length, 1);const audit = r.audits[0]
  assert.equal(audit.observations.length, fixture.oracle[source].records.length)
  assert.equal(audit.sourceScopeComplete, false);assert.equal(audit.authoritativeSourceTotal, null)
  assert.equal(readInventoryEvidence(jobs).status, 'discovery-only');assert.equal(readInventoryEvidence(jobs).reportedTotal, null)
  if (scenario === 'primary') { assert.equal(jobs.length, 0);assert.ok(audit.observations.every(job => !job.sourceCurrentNativeRoleQualified)) }
  else assert.ok(audit.observations.every(job => job.sourceCurrentNativeRoleQualified===fixture.oracle[source].records.find(r=>r.id===job.jobId).expectedCurrentRoleQualification))
  if (scenario === 'cap') assert.equal(jobs.length, 0)
  if (source === 'delphixindia') { assert.equal(jobs.length, 0);assert.ok(audit.observations.every(job => job.company === 'Perforce' && !job.sourceBrandScopeQualified)) }
  if (source === 'dagster') assert.ok(audit.observations.every(job => job.company === 'Prefect'))
  for (const expected of fixture.oracle[source].records) {
    const row = audit.observations.find(row => row.jobId === expected.id)
    assert.deepEqual(row.sourceNativeListingRecord, expected.originalFeedRecord)
    assert.ok(row.jobDescription.includes(expected.bodyText))
  }
}
