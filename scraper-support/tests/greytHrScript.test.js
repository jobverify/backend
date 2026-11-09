import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

import {
  CAREERS_URL,
  COMPANY,
  JOBS_API_URL,
  CATEGORIES_API_URL,
  SOURCE,
  createGreytHrScraper,
  hasOfficialCareersSignal,
  extractGreytHrJobs,
} from '../../scraper/greythr/script.js'

const officialCareersHtml = `
  <html>
    <head><title>Career and Job Opportunities - Greytip Software</title></head>
    <body>
      <a href="https://greytip.greythr.com/hire/jobs/">Careers</a>
      <h1>Begin the journey of your success here</h1>
      <h2>Come, grow with us</h2>
    </body>
  </html>
`

const publishedJobsPayload = {
  data: [
    {
      id: 'job-1',
      title: 'Associate Manager-Custome Success',
      req_id: '1356',
      slug: 'associate-manager-custome-success',
      locations: ['4', '1029'],
      description: '<p>Own customer onboarding and adoption of greytHR.</p>',
      job_type: 'Full-time',
      min_exp: 84,
      max_exp: 120,
      experience_units: 'years',
      apply_url: 'https://greytip.greythr.com/hire/jobs/associate-manager-custome-success',
      published_on_career_page: '2026-07-22T07:09:14.699611Z',
    },
  ],
}
const categories = JSON.parse(readFileSync(new URL('./fixtures/greythr/categories.json', import.meta.url)))

test('GreytHR scraper identifies the verified first-party careers and JSON jobs surfaces', () => {
  assert.equal(SOURCE, 'greythr')
  assert.equal(COMPANY, 'Greytip Software')
  assert.equal(CAREERS_URL, 'https://www.greythr.com/company/careers/')
  assert.equal(JOBS_API_URL, 'https://greytip.greythr.com/hire/api/career/published_jobs/')
  assert.equal(hasOfficialCareersSignal(officialCareersHtml), true)
  assert.deepEqual(extractGreytHrJobs(publishedJobsPayload, categories), [
    {
      title: 'Associate Manager-Custome Success',
      location: 'Bangalore',
      country: 'India',
      jobId: 'job-1',
      requisitionId: '1356',
      sourceUrl: 'https://greytip.greythr.com/hire/jobs/associate-manager-custome-success',
      applyUrl: 'https://greytip.greythr.com/hire/jobs/associate-manager-custome-success',
      jobType: 'Full-time',
      minExperience: 7,
      maxExperience: 10,
      experienceUnits: 'years',
      postedDate: '2026-07-22T07:09:14.699611Z',
      postingDate: '2026-07-22T07:09:14.699611Z',
      jobDescription: 'Own customer onboarding and adoption of greytHR.',
      sourceDescription: 'Own customer onboarding and adoption of greytHR.',
      jobDescriptionHtml: '<p>Own customer onboarding and adoption of greytHR.</p>',
    },
  ])
})

test('GreytHR scraper returns the published jobs from the verified first-party API', async () => {
  const requestedUrls = []
  const jobs = await createGreytHrScraper().run({
    fetchText: async (url) => {
      requestedUrls.push(url)
      if (url === CAREERS_URL) return officialCareersHtml
      throw new Error(`Unexpected URL: ${url}`)
    },
    fetchJson: async (url) => {
      requestedUrls.push(url)
      if (url === JOBS_API_URL) return publishedJobsPayload
      if (url === CATEGORIES_API_URL) return categories
      throw new Error(`Unexpected URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [CAREERS_URL, JOBS_API_URL, CATEGORIES_API_URL])
  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].title, 'Associate Manager-Custome Success')
})

test('GreytHR scraper fails closed when the official careers surface changes', async () => {
  await assert.rejects(
    createGreytHrScraper().run({
      fetchText: async () => '<html><body>Jobs</body></html>',
      fetchJson: async () => publishedJobsPayload,
    }),
    /verified GreytHR careers surface/i,
  )
})
