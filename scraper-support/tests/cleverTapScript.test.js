import assert from 'node:assert/strict'
import test from 'node:test'

import {
  CAREER_PAGE_URL,
  KULA_JOBS_URL,
  buildSearchUrl,
  createCleverTapScraper,
  extractSearchResults,
} from '../../scraper/clevertap/script.js'

const buildSerializedKulaHtml = (jobs) => {
  const escapedJobs = JSON.stringify(jobs).replace(/"/g, '\\"')
  return `before {\\"jobs\\":${escapedJobs},\\"departments\\":[{\\"id\\":1,\\"name\\":\\"Engineering\\"}]} after`
}

test('extractSearchResults parses CleverTap jobs from the public Kula payload and keeps only India roles', () => {
  const html = buildSerializedKulaHtml([
    {
      id: 12616,
      title: 'DevOps Engineer',
      listed: true,
      kind: 'internal_and_external',
      ats_job: {
        job_description: '$18',
        workplace: 'office',
        employment_type: 'full_time',
        ats_department: {
          name: 'Engineering',
        },
        offices: [
          {
            location: 'Mumbai, Maharashtra, India',
            city: 'Mumbai',
            country: 'India',
            remote: false,
          },
        ],
      },
    },
    {
      id: 25518,
      title: 'Manager Sales Enablement',
      listed: true,
      kind: 'internal_and_external',
      ats_job: {
        job_description: '$1a',
        workplace: 'office',
        employment_type: 'full_time',
        ats_department: {
          name: 'Sales Enablement',
        },
        offices: [
          {
            location: 'Bengaluru, Karnataka, India',
            city: 'Bengaluru',
            country: 'India',
            remote: false,
          },
          {
            location: 'Gurgaon, Haryana, India',
            city: 'Gurgaon',
            country: 'India',
            remote: false,
          },
        ],
      },
    },
    {
      id: 25519,
      title: 'Senior Data Analyst',
      listed: true,
      kind: 'internal_and_external',
      ats_job: {
        workplace: 'remote',
        employment_type: 'contract',
        ats_department: {
          name: 'Data',
        },
        offices: [
          {
            location: 'Remote',
            city: null,
            country: 'India',
            remote: true,
          },
          {
            location: 'Bengaluru, Karnataka, India',
            city: 'Bengaluru',
            country: 'India',
            remote: false,
          },
        ],
      },
    },
    {
      id: 27358,
      title: 'Onboarding Manager (Vietnam)',
      listed: true,
      kind: 'internal_and_external',
      ats_job: {
        workplace: 'remote',
        employment_type: 'full_time',
        ats_department: {
          name: 'Customer Solutions',
        },
        offices: [
          {
            location: 'Ho Chi Minh City, Ho Chi Minh City, Vietnam',
            city: 'Ho Chi Minh City',
            country: 'Vietnam',
            remote: true,
          },
        ],
      },
    },
    {
      id: 99999,
      title: '',
      listed: true,
      kind: 'internal_and_external',
      ats_job: {
        workplace: 'office',
        employment_type: 'full_time',
        ats_department: {
          name: 'Operations',
        },
        offices: [
          {
            location: 'Mumbai, Maharashtra, India',
            city: 'Mumbai',
            country: 'India',
            remote: false,
          },
        ],
      },
    },
  ])

  const jobs = extractSearchResults(html)

  assert.equal(jobs.length, 3)
  assert.deepEqual(jobs[0], {
    title: 'DevOps Engineer',
    company: 'CleverTap',
    department: 'Engineering',
    location: 'Mumbai, Maharashtra, India',
    city: 'Mumbai',
    country: 'India',
    jobId: '12616',
    requisitionId: '12616',
    sourceUrl: 'https://careers.kula.ai/clevertap/12616/?jobs=true',
    applyUrl: 'https://careers.kula.ai/clevertap/12616/?jobs=true',
    employmentType: 'Full-time',
    experienceRequired: null,
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills: [],
    postingDate: null,
    closingDate: null,
    jobDescription: null,
  })
  assert.deepEqual(jobs[1], {
    title: 'Manager Sales Enablement',
    company: 'CleverTap',
    department: 'Sales Enablement',
    location: 'Bengaluru, Karnataka, India; Gurgaon, Haryana, India',
    city: 'Bengaluru',
    country: 'India',
    jobId: '25518',
    requisitionId: '25518',
    sourceUrl: 'https://careers.kula.ai/clevertap/25518/?jobs=true',
    applyUrl: 'https://careers.kula.ai/clevertap/25518/?jobs=true',
    employmentType: 'Full-time',
    experienceRequired: null,
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills: [],
    postingDate: null,
    closingDate: null,
    jobDescription: null,
  })
  assert.deepEqual(jobs[2], {
    title: 'Senior Data Analyst',
    company: 'CleverTap',
    department: 'Data',
    location: 'Remote; Bengaluru, Karnataka, India',
    city: 'Remote',
    country: 'India',
    jobId: '25519',
    requisitionId: '25519',
    sourceUrl: 'https://careers.kula.ai/clevertap/25519/?jobs=true',
    applyUrl: 'https://careers.kula.ai/clevertap/25519/?jobs=true',
    employmentType: 'Contract',
    experienceRequired: null,
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills: [],
    postingDate: null,
    closingDate: null,
    jobDescription: null,
  })
})

test('run fetches CleverTap jobs from the public Kula page and decorates the results', async () => {
  const requestedUrls = []
  const scraper = createCleverTapScraper()

  const jobs = await scraper.run({
    fetchText: async (url) => {
      requestedUrls.push(url)
      return buildSerializedKulaHtml([
        {
          id: 12616,
          title: 'DevOps Engineer',
          listed: true,
          kind: 'internal_and_external',
          ats_job: {
            workplace: 'office',
            employment_type: 'full_time',
            ats_department: {
              name: 'Engineering',
            },
            offices: [
              {
                location: 'Mumbai, Maharashtra, India',
                city: 'Mumbai',
                country: 'India',
                remote: false,
              },
            ],
          },
        },
      ])
    },
  })

  assert.equal(buildSearchUrl(), KULA_JOBS_URL)
  assert.deepEqual(requestedUrls, [KULA_JOBS_URL])
  assert.equal(CAREER_PAGE_URL, 'https://clevertap.com/current-openings/')
  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].source, 'clevertap')
  assert.equal(jobs[0].link, 'https://careers.kula.ai/clevertap/12616/?jobs=true')
  assert.equal(jobs[0].scrapedAt, jobs[0].scrapedAt)
})
