import assert from 'node:assert/strict'
import test from 'node:test'

const loadAvalaraModule = async () => {
  try {
    return await import('../../scraper/avalara/script.js')
  } catch {
    assert.fail('Expected Avalara scraper module at ../../scraper/avalara/script.js')
  }
}

const payload = {
  jobs: [
    {
      data: {
        slug: '16709',
        req_id: '16709',
        title: 'Software Engineer II',
        city: 'Pune',
        state: 'Maharashtra',
        country: 'India',
        apply_url: 'https://careersind-avalara.icims.com/jobs/16709/login',
        description: '<p>Build tax compliance systems.</p>',
        employment_type: 'FULL_TIME',
        categories: [{ name: 'Engineering' }],
        posted_date: '2026-07-14T00:00:00+0000',
      },
    },
    {
      data: {
        slug: '99999',
        req_id: '99999',
        title: 'US Engineer',
        city: 'Seattle',
        state: 'Washington',
        country: 'United States',
        apply_url: 'https://careers-avalara.icims.com/jobs/99999/login',
        description: '<p>Ignore non-India roles.</p>',
        employment_type: 'FULL_TIME',
        categories: [{ name: 'Engineering' }],
        posted_date: '2026-07-14T00:00:00+0000',
      },
    },
  ],
  totalCount: 2,
}

test('extractSearchResults keeps only India listings from the Avalara official Jibe API', async () => {
  const avalara = await loadAvalaraModule()
  const jobs = avalara.extractSearchResults(payload)

  assert.equal(avalara.CAREER_PAGE_URL, 'https://careers.avalara.com/jobs')
  assert.equal(
    avalara.buildJobsApiUrl(1),
    'https://careers.avalara.com/api/jobs?page=1&country=India&internal=false&separator=%7C&facetField=country%7Cstate%7Ccity%7Clocation_type',
  )
  assert.deepEqual(jobs, [
    {
      title: 'Software Engineer II',
      company: 'Avalara',
      department: 'Engineering',
      location: 'Pune, Maharashtra, India',
      city: 'Pune',
      country: 'India',
      jobId: '16709',
      requisitionId: '16709',
      sourceUrl: 'https://careers.avalara.com/jobs/16709?lang=en-us',
      applyUrl: 'https://careersind-avalara.icims.com/jobs/16709/login',
      employmentType: 'FULL_TIME',
      experienceRequired: null,
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate: '2026-07-14T00:00:00+0000',
      closingDate: null,
      jobDescription: 'Build tax compliance systems.',
      jobType: 'FULL_TIME',
      additionalLocations: null,
    },
  ])
})

test('run returns an empty result set when the official Avalara India filter currently has no jobs', async () => {
  const avalara = await loadAvalaraModule()
  const requestedUrls = []

  const jobs = await avalara.createAvalaraScraper({
    fetchJson: async (url) => {
      requestedUrls.push(url)
      return { jobs: [], totalCount: 0 }
    },
  }).run()

  assert.deepEqual(requestedUrls, [
    'https://careers.avalara.com/api/jobs?page=1&country=India&internal=false&separator=%7C&facetField=country%7Cstate%7Ccity%7Clocation_type',
  ])
  assert.deepEqual(jobs, [])
})
