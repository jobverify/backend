import assert from 'node:assert/strict'
import test from 'node:test'

import {
  CAREERS_URL,
  COMPANY,
  GREENHOUSE_EMBED_SCRIPT_URL,
  GREENHOUSE_JOBS_API_URL,
  JOBS_PAGE_URL,
  OFFICIAL_BRAND_NAME,
  PROVIDER_METADATA,
  SOURCE,
  VERIFIED_ON,
  buildGreenhouseJobsApiUrl,
  createFive9IndiaScraper,
  extractGreenhouseEmbedScriptUrl,
  extractIndiaJobsFromGreenhousePayload,
  hasOfficialCareersLandingSignal,
  hasOfficialJobsPageSignal,
  normalizeGreenhouseJobUrl,
} from '../../scraper/five9india/script.js'

const officialCareersLandingHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Contact Center Careers - Five9 Career - SaaS Jobs | Five9</title>
    <link rel="canonical" href="https://www.five9.com/about/careers" />
  </head>
  <body>
    <main>
      <h1>Five9 Careers: Reimagine Where You Work</h1>
      <p>Employees Are the Secret to Our Success</p>
      <p>Apply today!</p>
      <a href="/about/careers/jobs">Search For Jobs</a>
    </main>
  </body>
</html>
`

const jobsPageHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Five9 Careers - Technical Account Manager Jobs - Five9 Jobs | Five9</title>
    <link rel="canonical" href="https://www.five9.com/about/careers/jobs" />
  </head>
  <body>
    <main id="main-content">
      <h1>Five9 Careers: Reimagine Where You Work</h1>
      <p>Search For Jobs</p>
      <p>Current Openings</p>
      <a href="#grnhse_app">Search For Jobs</a>
      <div id="grnhse_app"></div>
      <script src="https://boards.greenhouse.io/embed/job_board/js?for=five9"></script>
    </main>
  </body>
</html>
`

const greenhousePayload = {
  jobs: [
    {
      id: 5985462004,
      title: 'NOC Technician | India ',
      location: { name: 'India, Bengaluru' },
      absolute_url: 'https://www.five9.com/about/careers/job-detail?gh_jid=5985462004',
      requisition_id: 'FY26-28-326-419, FY26-28-326-420',
      company_name: 'Five9',
      updated_at: '2026-06-16T10:26:32-04:00',
      first_published: '2026-04-30T10:13:56-04:00',
      content:
        '&lt;p&gt;Join us in bringing joy to customer experience.&lt;/p&gt;'
        + '&lt;p&gt;Who we are:&lt;/p&gt;',
      departments: [{ name: 'Global Customer Assurance' }],
      offices: [{ name: 'India', location: null }],
    },
    {
      id: 6105888004,
      title: 'Apprentice- HR',
      location: { name: 'India, Bengaluru (Hybrid)' },
      absolute_url: 'https://www.five9.com/about/careers/job-detail?gh_jid=6105888004',
      requisition_id: 'FY26-99-111',
      company_name: 'Five9',
      updated_at: '2026-07-14T10:00:00Z',
      first_published: '2026-07-10T10:00:00Z',
      content: '&lt;p&gt;Hybrid apprenticeship role in Bengaluru.&lt;/p&gt;',
      departments: [{ name: 'India Apprentice Program' }],
      offices: [{ name: 'India', location: null }],
    },
    {
      id: 5993199004,
      title: 'Technical Support Engineer',
      location: { name: 'India, Chennai' },
      absolute_url: 'https://www.five9.com/about/careers/job-detail?gh_jid=5993199004',
      requisition_id: 'FY26-77-300',
      company_name: 'Five9',
      updated_at: '2026-07-11T10:00:00Z',
      first_published: '2026-07-01T10:00:00Z',
      content: '&lt;p&gt;Support role in Chennai.&lt;/p&gt;',
      departments: [{ name: 'Global Customer Assurance' }],
      offices: [{ name: 'India', location: null }],
    },
    {
      id: 5705441004,
      title: 'Solution Engineer - Hypercare Team',
      location: { name: 'Manila, Manila, Philippines (Hybrid)' },
      absolute_url: 'https://www.five9.com/about/careers/job-detail?gh_jid=5705441004',
      requisition_id: 'FY26-PH-10',
      company_name: 'Five9',
      updated_at: '2026-06-01T10:00:00Z',
      first_published: '2026-05-15T10:00:00Z',
      content: '&lt;p&gt;Philippines only.&lt;/p&gt;',
      departments: [{ name: 'Global Customer Assurance' }],
      offices: [{ name: 'Philippines', location: 'Manila, Manila, Philippines' }],
    },
  ],
}

test('Five9 India constants stay pinned to the verified first-party careers pages and Greenhouse API', () => {
  assert.equal(SOURCE, 'five9india')
  assert.equal(COMPANY, 'Five9 India')
  assert.equal(OFFICIAL_BRAND_NAME, 'Five9')
  assert.equal(VERIFIED_ON, '2026-07-15')
  assert.equal(CAREERS_URL, 'https://www.five9.com/about/careers')
  assert.equal(JOBS_PAGE_URL, 'https://www.five9.com/about/careers/jobs')
  assert.equal(
    GREENHOUSE_EMBED_SCRIPT_URL,
    'https://boards.greenhouse.io/embed/job_board/js?for=five9',
  )
  assert.equal(
    GREENHOUSE_JOBS_API_URL,
    'https://boards-api.greenhouse.io/v1/boards/five9/jobs',
  )
  assert.equal(
    buildGreenhouseJobsApiUrl(),
    'https://boards-api.greenhouse.io/v1/boards/five9/jobs?content=true',
  )
  assert.equal(hasOfficialCareersLandingSignal(officialCareersLandingHtml), true)
  assert.equal(hasOfficialJobsPageSignal(jobsPageHtml), true)
  assert.equal(
    extractGreenhouseEmbedScriptUrl(jobsPageHtml),
    'https://boards.greenhouse.io/embed/job_board/js?for=five9',
  )
  assert.equal(
    normalizeGreenhouseJobUrl(
      'https://www.five9.com/about/careers/job-detail?gh_jid=5985462004',
      5985462004,
    ),
    'https://www.five9.com/about/careers/job-detail?gh_jid=5985462004',
  )
  assert.equal(PROVIDER_METADATA.source, 'five9india')
})

test('Five9 India extracts only India jobs from the verified Greenhouse payload and preserves first-party detail routes', () => {
  const jobs = extractIndiaJobsFromGreenhousePayload(greenhousePayload, {
    scrapedAt: '2026-07-15T00:00:00.000Z',
  })

  assert.equal(jobs.length, 3)
  assert.deepEqual(
    jobs.map((job) => ({
      title: job.title,
      location: job.location,
      city: job.city,
      country: job.country,
      link: job.link,
      applyUrl: job.applyUrl,
      requisitionId: job.requisitionId,
      department: job.department,
      remoteStatus: job.remoteStatus,
    })),
    [
      {
        title: 'Apprentice- HR',
        location: 'India, Bengaluru (Hybrid)',
        city: 'Bangalore',
        country: 'India',
        link: 'https://www.five9.com/about/careers/job-detail?gh_jid=6105888004',
        applyUrl: 'https://www.five9.com/about/careers/job-detail?gh_jid=6105888004',
        requisitionId: 'FY26-99-111',
        department: 'India Apprentice Program',
        remoteStatus: 'Hybrid',
      },
      {
        title: 'Technical Support Engineer',
        location: 'India, Chennai',
        city: 'Chennai',
        country: 'India',
        link: 'https://www.five9.com/about/careers/job-detail?gh_jid=5993199004',
        applyUrl: 'https://www.five9.com/about/careers/job-detail?gh_jid=5993199004',
        requisitionId: 'FY26-77-300',
        department: 'Global Customer Assurance',
        remoteStatus: 'On-site',
      },
      {
        title: 'NOC Technician | India',
        location: 'India, Bengaluru',
        city: 'Bangalore',
        country: 'India',
        link: 'https://www.five9.com/about/careers/job-detail?gh_jid=5985462004',
        applyUrl: 'https://www.five9.com/about/careers/job-detail?gh_jid=5985462004',
        requisitionId: 'FY26-28-326-419, FY26-28-326-420',
        department: 'Global Customer Assurance',
        remoteStatus: 'On-site',
      },
    ],
  )
  assert.match(jobs[2].jobDescription, /bringing joy to customer experience/i)
})

test('Five9 India run validates the verified first-party pages before fetching the public Greenhouse API', async () => {
  const requested = []

  const jobs = await createFive9IndiaScraper({ maxJobs: 2 }).run({
    fetchText: async (url) => {
      requested.push({ type: 'text', url })
      if (url === CAREERS_URL) return officialCareersLandingHtml
      if (url === JOBS_PAGE_URL) return jobsPageHtml
      throw new Error(`Unexpected Five9 India fixture URL: ${url}`)
    },
    fetchJson: async (url, options = {}) => {
      requested.push({ type: 'json', url, options })
      return greenhousePayload
    },
    now: () => '2026-07-15T00:00:00.000Z',
  })

  assert.deepEqual(requested, [
    { type: 'text', url: CAREERS_URL },
    { type: 'text', url: JOBS_PAGE_URL },
    {
      type: 'json',
      url: 'https://boards-api.greenhouse.io/v1/boards/five9/jobs?content=true',
      options: { method: 'GET' },
    },
  ])
  assert.equal(jobs.length, 2)
  assert.equal(jobs[0].source, 'five9india')
  assert.equal(jobs[0].companyCareerPage, JOBS_PAGE_URL)
  assert.equal(jobs[0].companyDomain, 'five9.com')
  assert.equal(jobs[0].atsPlatform, 'greenhouse')
})

test('Five9 India fails closed when the verified jobs page or first-party gh_jid handoff drifts', async () => {
  await assert.rejects(
    createFive9IndiaScraper().run({
      fetchText: async (url) => {
        if (url === CAREERS_URL) return officialCareersLandingHtml
        if (url === JOBS_PAGE_URL) {
          return jobsPageHtml.replace(
            'https://boards.greenhouse.io/embed/job_board/js?for=five9',
            'https://boards.greenhouse.io/embed/job_board/js?for=other-company',
          )
        }
        throw new Error(`Unexpected Five9 India fixture URL: ${url}`)
      },
      fetchJson: async () => greenhousePayload,
    }),
    /verified greenhouse embed/i,
  )

  await assert.rejects(
    createFive9IndiaScraper().run({
      fetchText: async (url) => {
        if (url === CAREERS_URL) return officialCareersLandingHtml
        if (url === JOBS_PAGE_URL) return jobsPageHtml
        throw new Error(`Unexpected Five9 India fixture URL: ${url}`)
      },
      fetchJson: async () => ({
        jobs: [
          {
            ...greenhousePayload.jobs[0],
            absolute_url: 'https://job-boards.greenhouse.io/five9/jobs/5985462004',
          },
        ],
      }),
    }),
    /first-party gh_jid/i,
  )
})
