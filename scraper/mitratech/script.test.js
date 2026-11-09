import assert from 'node:assert/strict'
import test from 'node:test'

import {
  CAREERS_URL,
  COMPANY,
  GREENHOUSE_BOARD_URL,
  buildGreenhouseJobsApiUrl,
  createMitratechScraper,
  extractIndiaJobsFromGreenhousePayload,
  extractOfficialGreenhouseBoardUrl,
  hasOfficialCareersPageSignal,
  normalizeGreenhouseJobUrl,
} from './script.js'

const officialCareersHtml = `
  <!doctype html>
  <html lang="en">
    <head>
      <title>Global Technology Careers | Mitratech</title>
    </head>
    <body>
      <main>
        <h1>Global Technology Careers</h1>
        <p><a href="https://job-boards.greenhouse.io/mitratech">Current Openings</a></p>
        <section id="our-people">
          <h2>Our People</h2>
          <p>Meet the teams shaping enterprise software at Mitratech.</p>
        </section>
      </main>
    </body>
  </html>
`

const greenhousePayload = {
  jobs: [
    {
      id: 8049913,
      title: 'Principal Data Engineer',
      company_name: COMPANY,
      absolute_url: 'https://job-boards.greenhouse.io/mitratech/jobs/8049913?gh_src=test',
      requisition_id: '3858',
      updated_at: '2026-07-21T02:30:06-04:00',
      first_published: '2026-07-21T02:30:06-04:00',
      content: '<p>Lead data engineering for Mitratech products.</p>',
      location: { name: 'Mitratech India' },
      departments: [{ name: 'Development' }],
      offices: [{ name: 'Mitratech India', location: null }],
      metadata: null,
    },
    {
      id: 9000001,
      title: 'Senior Manager, Account Management',
      company_name: COMPANY,
      absolute_url: 'https://job-boards.greenhouse.io/mitratech/jobs/9000001',
      requisition_id: '4001',
      updated_at: '2026-07-22T02:30:06-04:00',
      first_published: '2026-07-22T02:30:06-04:00',
      content: '<p>Remote US role.</p>',
      location: { name: 'Remote US' },
      departments: [{ name: 'Sales' }],
      offices: [{ name: 'Remote US', location: null }],
      metadata: null,
    },
  ],
}

test('Mitratech pins the verified first-party careers handoff and Greenhouse API contract', () => {
  assert.equal(GREENHOUSE_BOARD_URL, 'https://job-boards.greenhouse.io/mitratech')
  assert.equal(hasOfficialCareersPageSignal(officialCareersHtml), true)
  assert.equal(extractOfficialGreenhouseBoardUrl(officialCareersHtml), GREENHOUSE_BOARD_URL)
  assert.equal(
    buildGreenhouseJobsApiUrl(),
    'https://boards-api.greenhouse.io/v1/boards/mitratech/jobs?content=true',
  )
  assert.equal(
    normalizeGreenhouseJobUrl(
      'https://job-boards.greenhouse.io/mitratech/jobs/8049913?gh_src=test',
      8049913,
    ),
    'https://job-boards.greenhouse.io/mitratech/jobs/8049913',
  )
})

test('Mitratech keeps only India jobs from the verified Greenhouse payload', () => {
  assert.deepEqual(
    extractIndiaJobsFromGreenhousePayload(greenhousePayload, {
      scrapedAt: '2026-08-01T00:00:00.000Z',
    }),
    [
      {
        title: 'Principal Data Engineer',
        company: 'Mitratech',
        location: 'Mitratech India',
        city: null,
        country: 'India',
        link: 'https://job-boards.greenhouse.io/mitratech/jobs/8049913',
        applyUrl: 'https://job-boards.greenhouse.io/mitratech/jobs/8049913',
        sourceUrl: 'https://job-boards.greenhouse.io/mitratech/jobs/8049913',
        source: 'mitratech',
        jobId: '8049913',
        requisitionId: '3858',
        department: 'Development',
        employmentType: null,
        experienceRequired: null,
        jobDescription: 'Lead data engineering for Mitratech products.',
        minimumQualification: null,
        preferredQualification: null,
        requiredSkills: [],
        postingDate: '2026-07-21T02:30:06-04:00',
        closingDate: null,
        scrapedAt: '2026-08-01T00:00:00.000Z',
      },
    ],
  )
})

test('Mitratech run validates the official careers page before fetching the Greenhouse jobs API', async () => {
  const requestedTextUrls = []
  const requestedJsonUrls = []

  const jobs = await createMitratechScraper().run({
    fetchText: async (url) => {
      requestedTextUrls.push(url)
      return officialCareersHtml
    },
    fetchJson: async (url) => {
      requestedJsonUrls.push(url)
      return greenhousePayload
    },
    now: () => '2026-08-01T00:00:00.000Z',
  })

  assert.deepEqual(requestedTextUrls, [CAREERS_URL])
  assert.deepEqual(requestedJsonUrls, [buildGreenhouseJobsApiUrl()])
  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].title, 'Principal Data Engineer')
})

test('Mitratech fails closed when the careers handoff or Greenhouse identity drifts', async () => {
  await assert.rejects(
    createMitratechScraper().run({
      fetchText: async () => '<html><title>Unexpected</title></html>',
      fetchJson: async () => greenhousePayload,
    }),
    /trusted Greenhouse board handoff/i,
  )

  assert.throws(
    () => extractIndiaJobsFromGreenhousePayload({
      jobs: [{
        id: 1,
        title: 'Principal Data Engineer',
        company_name: 'Unexpected Company',
        absolute_url: 'https://job-boards.greenhouse.io/mitratech/jobs/1',
        location: { name: 'Mitratech India' },
      }],
    }),
    /verified company identity/i,
  )
})
