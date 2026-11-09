import assert from 'node:assert/strict'
import test from 'node:test'

import {
  ASHBY_BOARD_URL,
  ASHBY_JOB_BOARD_URL,
  CAREER_PAGE_URL,
  createPropelScraper,
  extractAshbyJobs,
} from './script.js'

const ashbyPayload = {
  jobs: [
    {
      id: 'f53d1e36-48aa-4dd9-845b-032b62172244',
      title: '  Staff Software Engineer (Fullstack)  ',
      department: 'Engineering',
      team: 'Engineering',
      employmentType: 'FullTime',
      location: 'USA',
      secondaryLocations: [
        {
          location: 'Brooklyn, NYC',
          address: {
            postalAddress: {
              addressRegion: 'New York',
              addressCountry: 'USA',
              addressLocality: 'Brooklyn',
            },
          },
        },
      ],
      publishedAt: '2024-08-16T21:04:23.259+00:00',
      isListed: true,
      isRemote: true,
      workplaceType: 'Remote',
      address: {
        postalAddress: {
          addressCountry: 'United States',
        },
      },
      jobUrl: 'https://jobs.ashbyhq.com/propel/f53d1e36-48aa-4dd9-845b-032b62172244',
      applyUrl: 'https://jobs.ashbyhq.com/propel/f53d1e36-48aa-4dd9-845b-032b62172244/application',
      descriptionHtml: '<p>Build product experiences for millions of users.</p>',
    },
    {
      id: 'e6a61c7b-87bb-448c-81c7-2db5a2bb1d9f',
      title: 'Senior Full Stack Engineer, Healthcare',
      department: 'Engineering',
      employmentType: 'FullTime',
      location: 'USA',
      publishedAt: '2026-04-01T12:18:52.834+00:00',
      isListed: true,
      workplaceType: 'Remote',
      address: {
        postalAddress: {
          addressCountry: 'United States',
        },
      },
      jobUrl: 'https://jobs.ashbyhq.com/propel/e6a61c7b-87bb-448c-81c7-2db5a2bb1d9f',
      applyUrl: 'https://jobs.ashbyhq.com/propel/e6a61c7b-87bb-448c-81c7-2db5a2bb1d9f/application',
      descriptionHtml: '<p>Ship healthcare product features.</p>',
    },
    {
      id: 'hidden-role',
      title: 'Hidden Role',
      isListed: false,
      jobUrl: 'https://jobs.ashbyhq.com/propel/hidden-role',
      applyUrl: 'https://jobs.ashbyhq.com/propel/hidden-role/application',
    },
    {
      id: null,
      title: 'Missing identifiers',
      isListed: true,
      jobUrl: 'https://jobs.ashbyhq.com/propel/missing-identifiers',
      applyUrl: 'https://jobs.ashbyhq.com/propel/missing-identifiers/application',
    },
  ],
}

test('extractAshbyJobs returns listed Propel jobs with normalized Ashby fields', () => {
  assert.equal(CAREER_PAGE_URL, 'https://www.propel.app/careers/')
  assert.equal(ASHBY_BOARD_URL, 'https://jobs.ashbyhq.com/propel')
  assert.equal(ASHBY_JOB_BOARD_URL, 'https://api.ashbyhq.com/posting-api/job-board/propel')

  const jobs = extractAshbyJobs(ashbyPayload)

  assert.equal(jobs.length, 2)
  assert.deepEqual(jobs[0], {
    title: 'Staff Software Engineer (Fullstack)',
    company: 'Propel',
    department: 'Engineering',
    team: 'Engineering',
    location: 'USA',
    city: 'Brooklyn',
    state: 'New York',
    country: 'United States',
    jobId: 'f53d1e36-48aa-4dd9-845b-032b62172244',
    requisitionId: 'f53d1e36-48aa-4dd9-845b-032b62172244',
    sourceUrl: 'https://jobs.ashbyhq.com/propel/f53d1e36-48aa-4dd9-845b-032b62172244',
    applyUrl: 'https://jobs.ashbyhq.com/propel/f53d1e36-48aa-4dd9-845b-032b62172244/application',
    employmentType: 'Full Time',
    workplaceType: 'Remote',
    experienceRequired: null,
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills: [],
    postingDate: '2024-08-16T21:04:23.259+00:00',
    closingDate: null,
    jobDescription: '<p>Build product experiences for millions of users.</p>',
  })
  assert.equal(jobs[1].title, 'Senior Full Stack Engineer, Healthcare')
  assert.equal(jobs[1].city, null)
  assert.equal(jobs[1].state, null)
  assert.equal(jobs[1].country, 'United States')
})

test('run checks the official Propel handoff, selects India jobs and adds scraper metadata', async () => {
  const requests = []
  const scraper = createPropelScraper()

  const jobs = await scraper.run({
    fetchPage: async url => ({ status: 200, url,
      html: '<title>Careers</title><a href="https://jobs.ashbyhq.com/propel">Open roles</a>',
    }),
    fetchJson: async (url) => {
      requests.push(url)
      return { apiVersion: '1', jobs: [
        { ...ashbyPayload.jobs[0], location: 'Bengaluru, India', secondaryLocations: [],
          address: { addressCountry: 'India' } },
        ashbyPayload.jobs[1],
      ] }
    },
  })

  assert.deepEqual(requests, [ASHBY_JOB_BOARD_URL])
  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].source, 'propel')
  assert.equal(jobs[0].link, jobs[0].applyUrl)
  assert.match(jobs[0].scrapedAt, /\d{4}-\d{2}-\d{2}T/)
})
