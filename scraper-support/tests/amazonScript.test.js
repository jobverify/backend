import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

const loadAmazonModule = async () => {
  try {
    return await import('../../scraper/amazon/script.js')
  } catch {
    assert.fail('Expected Amazon scraper module at ../../scraper/scraper/amazon/script.js')
  }
}

const fixturesDir = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  'fixtures',
  'amazon',
)

const readJsonFixture = (name) => JSON.parse(
  readFileSync(path.join(fixturesDir, name), 'utf8'),
)

test('Amazon URL builders stay on the official public search and job domains', async () => {
  const {
    buildApplyUrl,
    buildJobUrl,
    buildSearchApiUrl,
  } = await loadAmazonModule()

  assert.equal(
    buildSearchApiUrl(),
    'https://www.amazon.jobs/en/search.json?offset=0&result_limit=10&sort=relevant&normalized_country_code%5B%5D=IND',
  )
  assert.equal(
    buildSearchApiUrl({ offset: 20, resultLimit: 5 }),
    'https://www.amazon.jobs/en/search.json?offset=20&result_limit=5&sort=relevant&normalized_country_code%5B%5D=IND',
  )
  assert.equal(
    buildJobUrl('/en/jobs/10390095/rpa-engineer-ar-automation'),
    'https://www.amazon.jobs/en/jobs/10390095/rpa-engineer-ar-automation',
  )
  assert.equal(
    buildApplyUrl('https://account.amazon.com/jobs/10390095/apply'),
    'https://account.amazon.com/jobs/10390095/apply',
  )
})

test('extractSearchResults keeps Amazon India jobs from the public search JSON response', async () => {
  const { extractPaginationSummary, extractSearchResults } = await loadAmazonModule()
  const payload = readJsonFixture('search-india-page-1.json')
  const jobs = extractSearchResults(payload)

  assert.equal(jobs.length, 2)
  assert.deepEqual(jobs[0], {
    title: 'RPA Engineer, AR Automation',
    company: 'Amazon',
    department: 'Operations, IT, & Support Engineering',
    location: 'Hyderabad, Telangana, India',
    city: 'Hyderabad',
    jobId: '10390095',
    requisitionId: '53e13a03-4621-4f55-a7e5-7daedd9315df',
    sourceUrl: 'https://www.amazon.jobs/en/jobs/10390095/rpa-engineer-ar-automation',
    applyUrl: 'https://account.amazon.com/jobs/10390095/apply',
    employmentType: 'Full-time',
    experienceRequired: null,
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills: [],
    postingDate: '2026-04-13',
    closingDate: null,
    jobDescription: jobs[0].jobDescription,
  })
  assert.match(jobs[0].jobDescription, /transform our financial operations/i)
  assert.doesNotMatch(jobs[0].jobDescription, /<br|<p|<li/i)

  assert.deepEqual(extractPaginationSummary(payload, { offset: 0, resultLimit: 2 }), {
    offset: 0,
    resultLimit: 2,
    totalRecords: 2632,
    totalPages: 1316,
    hasNext: true,
  })
})

test('extractJobDetail recovers Amazon experience requirements from official detail sections', async () => {
  const { extractJobDetail } = await loadAmazonModule()
  const detail = extractJobDetail(`
    <html>
      <head>
        <title>Software Dev Engineer II - Job ID: 2805115 | Amazon.jobs</title>
        <meta property="og:title" content="Software Dev Engineer II" />
      </head>
      <body>
        <div class="container" id="job-detail-body">
          <div class="section"><h2>Description</h2><p>Build next-generation tools for Alexa.</p></div>
          <div class="section"><h2>Basic Qualifications</h2><p>- 3+ years of non-internship professional software development experience<br/>- Experience programming with Java</p></div>
          <div class="section"><h2>Preferred Qualifications</h2><p>- Experience working with distributed systems</p></div>
        </div>
      </body>
    </html>
  `, {
    title: 'Amazon.jobs',
    sourceUrl: 'https://www.amazon.jobs/en/jobs/2805115/software-dev-engineer-ii',
    applyUrl: 'https://account.amazon.jobs/jobs/2805115/apply',
  })

  assert.equal(detail.title, 'Software Dev Engineer II')
  assert.equal(detail.experienceRequired, '3+ years')
  assert.match(detail.jobDescription, /3\+ years of non-internship professional software development experience/i)
})

test('extractJobDetail recovers month-based Amazon experience requirements without treating contract length as experience', async () => {
  const { extractJobDetail } = await loadAmazonModule()
  const detail = extractJobDetail(`
    <html>
      <head>
        <meta property="og:title" content="CTK Svc Sr. Associate, CTK" />
      </head>
      <body>
        <div class="section"><h2>Description</h2><p>This is a fixed term contractual role for 12 months.</p></div>
        <div class="section"><h2>Basic Qualifications</h2><p>- Bachelor's degree or Advanced Degree<br/>- Speak, write, and read fluently in English<br/>- 18+ months of human resources experience<br/>- 18+ months of customer service experience<br/>- 6+ months of Microsoft Office products and applications experience</p></div>
      </body>
    </html>
  `, {
    title: 'Amazon.jobs',
    sourceUrl: 'https://www.amazon.jobs/en/jobs/10488235/ctk-svc-sr-associate-ctk',
    applyUrl: 'https://account.amazon.jobs/jobs/10488235/apply',
  })

  assert.equal(detail.title, 'CTK Svc Sr. Associate, CTK')
  assert.equal(detail.experienceRequired, '18+ months')
  assert.doesNotMatch(detail.jobDescription, /experienceRequired/i)
})

test('run paginates Amazon India search results and decorates shared runner fields', async () => {
  const {
    buildSearchApiUrl,
    createAmazonScraper,
  } = await loadAmazonModule()
  const payload = readJsonFixture('search-india-page-1.json')
  const requests = []
  const page1 = {
    ...payload,
    jobs: [payload.jobs[0]],
  }
  const page2 = {
    ...payload,
    jobs: [payload.jobs[1]],
  }
  const scraper = createAmazonScraper({ pageSize: 1, maxPages: 2, maxJobs: 2 })

  const jobs = await scraper.run({
    fetchJson: async (url) => {
      requests.push(url)

      if (url === buildSearchApiUrl({ offset: 0, resultLimit: 1 })) return page1
      if (url === buildSearchApiUrl({ offset: 1, resultLimit: 1 })) return page2

      throw new Error(`Unexpected Amazon URL: ${url}`)
    },
  })

  assert.deepEqual(requests, [
    buildSearchApiUrl({ offset: 0, resultLimit: 1 }),
    buildSearchApiUrl({ offset: 1, resultLimit: 1 }),
  ])
  assert.equal(jobs.length, 2)
  assert.equal(jobs[0].source, 'amazon')
  assert.equal(jobs[0].company, 'Amazon')
  assert.ok(jobs.every((job) => job.link === job.applyUrl))
  assert.ok(jobs.every((job) => typeof job.scrapedAt === 'string' && job.scrapedAt.length > 0))
})

test('run enriches recent Amazon jobs with official detail page experience', async () => {
  const {
    buildSearchApiUrl,
    createAmazonScraper,
  } = await loadAmazonModule()

  const scraper = createAmazonScraper({ pageSize: 1, maxPages: 1, maxJobs: 1 })
  const requests = []
  const recentPayload = {
    error: null,
    hits: 1,
    jobs: [
      {
        id: 'req-1',
        id_icims: '2805115',
        title: 'Amazon.jobs',
        job_category: 'Software Development',
        job_schedule_type: 'full-time',
        job_path: '/en/jobs/2805115/software-dev-engineer-ii',
        location: 'IN, KA, Bengaluru',
        normalized_location: 'Bengaluru, Karnataka, IND',
        city: 'Bengaluru',
        country_code: 'IND',
        posted_date: 'July 29, 2026',
        description: 'Build next-generation tools for Alexa.',
        url_next_step: 'https://account.amazon.jobs/jobs/2805115/apply',
      },
    ],
  }

  const jobs = await scraper.run({
    now: '2026-07-30T12:00:00.000Z',
    detailFetchRetentionDays: 10,
    fetchJson: async (url) => {
      requests.push(url)
      if (url === buildSearchApiUrl({ offset: 0, resultLimit: 1 })) return recentPayload
      throw new Error(`Unexpected Amazon URL: ${url}`)
    },
    fetchText: async (url) => {
      requests.push(url)
      assert.equal(url, 'https://www.amazon.jobs/en/jobs/2805115/software-dev-engineer-ii')
      return `
        <html>
          <head>
            <meta property="og:title" content="Software Dev Engineer II" />
          </head>
          <body>
            <div class="section"><h2>Description</h2><p>Build next-generation tools for Alexa.</p></div>
            <div class="section"><h2>Basic Qualifications</h2><p>- 3+ years of non-internship professional software development experience</p></div>
          </body>
        </html>
      `
    },
  })

  assert.deepEqual(requests, [
    buildSearchApiUrl({ offset: 0, resultLimit: 1 }),
    'https://www.amazon.jobs/en/jobs/2805115/software-dev-engineer-ii',
  ])
  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].title, 'Software Dev Engineer II')
  assert.equal(jobs[0].experienceRequired, '3+ years')
})

test('run still enriches Amazon jobs within the default 30-day detail retention window', async () => {
  const {
    buildSearchApiUrl,
    createAmazonScraper,
  } = await loadAmazonModule()

  const scraper = createAmazonScraper({ pageSize: 1, maxPages: 1, maxJobs: 1 })
  const requests = []
  const payload = {
    error: null,
    hits: 1,
    jobs: [
      {
        id: 'req-20-days',
        id_icims: '2805116',
        title: 'Amazon.jobs',
        job_category: 'Software Development',
        job_schedule_type: 'full-time',
        job_path: '/en/jobs/2805116/software-dev-engineer-ii',
        location: 'IN, KA, Bengaluru',
        normalized_location: 'Bengaluru, Karnataka, IND',
        city: 'Bengaluru',
        country_code: 'IND',
        posted_date: 'July 10, 2026',
        description: 'Build next-generation tools for Alexa.',
        url_next_step: 'https://account.amazon.jobs/jobs/2805116/apply',
      },
    ],
  }

  const jobs = await scraper.run({
    now: '2026-07-30T12:00:00.000Z',
    fetchJson: async (url) => {
      requests.push(url)
      if (url === buildSearchApiUrl({ offset: 0, resultLimit: 1 })) return payload
      throw new Error(`Unexpected Amazon URL: ${url}`)
    },
    fetchText: async (url) => {
      requests.push(url)
      assert.equal(url, 'https://www.amazon.jobs/en/jobs/2805116/software-dev-engineer-ii')
      return `
        <html>
          <head>
            <meta property="og:title" content="Software Dev Engineer II" />
          </head>
          <body>
            <div class="section"><h2>Description</h2><p>Build next-generation tools for Alexa.</p></div>
            <div class="section"><h2>Basic Qualifications</h2><p>- 3+ years of non-internship professional software development experience</p></div>
          </body>
        </html>
      `
    },
  })

  assert.deepEqual(requests, [
    buildSearchApiUrl({ offset: 0, resultLimit: 1 }),
    'https://www.amazon.jobs/en/jobs/2805116/software-dev-engineer-ii',
  ])
  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].title, 'Software Dev Engineer II')
  assert.equal(jobs[0].experienceRequired, '3+ years')
})
