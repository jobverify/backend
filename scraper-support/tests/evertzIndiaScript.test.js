import assert from 'node:assert/strict'
import test from 'node:test'

const loadEvertzIndiaModule = async () => {
  try {
    return await import('../../scraper/evertzindia/script.js')
  } catch {
    assert.fail('Expected Evertz India scraper module at ../../scraper/evertzindia/script.js')
  }
}

const payload = [
  {
    id: 'job_1',
    title: 'Senior Data Science Engineer, India',
    country_id: 'India',
    city: 'Bangalore',
    state: 'Karnataka',
    department: 'India Office',
    description: 'We are seeking a <strong>great</strong> engineer.<br>Office Location: Manyata Tech Park, Bangalore, India',
    type: 'Full Time',
    board_code: 'tpnZ5ww78H',
  },
  {
    id: 'job_2',
    title: 'Field Service Engineer India - Media, Broadcast',
    country_id: 'India',
    city: 'Bangalore',
    state: 'Karnataka',
    department: 'Technical Support',
    description: 'Support customers across the India broadcast market.',
    type: 'Full Time',
    board_code: 'MCnO1W4fov',
  },
  {
    id: 'job_us',
    title: 'Ignore US Role',
    country_id: 'United States',
    city: 'Burbank',
    state: 'California',
    department: 'Technical Support',
    description: 'Ignore this role.',
    type: 'Full Time',
    board_code: 'ignore-me',
  },
]

test('extractSearchResults keeps only India roles and derives public detail/apply URLs', async () => {
  const evertzIndia = await loadEvertzIndiaModule()
  const jobs = evertzIndia.extractSearchResults(payload)

  assert.equal(evertzIndia.CAREER_PAGE_URL, 'https://evertz.com/contact/careers/')
  assert.equal(evertzIndia.CAREERS_FEED_URL, 'https://evertz.com/includes/json/careers.json')
  assert.equal(jobs.length, 2)
  assert.deepEqual(jobs[0], {
    title: 'Senior Data Science Engineer, India',
    company: 'Evertz India',
    department: 'India Office',
    location: 'Bangalore, Karnataka, India',
    city: 'Bangalore',
    country: 'India',
    jobId: 'job_1',
    requisitionId: 'job_1',
    sourceUrl: 'https://evertz.com/contact/careers/job_1',
    applyUrl: 'https://evertz.applytojob.com/apply/tpnZ5ww78H',
    employmentType: 'Full Time',
    experienceRequired: null,
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills: [],
    postingDate: null,
    closingDate: null,
    jobDescription: 'We are seeking a great engineer. Office Location: Manyata Tech Park, Bangalore, India',
    jobType: 'Full Time',
    additionalLocations: null,
  })
})

test('run fetches the official Evertz feed and decorates matched India jobs', async () => {
  const evertzIndia = await loadEvertzIndiaModule()
  const requestedUrls = []

  const jobs = await evertzIndia.createEvertzIndiaScraper({
    maxJobs: 1,
    fetchJson: async (url) => {
      requestedUrls.push(url)
      if (url === evertzIndia.CAREERS_FEED_URL) return payload
      throw new Error(`Unexpected URL: ${url}`)
    },
  }).run()

  assert.deepEqual(requestedUrls, [evertzIndia.CAREERS_FEED_URL])
  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].source, 'evertzindia')
  assert.equal(jobs[0].link, jobs[0].applyUrl)
  assert.equal(typeof jobs[0].scrapedAt, 'string')
})
