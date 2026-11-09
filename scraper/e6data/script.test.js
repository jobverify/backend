import assert from 'node:assert/strict'
import test from 'node:test'

import {
  CAREERS_API_URL,
  CAREERS_PAGE_URL,
  CAREERS_PORTAL_URL,
  COMPANY,
  HOMEPAGE_URL,
  SOURCE,
  createE6DataScraper,
  extractIndiaJobs,
  hasOfficialCareersPageSignal,
  hasOfficialHomepageSignal,
  hasOfficialPortalSignal,
} from './script.js'

const officialHomepageHtml = `
  <html lang="en">
    <head>
      <title>e6data - The data plane for the agentic era</title>
    </head>
    <body>
      <header>
        <a href="/">e6data</a>
        <nav>
          <a href="/products">Products</a>
          <a href="/careers">Careers</a>
          <a href="/contact">Contact</a>
        </nav>
      </header>
      <main>
        <h1><span>The data plane</span> agents were waiting for.</h1>
        <p>Built for the agentic era.</p>
      </main>
    </body>
  </html>
`

const currentHomepageHtml = `
  <html lang="en">
    <head><title>e6data: lakehouse compute engine for the agentic era</title></head>
    <body>
      <a href="/careers">Careers</a>
      <h1>The data plane for the agentic era</h1>
    </body>
  </html>
`

const officialCareersPageHtml = `
  <html lang="en">
    <head>
      <title>Careers at e6data — e6data</title>
    </head>
    <body>
      <main>
        <p>CAREERS</p>
        <h1>Build the compute layer with us</h1>
        <a href="https://e6data.zohorecruit.in/jobs/Careers">View all open roles →</a>
      </main>
    </body>
  </html>
`

const officialPortalHtml = `
  <html>
    <head>
      <title>Jobs at e6data</title>
      <meta property="og:url" content="https://e6data.zohorecruit.in/jobs/Careers" />
    </head>
    <body>
      <h1>Jobs at e6data</h1>
      <input id="pageJson" value="{}" />
      <input id="moduleMeta" value="{}" />
      <input id="jobs" value="[]" />
      <p>CareerSite</p>
      <p>e6data</p>
    </body>
  </html>
`

const officialApiPayload = {
  code: 'success',
  data: [
    {
      id: '153870000000379034',
      Posting_Title: 'Senior Software Engineer - Planner',
      Job_Type: 'Full time',
      Work_Experience: '5-8 years',
      Job_Description: 'Design distributed planner services.',
      Date_Opened: '2026-08-12',
      City: 'Bangalore North',
      State: 'Karnataka',
      Country: 'India',
      Currency: 'INR',
      Publish: false,
      $url:
        'https://e6data.zohorecruit.in/jobs/Careers/153870000000379034/Senior-Software-Engineer-Planner?source=CareerSite',
    },
    {
      id: '153870000000979112',
      Posting_Title: 'Senior Software Engineer - Database engineer',
      Job_Type: 'Full time',
      Work_Experience: '7-10 years',
      Job_Description: 'Remote role with no explicit country in the public feed.',
      Date_Opened: '2026-08-11',
      City: '',
      State: '',
      Country: '',
      Currency: 'INR',
      Remote_Job: 'Yes',
      Publish: true,
      $url:
        'https://e6data.zohorecruit.in/jobs/Careers/153870000000979112/Senior-Software-Engineer-Database-engineer?source=CareerSite',
    },
    {
      id: '153870000001436332',
      Posting_Title: 'Solution Engineer',
      Job_Type: 'Full time',
      Work_Experience: '4-7 years',
      Job_Description: 'Remote role with no explicit country in the public feed.',
      Date_Opened: '2026-08-10',
      City: '',
      State: '',
      Country: '',
      Currency: 'INR',
      Remote_Job: 'Yes',
      Publish: true,
      $url:
        'https://e6data.zohorecruit.in/jobs/Careers/153870000001436332/Solution-Engineer?source=CareerSite',
    },
    {
      id: '153870000001028082',
      Posting_Title: 'Senior Quality Engineer',
      Job_Type: 'Full time',
      Work_Experience: '5-8 years',
      Job_Description: 'Quality engineering role for the platform team.',
      Date_Opened: '2026-08-09',
      City: 'NA',
      State: 'Karnataka',
      Country: 'India',
      Currency: 'INR',
      Publish: true,
      $url:
        'https://e6data.zohorecruit.in/jobs/Careers/153870000001028082/Senior-Quality-Engineer?source=CareerSite',
    },
    {
      id: '153870000000474222',
      Posting_Title: 'Software Engineer',
      Job_Type: 'Full time',
      Work_Experience: '3-5 years',
      Job_Description: 'Remote role with no explicit country in the public feed.',
      Date_Opened: '2026-08-08',
      City: '',
      State: '',
      Country: '',
      Currency: 'INR',
      Remote_Job: 'Yes',
      Publish: true,
      $url:
        'https://e6data.zohorecruit.in/jobs/Careers/153870000000474222/Software-Engineer?source=CareerSite',
    },
    {
      id: '153870000001028080',
      Posting_Title: 'QA Engineer (Platform)',
      Job_Type: 'Full time',
      Work_Experience: '2-4 years',
      Job_Description: 'Role with missing public location fields.',
      Date_Opened: '2026-08-07',
      City: null,
      State: null,
      Country: null,
      Currency: 'INR',
      Publish: true,
      $url:
        'https://e6data.zohorecruit.in/jobs/Careers/153870000001028080/QA-Engineer-Platform?source=CareerSite',
    },
  ],
}

const expectedIndiaJobs = [
  {
    title: 'Senior Software Engineer - Planner',
    company: COMPANY,
    department: null,
    location: 'Bangalore North, Karnataka, India',
    city: 'Bangalore North',
    state: 'Karnataka',
    country: 'India',
    jobId: '153870000000379034',
    requisitionId: '153870000000379034',
    sourceUrl:
      'https://e6data.zohorecruit.in/jobs/Careers/153870000000379034/Senior-Software-Engineer-Planner?source=CareerSite',
    applyUrl:
      'https://e6data.zohorecruit.in/jobs/Careers/153870000000379034/Senior-Software-Engineer-Planner?source=CareerSite',
    employmentType: 'Full-time',
    experienceRequired: '5-8 years',
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills: [],
    postingDate: '2026-08-12',
    closingDate: null,
    jobDescription: 'Design distributed planner services.',
    remoteStatus: 'On-site',
  },
  {
    title: 'Senior Quality Engineer',
    company: COMPANY,
    department: null,
    location: 'Karnataka, India',
    city: null,
    state: 'Karnataka',
    country: 'India',
    jobId: '153870000001028082',
    requisitionId: '153870000001028082',
    sourceUrl:
      'https://e6data.zohorecruit.in/jobs/Careers/153870000001028082/Senior-Quality-Engineer?source=CareerSite',
    applyUrl:
      'https://e6data.zohorecruit.in/jobs/Careers/153870000001028082/Senior-Quality-Engineer?source=CareerSite',
    employmentType: 'Full-time',
    experienceRequired: '5-8 years',
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills: [],
    postingDate: '2026-08-09',
    closingDate: null,
    jobDescription: 'Quality engineering role for the platform team.',
    remoteStatus: 'On-site',
  },
]

test('helpers recognize the verified August 14, 2026 homepage, careers handoff, Zoho board, and India-only API contract', () => {
  assert.equal(HOMEPAGE_URL, 'https://e6data.com/')
  assert.equal(CAREERS_PAGE_URL, 'https://e6data.com/careers')
  assert.equal(CAREERS_PORTAL_URL, 'https://e6data.zohorecruit.in/jobs/Careers')
  assert.equal(
    CAREERS_API_URL,
    'https://e6data.zohorecruit.in/recruit/v2/public/Job_Openings?pagename=Careers&source=CareerSite',
  )

  assert.equal(hasOfficialHomepageSignal(officialHomepageHtml), true)
  assert.equal(hasOfficialCareersPageSignal(officialCareersPageHtml), true)
  assert.equal(hasOfficialPortalSignal(officialPortalHtml), true)
  assert.deepEqual(extractIndiaJobs(officialApiPayload), expectedIndiaJobs)
})

test('homepage signal accepts the current e6data title while preserving its official careers link', () => {
  assert.equal(hasOfficialHomepageSignal(currentHomepageHtml), true)
  assert.equal(hasOfficialHomepageSignal(currentHomepageHtml.replace('href="/careers"', 'href="/contact"')), false)
})

test('run returns only explicitly India-scoped jobs from the verified public Zoho API', async () => {
  const requestedTextUrls = []
  const requestedJsonUrls = []

  const jobs = await createE6DataScraper().run({
    fetchText: async (url) => {
      requestedTextUrls.push(url)

      if (url === HOMEPAGE_URL) return officialHomepageHtml
      if (url === CAREERS_PAGE_URL) return officialCareersPageHtml
      if (url === CAREERS_PORTAL_URL) return officialPortalHtml

      throw new Error(`Unexpected text URL: ${url}`)
    },
    fetchJson: async (url) => {
      requestedJsonUrls.push(url)

      if (url === CAREERS_API_URL) return officialApiPayload

      throw new Error(`Unexpected JSON URL: ${url}`)
    },
    now: () => '2026-08-14T00:00:00.000Z',
  })

  assert.deepEqual(requestedTextUrls, [
    HOMEPAGE_URL,
    CAREERS_PAGE_URL,
    CAREERS_PORTAL_URL,
  ])
  assert.deepEqual(requestedJsonUrls, [CAREERS_API_URL])
  assert.deepEqual(jobs, expectedIndiaJobs.map((job) => ({
    ...job,
    source: SOURCE,
    link: job.applyUrl,
    scrapedAt: '2026-08-14T00:00:00.000Z',
  })))
})

test('run fails closed when the homepage no longer matches the verified official e6data surface', async () => {
  await assert.rejects(
    createE6DataScraper().run({
      fetchText: async (url) => {
        if (url === HOMEPAGE_URL) {
          return '<html><head><title>Placeholder</title></head><body>Coming soon</body></html>'
        }

        if (url === CAREERS_PAGE_URL) return officialCareersPageHtml
        if (url === CAREERS_PORTAL_URL) return officialPortalHtml

        throw new Error(`Unexpected text URL: ${url}`)
      },
      fetchJson: async () => officialApiPayload,
    }),
    /e6data homepage no longer matches the verified official public surface/i,
  )
})

test('run fails closed when the careers page no longer matches the verified Zoho handoff surface', async () => {
  await assert.rejects(
    createE6DataScraper().run({
      fetchText: async (url) => {
        if (url === HOMEPAGE_URL) return officialHomepageHtml
        if (url === CAREERS_PAGE_URL) {
          return `
            <html>
              <head><title>Careers at e6data — e6data</title></head>
              <body><h1>Build the compute layer with us</h1></body>
            </html>
          `
        }
        if (url === CAREERS_PORTAL_URL) return officialPortalHtml

        throw new Error(`Unexpected text URL: ${url}`)
      },
      fetchJson: async () => officialApiPayload,
    }),
    /e6data careers page no longer matches the verified public handoff surface/i,
  )
})

test('run fails closed when the public Zoho board stops matching the verified official surface', async () => {
  await assert.rejects(
    createE6DataScraper().run({
      fetchText: async (url) => {
        if (url === HOMEPAGE_URL) return officialHomepageHtml
        if (url === CAREERS_PAGE_URL) return officialCareersPageHtml
        if (url === CAREERS_PORTAL_URL) {
          return `
            <html>
              <head><title>Jobs | e6data</title></head>
              <body><h1>Open Roles</h1></body>
            </html>
          `
        }

        throw new Error(`Unexpected text URL: ${url}`)
      },
      fetchJson: async () => officialApiPayload,
    }),
    /e6data public Zoho Recruit board no longer matches the verified surface/i,
  )
})

test('run fails closed when the public jobs API no longer returns the verified success payload', async () => {
  await assert.rejects(
    createE6DataScraper().run({
      fetchText: async (url) => {
        if (url === HOMEPAGE_URL) return officialHomepageHtml
        if (url === CAREERS_PAGE_URL) return officialCareersPageHtml
        if (url === CAREERS_PORTAL_URL) return officialPortalHtml

        throw new Error(`Unexpected text URL: ${url}`)
      },
      fetchJson: async () => ({ code: 'error', data: null }),
    }),
    /e6data public jobs API no longer returns the verified success payload/i,
  )
})
