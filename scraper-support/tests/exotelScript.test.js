import assert from 'node:assert/strict'
import test from 'node:test'

const loadExotelModule = async () => {
  try {
    return await import('../../scraper/exotel/script.js')
  } catch {
    assert.fail('Expected Exotel scraper module at ../../scraper/exotel/script.js')
  }
}

const payload = [
  {
    id: 701455,
    title: 'Business Operations - Intern',
    position_type: 'Full-time',
    location: {
      city: 'Bengaluru',
      state: 'Karnataka',
      country: 'India',
    },
    company_name: 'Exotel Techcom Pvt Ltd',
    job_code: 'exotel73617',
    team: 'OPERATIONS',
    description: '<h1>About us</h1><p>Exotel builds customer communication software.</p>',
  },
  {
    id: 701172,
    title: 'Senior Manager - TAM',
    position_type: 'Full-time',
    location: {
      city: 'Bengaluru/Gurugram',
      state: null,
      country: null,
    },
    company_name: 'Exotel Techcom Pvt Ltd',
    job_code: 'exotel202967',
    team: 'Customer Operations',
    description: '<h2>Location: Bangalore / Gurugram</h2><p>Lead strategic customer programs.</p>',
  },
  {
    id: 700001,
    title: 'Dubai Role',
    position_type: 'Full-time',
    location: {
      city: 'Dubai',
      state: null,
      country: 'United Arab Emirates',
    },
    company_name: 'Exotel Techcom Pvt Ltd',
    job_code: 'exotel00001',
    team: 'Other',
    description: '<p>Ignore this non-India role.</p>',
  },
]

test('extractSearchResults keeps India and India-like Exotel openings from Recruiterbox JSON', async () => {
  const exotel = await loadExotelModule()
  const jobs = exotel.extractSearchResults(payload)

  assert.equal(exotel.CAREER_PAGE_URL, 'https://exotel.com/about-us/careers/')
  assert.equal(exotel.OPENINGS_API_URL, 'https://app.recruiterbox.com/widget/2176/openings/')
  assert.equal(jobs.length, 2)
  assert.deepEqual(jobs[0], {
    title: 'Business Operations - Intern',
    company: 'Exotel Techcom Pvt Ltd',
    department: 'OPERATIONS',
    location: 'Bengaluru, Karnataka, India',
    city: 'Bengaluru',
    country: 'India',
    jobId: '701455',
    requisitionId: 'exotel73617',
    sourceUrl: 'https://app.recruiterbox.com/widget/2176/opening/701455/',
    applyUrl: 'https://app.recruiterbox.com/widget/2176/opening/701455/',
    employmentType: 'Full-time',
    experienceRequired: null,
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills: [],
    postingDate: null,
    closingDate: null,
    jobDescription: 'About us Exotel builds customer communication software.',
    jobType: 'Full-time',
    additionalLocations: null,
  })
  assert.equal(jobs[1].city, 'Bengaluru/Gurugram')
})

test('run fetches the public Exotel Recruiterbox feed and decorates matched jobs', async () => {
  const exotel = await loadExotelModule()
  const requestedUrls = []

  const jobs = await exotel.createExotelScraper({
    maxJobs: 1,
    fetchJson: async (url) => {
      requestedUrls.push(url)
      if (url === exotel.OPENINGS_API_URL) return payload
      throw new Error(`Unexpected URL: ${url}`)
    },
  }).run()

  assert.deepEqual(requestedUrls, [exotel.OPENINGS_API_URL])
  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].source, 'exotel')
  assert.equal(jobs[0].link, jobs[0].applyUrl)
  assert.equal(typeof jobs[0].scrapedAt, 'string')
})
