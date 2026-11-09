import assert from 'node:assert/strict'
import test from 'node:test'

import {
  CAREERS_URL,
  GREENHOUSE_BOARD_SLUG,
  buildGreenhouseBoardUrl,
  buildGreenhouseJobsApiUrl,
  createFivetranScraper,
  hasOfficialCareersSignal,
  normalizeGreenhouseJobUrl,
} from './script.js'

const careersHtml = `
  <!doctype html>
  <html lang="en">
    <head>
      <title>Experience ownership, impact, and recognition at Fivetran | Careers at Fivetran</title>
    </head>
    <body>
      <p>Together, we power the data revolution</p>
      <p>Create job alert</p>
      <a href="https://my.greenhouse.io/users/sign_in?job_board=fivetran">Job alert</a>
      <p>Bengaluru | India</p>
      <p>Sydney | Australia</p>
      <p>careers@fivetran.com</p>
    </body>
  </html>
`

const jobsPayload = {
  jobs: [
    {
      id: 7687227003,
      title: 'Software Engineer',
      absolute_url: 'https://www.fivetran.com/careers/job?gh_jid=7687227003',
      company_name: 'Fivetran ',
      requisition_id: 'REQ-2',
      location: { name: 'Bengaluru, Karnataka, India, APAC' },
      departments: [{ name: 'Engineering' }],
      content: '<ul><li>Distributed systems</li></ul>',
      updated_at: '2026-08-01T09:00:00Z',
    },
  ],
}

test('Fivetran accepts the current first-party gh_jid job URLs from the Greenhouse payload', () => {
  assert.equal(hasOfficialCareersSignal(careersHtml), true)
  assert.equal(
    normalizeGreenhouseJobUrl('https://www.fivetran.com/careers/job?gh_jid=7687227003', 7687227003),
    'https://www.fivetran.com/careers/job?gh_jid=7687227003',
  )
})

test('Fivetran run accepts the current first-party gh_jid payload while the Greenhouse board redirect still resolves to careers', async () => {
  const requestedPages = []
  const requestedJsonUrls = []

  const jobs = await createFivetranScraper().run({
    fetchPage: async (url) => {
      requestedPages.push(url)
      if (url === CAREERS_URL) return { status: 200, url, html: careersHtml }
      if (url === buildGreenhouseBoardUrl(GREENHOUSE_BOARD_SLUG)) {
        return { status: 200, url: CAREERS_URL, html: careersHtml }
      }
      throw new Error(`Unexpected page URL: ${url}`)
    },
    fetchJson: async (url) => {
      requestedJsonUrls.push(url)
      if (url === buildGreenhouseJobsApiUrl(GREENHOUSE_BOARD_SLUG)) return jobsPayload
      throw new Error(`Unexpected JSON URL: ${url}`)
    },
    now: () => '2026-08-02T04:46:00.000Z',
  })

  assert.deepEqual(requestedPages, [
    CAREERS_URL,
    buildGreenhouseBoardUrl(GREENHOUSE_BOARD_SLUG),
  ])
  assert.deepEqual(requestedJsonUrls, [buildGreenhouseJobsApiUrl(GREENHOUSE_BOARD_SLUG)])
  assert.equal(jobs.length, 1)
  assert.deepEqual(
    {
      title: jobs[0].title,
      location: jobs[0].location,
      link: jobs[0].link,
      source: jobs[0].source,
      scrapedAt: jobs[0].scrapedAt,
    },
    {
      title: 'Software Engineer',
      location: 'Bengaluru, Karnataka, India, APAC',
      link: 'https://www.fivetran.com/careers/job?gh_jid=7687227003',
      source: 'fivetran',
      scrapedAt: '2026-08-02T04:46:00.000Z',
    },
  )
})
