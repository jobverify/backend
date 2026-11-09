import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import { normalizeScrapedJob } from '../utils/normalizeScrapedJob.js'

const loadBaxterModule = async () => {
  try {
    return await import('../../scraper/baxter/script.js')
  } catch {
    return null
  }
}

const fixturesDir = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  'fixtures',
  'baxter',
)

const readFixture = (name) => readFileSync(path.join(fixturesDir, name), 'utf8')

test('buildSearchUrl keeps Baxter listings on the India TalentBrew pages', async () => {
  const baxter = await loadBaxterModule()
  assert.ok(baxter)

  assert.equal(
    baxter.buildSearchUrl(),
    'https://jobs.baxter.com/en/search-jobs/india',
  )
  assert.equal(
    baxter.buildSearchUrl({ page: 2 }),
    'https://jobs.baxter.com/en/search-jobs/india&p=2',
  )
})

test('extractSearchResults keeps Baxter India cards and maps them into the shared listing contract', async () => {
  const baxter = await loadBaxterModule()
  assert.ok(baxter)

  const jobs = baxter.extractSearchResults(readFixture('search-results-india-page-1.html'))

  assert.equal(jobs.length, 15)
  assert.deepEqual(jobs[0], {
    title: 'Sr Data Scientist',
    company: 'Baxter',
    department: null,
    location: 'Gurgaon, Haryana, India',
    city: 'Gurgaon',
    country: 'India',
    jobId: '95886854384',
    requisitionId: '95886854384',
    sourceUrl: 'https://jobs.baxter.com/en/job/gurgaon/sr-data-scientist/152/95886854384',
    applyUrl: 'https://jobs.baxter.com/en/job/gurgaon/sr-data-scientist/152/95886854384',
    employmentType: 'Full-time',
    experienceRequired: null,
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills: [],
    postingDate: null,
    closingDate: null,
    jobDescription: null,
  })

  assert.equal(jobs[14].jobId, '96284817856')
  assert.equal(jobs[14].city, 'Ahmedabad')
})

test('extractSearchResults drops non-India spillover cards from Baxter keyword pages', async () => {
  const baxter = await loadBaxterModule()
  assert.ok(baxter)

  const jobs = baxter.extractSearchResults(`
    <section id="search-results-list">
      <a href="/en/job/aibonito/operator/152/1" data-job-id="1">
        <h2>Manufacturing Operator</h2>
        <span class="sr-facet job-location">Aibonito, Aibonito</span>
      </a>
      <a href="/en/job/marion/production-associate/152/2" data-job-id="2">
        <h2>Production Associate</h2>
        <span class="sr-facet job-location">Marion, NC</span>
      </a>
      <a href="/en/job/bengaluru/software-engineer/152/3" data-job-id="3">
        <h2>Software Engineer</h2>
        <span class="sr-facet job-location">Bengaluru, Karnataka</span>
      </a>
    </section>
  `)

  assert.deepEqual(jobs.map((job) => job.jobId), ['3'])
  assert.equal(jobs[0].location, 'Bengaluru, Karnataka, India')
})

test('extractPaginationSummary reads Baxter India paging links', async () => {
  const baxter = await loadBaxterModule()
  assert.ok(baxter)

  assert.deepEqual(
    baxter.extractPaginationSummary(readFixture('search-results-india-page-1.html')),
    {
      nextUrl: 'https://jobs.baxter.com/search-jobs/india&p=2',
    },
  )
})

test('extractJobDetail reads Baxter detail metadata, JSON-LD, and Workday apply links', async () => {
  const baxter = await loadBaxterModule()
  assert.ok(baxter)

  const detail = baxter.extractJobDetail(readFixture('job-detail-sr-data-scientist.html'), {
    title: 'Sr Data Scientist',
    company: 'Baxter',
    department: null,
    location: 'Gurgaon, Haryana, India',
    city: 'Gurgaon',
    country: 'India',
    jobId: '95886854384',
    requisitionId: '95886854384',
    sourceUrl: 'https://jobs.baxter.com/en/job/gurgaon/sr-data-scientist/152/95886854384',
    applyUrl: 'https://jobs.baxter.com/en/job/gurgaon/sr-data-scientist/152/95886854384',
  })

  assert.equal(detail.title, 'Sr Data Scientist')
  assert.equal(detail.company, 'Baxter')
  assert.equal(detail.department, 'Analytics & Data Science')
  assert.equal(detail.location, 'Gurgaon, Haryana, India')
  assert.equal(detail.city, 'Gurgaon')
  assert.equal(detail.country, 'India')
  assert.equal(detail.jobId, '95886854384')
  assert.equal(detail.requisitionId, '202510')
  assert.equal(detail.employmentType, 'Full-time')
  assert.equal(detail.experienceRequired, '8+ Years')
  assert.match(detail.jobDescription, /We are seeking an exceptional Senior Data Scientist/i)
  assert.equal(detail.minimumQualification, "Bachelor's degree in Computer Science, Information Technology, or related technical field (required).")
  assert.ok(detail.requiredSkills.includes('Programming Languages: Python (NumPy, Pandas, Scikit-learn), SQL (advanced proficiency required).'))
  assert.ok(detail.requiredSkills.includes('Cloud platforms :AWS/Azure/GCP/OCI experience.'))
  assert.equal(detail.postingDate, '2026-06-02')
  assert.equal(detail.closingDate, null)
  assert.equal(
    detail.applyUrl,
    'https://baxter.wd1.myworkdayjobs.com/baxter/job/Gurgaon-Haryana/Sr-Data-Scientist_JR-202510/apply',
  )
  assert.equal(
    detail.sourceUrl,
    'https://jobs.baxter.com/en/job/gurgaon/sr-data-scientist/152/95886854384',
  )
})

test('normalizeScrapedJob composes Baxter India experienced data roles from detail pages', async () => {
  const baxter = await loadBaxterModule()
  assert.ok(baxter)

  const detail = baxter.extractJobDetail(
    readFixture('job-detail-sr-data-scientist.html'),
    baxter.extractSearchResults(readFixture('search-results-india-page-1.html'))[0],
  )

  const normalized = normalizeScrapedJob(detail, {
    source: 'baxter',
    companyName: 'Baxter',
    companyCareerPage: 'https://jobs.baxter.com/en/search-jobs/india',
    atsPlatform: 'talentbrew-radancy',
  })

  assert.equal(normalized.company, 'Baxter')
  assert.equal(normalized.country, 'India')
  assert.equal(normalized.remoteStatus, 'On-site')
  assert.equal(normalized.experienceLevel, 'Senior Level')
  assert.equal(normalized.jobType, 'Full-time Experienced')
})

test('run paginates Baxter India pages, enriches detail pages, and decorates shared runner fields', async () => {
  const baxter = await loadBaxterModule()
  assert.ok(baxter)

  const requests = []
  const scraper = baxter.createBaxterScraper({ maxPages: 1, maxJobs: 1, includeDetails: true })

  const jobs = await scraper.run({
    fetchText: async (url) => {
      requests.push(url)
      if (url === baxter.buildSearchUrl()) {
        return readFixture('search-results-india-page-1.html')
      }
      if (url === 'https://jobs.baxter.com/en/job/gurgaon/sr-data-scientist/152/95886854384') {
        return readFixture('job-detail-sr-data-scientist.html')
      }
      throw new Error(`Unexpected Baxter URL: ${url}`)
    },
  })

  assert.deepEqual(requests, [
    baxter.buildSearchUrl(),
    'https://jobs.baxter.com/en/job/gurgaon/sr-data-scientist/152/95886854384',
  ])
  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].source, 'baxter')
  assert.equal(jobs[0].company, 'Baxter')
  assert.equal(jobs[0].jobId, '95886854384')
  assert.equal(jobs[0].requisitionId, '202510')
  assert.equal(
    jobs[0].applyUrl,
    'https://baxter.wd1.myworkdayjobs.com/baxter/job/Gurgaon-Haryana/Sr-Data-Scientist_JR-202510/apply',
  )
  assert.equal(typeof jobs[0].scrapedAt, 'string')
})

test('run stops when Baxter TalentBrew repeats the next-page URL', async () => {
  const baxter = await loadBaxterModule()
  assert.ok(baxter)

  const repeatedNextUrl = 'https://jobs.baxter.com/search-jobs/india&p=2'
  const requests = []
  const jobs = await baxter.createBaxterScraper({ maxPages: 10, includeDetails: false }).run({
    fetchText: async (url) => {
      requests.push(url)
      if (url === baxter.buildSearchUrl() || url === repeatedNextUrl) {
        return readFixture('search-results-india-page-1.html')
      }
      throw new Error(`Unexpected Baxter URL: ${url}`)
    },
  })

  assert.deepEqual(requests, [baxter.buildSearchUrl(), repeatedNextUrl])
  assert.equal(jobs.length, 15)
})

test('run bounds default Baxter fetches with abort signals', async () => {
  const baxter = await loadBaxterModule()
  assert.ok(baxter)

  const originalFetch = globalThis.fetch
  const requests = []
  globalThis.fetch = async (url, init = {}) => {
    requests.push({ url: String(url), signal: init.signal })

    if (url === baxter.buildSearchUrl()) {
      return { ok: true, status: 200, text: async () => readFixture('search-results-india-page-1.html') }
    }
    if (url === 'https://jobs.baxter.com/en/job/gurgaon/sr-data-scientist/152/95886854384') {
      return { ok: true, status: 200, text: async () => readFixture('job-detail-sr-data-scientist.html') }
    }

    assert.fail(`Unexpected Baxter URL: ${url}`)
  }

  try {
    const jobs = await baxter.createBaxterScraper({ maxPages: 1, maxJobs: 1 }).run()

    assert.equal(jobs.length, 1)
    assert.ok(requests.every((request) => request.signal), 'each fetch should include an abort signal')
    assert.ok(requests.every((request) => typeof request.signal.aborted === 'boolean'))
  } finally {
    globalThis.fetch = originalFetch
  }
})
