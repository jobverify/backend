import assert from 'node:assert/strict'
import test from 'node:test'

import { createAshbyApiScraper, extractAshbyJobs } from '../utils/ashbyApi.js'

const FIXED_SCRAPED_AT = '2026-07-28T00:00:00.000Z'

const ashbyPayload = {
  jobs: [
    {
      id: 'india-primary',
      title: 'Senior Software Engineer',
      department: 'Engineering',
      employmentType: 'FullTime',
      location: 'Bengaluru, India',
      secondaryLocations: [],
      publishedAt: '2026-07-28T01:00:00.000Z',
      isListed: true,
      address: {
        postalAddress: {
          addressCountry: 'India',
          addressLocality: 'Bengaluru',
          addressRegion: 'Karnataka',
        },
      },
      jobUrl: 'https://jobs.ashbyhq.com/example/india-primary',
      applyUrl: 'https://jobs.ashbyhq.com/example/india-primary/application',
      descriptionPlain: 'Build product APIs from Bengaluru.',
    },
    {
      id: 'india-secondary',
      title: 'Developer Relations Engineer',
      department: 'Engineering',
      employmentType: 'FullTime',
      location: 'Remote',
      secondaryLocations: [
        {
          location: 'Remote India',
          address: {
            postalAddress: {
              addressCountry: 'India',
              addressLocality: 'Pune',
              addressRegion: 'Maharashtra',
            },
          },
        },
      ],
      publishedAt: '2026-07-28T02:00:00.000Z',
      isListed: true,
      address: {
        postalAddress: {
          addressCountry: 'United States',
        },
      },
      jobUrl: 'https://jobs.ashbyhq.com/example/india-secondary',
      applyUrl: 'https://jobs.ashbyhq.com/example/india-secondary/application',
      descriptionPlain: 'Support developer workflows in India.',
    },
    {
      id: 'non-india',
      title: 'Staff Engineer',
      department: 'Engineering',
      employmentType: 'FullTime',
      location: 'San Francisco, CA',
      secondaryLocations: [],
      publishedAt: '2026-07-28T03:00:00.000Z',
      isListed: true,
      address: {
        postalAddress: {
          addressCountry: 'United States',
          addressLocality: 'San Francisco',
          addressRegion: 'California',
        },
      },
      jobUrl: 'https://jobs.ashbyhq.com/example/non-india',
      applyUrl: 'https://jobs.ashbyhq.com/example/non-india/application',
      descriptionPlain: 'US-only role.',
    },
    {
      id: 'hidden-india',
      title: 'Hidden India Role',
      department: 'Operations',
      employmentType: 'Contract',
      location: 'India',
      secondaryLocations: [],
      publishedAt: '2026-07-28T04:00:00.000Z',
      isListed: false,
      address: {
        postalAddress: {
          addressCountry: 'India',
        },
      },
      jobUrl: 'https://jobs.ashbyhq.com/example/hidden-india',
      applyUrl: 'https://jobs.ashbyhq.com/example/hidden-india/application',
      descriptionPlain: 'This role should be ignored.',
    },
  ],
}

test('extractAshbyJobs keeps only listed India jobs from Ashby payloads', () => {
  assert.deepEqual(
    extractAshbyJobs({
      payload: ashbyPayload,
      companyName: 'Example Co',
    }),
    [
      {
        title: 'Senior Software Engineer',
        company: 'Example Co',
        department: 'Engineering',
        location: 'Bengaluru, India',
        city: 'Bengaluru',
        state: 'Karnataka',
        country: 'India',
        jobId: 'india-primary',
        requisitionId: 'india-primary',
        sourceUrl: 'https://jobs.ashbyhq.com/example/india-primary',
        applyUrl: 'https://jobs.ashbyhq.com/example/india-primary/application',
        employmentType: 'Full Time',
        experienceRequired: null,
        minimumQualification: null,
        preferredQualification: null,
        requiredSkills: [],
        postingDate: '2026-07-28T01:00:00.000Z',
        closingDate: null,
        jobDescription: 'Build product APIs from Bengaluru.',
      },
      {
        title: 'Developer Relations Engineer',
        company: 'Example Co',
        department: 'Engineering',
        location: 'Remote India',
        city: 'Pune',
        state: 'Maharashtra',
        country: 'India',
        jobId: 'india-secondary',
        requisitionId: 'india-secondary',
        sourceUrl: 'https://jobs.ashbyhq.com/example/india-secondary',
        applyUrl: 'https://jobs.ashbyhq.com/example/india-secondary/application',
        employmentType: 'Full Time',
        experienceRequired: null,
        minimumQualification: null,
        preferredQualification: null,
        requiredSkills: [],
        postingDate: '2026-07-28T02:00:00.000Z',
        closingDate: null,
        jobDescription: 'Support developer workflows in India.',
      },
    ],
  )
})

test('createAshbyApiScraper fetches the configured board and decorates India jobs', async () => {
  const requestedUrls = []
  const jobs = await createAshbyApiScraper({
    source: 'exampleco',
    companyName: 'Example Co',
    ashbyJobBoardUrl: 'https://api.ashbyhq.com/posting-api/job-board/exampleco',
    now: () => FIXED_SCRAPED_AT,
  }).run({
    fetchJson: async (url) => {
      requestedUrls.push(url)
      return { ...ashbyPayload, jobs: ashbyPayload.jobs.map(job => ({ ...job,
        jobUrl: job.jobUrl.replace('/example/', '/exampleco/'),
        applyUrl: job.applyUrl.replace('/example/', '/exampleco/'),
      })) }
    },
  })

  assert.deepEqual(requestedUrls, [
    'https://api.ashbyhq.com/posting-api/job-board/exampleco',
  ])
  assert.equal(jobs.length, 2)
  assert.equal(jobs[0].source, 'exampleco')
  assert.equal(jobs[0].link, jobs[0].applyUrl)
  assert.equal(jobs[0].scrapedAt, FIXED_SCRAPED_AT)
})
