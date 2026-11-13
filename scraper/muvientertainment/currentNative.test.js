import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { gunzipSync } from 'node:zlib'
import { run, JOB_LISTINGS_URL } from './script.js'
import { MUVI_ENTERTAINMENT_CATALOG } from './catalog.js'
import { readInventoryEvidence } from '../../scraper-support/utils/inventoryEvidence.js'
import { normalizeScrapedJob } from '../../scraper-support/utils/normalizeScrapedJob.js'
import { isIndiaJob } from '../../scraper-support/utils/indiaLocationFilter.js'
import { generateFingerprint } from '../../scraper-support/utils/applicationIdentity.js'
import { analyzePublishableJobs } from '../../scraper-support/utils/publishableJobMetrics.js'
import { readSourceObservationEvidence } from '../../scraper-support/utils/sourceObservationEvidence.js'

const capture = () => JSON.parse(gunzipSync(readFileSync(new URL('./fixtures/current-20261113.json.gz', import.meta.url))))
const execute = (pages = capture()) => run({ fetchText: async url => {
  assert.ok(Object.hasOwn(pages, url), 'Unexpected Muvi public URL: ' + url)
  return pages[url]
} })

test('Muvi retains all four current remote vacancies with full descriptions and unresolved country', async () => {
  const result = await execute(), jobs = result.nativeCollectionEvidence.observations
  assert.equal(result.length, 0)
  assert.equal(readSourceObservationEvidence(result, 'muvientertainment').observedVacancyCount, 4)
  assert.deepEqual(jobs.map(job => job.title), ['Quality Engineer', 'Full-Stack PHP Developer', 'Growth Marketer (AI & Automation)', 'Product Marketing Specialist'])
  assert.equal(new Set(jobs.map(job => job.jobId)).size, 4)
  for (const job of jobs) {
    assert.equal(job.location, 'Remote')
    assert.equal(job.country, null)
    assert.equal(job.sourceCountryScopeUnresolved, true)
    assert.equal(job.sourceListingComplete, false)
    assert.equal(job.sourceScopeComplete, false)
    assert.ok(job.sourceDescription.length > 300)
    assert.equal(job.sourceDetailComplete, true)
    assert.equal(normalizeScrapedJob(job, MUVI_ENTERTAINMENT_CATALOG).country, null)
    assert.equal(isIndiaJob(normalizeScrapedJob(job, MUVI_ENTERTAINMENT_CATALOG)), false)
    const legacyIdentity = { ...job, jobId: 'muvientertainment-' + job.sourceNativeApplicationId,
      requisitionId: job.sourceNativeApplicationId }
    assert.equal(generateFingerprint(job), generateFingerprint(legacyIdentity), 'The same role URL must retain the legacy persistence key')
  }
  const evidence = readInventoryEvidence(result)
  assert.equal(evidence.status, 'coverage-gap')
  assert.equal(evidence.listingComplete, false)
  assert.equal(evidence.reportedTotal, null)
  assert.equal(evidence.indiaFacetCount, null)
})

test('Muvi retains role criteria after a nested description container', async () => {
  const pages = capture(), detail = Object.keys(pages).find(url => url !== JOB_LISTINGS_URL && url.includes('/qa/'))
  pages[detail] = pages[detail].replace('<div class="job-abt">', '<div class="job-abt"><div><p>Our quality engineering team builds robust streaming software for customers around the world.</p></div>')
  const jobs = (await execute(pages)).nativeCollectionEvidence.observations
  assert.match(jobs[0].sourceDescription, /quality of software development and deployment/)
})

test('Muvi continues rejecting native detail title and location conflicts', async () => {
  for (const mutate of [
    html => html.replace('>Quality Engineer</h3>', '>Unrelated Engineer</h3>'),
    html => html.replace('<div class="location">Remote</div>', '<div class="location">India</div>'),
  ]) {
    const pages = capture(), detail = Object.keys(pages).find(url => url.includes('/qa/'))
    pages[detail] = mutate(pages[detail])
    await assert.rejects(execute(pages), /mismatched public job detail/)
  }
})

test('Muvi retains the applicationless native rendition as an unqualified observation with stable URL identity', async () => {
  const pages = capture(), detail = Object.keys(pages).find(url => url.includes('/qa/'))
  const complete = (await execute(pages)).nativeCollectionEvidence.observations
  pages[detail] = gunzipSync(readFileSync(new URL('./fixtures/detail-applicationless-20261113.html.gz', import.meta.url))).toString('utf8')
  const result = await execute(pages), jobs = result.nativeCollectionEvidence.observations, job = jobs[0]
  assert.equal(jobs.length, 4)
  assert.equal(job.jobId, complete[0].jobId)
  assert.equal(generateFingerprint(job), generateFingerprint(complete[0]))
  assert.equal(job.sourceNativeApplicationId, null)
  assert.equal(job.sourceNativeApplicationHandoffAvailable, false)
  assert.equal(job.activeApplyVerified, false)
  assert.equal(job.sourceDetailComplete, false)
  assert.equal(job.sourceDetailFailureKind, 'native-application-unavailable')
  assert.equal(job.sourceCurrentNativeRoleQualified, false)
  assert.ok(job.sourceDescription.length > 300)
  assert.equal(normalizeScrapedJob(job, MUVI_ENTERTAINMENT_CATALOG).country, null)
  assert.equal(isIndiaJob(normalizeScrapedJob(job, MUVI_ENTERTAINMENT_CATALOG)), false)
  assert.equal(result.length, 0)
  assert.equal(readInventoryEvidence(result).listingComplete, false)
})

test('Muvi does not authorize company scope or cleanup from India labels and visible application forms alone', async () => {
  const pages = capture()
  for (const url of Object.keys(pages)) pages[url] = pages[url]
    .replaceAll('<span>Remote</span>', '<span>India</span>')
    .replaceAll('<div class="location">Remote</div>', '<div class="location">India</div>')
  const jobs = await execute(pages)
  assert.equal(jobs.length, 4)
  for (const job of jobs) {
    assert.equal(job.country, 'India')
    assert.equal(job.sourceScopeComplete, false)
    assert.equal(job.lifecycleCleanupAllowed, false)
  }
  assert.equal(readInventoryEvidence(jobs).listingComplete, false)
  assert.equal(readInventoryEvidence(jobs).indiaFacetCount, null)
})

test('Muvi holds an explicit India applicationless observation outside raw and normalized publication pipelines', async () => {
  const pages = capture(), detail = Object.keys(pages).find(url => url.includes('/qa/'))
  pages[JOB_LISTINGS_URL] = '<title>Job Listings - Muvi</title><div class="job-card"><a href="' + detail
    + '"><h6>Quality Engineer</h6></a><div class="job-card-tags"><span>2-3 Years</span><span>Quality Engineer</span><span>1 Openings</span><span>India</span></div></div>'
  pages[detail] = gunzipSync(readFileSync(new URL('./fixtures/detail-applicationless-20261113.html.gz', import.meta.url))).toString('utf8')
    .replaceAll('<div class="location">Remote</div>', '<div class="location">India</div>')
  const jobs = await execute(pages)
  assert.equal(analyzePublishableJobs(jobs).eligibleJobs.length, 0)
  assert.equal(analyzePublishableJobs(jobs.map(job => normalizeScrapedJob(job, MUVI_ENTERTAINMENT_CATALOG))).eligibleJobs.length, 0)
  assert.equal(jobs.length, 0)
  assert.equal(jobs.nativeCollectionEvidence.observations.length, 1)
  assert.equal(jobs.nativeCollectionEvidence.observations[0].country, 'India')
  assert.equal(jobs.nativeCollectionEvidence.observations[0].sourceNativeApplicationHandoffAvailable, false)
  assert.equal(readSourceObservationEvidence(jobs, 'muvientertainment').observedVacancyCount, 1)
})
