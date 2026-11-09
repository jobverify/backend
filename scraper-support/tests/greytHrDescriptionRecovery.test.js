import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { createGreytHrScraper, extractGreytHrJobs, CAREERS_URL, JOBS_API_URL } from '../../scraper/greythr/script.js'
import { normalizeScrapedJob } from '../utils/normalizeScrapedJob.js'
import { analyzePublishableJobs } from '../utils/publishableJobMetrics.js'
import { buildJobPostedAtCutoff } from '../../src/utils/jobLifecycle.js'

const fixture = name => JSON.parse(readFileSync(new URL(`./fixtures/greythr/${name}.json`, import.meta.url)))
const careersHtml = '<title>Career and Job Opportunities - Greytip Software</title><h1>Begin the journey of your success here</h1><h2>Come, grow with us</h2><a href="https://greytip.greythr.com/hire/jobs/">Careers</a>'
const categoriesUrl = 'https://greytip.greythr.com/hire/api/greythr/emp-category/'
const detailUrl = 'https://greytip.greythr.com/hire/api/sourcing/get_job/associate-product-manager-817/'

test('GreytHR preserves the actual listing description and resolves numeric location IDs', () => {
  const [job] = extractGreytHrJobs(fixture('listing'), fixture('categories'))
  assert.match(job.jobDescription, /drive Recruit's product strategy and roadmap/)
  assert.equal(job.sourceDescription, job.jobDescription)
  assert.match(job.jobDescriptionHtml, /<h3>/)
  assert.equal(job.location, 'Bangalore')
  assert.equal(job.country, 'India')
  assert.equal(job.jobId, '7d208252-08e6-485f-aeb8-8dc149cce3be')
  assert.equal(job.requisitionId, '1393')
})

test('GreytHR never promotes foreign or unresolved location IDs to India', () => {
  const listing = fixture('listing')
  listing.data[0].locations = ['1029', '1030']
  assert.deepEqual(extractGreytHrJobs(listing, fixture('categories')), [])
  listing.data[0].locations = ['4', '1029']
  assert.equal(extractGreytHrJobs(listing, fixture('categories'))[0].location, 'Bangalore')
  listing.data[0].locations = ['unknown']
  assert.throws(() => extractGreytHrJobs(listing, fixture('categories')), /location/i)
})

test('GreytHR converts native month-valued experience to the years shown by its official client', () => {
  const [job] = extractGreytHrJobs(fixture('listing'), fixture('categories'))
  assert.equal(job.minExperience, 3)
  assert.equal(job.maxExperience, 5)
  assert.equal(job.experienceUnits, 'years')
})

const run = (listing, detail = fixture('detail'), options = {}) => {
  const requests = []
  const promise = createGreytHrScraper().run({
    fetchText: async url => { assert.equal(url, CAREERS_URL); return careersHtml },
    fetchJson: async (url, request = {}) => {
      requests.push({url, ...request})
      if (url === JOBS_API_URL) return listing
      if (url === categoriesUrl) return fixture('categories')
      if (url === detailUrl) return detail
      throw new Error(`Unexpected public API: ${url}`)
    },
    ...options,
  })
  return { promise, requests }
}

test('GreytHR uses the native GET detail only when listing content is absent', async () => {
  const listing = fixture('listing')
  const complete = run(listing)
  assert.match((await complete.promise)[0].jobDescription, /drive Recruit/)
  assert.equal(complete.requests.some(r => r.url === detailUrl), false)
  delete listing.data[0].description
  const controller = new AbortController()
  const recovered = run(listing, fixture('detail'), { signal: controller.signal })
  const [job] = await recovered.promise
  assert.match(job.jobDescription, /drive Recruit/)
  const request = recovered.requests.find(r => r.url === detailUrl)
  assert.equal(request.method, 'GET')
  assert.equal(request.signal, controller.signal)
  assert.equal(recovered.requests.find(r => r.url === JOBS_API_URL).method, 'POST')
})

test('GreytHR rejects a substituted or unpublished native detail', async () => {
  const listing = fixture('listing')
  delete listing.data[0].description
  for (const mutate of [d => {d.job.id = 'another-job'}, d => {d.job.req_id = '0'}, d => {d.job.locations = ['1029']}, d => {d.job_status = 'draft'}]) {
    const detail = fixture('detail'); mutate(detail)
    await assert.rejects(run(listing, detail).promise, /detail|identity|published/i)
  }
})

test('GreytHR rejects unavailable inventory and off-tenant application identity', async () => {
  await assert.rejects(run({error: 'upstream unavailable'}).promise, /listing|inventory/i)
  const listing = fixture('listing')
  listing.data[0].apply_url = 'https://unrelated.example/jobs/associate-product-manager-817'
  await assert.rejects(run(listing).promise, /identity|application/i)
})

test('GreytHR cannot verify an empty source with an unavailable location dictionary', async () => {
  await assert.rejects(createGreytHrScraper().run({
    fetchText: async () => careersHtml,
    fetchJson: async url => url === JOBS_API_URL ? {data:[]} : {error:'upstream unavailable'},
  }), /location|dictionary/i)
})

test('GreytHR retains the current native publication timestamp through job normalization', () => {
  const listing = fixture('publication-dates-20261024')
  const [job] = extractGreytHrJobs(listing, fixture('categories'))
  const normalized = normalizeScrapedJob(job, { source: 'greythr' })
  assert.equal(job.postedDate, '2026-10-07T09:28:03.179412Z', 'Preserve the original native timestamp')
  assert.equal(job.postingDate, '2026-10-07T09:28:03.179412Z')
  assert.equal(normalized.postedAt.toISOString(), '2026-10-07T09:28:03.179Z')
  assert.equal(normalized.postingDate.toISOString(), '2026-10-07T09:28:03.179Z')
  assert.equal(normalized.sourceDescription, job.sourceDescription)
})

test('actual GreytHR old roles remain outside insertion and public date scope after description recovery', () => {
  const now = new Date('2026-10-24T17:01:37.964Z')
  const jobs = extractGreytHrJobs(fixture('publication-dates-20261024'), fixture('categories'))
  const rawMetrics = analyzePublishableJobs(jobs, { now })
  assert.equal(rawMetrics.filterCounts.old, 2)
  assert.equal(rawMetrics.eligibleJobs.length, 1)
  const normalized = jobs.map(job => normalizeScrapedJob(job, { source: 'greythr' }))
  const metrics = analyzePublishableJobs(normalized, { now })
  assert.equal(metrics.filterCounts.old, 2)
  assert.equal(metrics.eligibleJobs.length, 1)
  assert.equal(metrics.eligibleJobs[0].jobId, '7d208252-08e6-485f-aeb8-8dc149cce3be')
  assert.equal(normalized.filter(job => job.postedAt >= buildJobPostedAtCutoff(now, 60)).length, 2,
    'The sixty-day storage retention window does not replace the calendar-month insertion/public cutoff')
  assert.ok(jobs.every(job => job.jobDescription && job.sourceDescription))
})

test('GreytHR uses native creation time only when native publication time is absent', () => {
  const listing = fixture('publication-dates-20261024')
  listing.data[0].published_on_career_page = null
  const [job] = extractGreytHrJobs(listing, fixture('categories'))
  assert.equal(job.postingDate, '2026-10-06T07:36:48.332873Z')
  assert.equal(normalizeScrapedJob(job, { source: 'greythr' }).postedAt.toISOString(), '2026-10-06T07:36:48.332Z')
})
