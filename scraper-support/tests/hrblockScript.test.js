import assert from 'node:assert/strict'
import test from 'node:test'

const loadHrblockModule = async () => {
  try {
    return await import('../../scraper/hrblock/script.js')
  } catch {
    assert.fail('Expected H&R Block scraper module at ../../scraper/hrblock/script.js')
  }
}

const payload = {
  jobs: [
    {
      data: {
        slug: '41449',
        req_id: '41449',
        title: 'Sr Software Engineer',
        city: 'Thiruvananthapuram',
        state: 'Kerala',
        country: 'India',
        apply_url: 'https://indiacareers-hrblock.icims.com/jobs/41449/login',
        description: '<p>Build resilient ServiceNow integrations.</p>',
        employment_type: 'FULL_TIME',
        categories: [{ name: 'Information Technology' }],
        tags1: ['Regular'],
        posted_date: '2026-03-04T14:55:00+0000',
      },
    },
    {
      data: {
        slug: '45941',
        req_id: '45941',
        title: 'Operations Technical Specialist - Seasonal',
        city: 'BREMERTON',
        state: 'Washington',
        country: 'United States',
        apply_url: 'https://careers-hrblock.icims.com/jobs/45941/login',
        description: '<p>Ignore non-India roles.</p>',
        employment_type: 'FULL_TIME',
        categories: [{ name: 'Retail Tax Leadership & Operations' }],
        tags1: ['Seasonal - Corporate'],
        posted_date: '2026-07-09T21:18:00+0000',
      },
    },
  ],
  totalCount: 2,
}

test('extractSearchResults keeps only India listings from the H&R Block official Jibe API', async () => {
  const hrblock = await loadHrblockModule()
  const jobs = hrblock.extractSearchResults(payload)

  assert.equal(hrblock.CAREER_PAGE_URL, 'https://careers.hrblock.com/jobs')
  assert.equal(
    hrblock.buildJobsApiUrl(1),
    'https://careers.hrblock.com/api/jobs?page=1&country=India&internal=false&separator=%7C&facetField=country%7Cstate%7Ccity%7Clocation_type',
  )
  assert.equal(jobs.length, 1)
  assert.deepEqual(jobs[0], {
    title: 'Sr Software Engineer',
    company: 'H&R Block',
    department: 'Information Technology',
    location: 'Thiruvananthapuram, Kerala, India',
    city: 'Thiruvananthapuram',
    country: 'India',
    jobId: '41449',
    requisitionId: '41449',
    sourceUrl: 'https://careers.hrblock.com/jobs/41449?lang=en-us',
    applyUrl: 'https://indiacareers-hrblock.icims.com/jobs/41449/login',
    employmentType: 'FULL_TIME',
    experienceRequired: null,
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills: [],
    postingDate: '2026-03-04T14:55:00+0000',
    closingDate: null,
    jobDescription: 'Build resilient ServiceNow integrations.',
    jobType: 'FULL_TIME',
    additionalLocations: null,
  })
})

test('run returns an empty result set when the official India filter currently has no jobs', async () => {
  const hrblock = await loadHrblockModule()
  const requestedUrls = []

  const jobs = await hrblock.createHrblockScraper({
    fetchJson: async (url) => {
      requestedUrls.push(url)
      return { jobs: [], totalCount: 0 }
    },
  }).run()

  assert.deepEqual(requestedUrls, [
    'https://careers.hrblock.com/api/jobs?page=1&country=India&internal=false&separator=%7C&facetField=country%7Cstate%7Ccity%7Clocation_type',
  ])
  assert.deepEqual(jobs, [])
})
