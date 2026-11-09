import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

const loadCapgeminiModule = async () => {
  try {
    return await import('../../scraper/capgemini/script.js')
  } catch {
    assert.fail('Expected Capgemini scraper module at ../../scraper/scraper/capgemini/script.js')
  }
}

const fixturesDir = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  'fixtures',
  'capgemini',
)

const readJsonFixture = (name) => JSON.parse(readFileSync(path.join(fixturesDir, name), 'utf8'))

test('Capgemini URL builders stay on the first-party careers API and filter India by country code', async () => {
  const {
    buildFiltersUrl,
    buildSearchUrl,
    CAREER_PAGE_URL,
    INDIA_COUNTRY_CODE,
  } = await loadCapgeminiModule()

  assert.equal(CAREER_PAGE_URL, 'https://www.capgemini.com/careers/join-capgemini/job-search/')
  assert.equal(INDIA_COUNTRY_CODE, 'en-in')
  assert.equal(
    buildFiltersUrl(),
    'https://cg-jobstream-api.azurewebsites.net/api/job-filters/',
  )
  assert.equal(
    buildSearchUrl(),
    'https://cg-jobstream-api.azurewebsites.net/api/job-search?page=1&size=10&country_code=en-in',
  )
  assert.equal(
    buildSearchUrl({ page: 2, size: 25 }),
    'https://cg-jobstream-api.azurewebsites.net/api/job-search?page=2&size=25&country_code=en-in',
  )
})

test('extractSearchResults maps Capgemini India API records into shared scraper fields', async () => {
  const {
    extractPaginationSummary,
    extractSearchResults,
  } = await loadCapgeminiModule()
  const payload = readJsonFixture('search-page-1.json')
  const jobs = extractSearchResults(payload)
  const summary = extractPaginationSummary(payload, { page: 1, size: 10 })

  assert.equal(jobs.length, 10)
  assert.deepEqual(summary, {
    page: 1,
    pageSize: 10,
    totalRecords: 829,
    totalPages: 83,
    hasNext: true,
  })

  assert.deepEqual(jobs[1], {
    title: 'SAP DRC E-Invoicing Functional Consultant/Senior Consultant',
    company: 'Capgemini',
    department: 'Software Engineering',
    location: 'Bangalore, Pune, Gandhinagar, Mumbai (ex Bombay), India',
    city: 'Bangalore',
    jobId: '382966-en_GB_SAPBTP',
    requisitionId: '382966-en_GB',
    sourceUrl: 'https://careers.capgemini.com/job/Bangalore-SAP-DRC-E-Invoicing-Functional-ConsultantSenior-Consultant/1388807233/?feedId=388633&utm_source=CareerSite&tcsource=apply',
    applyUrl: 'https://careers.capgemini.com/job/Bangalore-SAP-DRC-E-Invoicing-Functional-ConsultantSenior-Consultant/1388807233/?feedId=388633&utm_source=CareerSite&tcsource=apply',
    employmentType: 'Full-time',
    experienceRequired: 'Experienced Professionals',
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills: [],
    postingDate: '2026-06-26T16:31:06.000Z',
    closingDate: null,
    jobDescription: jobs[1].jobDescription,
    publicExperienceChecked: true,
  })
  assert.match(jobs[1].jobDescription, /Choosing Capgemini means choosing a company/i)
  assert.match(jobs[1].jobDescription, /Your Role/i)
  assert.doesNotMatch(jobs[1].jobDescription, /<p>|<div>|<li>|<h2>/i)
})

test('run paginates Capgemini India API pages and decorates shared runner fields', async () => {
  const {
    buildSearchUrl,
    createCapgeminiScraper,
  } = await loadCapgeminiModule()
  const page1Payload = readJsonFixture('search-page-1.json')
  const page2Payload = readJsonFixture('search-page-2.json')
  const requests = []
  const scraper = createCapgeminiScraper({ maxPages: 2, size: 10 })

  const jobs = await scraper.run({
    fetchJson: async (url) => {
      requests.push(url)

      if (url === buildSearchUrl({ page: 1, size: 10 })) return page1Payload
      if (url === buildSearchUrl({ page: 2, size: 10 })) return page2Payload
      throw new Error(`Unexpected Capgemini URL: ${url}`)
    },
  })

  assert.deepEqual(requests, [
    buildSearchUrl({ page: 1, size: 10 }),
    buildSearchUrl({ page: 2, size: 10 }),
  ])
  assert.equal(jobs.length, 20)
  assert.equal(jobs[0].source, 'capgemini')
  assert.equal(jobs[0].company, 'Capgemini')
  assert.equal(jobs[0].publicExperienceChecked, true)
  assert.ok(jobs.every((job) => job.link === job.applyUrl))
  assert.ok(jobs.every((job) => typeof job.scrapedAt === 'string' && job.scrapedAt.length > 0))
  assert.ok(jobs.some((job) => job.jobId === '382960-en_GB_SAPBTP'))
  assert.ok(jobs.some((job) => job.jobId === '503318-en_GB_SAPBTP'))
})
