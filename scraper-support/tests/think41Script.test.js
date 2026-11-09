import assert from 'node:assert/strict'
import test from 'node:test'

const loadThink41Module = async () => {
  try {
    return await import('../../scraper/think41/script.js')
  } catch {
    return null
  }
}

const officialJobsPayload = [
  {
    title: 'Technical Product Analyst',
    yoe: '1 - 3 Years',
    link: 'https://www.hirist.tech/j/think41-technical-product-analyst-1559720',
    job_location: 'Bangalore',
    job_type: 'Full-Time',
    id: 1,
  },
  {
    title: 'Engineering Manager',
    yoe: '7 - 11 Years',
    link: 'https://www.hirist.tech/j/think41-engineering-manager-1566136?ref=red_old',
    job_location: 'Bangalore',
    job_type: 'Full-Time',
    id: 3,
  },
  {
    title: 'Staff Platform Engineer',
    yoe: '8 - 10 Years',
    link: 'https://www.hirist.tech/j/think41-staff-platform-engineer-1569999',
    job_location: 'Austin',
    job_type: 'Full-Time',
    id: 99,
  },
]

test('Think41 constants stay pinned to the verified official careers page and same-origin public jobs feed', async () => {
  const think41 = await loadThink41Module()
  assert.ok(think41, 'Expected Think41 scraper module at ../../scraper/think41/script.js')

  assert.equal(think41.SOURCE, 'think41')
  assert.equal(think41.COMPANY, 'Think41')
  assert.equal(think41.CAREERS_PAGE_URL, 'https://www.think41.com/careers2')
  assert.equal(think41.JOBS_API_URL, 'https://www.think41.com/jobs')
})

test('extractIndiaJobs keeps only India listings from Think41\'s official jobs feed and decorates apply links', async () => {
  const think41 = await loadThink41Module()
  assert.ok(think41, 'Expected Think41 scraper module at ../../scraper/think41/script.js')

  assert.deepEqual(think41.extractIndiaJobs(officialJobsPayload), [
    {
      title: 'Technical Product Analyst',
      company: 'Think41',
      department: null,
      location: 'Bangalore, India',
      city: 'Bangalore',
      state: null,
      country: 'India',
      jobId: '1',
      requisitionId: '1',
      sourceUrl: 'https://www.think41.com/careers2',
      applyUrl: 'https://www.hirist.tech/j/think41-technical-product-analyst-1559720',
      employmentType: 'Full-Time',
      experienceRequired: '1 - 3 Years',
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate: null,
      closingDate: null,
      jobDescription: null,
    },
    {
      title: 'Engineering Manager',
      company: 'Think41',
      department: null,
      location: 'Bangalore, India',
      city: 'Bangalore',
      state: null,
      country: 'India',
      jobId: '3',
      requisitionId: '3',
      sourceUrl: 'https://www.think41.com/careers2',
      applyUrl: 'https://www.hirist.tech/j/think41-engineering-manager-1566136?ref=red_old',
      employmentType: 'Full-Time',
      experienceRequired: '7 - 11 Years',
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate: null,
      closingDate: null,
      jobDescription: null,
    },
  ])
})

test('run fetches Think41\'s official public jobs endpoint and decorates the resulting India jobs', async () => {
  const think41 = await loadThink41Module()
  assert.ok(think41, 'Expected Think41 scraper module at ../../scraper/think41/script.js')

  const requestedUrls = []
  const jobs = await think41.createThink41Scraper({ maxJobs: 1 }).run({
    fetchJson: async (url) => {
      requestedUrls.push(url)
      return officialJobsPayload
    },
    now: () => '2026-07-10T00:00:00.000Z',
  })

  assert.deepEqual(requestedUrls, ['https://www.think41.com/jobs'])
  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].source, 'think41')
  assert.equal(jobs[0].link, 'https://www.hirist.tech/j/think41-technical-product-analyst-1559720')
  assert.equal(jobs[0].scrapedAt, '2026-07-10T00:00:00.000Z')
})

test('run fails closed when the Think41 official jobs feed changes shape', async () => {
  const think41 = await loadThink41Module()
  assert.ok(think41, 'Expected Think41 scraper module at ../../scraper/think41/script.js')

  await assert.rejects(
    think41.createThink41Scraper().run({
      fetchJson: async () => ({ jobs: [] }),
    }),
    /official Think41 jobs feed/i,
  )
})
