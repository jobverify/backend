import assert from 'node:assert/strict'
import test from 'node:test'

import {
  CAREER_PAGE_URL,
  KULA_JOBS_URL,
  buildSearchUrl,
  createAckoScraper,
  extractSearchResults,
} from '../../scraper/acko/script.js'

const buildEscapedKulaHtml = (jobs) => {
  const escapedJobs = JSON.stringify(jobs).replace(/"/g, '\\"')
  return `before \\"jobs\\":${escapedJobs},\\"departments\\":[] after`
}

test('extractSearchResults parses ACKO jobs embedded in the public Kula HTML payload', () => {
  const html = buildEscapedKulaHtml([
    {
      id: 29653,
      title: 'Director of Product Design',
      listed: true,
      kind: 'internal_and_external',
      ats_job: {
        workplace: 'office',
        employment_type: 'full_time',
        ats_department: {
          name: 'Design',
        },
        offices: [
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
      id: 40001,
      title: 'Senior Engineering Manager',
      listed: true,
      kind: 'external',
      ats_job: {
        workplace: 'remote',
        employment_type: 'full_time',
        ats_department: {
          name: 'Engineering',
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
      id: 40002,
      title: '',
      listed: true,
      kind: 'external',
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

  assert.equal(jobs.length, 2)
  assert.deepEqual(jobs[0], {
    title: 'Director of Product Design',
    company: 'ACKO',
    department: 'Design',
    location: 'Bengaluru, Karnataka, India',
    city: 'Bengaluru',
    country: 'India',
    jobId: '29653',
    requisitionId: '29653',
    sourceUrl: 'https://careers.kula.ai/acko/29653/?jobs=true',
    applyUrl: 'https://careers.kula.ai/acko/29653/?jobs=true',
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
    title: 'Senior Engineering Manager',
    company: 'ACKO',
    department: 'Engineering',
    location: 'Remote; Bengaluru, Karnataka, India',
    city: 'Remote',
    country: 'India',
    jobId: '40001',
    requisitionId: '40001',
    sourceUrl: 'https://careers.kula.ai/acko/40001/?jobs=true',
    applyUrl: 'https://careers.kula.ai/acko/40001/?jobs=true',
    employmentType: 'Full-time',
    experienceRequired: null,
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills: [],
    postingDate: null,
    closingDate: null,
    jobDescription: null,
  })
})

test('run fetches the public Kula jobs payload for ACKO and decorates the results', async () => {
  const requestedUrls = []
  const scraper = createAckoScraper()

  const jobs = await scraper.run({
    fetchText: async (url) => {
      requestedUrls.push(url)
      return buildEscapedKulaHtml([
        {
          id: 29653,
          title: 'Director of Product Design',
          listed: true,
          kind: 'internal_and_external',
          ats_job: {
            workplace: 'office',
            employment_type: 'full_time',
            ats_department: {
              name: 'Design',
            },
            offices: [
              {
                location: 'Bengaluru, Karnataka, India',
                city: 'Bengaluru',
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
  assert.equal(CAREER_PAGE_URL, 'https://www.acko.com/careers/jobs/')
  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].source, 'acko')
  assert.equal(jobs[0].link, 'https://careers.kula.ai/acko/29653/?jobs=true')
  assert.equal(jobs[0].scrapedAt, jobs[0].scrapedAt)
})
