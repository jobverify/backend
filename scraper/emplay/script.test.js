import assert from 'node:assert/strict'
import test from 'node:test'

import {
  CAREERS_URL,
  JOBS_URL,
  createEmplayScraper,
  extractJobs,
  hasOfficialCareersSignal,
  hasOfficialJobsPageSignal,
} from './script.js'

const careersHtml = `
  <html lang="en">
    <head>
      <title>careers</title>
    </head>
    <body>
      <p>Join us and change yours by shaping the future of Conversations!</p>
      <a href="/careers-all-jobs">Explore Job Openings</a>
    </body>
  </html>
`

const jobsHtml = `
  <html lang="en">
    <head>
      <title>all jobs</title>
    </head>
    <body>
      <h1>All Jobs</h1>
      <p>Join Our Team</p>
      <section id="devops" class="devops">
        <div class="div-block-482"><div class="text-block-256">DEVOPS</div></div>
        <div class="w-dyn-list">
          <div role="list" class="collection-list-5 w-dyn-items w-row">
            <div role="listitem" class="collection-item-6-copy w-dyn-item w-col w-col-6">
              <div class="div-block-485">
                <div class="w-layout-grid grid-114">
                  <div class="div-block-998"><a href="/devops/qa-engineer-ai-testing-skills" class="link-41">QA Engineer — AI Testing Skills</a></div>
                  <div><div class="text-block-264">June 22, 2026</div></div>
                </div>
                <div class="text-block-268">Remote / Work from Home</div>
                <div>As per company standards</div>
                <div class="text-block-263">3-4 Years </div>
              </div>
            </div>
          </div>
        </div>
      </section>
      <a href="/careers-all-jobs" class="button-21 w-button">All Jobs</a>
    </body>
  </html>
`

test('Emplay constants stay pinned to the verified official careers surfaces', () => {
  assert.equal(CAREERS_URL, 'https://www.emplay.net/careers/')
  assert.equal(JOBS_URL, 'https://www.emplay.net/careers-all-jobs')
  assert.equal(hasOfficialCareersSignal(careersHtml), true)
  assert.equal(hasOfficialJobsPageSignal(jobsHtml), true)
})

test('extractJobs parses the official Emplay static job card surface', () => {
  assert.deepEqual(extractJobs(jobsHtml), [
    {
      title: 'QA Engineer — AI Testing Skills',
      company: 'Emplay',
      department: 'DEVOPS',
      location: 'Remote / Work from Home',
      city: 'Remote',
      country: 'India',
      jobId: 'https://www.emplay.net/devops/qa-engineer-ai-testing-skills',
      requisitionId: 'https://www.emplay.net/devops/qa-engineer-ai-testing-skills',
      sourceUrl: 'https://www.emplay.net/devops/qa-engineer-ai-testing-skills',
      applyUrl: 'https://www.emplay.net/devops/qa-engineer-ai-testing-skills',
      employmentType: null,
      experienceRequired: '3-4 Years',
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate: 'June 22, 2026',
      closingDate: null,
      jobDescription: 'As per company standards',
      remoteStatus: 'Remote',
    },
  ])
})

test('run verifies the official Emplay surfaces before parsing static job cards', async () => {
  const requestedUrls = []
  const jobs = await createEmplayScraper().run({
    fetchText: async (url) => {
      requestedUrls.push(url)
      if (url === CAREERS_URL) return careersHtml
      if (url === JOBS_URL) return jobsHtml
      throw new Error(`Unexpected URL: ${url}`)
    },
    now: () => '2026-07-08T00:00:00.000Z',
  })

  assert.deepEqual(requestedUrls, [CAREERS_URL, JOBS_URL])
  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].source, 'emplay')
  assert.equal(jobs[0].scrapedAt, '2026-07-08T00:00:00.000Z')
})

test('run fails closed when the verified Emplay jobs page signal disappears', async () => {
  await assert.rejects(
    createEmplayScraper().run({
      fetchText: async (url) => {
        if (url === CAREERS_URL) return careersHtml
        return '<html><body>No jobs here</body></html>'
      },
    }),
    /static listings surface/i,
  )
})
