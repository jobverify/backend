import assert from 'node:assert/strict'
import test from 'node:test'

const careersPage = {
  status: 200,
  url: 'https://innovaccer.com/careers',
  html: `
<!doctype html>
<html lang="en">
  <head>
    <title>Careers | Innovaccer</title>
  </head>
  <body>
    <h1>Transforming healthcare together for a better future.</h1>
    <a href="/careers/jobs" target="_blank">View open positions</a>
    <h2>Our Locations at a Glance</h2>
    <p>Stay in the loop, join our Talent Community!</p>
  </body>
</html>
`,
}

const jobsPage = {
  status: 200,
  url: 'https://innovaccer.com/careers/jobs',
  html: `
<!doctype html>
<html lang="en">
  <head>
    <title>Innovaccer Job Openings</title>
  </head>
  <body>
    <h1>Job Openings</h1>
    <p>Find your next role at Innovaccer.</p>
    <section aria-label="open roles">
      <a class="link-block-11 w-inline-block" href="https://apply.workable.com/j/48AE13A8DE">
        <h2>4348- Software Development Engineer-III Backend (Comet)</h2>
        <p>Noida, Uttar Pradesh, India</p>
      </a>
      <a class="link-block-11 w-inline-block" href="https://apply.workable.com/j/4297ABCDEF">
        <h2>4297- Senior Product Manager, AI</h2>
        <p>Noida, Uttar Pradesh, India</p>
      </a>
      <a class="link-block-11 w-inline-block" href="https://apply.workable.com/j/USROLE1234">
        <h2>Principal Data Architect</h2>
        <p>San Francisco, California, United States</p>
      </a>
    </section>
  </body>
</html>
`,
}

const widgetPayload = {
  name: 'Innovaccer Analytics',
  jobs: [
    {
      shortcode: '48AE13A8DE',
      title: '4348- Software Development Engineer-III Backend (Comet)',
      code: '4348',
      url: 'https://apply.workable.com/innovaccer-analytics/j/48AE13A8DE',
      application_url: 'https://apply.workable.com/innovaccer-analytics/j/48AE13A8DE/apply',
      city: 'Noida',
      state: 'Uttar Pradesh',
      country: 'India',
      department: 'Engineering And Analytics',
      employment_type: 'Full-time',
      workplace: 'on_site',
      published_on: '2026-07-06T00:00:00.000Z',
      experience: 'Mid-Senior level',
      education: "Bachelor's Degree",
    },
    {
      shortcode: '4297ABCDEF',
      title: '4297- Senior Product Manager, AI',
      code: '4297',
      url: 'https://apply.workable.com/innovaccer-analytics/j/4297ABCDEF',
      application_url: 'https://apply.workable.com/innovaccer-analytics/j/4297ABCDEF/apply',
      city: 'Noida',
      state: 'Uttar Pradesh',
      country: 'India',
      department: 'Product',
      employment_type: '',
      workplace: 'hybrid',
      published_on: '2026-07-04T00:00:00.000Z',
      experience: 'Associate',
      education: '',
    },
    {
      shortcode: 'USROLE1234',
      title: 'Principal Data Architect',
      code: '9800',
      url: 'https://apply.workable.com/innovaccer-analytics/j/USROLE1234',
      application_url: 'https://apply.workable.com/innovaccer-analytics/j/USROLE1234/apply',
      city: 'San Francisco',
      state: 'California',
      country: 'United States',
      department: 'Engineering And Analytics',
      employment_type: 'Full-time',
      workplace: 'remote',
      published_on: '2026-07-03T00:00:00.000Z',
      experience: 'Director',
    },
  ],
}

const loadInnovaccerModule = async () => {
  try {
    return await import('../../scraper/innovaccer/script.js')
  } catch {
    assert.fail('Expected Innovaccer scraper module at ../../scraper/innovaccer/script.js')
  }
}

test('Innovaccer verifies the first-party careers pages and Workable widget constants', async () => {
  const innovaccer = await loadInnovaccerModule()

  assert.equal(innovaccer.CAREERS_PAGE_URL, 'https://innovaccer.com/careers')
  assert.equal(innovaccer.JOBS_PAGE_URL, 'https://innovaccer.com/careers/jobs')
  assert.equal(innovaccer.WORKABLE_BOARD_URL, 'https://apply.workable.com/innovaccer-analytics/')
  assert.equal(innovaccer.WIDGET_API_URL, 'https://apply.workable.com/api/v1/widget/accounts/innovaccer-analytics')
  assert.equal(innovaccer.JOBS_FEED_URL, 'https://apply.workable.com/innovaccer-analytics/jobs.md')
  assert.equal(innovaccer.hasOfficialCareersPageSignal(careersPage), true)
  assert.equal(innovaccer.hasOfficialJobsPageSignal(jobsPage), true)
  assert.equal(innovaccer.hasWidgetApiSignal(widgetPayload), true)
})

test('Innovaccer extracts India jobs from the public Workable widget payload', async () => {
  const innovaccer = await loadInnovaccerModule()

  const jobs = innovaccer.extractIndiaJobsFromWidget(widgetPayload)

  assert.deepEqual(jobs, [
    {
      title: '4297- Senior Product Manager, AI',
      company: 'Innovaccer',
      department: 'Product',
      location: 'Noida, Uttar Pradesh, India',
      city: 'Noida',
      state: 'Uttar Pradesh',
      country: 'India',
      jobId: '4297ABCDEF',
      requisitionId: '4297ABCDEF',
      sourceUrl: 'https://apply.workable.com/innovaccer-analytics/j/4297ABCDEF',
      applyUrl: 'https://apply.workable.com/innovaccer-analytics/j/4297ABCDEF/apply',
      employmentType: null,
      experienceRequired: 'Associate',
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate: '2026-07-04',
      closingDate: null,
      jobDescription: null,
      remoteStatus: 'Hybrid',
    },
    {
      title: '4348- Software Development Engineer-III Backend (Comet)',
      company: 'Innovaccer',
      department: 'Engineering And Analytics',
      location: 'Noida, Uttar Pradesh, India',
      city: 'Noida',
      state: 'Uttar Pradesh',
      country: 'India',
      jobId: '48AE13A8DE',
      requisitionId: '48AE13A8DE',
      sourceUrl: 'https://apply.workable.com/innovaccer-analytics/j/48AE13A8DE',
      applyUrl: 'https://apply.workable.com/innovaccer-analytics/j/48AE13A8DE/apply',
      employmentType: 'Full-time',
      experienceRequired: 'Mid-Senior level',
      minimumQualification: "Bachelor's Degree",
      preferredQualification: null,
      requiredSkills: [],
      postingDate: '2026-07-06',
      closingDate: null,
      jobDescription: null,
      remoteStatus: 'On-site',
    },
  ])
})

test('Innovaccer run verifies the trusted public surfaces before returning India jobs', async () => {
  const innovaccer = await loadInnovaccerModule()
  const requestedPages = []
  const requestedJson = []

  const jobs = await innovaccer.createInnovaccerScraper({ maxJobs: 1 }).run({
    fetchPage: async (url) => {
      requestedPages.push(url)
      if (url === innovaccer.CAREERS_PAGE_URL) return careersPage
      if (url === innovaccer.JOBS_PAGE_URL) return jobsPage
      throw new Error(`Unexpected Innovaccer page URL: ${url}`)
    },
    fetchJson: async (url) => {
      requestedJson.push(url)
      if (url === innovaccer.WIDGET_API_URL) return widgetPayload
      throw new Error(`Unexpected Innovaccer widget URL: ${url}`)
    },
    now: () => '2026-07-16T00:00:00.000Z',
  })

  assert.deepEqual(requestedPages, [
    innovaccer.CAREERS_PAGE_URL,
    innovaccer.JOBS_PAGE_URL,
  ])
  assert.deepEqual(requestedJson, [innovaccer.WIDGET_API_URL])
  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].source, 'innovaccer')
  assert.equal(jobs[0].link, jobs[0].applyUrl)
  assert.equal(jobs[0].scrapedAt, '2026-07-16T00:00:00.000Z')
  assert.equal(jobs[0].title, '4297- Senior Product Manager, AI')
})

test('Innovaccer fails closed when the verified jobs page drifts materially', async () => {
  const innovaccer = await loadInnovaccerModule()

  await assert.rejects(
    innovaccer.createInnovaccerScraper().run({
      fetchPage: async (url) => {
        if (url === innovaccer.CAREERS_PAGE_URL) return careersPage
        if (url === innovaccer.JOBS_PAGE_URL) {
          return {
            ...jobsPage,
            html: '<html><body><h1>Unexpected</h1></body></html>',
          }
        }

        throw new Error(`Unexpected Innovaccer page URL: ${url}`)
      },
      fetchJson: async () => widgetPayload,
    }),
    /verified Innovaccer jobs page/i,
  )
})
