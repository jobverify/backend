import assert from 'node:assert/strict'
import test from 'node:test'

import {
  ASHBY_JOB_BOARD_URL,
  CAREER_PAGE_URL,
  createNivodaScraper,
  extractAshbyJobs,
} from '../../scraper/nivoda/script.js'

const indiaJob = {
  id: 'india-job-uuid',
  title: 'Senior Software Engineer',
  isListed: true,
  location: 'Mumbai',
  address: {
    postalAddress: {
      addressLocality: 'Mumbai',
      addressRegion: 'Maharashtra',
      addressCountry: 'India',
    },
  },
  department: 'Engineering',
  employmentType: 'FullTime',
  publishedAt: '2026-07-01T00:00:00.000Z',
  descriptionHtml: '<p>Build products for the diamond industry.</p>',
}

const nonIndiaJob = {
  id: 'uk-job-uuid',
  title: 'Product Manager',
  isListed: true,
  location: 'London, United Kingdom',
  address: {
    postalAddress: {
      addressLocality: 'London',
      addressCountry: 'United Kingdom',
    },
  },
}

test('extractAshbyJobs keeps structured India locations and excludes non-India jobs', () => {
  const jobs = extractAshbyJobs({ jobs: [indiaJob, nonIndiaJob] })

  assert.equal(jobs.length, 1)
  assert.deepEqual(jobs[0], {
    title: 'Senior Software Engineer',
    company: 'Nivoda',
    department: 'Engineering',
    location: 'Mumbai, Maharashtra, India',
    city: 'Mumbai',
    state: 'Maharashtra',
    country: 'India',
    jobId: 'india-job-uuid',
    requisitionId: 'india-job-uuid',
    sourceUrl: 'https://jobs.ashbyhq.com/nivoda/india-job-uuid',
    applyUrl: 'https://jobs.ashbyhq.com/nivoda/india-job-uuid/application',
    employmentType: 'Full Time',
    experienceRequired: null,
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills: [],
    postingDate: '2026-07-01T00:00:00.000Z',
    closingDate: null,
    jobDescription: '<p>Build products for the diamond industry.</p>',
  })
})

test('run pins the verified Ashby feed and returns runner metadata', async () => {
  const requestedUrls = []
  const scraper = createNivodaScraper()

  const jobs = await scraper.run({
    fetchJson: async (url) => {
      requestedUrls.push(url)
      return { jobs: [indiaJob] }
    },
  })

  assert.equal(CAREER_PAGE_URL, 'https://nivoda.com/careers')
  assert.equal(ASHBY_JOB_BOARD_URL, 'https://api.ashbyhq.com/posting-api/job-board/nivoda')
  assert.deepEqual(requestedUrls, [ASHBY_JOB_BOARD_URL])
  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].source, 'nivoda')
  assert.equal(jobs[0].link, 'https://jobs.ashbyhq.com/nivoda/india-job-uuid/application')
  assert.match(jobs[0].scrapedAt, /^\d{4}-\d{2}-\d{2}T/)
})
