import assert from 'node:assert/strict'
import test from 'node:test'

const joinHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>McAfee, LLC</title>
  </head>
  <body>
    <main>
      <h1>Careers At McAfee</h1>
      <p>Join our Talent Community</p>
      <p>See jobs by:</p>
      <a href="/join/categories">Categories</a>
      <a href="/join/locations">Locations</a>
    </main>
  </body>
</html>
`

const jobsPageHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>McAfee, LLC Job Search - Jobs</title>
  </head>
  <body>
    <main>
      <h1>Jobs</h1>
      <p>Not ready to apply? Stay connected with us</p>
      <a href="/jobs">Jobs</a>
      <a href="/login">Log In</a>
    </main>
  </body>
</html>
`

const searchShellHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>McAfee, LLC</title>
  </head>
  <body>
    <main>
      <h1>404</h1>
      <p>The page you are looking for no longer exists.</p>
      <p>Find out more about McAfee Careers here or start your job search.</p>
      <p>See jobs by:</p>
      <a href="/join/categories">Categories</a>
      <a href="/join/locations">Locations</a>
    </main>
  </body>
</html>
`

const indiaJobsPayload = {
  jobs: [
    {
      data: {
        slug: '1469',
        language: 'en-us',
        req_id: '1469',
        title: 'Data Engineer / Analyst',
        description: '<p>Role Summary</p>',
        responsibilities: '<ul><li>Build dashboards</li></ul>',
        location_name: 'India - Bengaluru',
        short_location: 'Bangalore, India',
        full_location: 'Bangalore, India',
        city: 'Bangalore',
        state: 'Karnataka',
        country: 'India',
        tags1: ['Hybrid'],
        categories: [{ name: 'Information Technology' }],
        department: '',
        employment_type: 'FULL_TIME',
        posted_date: '2026-07-31T09:25:00+0000',
        posting_expiry_date: '2026-10-27T18:30:00+0000',
        apply_url: 'https://global-mcafee.icims.com/jobs/1469/login',
      },
    },
  ],
}

const mixedJobsPayload = {
  jobs: [
    ...indiaJobsPayload.jobs,
    {
      data: {
        slug: '9999',
        language: 'en-us',
        req_id: '9999',
        title: 'Finance Specialist - Hybrid',
        description: '<p>Canada role</p>',
        responsibilities: '<ul><li>Not India</li></ul>',
        location_name: 'Canada - Toronto',
        city: 'Toronto',
        state: 'Ontario',
        country: 'Canada',
        tags1: [],
        categories: [{ name: 'Finance' }],
        department: 'Finance',
        employment_type: 'FULL_TIME',
        posted_date: '2026-07-31T09:25:00+0000',
        posting_expiry_date: '2026-10-27T18:30:00+0000',
        apply_url: 'https://global-mcafee.icims.com/jobs/9999/login',
      },
    },
  ],
}

const loadModule = async () => import('../../scraper/mcafee/script.js')

test('McAfee recognizes the verified join shell, jobs page, legacy 404 wrapper, and India API contract', async () => {
  const mcafee = await loadModule()

  assert.equal(mcafee.SOURCE, 'mcafee')
  assert.equal(mcafee.COMPANY, 'McAfee')
  assert.equal(mcafee.JOIN_URL, 'https://careers.mcafee.com/join')
  assert.equal(mcafee.JOBS_PAGE_URL, 'https://careers.mcafee.com/jobs')
  assert.equal(mcafee.JOBS_API_URL, 'https://careers.mcafee.com/api/jobs')
  assert.equal(mcafee.SEARCH_RESULTS_URL, 'https://careers.mcafee.com/global/en/search-results')
  assert.equal(mcafee.VERIFIED_ON, '2026-08-03')
  assert.equal(mcafee.hasJoinShellSignal(joinHtml), true)
  assert.equal(mcafee.hasJobsPageSignal(jobsPageHtml), true)
  assert.equal(mcafee.hasNonEnumerableSearchShellSignal({ status: 404, html: searchShellHtml }), true)
  assert.equal(mcafee.buildJobDetailUrl(indiaJobsPayload.jobs[0]), 'https://careers.mcafee.com/jobs/1469?lang=en-us')
  assert.equal(mcafee.hasMcAfeeJobsApiSignal(indiaJobsPayload), true)
})

test('McAfee normalizes only India jobs from the public API payload', async () => {
  const mcafee = await loadModule()

  assert.deepEqual(
    mixedJobsPayload.jobs.map((job) => mcafee.normalizeMcAfeeJob(job)).filter(Boolean),
    [
      {
        title: 'Data Engineer / Analyst',
        company: 'McAfee',
        department: 'Information Technology',
        location: 'Bangalore, India',
        city: 'Bangalore',
        country: 'India',
        jobId: '1469',
        requisitionId: '1469',
        sourceUrl: 'https://careers.mcafee.com/jobs/1469?lang=en-us',
        applyUrl: 'https://global-mcafee.icims.com/jobs/1469/login',
        employmentType: 'FULL TIME',
        experienceRequired: null,
        minimumQualification: null,
        preferredQualification: null,
        requiredSkills: ['Hybrid'],
        postingDate: '2026-07-31T09:25:00+0000',
        closingDate: '2026-10-27T18:30:00+0000',
        jobDescription: 'Role Summary\n\nBuild dashboards',
        remoteStatus: null,
      },
    ],
  )
})

test('McAfee run() validates the verified public India jobs API surface end-to-end', async () => {
  const mcafee = await loadModule()
  const requestedPageUrls = []
  const requestedJsonUrls = []

  const jobs = await mcafee.createMcAfeeScraper().run({
    fetchPage: async (url) => {
      requestedPageUrls.push(url)
      if (url === mcafee.JOIN_URL) return { status: 200, url, html: joinHtml }
      if (url === mcafee.JOBS_PAGE_URL) return { status: 200, url, html: jobsPageHtml }
      if (url === mcafee.SEARCH_RESULTS_URL) return { status: 404, url, html: searchShellHtml }
      throw new Error(`Unexpected page URL: ${url}`)
    },
    fetchJson: async (url) => {
      requestedJsonUrls.push(url)
      return { status: 200, url, json: indiaJobsPayload }
    },
  })

  assert.deepEqual(requestedPageUrls, [
    mcafee.JOIN_URL,
    mcafee.JOBS_PAGE_URL,
    mcafee.SEARCH_RESULTS_URL,
  ])
  assert.deepEqual(requestedJsonUrls, ['https://careers.mcafee.com/api/jobs?country=India&limit=100'])
  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].title, 'Data Engineer / Analyst')
  assert.equal(jobs[0].sourceUrl, 'https://careers.mcafee.com/jobs/1469?lang=en-us')
})
