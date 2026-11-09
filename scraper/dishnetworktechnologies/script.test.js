import assert from 'node:assert/strict'
import test from 'node:test'

import {
  INDIA_LOCATION_QUERY,
  JOBS_PAGE_URL,
  buildSearchUrl,
  createDishNetworkTechnologiesScraper,
  extractJobListings,
  hasOfficialJobsPageSignal,
} from './script.js'

const firstPageHtml = `
  <html>
    <head><title>Search Jobs | EchoStar</title></head>
    <body>
      <main>
        <h1>Search Jobs</h1>
        <div class="iCIMS_JobsTable">
          <div class="iCIMS_JobsTableRow">
            <a class="iCIMS_Anchor" href="/jobs/145077301/engineer---data-warehouse-operations/job">
              Engineer - Data Warehouse Operations
            </a>
            <dl>
              <dt>Job ID</dt><dd>145077301</dd>
              <dt>Location</dt><dd>IN-Bengaluru</dd>
              <dt>Department</dt><dd>Technology</dd>
              <dt>Posted Date</dt><dd>03/29/2026</dd>
            </dl>
          </div>
          <div class="iCIMS_JobsTableRow">
            <a class="iCIMS_Anchor" href="/jobs/999999/unrelated-role/job">Unrelated Role</a>
            <dl><dt>Job ID</dt><dd>999999</dd><dt>Location</dt><dd>US-Colorado</dd></dl>
          </div>
        </div>
        <a rel="next" href="?location=India&amp;page=2">Next</a>
      </main>
    </body>
  </html>
`

const secondPageHtml = `
  <html>
    <head><title>Search Jobs | EchoStar</title></head>
    <body>
      <main>
        <h1>Search Jobs</h1>
        <div class="iCIMS_JobsTable">
          <div class="iCIMS_JobsTableRow">
            <a href="/jobs/145077302/senior-software-engineer/job">Senior Software Engineer</a>
            <dl>
              <dt>Job ID</dt><dd>145077302</dd>
              <dt>Location</dt><dd>IN-Hyderabad</dd>
            </dl>
          </div>
        </div>
      </main>
    </body>
  </html>
`

test('builds and validates the official EchoStar India jobs search page', () => {
  assert.equal(JOBS_PAGE_URL, 'https://jobs.echostar.com/jobs')
  assert.equal(INDIA_LOCATION_QUERY, 'India')
  assert.equal(buildSearchUrl(), 'https://jobs.echostar.com/jobs?location=India&page=1&sortBy=distance_from&stretch=10&stretchUnit=MILES&woe=12')
  assert.equal(hasOfficialJobsPageSignal(firstPageHtml), true)
})

test('extracts only India listings from the official iCIMS jobs page', () => {
  assert.deepEqual(extractJobListings(firstPageHtml), [{
    title: 'Engineer - Data Warehouse Operations',
    company: 'DISH Network Technologies',
    department: 'Technology',
    location: 'Bengaluru, India',
    city: 'Bengaluru',
    country: 'India',
    jobId: '145077301',
    requisitionId: '145077301',
    sourceUrl: 'https://jobs.echostar.com/jobs/145077301/engineer---data-warehouse-operations/job',
    applyUrl: 'https://jobs.echostar.com/jobs/145077301/engineer---data-warehouse-operations/job',
    employmentType: null,
    experienceRequired: null,
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills: [],
    postingDate: '2026-03-29',
    closingDate: null,
    jobDescription: null,
  }])
})

test('paginates the official India search and returns normalized DISH Network Technologies jobs', async () => {
  const requestedUrls = []
  const scraper = createDishNetworkTechnologiesScraper({ now: () => '2026-07-07T00:00:00.000Z' })

  const jobs = await scraper.run({
    fetchText: async (url) => {
      requestedUrls.push(url)
      return url.includes('page=1') ? firstPageHtml : secondPageHtml
    },
  })

  assert.deepEqual(requestedUrls, [buildSearchUrl({ page: 1 }), buildSearchUrl({ page: 2 })])
  assert.equal(jobs.length, 2)
  assert.deepEqual(jobs[1], {
    title: 'Senior Software Engineer',
    company: 'DISH Network Technologies',
    department: null,
    location: 'Hyderabad, India',
    city: 'Hyderabad',
    country: 'India',
    jobId: '145077302',
    requisitionId: '145077302',
    sourceUrl: 'https://jobs.echostar.com/jobs/145077302/senior-software-engineer/job',
    applyUrl: 'https://jobs.echostar.com/jobs/145077302/senior-software-engineer/job',
    employmentType: null,
    experienceRequired: null,
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills: [],
    postingDate: null,
    closingDate: null,
    jobDescription: null,
    source: 'dishnetworktechnologies',
    link: 'https://jobs.echostar.com/jobs/145077302/senior-software-engineer/job',
    scrapedAt: '2026-07-07T00:00:00.000Z',
  })
})
