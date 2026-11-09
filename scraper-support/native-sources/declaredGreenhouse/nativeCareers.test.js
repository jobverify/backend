import { fixture, replay } from './fixtureReplay.js'
import assert from 'node:assert/strict'
import test from 'node:test'
import * as banyansoftware from '../../../scraper/banyansoftware/script.js'
import * as elationhealth from '../../../scraper/elationhealth/script.js'
import * as eqtcorporation from '../../../scraper/eqtcorporation.workday/script.js'
import * as prophecy from '../../../scraper/prophecy/script.js'
import * as dutchie from '../../../scraper/dutchie/script.js'
import * as biofourmis from '../../../scraper/biofourmis/script.js'
import { createNativeGreenhouseScraper, NATIVE_GREENHOUSE_PROFILES } from './nativeCareers.js'
import { normalizeScrapedJob } from '../../utils/normalizeScrapedJob.js'
import { isIndiaJob } from '../../utils/indiaLocationFilter.js'
import { readInventoryEvidence } from '../../utils/inventoryEvidence.js'

globalThis.fetch = async () => { throw Error('Offline original-entity controls prohibit all network and website execution') }
// FT's reusable channel profile is tested here; its broader registered source
// has separate original-entity traversal tests in financialtimes/native.test.js.
// Buildkite/Tripadvisor's current source wrappers additionally prove the active
// public client and a final post-detail traversal with Nov03 original fixtures.
// This archived cohort keeps exercising the unchanged reusable engine and all
// original native identity/content/date assertions below.
// Doximity now adds current hosted publication/criteria reads absent from this
// Oct31 archive. Preserve every original API-engine assertion here; its current
// actual registered route is tested with the Nov08 full API/hosted corpus.
const sources = { banyansoftware, doximity:createNativeGreenhouseScraper(NATIVE_GREENHOUSE_PROFILES.doximity), elationhealth, eqtcorporation,
  buildkite:createNativeGreenhouseScraper(NATIVE_GREENHOUSE_PROFILES.buildkite),
  tripadvisor:createNativeGreenhouseScraper(NATIVE_GREENHOUSE_PROFILES.tripadvisor), prophecy, dutchie, biofourmis,
  'financialtimes-channel-only':createNativeGreenhouseScraper(NATIVE_GREENHOUSE_PROFILES.financialtimes) }

// The Oct31 cohort predates Biofourmis's additional departments scope read.
// Keep that missing fixture explicitly unanswered, with no invented HTTP proof.
const assertMissingBiofourmisDepartmentScope = audit => {
  const scopeURL = 'https://boards-api.greenhouse.io/v1/boards/biofourmis/departments/'
  const unanswered = audit.rawPages.filter(page => !page.transportQualified)
  assert.deepEqual(unanswered.map(page => page.url), [scopeURL, scopeURL])
  for (const page of unanswered) {
    assert.equal(page.usable, false)
    assert.ok(page.status == null && page.bodyBase64 == null && page.bodySHA256 == null)
    assert.equal(page.originalText, null)
    assert.equal(page.legacyParsedJSON, undefined)
    assert.match(page.error.message, /Only original current public URLs may be replayed/)
  }
  for (const phase of [audit.opening, audit.closing]) {
    assert.equal(phase.publisherQualified, true)
    assert.equal(phase.qualified, false)
    assert.ok(phase.issues.some(issue => /current declared department collection unavailable/.test(issue)))
  }
  assert.equal(audit.publicInventoryProof.complete, false)
  assert.equal(audit.sourceScopeComplete, false)
  assert.equal(audit.lifecycleCleanupAllowed, false)
}

for (const [source, module] of Object.entries(sources)) test(source + ': genuine complete native post corpus is retained before prospect/country selection', async () => {
  const r = replay(), nativeSource=source==='financialtimes-channel-only'?'financialtimes':source, expected = fixture.oracle[nativeSource]
  let jobs, error
  try { jobs = await module.run(r.options) } catch (caught) { error = caught.message }
  assert.equal(r.audits.length, 1, 'Current complete published records must reach an awaited audit; legacy result/error: ' + error)
  assert.ifError(error)
  const audit = r.audits[0]
  assert.equal(audit.opening.publisherQualified, true)
  assert.equal(audit.closing.publisherQualified, true)
  // The public Biofourmis wrapper now requires a department response absent
  // from this original cohort; all original native post assertions stay below.
  const additionalPublicScopeMissing = source === 'biofourmis'
  assert.equal(audit.opening.qualified, !additionalPublicScopeMissing)
  assert.equal(audit.closing.qualified, !additionalPublicScopeMissing)
  if (additionalPublicScopeMissing) assertMissingBiofourmisDepartmentScope(audit)
  assert.equal(audit.observations.length, expected.records.length)
  assert.equal(audit.opening.reportedNativePostCount, expected.records.length)
  assert.equal(audit.closing.reportedNativePostCount, expected.records.length)
  assert.equal(audit.opening.nativePostIds.length, expected.records.length)
  assert.equal(audit.closing.nativePostIds.length, expected.records.length)
  assert.deepEqual(audit.observations.map(job => job.jobId), expected.records.map(row => String(row.postId)))
  for (const row of expected.records) {
    const job = audit.observations.find(item => item.jobId === String(row.postId))
    assert.deepEqual(job.sourceNativeRecord, row.nativeOwnPostRecord)
    assert.deepEqual(job.sourceNativeListingRecord, row.nativeFeedRecord)
    assert.equal(job.sourceNativePostKind, row.postKind)
    assert.equal(job.internalJobId, row.nativeOwnPostRecord.internal_job_id)
    assert.equal(job.requisitionId, row.nativeOwnPostRecord.requisition_id)
    assert.equal(job.sourcePostingDate, row.nativeOwnPostRecord.first_published)
    assert.equal(job.sourceNativeContentText, row.nativeContentText)
    assert.equal(job.jobDescription, row.fullCriteriaText)
    assert.equal(job.sourceNativeOwnHostedPageReadThisRun, false)
    assert.equal(job.sourceCurrentNativeRoleQualified, true)
    const normalized = normalizeScrapedJob(job, { source:nativeSource, companyName: fixture.profiles[nativeSource].companyName, countryFilter: 'India' })
    assert.equal(normalized.sourceDescription, row.fullCriteriaText)
    assert.equal(normalized.postedAt.toISOString(), new Date(row.nativeOwnPostRecord.first_published).toISOString())
    assert.equal(isIndiaJob(normalized) && row.postKind === 'job', false, 'Genuine cohort has no native India job-kind posts; unresolved scope cannot infer India')
    if (!job.country) { assert.equal(job.location, null);assert.equal(job.city, null);assert.deepEqual(job.locations, []) }
    assert.equal(job.sourceScopeComplete, false);assert.equal(job.lifecycleCleanupAllowed, false)
  }
  assert.ok(jobs.every(job => job.sourceNativePostKind === 'job'))
  assert.equal(readInventoryEvidence(jobs).status, additionalPublicScopeMissing ? 'coverage-gap' : 'discovery-only')
  assert.equal(readInventoryEvidence(jobs).listingComplete, false)
  assert.equal(readInventoryEvidence(jobs).reportedTotal, null)
  assert.equal(audit.sourceScopeComplete, false)
  const hostedRoleRequests = additionalPublicScopeMissing
    ? r.requests.filter(url => url !== 'https://job-boards.greenhouse.io/biofourmis')
    : r.requests
  assert.ok(hostedRoleRequests.every(url => !new URL(url).hostname.startsWith('job-boards.')), 'Blocked hosted role pages are never retried')
  if (additionalPublicScopeMissing) assert.equal(
    r.requests.filter(url => url === 'https://job-boards.greenhouse.io/biofourmis').length, 2,
    'The two unanswered advertised board scope reads are not role detail retries',
  )
})

test('original Response transport is read without inventing HTTP metadata or falling back to parsed JSON', async () => {
  const r = replay(), methods = []
  const fetchImpl = async (url, request) => {
    methods.push(request?.method)
    return r.options.fetchImpl(url)
  }
  const jobs = await biofourmis.run({ fetchImpl, onAudit: audit => r.audits.push(audit) })
  assert.equal(jobs.length, 0);assert.equal(r.audits.length, 1)
  assert.equal(r.audits[0].opening.publisherQualified, true);assert.equal(r.audits[0].closing.publisherQualified, true)
  assert.ok(methods.length > 0 && methods.every(method => method === 'GET'))
  const originalResponses = r.audits[0].rawPages.filter(page => page.transportQualified)
  assert.ok(originalResponses.length > 0)
  assert.ok(originalResponses.every(page => page.status === 200 && page.bodyBase64 && page.bodySHA256))
  assertMissingBiofourmisDepartmentScope(r.audits[0])
})
