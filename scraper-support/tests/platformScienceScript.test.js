import assert from 'node:assert/strict'
import test from 'node:test'

import {
  CAREERS_URL,
  GREENHOUSE_API_URL,
  GREENHOUSE_BOARD_URL,
  createPlatformScienceScraper,
  extractJobsFromGreenhousePayload,
  isIndiaJob,
  pageIndicatesOfficialJobsSurface,
} from '../../scraper/platformscience/script.js'

const sampleCareersHtml = `
  <main>
    <h1>Open Positions</h1>
    <a href="https://www.platformscience.com/careers?gh_jid=123">Full Stack Developer - India Chennai, Tamil Nadu, India VIEW JOB</a>
    <a href="https://www.platformscience.com/careers?gh_jid=456">Senior Quality Engineer (Automation) - India Chennai, Tamil Nadu, India VIEW JOB</a>
    <a href="${GREENHOUSE_BOARD_URL}">Contact Us</a>
  </main>
`

const samplePayload = {
  jobs: [
    {
      absolute_url: 'https://job-boards.greenhouse.io/platformscience/jobs/1111111003',
      id: 1111111003,
      requisition_id: 'PS-IND-001',
      title: 'Full Stack Developer - India',
      company_name: 'Platform Science',
      first_published: '2026-07-24T10:00:00-04:00',
      content: '<p>Build customer-facing software in Chennai.</p>',
      location: { name: 'Chennai, Tamil Nadu, India' },
      departments: [{ name: 'Engineering' }],
      offices: [{ location: 'Chennai, Tamil Nadu, India' }],
      metadata: [],
    },
    {
      absolute_url: 'https://job-boards.greenhouse.io/platformscience/jobs/1111111004',
      id: 1111111004,
      requisition_id: 'PS-IND-002',
      title: 'Senior Quality Engineer (Automation) - India',
      company_name: 'Platform Science',
      first_published: '2026-07-24T10:00:00-04:00',
      content: '<p>Automation quality role in Chennai.</p>',
      location: { name: 'Chennai, Tamil Nadu, India' },
      departments: [{ name: 'Engineering' }],
      offices: [{ location: 'Chennai, Tamil Nadu, India' }],
      metadata: [],
    },
    {
      absolute_url: 'https://job-boards.greenhouse.io/platformscience/jobs/1111111005',
      id: 1111111005,
      requisition_id: 'PS-US-001',
      title: 'Director of Procurement',
      company_name: 'Platform Science',
      first_published: '2026-07-24T10:00:00-04:00',
      content: '<p>US procurement leadership role.</p>',
      location: { name: 'San Diego, California, United States' },
      departments: [{ name: 'Finance - NAM' }],
      offices: [{ location: 'San Diego, California, United States' }],
      metadata: [],
    },
  ],
}

test('pageIndicatesOfficialJobsSurface recognizes the verified Platform Science first-party jobs page', () => {
  assert.equal(CAREERS_URL, 'https://www.platformscience.com/jobs')
  assert.equal(GREENHOUSE_API_URL, 'https://boards-api.greenhouse.io/v1/boards/platformscience/jobs?content=true')
  assert.equal(pageIndicatesOfficialJobsSurface(sampleCareersHtml), true)
  assert.equal(pageIndicatesOfficialJobsSurface('<main>No openings today</main>'), false)
})

test('Platform Science scraper keeps only India roles from the official Greenhouse feed', async () => {
  assert.equal(isIndiaJob(samplePayload.jobs[0]), true)
  assert.equal(isIndiaJob(samplePayload.jobs[1]), true)
  assert.equal(isIndiaJob(samplePayload.jobs[2]), false)

  const extractedJobs = extractJobsFromGreenhousePayload(samplePayload)
  assert.equal(extractedJobs.length, 2)

  const jobs = await createPlatformScienceScraper().run({
    fetchText: async (url) => {
      assert.equal(url, CAREERS_URL)
      return sampleCareersHtml
    },
    fetchJson: async (url) => {
      assert.equal(url, GREENHOUSE_API_URL)
      return samplePayload
    },
    now: () => '2026-07-25T00:00:00.000Z',
  })

  assert.deepEqual(
    jobs.map((job) => [job.title, job.location, job.department, job.country, job.scrapedAt]),
    [
      ['Full Stack Developer - India', 'Chennai, Tamil Nadu, India', 'Engineering', 'India', '2026-07-25T00:00:00.000Z'],
      ['Senior Quality Engineer (Automation) - India', 'Chennai, Tamil Nadu, India', 'Engineering', 'India', '2026-07-25T00:00:00.000Z'],
    ],
  )
})
