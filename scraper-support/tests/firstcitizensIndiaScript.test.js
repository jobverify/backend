import assert from 'node:assert/strict'
import test from 'node:test'

const loadFirstCitizensIndiaModule = async () => {
  try {
    return await import('../../scraper/firstcitizensindia/script.js')
  } catch {
    assert.fail('Expected First Citizens India scraper module at ../../scraper/firstcitizensindia/script.js')
  }
}

const payload = {
  jobs: [
    {
      slug: '34630',
      req_id: '34630',
      title: 'Senior Software Engineer',
      full_location: 'Bengaluru, India',
      city: 'Bengaluru',
      state: 'Karnataka',
      country: 'India',
      apply_url: 'https://external-firstcitizens.icims.com/jobs/34630/login',
      description: '<p>Build secure banking APIs.</p>',
      employment_type: 'FULL_TIME',
      tags1: 'Technology',
      posted_date: '2026-07-08T00:00:00+0000',
    },
    {
      slug: '99999',
      req_id: '99999',
      title: 'Ignore US Role',
      full_location: 'Raleigh, United States',
      city: 'Raleigh',
      state: 'North Carolina',
      country: 'United States',
      apply_url: 'https://external-firstcitizens.icims.com/jobs/99999/login',
      description: '<p>Ignore this role.</p>',
      employment_type: 'FULL_TIME',
      tags1: 'Technology',
      posted_date: '2026-07-08T00:00:00+0000',
    },
  ],
  totalCount: 1,
}

test('extractSearchResults keeps only India listings from the First Citizens Jibe API', async () => {
  const firstCitizensIndia = await loadFirstCitizensIndiaModule()
  const jobs = firstCitizensIndia.extractSearchResults(payload)

  assert.equal(firstCitizensIndia.CAREER_PAGE_URL, 'https://jobs.firstcitizens.com/')
  assert.equal(
    firstCitizensIndia.buildJobsApiUrl(1),
    'https://jobs.firstcitizens.com/api/jobs?page=1&country=India',
  )
  assert.equal(jobs.length, 1)
  assert.deepEqual(jobs[0], {
    title: 'Senior Software Engineer',
    company: 'First Citizens India',
    department: 'Technology',
    location: 'Bengaluru, Karnataka, India',
    city: 'Bengaluru',
    country: 'India',
    jobId: '34630',
    requisitionId: '34630',
    sourceUrl: 'https://jobs.firstcitizens.com/jobs/34630?lang=en-us',
    applyUrl: 'https://external-firstcitizens.icims.com/jobs/34630/login',
    employmentType: 'FULL_TIME',
    experienceRequired: null,
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills: [],
    postingDate: '2026-07-08T00:00:00+0000',
    closingDate: null,
    jobDescription: 'Build secure banking APIs.',
    jobType: 'FULL_TIME',
    additionalLocations: null,
  })
})

test('run returns an empty result set when the official India filter currently has no jobs', async () => {
  const firstCitizensIndia = await loadFirstCitizensIndiaModule()
  const requestedUrls = []

  const jobs = await firstCitizensIndia.createFirstCitizensIndiaScraper({
    fetchJson: async (url) => {
      requestedUrls.push(url)
      return { jobs: [], totalCount: 0 }
    },
  }).run()

  assert.deepEqual(requestedUrls, [
    'https://jobs.firstcitizens.com/api/jobs?page=1&country=India',
  ])
  assert.deepEqual(jobs, [])
})
