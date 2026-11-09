import assert from 'node:assert/strict'
import test from 'node:test'

import {
  ASHBY_JOB_BOARD_URL,
  CAREERS_URL,
  createExaScraper,
  extractAshbyJobs,
  extractVerifiedCareersBundleUrl,
  hasOfficialCareersPageSignal,
  hasVerifiedCareersBundleSignal,
} from './script.js'

const careersHtml = `
  <!doctype html>
  <html lang="en">
    <head>
      <title>Careers</title>
      <script src="/_next/static/chunks/app/careers/page-abcdef1234567890.js"></script>
    </head>
    <body>
      <h1>Come build the best search engine in the world</h1>
      <p>Visa sponsorship</p>
      <p>Fully in-person team</p>
      <footer>Exa Labs Inc.</footer>
    </body>
  </html>
`

const bundleScript = `
  const officeLabels = { SF:"San Francisco", NYC:"New York City", SG:"Singapore" }
  const jobs = [
    "https://jobs.ashbyhq.com/exa/41eb773d-9909-422c-b6b8-5bbdc407d318",
    "https://jobs.ashbyhq.com/exa/e3e0cd05-d71a-491d-a553-2a991741915c",
    "https://jobs.ashbyhq.com/exa/11cd06ca-db50-4821-a920-07071f8ce0b4"
  ]
`

const ashbyPayload = {
  jobs: [
    {
      id: 'job-india-1',
      isListed: true,
      title: 'Software Engineer, India',
      department: 'Engineering',
      jobUrl: 'https://jobs.ashbyhq.com/exa/job-india-1',
      applyUrl: 'https://jobs.ashbyhq.com/exa/job-india-1/apply',
      employmentType: 'FullTime',
      publishedAt: '2026-07-31',
      location: 'Hyderabad, India',
      address: {
        postalAddress: {
          addressLocality: 'Hyderabad',
          addressRegion: 'Telangana',
          addressCountry: 'India',
        },
      },
      secondaryLocations: [],
    },
  ],
}

test('Exa accepts the current hashed careers bundle and still extracts India Ashby jobs', async () => {
  assert.equal(hasOfficialCareersPageSignal(careersHtml), true)
  assert.equal(
    extractVerifiedCareersBundleUrl(careersHtml),
    'https://exa.ai/_next/static/chunks/app/careers/page-abcdef1234567890.js',
  )
  assert.equal(hasVerifiedCareersBundleSignal(bundleScript), true)

  const requestedTextUrls = []
  const requestedJsonUrls = []
  const jobs = await createExaScraper({
    now: () => '2026-08-02T00:00:00.000Z',
  }).run({
    fetchText: async (url) => {
      requestedTextUrls.push(url)
      if (url === CAREERS_URL) return careersHtml
      if (url === 'https://exa.ai/_next/static/chunks/app/careers/page-abcdef1234567890.js') return bundleScript
      throw new Error(`Unexpected text URL: ${url}`)
    },
    fetchJson: async (url) => {
      requestedJsonUrls.push(url)
      if (url === ASHBY_JOB_BOARD_URL) return ashbyPayload
      throw new Error(`Unexpected JSON URL: ${url}`)
    },
  })

  assert.deepEqual(requestedTextUrls, [
    CAREERS_URL,
    'https://exa.ai/_next/static/chunks/app/careers/page-abcdef1234567890.js',
  ])
  assert.deepEqual(requestedJsonUrls, [ASHBY_JOB_BOARD_URL])
  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].title, 'Software Engineer, India')
  assert.equal(jobs[0].country, 'India')
  assert.equal(jobs[0].source, 'exa')
  assert.equal(jobs[0].scrapedAt, '2026-08-02T00:00:00.000Z')
})
