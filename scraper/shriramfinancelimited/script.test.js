import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import {
  CAREERS_URL,
  PAGE_SIZE,
  buildCurrentOpeningsApiUrl,
  createShriramFinanceLimitedScraper,
  extractExpectedOpeningCount,
  hasOfficialCareersSignal,
} from './script.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const readFixture = (name) => readFileSync(path.join(currentDir, 'fixtures', name), 'utf8')

const careersHtml = readFixture('careers.html')
const currentOpeningPage0 = JSON.parse(readFixture('current-opening-page-0.json'))
const currentOpeningPage1 = JSON.parse(readFixture('current-opening-page-1.json'))
const CURRENT_OPENINGS_STATE_KEY = '/api/v1/current-opening?page=0&items_per_page=6'

const createMockResponse = ({ status = 200, body = '', jsonBody, setCookies = [] } = {}) => ({
  ok: status >= 200 && status < 300,
  status,
  headers: {
    getSetCookie: () => setCookies,
    get: (name) => (name.toLowerCase() === 'set-cookie' ? setCookies.join(', ') : null),
  },
  text: async () => String(body),
  json: async () => jsonBody,
})

const createCareersHtmlWithCurrentOpeningsState = (records) => {
  const stateMatch = careersHtml.match(
    /<script id="serverApp-state" type="application\/json">([\s\S]*?)<\/script>/i,
  )
  assert.ok(stateMatch, 'Expected careers fixture to contain Angular serverApp-state')

  const state = JSON.parse(stateMatch[1])
  state[CURRENT_OPENINGS_STATE_KEY] = JSON.stringify(records)

  return careersHtml.replace(stateMatch[1], JSON.stringify(state))
}

test('SHRIRAM careers fixture matches the verified first-party careers surface', () => {
  assert.equal(CAREERS_URL, 'https://www.shriramfinance.in/careers')
  assert.equal(PAGE_SIZE, 6)
  assert.equal(hasOfficialCareersSignal(careersHtml), true)
  assert.equal(extractExpectedOpeningCount(careersHtml), 7)
})

test('SHRIRAM scraper uses the server-rendered current-opening state when the public API returns 400', async () => {
  const scraper = createShriramFinanceLimitedScraper({
    now: () => '2026-07-19T00:00:00.000Z',
  })
  const embeddedCareersHtml = createCareersHtmlWithCurrentOpeningsState(currentOpeningPage0)
  const seenRequests = []

  const jobs = await scraper.run({
    fetchImpl: async (url) => {
      seenRequests.push(url)

      if (url === CAREERS_URL) {
        return createMockResponse({
          body: embeddedCareersHtml,
          setCookies: ['dtCookiewq32dowc=session-a; Path=/; Domain=.shriramfinance.in'],
        })
      }

      if (String(url).includes('/api/v1/current-opening')) {
        return createMockResponse({ status: 400 })
      }

      throw new Error(`Unexpected URL: ${url}`)
    },
  })

  assert.deepEqual(
    jobs.map((job) => job.jobId),
    ['107', '106', '103', '102', '104', '105'],
  )
  assert.equal(jobs[0].source, 'shriramfinancelimited')
  assert.equal(jobs[0].companyCareerPage, CAREERS_URL)
  assert.equal(jobs[0].scrapedAt, '2026-07-19T00:00:00.000Z')
  assert.equal(seenRequests.includes(buildCurrentOpeningsApiUrl(0)), false)
})

test('SHRIRAM scraper paginates the session-backed first-party current-opening API', async () => {
  const seenRequests = []
  const scraper = createShriramFinanceLimitedScraper({
    now: () => '2026-07-11T00:00:00.000Z',
  })
  const cookieValues = [
    'dtCookiewq32dowc=session-a; Path=/; Domain=.shriramfinance.in',
    'TS01dc4fc6=session-b; Path=/; Secure; HttpOnly; SameSite=Strict',
    'TS01589857=session-c; Path=/; Domain=.shriramfinance.in; Secure; HttpOnly; SameSite=Strict',
  ]

  const jobs = await scraper.run({
    fetchImpl: async (url, options = {}) => {
      seenRequests.push({ url, options })

      if (url === CAREERS_URL) {
        return createMockResponse({
          body: careersHtml,
          setCookies: cookieValues,
        })
      }

      if (url === buildCurrentOpeningsApiUrl(0)) {
        return createMockResponse({ jsonBody: currentOpeningPage0 })
      }

      if (url === buildCurrentOpeningsApiUrl(1)) {
        return createMockResponse({ jsonBody: currentOpeningPage1 })
      }

      throw new Error(`Unexpected URL: ${url}`)
    },
  })

  assert.equal(jobs.length, 7)
  assert.deepEqual(
    jobs.map((job) => job.jobId),
    ['107', '106', '103', '102', '104', '105', '101'],
  )

  const goldLoanRole = jobs.find((job) => job.jobId === '107')
  assert.equal(goldLoanRole.title, 'Business Executive (Gold Loan)')
  assert.equal(goldLoanRole.location, 'India')
  assert.equal(goldLoanRole.city, null)
  assert.equal(goldLoanRole.experienceRequired, 'Minimum 2 years of experience in Gold Loan.')
  assert.equal(goldLoanRole.minimumQualification, 'Any Graduate/PG')

  const complaintsRole = jobs.find((job) => job.jobId === '103')
  assert.equal(complaintsRole.location, 'Chennai, India')
  assert.equal(complaintsRole.city, 'Chennai')
  assert.equal(complaintsRole.experienceRequired, '3+ years in Customer Complaints Management')
  assert.deepEqual(complaintsRole.requiredSkills, [])
  assert.match(complaintsRole.jobDescription, /Handling Customer Complaints\./)

  const creditManagerRole = jobs.find((job) => job.jobId === '106')
  assert.deepEqual(creditManagerRole.requiredSkills, [
    'Strong understanding of credit risk assessment methodologies and underwriting principles.',
    'Effective communication skills, both verbal and written.',
  ])
  assert.match(creditManagerRole.jobDescription, /Credit underwriting and CAM preparation/)

  const juniorExecutiveRole = jobs.find((job) => job.jobId === '101')
  assert.equal(juniorExecutiveRole.minimumQualification, 'Any Commerce Or Science Graduates/Post Graduates.')
  assert.match(juniorExecutiveRole.jobDescription, /Loan Processing Operation/)

  assert.equal(jobs[0].source, 'shriramfinancelimited')
  assert.equal(jobs[0].companyCareerPage, CAREERS_URL)
  assert.equal(jobs[0].companyDomain, 'shriramfinance.in')
  assert.equal(jobs[0].atsPlatform, 'official-company-careers')
  assert.equal(jobs[0].scrapedAt, '2026-07-11T00:00:00.000Z')
  assert.equal(jobs[0].link, CAREERS_URL)

  assert.equal(seenRequests.length, 3)
  assert.equal(seenRequests[0].url, CAREERS_URL)
  assert.equal(seenRequests[1].url, buildCurrentOpeningsApiUrl(0))
  assert.equal(seenRequests[2].url, buildCurrentOpeningsApiUrl(1))
  assert.equal(
    seenRequests[1].options.headers.Cookie,
    'dtCookiewq32dowc=session-a; TS01dc4fc6=session-b; TS01589857=session-c',
  )
  assert.equal(seenRequests[1].options.headers.Referer, CAREERS_URL)
  assert.equal(seenRequests[1].options.headers.Origin, 'https://www.shriramfinance.in')
  assert.equal(seenRequests[1].options.headers['X-Requested-With'], 'XMLHttpRequest')
})

test('SHRIRAM scraper can paginate the public current-opening API even when the careers shell sets no cookies', async () => {
  const scraper = createShriramFinanceLimitedScraper({
    now: () => '2026-08-01T12:00:00.000Z',
  })

  const jobs = await scraper.run({
    fetchImpl: async (url, options = {}) => {
      if (url === CAREERS_URL) {
        return createMockResponse({
          body: careersHtml,
          setCookies: [],
        })
      }

      if (url === buildCurrentOpeningsApiUrl(0)) {
        return createMockResponse({ jsonBody: currentOpeningPage0 })
      }

      if (url === buildCurrentOpeningsApiUrl(1)) {
        return createMockResponse({ jsonBody: currentOpeningPage1 })
      }

      throw new Error(`Unexpected URL: ${url}`)
    },
  })

  assert.equal(jobs.length, 7)
  assert.equal(jobs[0].scrapedAt, '2026-08-01T12:00:00.000Z')
})

test('SHRIRAM scraper fails closed when the verified careers page changes materially', async () => {
  const scraper = createShriramFinanceLimitedScraper()

  await assert.rejects(
    scraper.run({
      fetchImpl: async () => createMockResponse({ body: '<html><body><h1>Careers</h1></body></html>' }),
    }),
    /verified official public jobs surface changed materially/i,
  )
})
