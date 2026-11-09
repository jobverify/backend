import assert from 'node:assert/strict'
import test from 'node:test'

const loadMckinseyModule = async () => {
  try {
    return await import('../../scraper/mckinseycompany/script.js')
  } catch {
    assert.fail('Expected McKinsey & Company scraper module at ../../scraper/mckinseycompany/script.js')
  }
}

const INDIA_CAREERS_HTML = `
<!doctype html>
<html>
  <head>
    <title>Careers in India | India | McKinsey &amp; Company</title>
  </head>
  <body>
    <a href="/careers/search-jobs/en">Search jobs</a>
    <h1>Careers in India</h1>
    <p>Join McKinsey India and find your ideal job.</p>
    <section>Career paths for students</section>
  </body>
</html>
`

const SEARCH_JOBS_HTML = `
<!doctype html>
<html>
  <head>
    <title>McKinsey Job Search | Consulting and Internal Roles | Careers | McKinsey &amp; Company</title>
    <script>window.__NEXT_DATA__ = {};</script>
  </head>
  <body>
    <script>const api = "https://gateway.mckinsey.com/apigw-x0cceuow60/v1/api/jobs/search";</script>
    <a href="/careers/search-jobs/en">Search jobs</a>
  </body>
</html>
`

const JOBS_PAYLOAD_PAGE_1 = {
  docs: [
    {
      jobID: '15178',
      title: 'Associate',
      interest: 'Consulting',
      cities: ['Mumbai', 'New York City'],
      countries: ['India', 'United States'],
      postedToLinkedInDate: '2026-07-20',
      shortJobSummary: 'Drive problem solving for client teams.',
      jobApplyURL: 'https://mckinsey.avature.net/careers/ApplicationMethods?folderId=15178',
    },
    {
      jobID: '15179',
      title: 'Analyst',
      interest: 'Consulting',
      cities: ['London'],
      countries: ['United Kingdom'],
      postedToLinkedInDate: '2026-07-18',
      shortJobSummary: 'Non-India role.',
      jobApplyURL: 'https://mckinsey.avature.net/careers/ApplicationMethods?folderId=15179',
    },
  ],
}

const JOBS_PAYLOAD_PAGE_2 = { docs: [] }

test('McKinsey validator signals accept the current India handoff and lightweight search shell from Saturday, July 25, 2026', async () => {
  const mckinsey = await loadMckinseyModule()

  assert.equal(mckinsey.hasOfficialIndiaCareersSignal(INDIA_CAREERS_HTML), true)
  assert.equal(mckinsey.hasPublicJobsSearchSignal(SEARCH_JOBS_HTML), true)
})

test('McKinsey scraper returns only India jobs from the public search API', async () => {
  const mckinsey = await loadMckinseyModule()
  const requestedJsonUrls = []

  const jobs = await mckinsey.createMckinseyCompanyScraper({
    fetchText: async (url) => {
      if (url === mckinsey.INDIA_CAREERS_URL) return INDIA_CAREERS_HTML
      if (url === mckinsey.SEARCH_JOBS_URL) return SEARCH_JOBS_HTML
      throw new Error(`Unexpected HTML URL: ${url}`)
    },
    fetchJson: async (url) => {
      requestedJsonUrls.push(url)
      if (url === mckinsey.buildSearchApiUrl({ start: 1 })) return JOBS_PAYLOAD_PAGE_1
      if (url === mckinsey.buildSearchApiUrl({ start: 21 })) return JOBS_PAYLOAD_PAGE_2
      throw new Error(`Unexpected JSON URL: ${url}`)
    },
    now: () => '2026-07-25T12:00:00.000Z',
  }).run()

  assert.deepEqual(requestedJsonUrls, [
    mckinsey.buildSearchApiUrl({ start: 1 }),
    mckinsey.buildSearchApiUrl({ start: 21 }),
  ])
  assert.deepEqual(jobs, [
    {
      title: 'Associate',
      company: 'McKinsey & Company',
      department: 'Consulting',
      location: 'Mumbai, India',
      city: 'Mumbai',
      jobId: '15178',
      requisitionId: '15178',
      sourceUrl: 'https://mckinsey.avature.net/careers/ApplicationMethods?folderId=15178',
      applyUrl: 'https://mckinsey.avature.net/careers/ApplicationMethods?folderId=15178',
      employmentType: null,
      experienceRequired: null,
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate: '2026-07-20',
      closingDate: null,
      jobDescription: 'Drive problem solving for client teams.',
      source: 'mckinseycompany',
      link: 'https://mckinsey.avature.net/careers/ApplicationMethods?folderId=15178',
      scrapedAt: '2026-07-25T12:00:00.000Z',
    },
  ])
})
