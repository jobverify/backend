import assert from 'node:assert/strict'
import test from 'node:test'

const FIXED_SCRAPED_AT = '2026-07-25T00:00:00.000Z'

const loadZerodhaModule = async () => import('../../scraper/zerodha/script.js')

test('Zerodha reads the official zero-posting API response and returns no jobs', async () => {
  const zerodha = await loadZerodhaModule()
  const requestedUrls = []

  const jobs = await zerodha.createZerodhaScraper({
    now: () => FIXED_SCRAPED_AT,
  }).run({
    fetchJson: async (url) => {
      requestedUrls.push(url)
      return { count: 0, data: [], success: true }
    },
  })

  assert.equal(zerodha.SOURCE, 'zerodha')
  assert.equal(zerodha.COMPANY_NAME, 'Zerodha')
  assert.equal(zerodha.CAREERS_PAGE_URL, 'https://careers.zerodha.com/')
  assert.equal(zerodha.JOBS_API_URL, 'https://careers.zerodha.com/api/jobs')
  assert.deepEqual(requestedUrls, [zerodha.JOBS_API_URL])
  assert.deepEqual(jobs, [])
})

test('Zerodha normalizes a first-party public job from the official API shape', async () => {
  const zerodha = await loadZerodhaModule()

  const jobs = await zerodha.createZerodhaScraper({
    now: () => FIXED_SCRAPED_AT,
  }).run({
    fetchJson: async () => ({
      count: 1,
      success: true,
      data: [{
        name: 'backend-engineer',
        job_title: 'Backend Engineer',
        location: 'Bengaluru',
        department: 'Engineering',
        description: '<p>Build reliable trading systems.</p>',
      }],
    }),
  })

  assert.deepEqual(jobs[0], {
    title: 'Backend Engineer',
    company: 'Zerodha',
    department: 'Engineering',
    location: 'Bengaluru',
    city: 'Bengaluru',
    country: 'India',
    jobId: 'backend-engineer',
    requisitionId: 'backend-engineer',
    sourceUrl: 'https://careers.zerodha.com/#backend-engineer',
    applyUrl: 'https://careers.zerodha.com/#backend-engineer',
    employmentType: null,
    experienceRequired: null,
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills: [],
    postingDate: null,
    closingDate: null,
    jobDescription: 'Build reliable trading systems.',
    remoteStatus: null,
    source: 'zerodha',
    link: 'https://careers.zerodha.com/#backend-engineer',
    scrapedAt: FIXED_SCRAPED_AT,
  })
})

test('Zerodha fails closed when the official API envelope changes', async () => {
  const zerodha = await loadZerodhaModule()

  await assert.rejects(
    zerodha.createZerodhaScraper().run({
      fetchJson: async () => ({ success: false, data: [] }),
    }),
    /verified zerodha jobs API/i,
  )
})
