import assert from 'node:assert/strict'
import test from 'node:test'
import { fixture, replay } from './fixtureReplay.js'
import { getScraperCatalog, createCatalogScraper } from '../../providers/index.js'
import { normalizeScrapedJob } from '../../utils/normalizeScrapedJob.js'
import { isIndiaJob } from '../../utils/indiaLocationFilter.js'
import { readInventoryEvidence } from '../../utils/inventoryEvidence.js'
import { readSourceObservationEvidence } from '../../utils/sourceObservationEvidence.js'
import { createDeclaredJobFeedScraper, DECLARED_JOB_FEED_PROFILES } from './nativeCareers.js'

globalThis.fetch = async () => { throw Error('Offline original-entity tests prohibit network and website execution') }
const catalog = getScraperCatalog()
for (const [source, expected] of Object.entries(fixture.oracle)) test(source + (source==='prefect'?': unchanged shared engine preserves the original native cohort before source-specific country proofs':': actual registered source preserves every complete native model before selection'), async () => {
  const r = replay(), provider = catalog.find(provider => provider.source === source)
  let jobs, error
  // The current Prefect wrapper has fresh source-specific HTTP fixtures. Keep
  // this historical shared-engine cohort's original geography assertions.
  try { jobs = await (source==='prefect'?createDeclaredJobFeedScraper(DECLARED_JOB_FEED_PROFILES.prefect):createCatalogScraper(provider)).run(r.options) } catch (caught) { error = caught }
  assert.equal(r.audits.length, 1, 'Every native record must reach an awaited audit; old result: ' + error?.message)
  assert.ifError(error)
  const audit = r.audits[0], profile = fixture.profiles[source]
  assert.equal(audit.opening.publisherQualified, true, JSON.stringify(audit.opening.issues))
  assert.equal(audit.closing.publisherQualified, true, JSON.stringify(audit.closing.issues))
  assert.equal(audit.observations.length, expected.records.length)
  assert.deepEqual(audit.observations.map(row => row.jobId), expected.records.map(row => row.id))
  assert.equal(r.records.length, 1)
  assert.deepEqual(r.records[0], audit.observations)
  assert.doesNotThrow(() => JSON.stringify(audit))
  for (const original of expected.records) {
    const job = audit.observations.find(row => row.jobId === original.id)
    assert.equal(job.company, original.nativeCompany)
    assert.equal(job.source, source)
    assert.deepEqual(job.sourceNativeListingRecord, original.originalFeedRecord)
    if (original.originalOwnRecord) assert.deepEqual(job.sourceNativeRecord, original.originalOwnRecord)
    if (original.originalOwnPosting) {
      assert.deepEqual(job.sourceNativePosting, original.originalOwnPosting)
      assert.deepEqual(job.sourceNativeOrganization, original.originalOwnOrganization)
    }
    if (original.originalSchema) assert.deepEqual(job.sourceNativeJobPosting, original.originalSchema)
    assert.equal(job.sourcePostingDate, original.originalDate)
    for (const fact of original.criteriaFacts) assert.ok(job.jobDescription?.includes(fact), source + '/' + original.id + ': complete original criteria missing: ' + fact.slice(0, 100))
    assert.equal(job.sourceCurrentNativeRoleQualified, original.expectedCurrentRoleQualification, JSON.stringify(job.sourceNativeIssues))
    for(const[key,value]of Object.entries(original.expectedGeography))assert.deepEqual(job[key],value,source+'/'+original.id+': '+key)
    assert.equal(job.sourceScopeComplete, false)
    assert.equal(job.lifecycleCleanupAllowed, false)
    if (profile.platform !== 'greenhouse') assert.equal(job.requisitionId, null, 'Public posting UUID is not a requisition ID')
    const normalized = normalizeScrapedJob(job, provider)
    assert.equal(normalized.company, original.nativeCompany)
    assert.equal(normalized.sourceDescription, job.jobDescription)
    assert.equal(normalized.postedAt.toISOString(), new Date(original.originalDate).toISOString())
    if (!job.country) {
      assert.equal(job.location, null);assert.equal(job.city, null);assert.deepEqual(job.locations, [])
      assert.equal(isIndiaJob(normalized), false, 'Unknown country must not acquire provider India default')
    }
  }
  if (source === 'delphixindia') {
    assert.equal(jobs.length, 0, 'Parent-company jobs lacking Delphix ownership stay in the audit')
    assert.equal(audit.observations.filter(job => job.country === 'India').length, 5)
    assert.ok(audit.observations.every(job => job.sourceBrandScopeQualified === false && job.company === 'Perforce'))
  }
  if (source === 'dagster') assert.ok(jobs.every(job => job.company === 'Prefect'))
  assert.equal(readInventoryEvidence(jobs).status, 'discovery-only')
  assert.equal(readInventoryEvidence(jobs).listingComplete, false)
  assert.equal(readInventoryEvidence(jobs).reportedTotal, null)
  assert.equal(readSourceObservationEvidence(jobs, source).observedRecordCount, expected.records.length)
  assert.equal(audit.sourceScopeComplete, false)
  assert.ok(r.requests.every(url => !/application|non-user-graphql|talent-community|\/apply\b/.test(new URL(url).pathname)))
})
