import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

const loadLttsModule = async () => {
  try {
    return await import('../../scraper/ltts/script.js')
  } catch {
    assert.fail('Expected LTTS scraper module at ../../scraper/scraper/ltts/script.js')
  }
}

const fixturesDir = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  'fixtures',
  'ltts',
)

const readFixture = (name) => readFileSync(path.join(fixturesDir, name), 'utf8')

test('LTTS URL builders stay on the public SenseHQ iframe routes', async () => {
  const {
    API_BASE_URL,
    CAREER_PAGE_URL,
    buildJobUrl,
    buildListingUrl,
  } = await loadLttsModule()

  assert.equal(API_BASE_URL, 'https://ltts.sensehq.com/careers/iframe')
  assert.equal(CAREER_PAGE_URL, 'https://www.ltts.com/careers/India')
  assert.equal(
    buildListingUrl(),
    'https://ltts.sensehq.com/careers/iframe/jobs?page=1&isIframe=true',
  )
  assert.equal(
    buildListingUrl({ page: 3 }),
    'https://ltts.sensehq.com/careers/iframe/jobs?page=3&isIframe=true',
  )
  assert.equal(
    buildJobUrl(35653),
    'https://ltts.sensehq.com/careers/iframe/jobs/35653?isIframe=true',
  )
})

test('extractSearchResults keeps only LTTS India jobs from the SenseHQ listings pages', async () => {
  const { extractPaginationSummary, extractSearchResults } = await loadLttsModule()
  const html = readFixture('listing-page-1.html')
  const jobs = extractSearchResults(html)

  assert.equal(jobs.length, 1)
  assert.deepEqual(jobs[0], {
    title: 'BIW Designer',
    company: 'LTTS',
    department: 'LTTS India',
    location: 'Bangalore, India',
    city: 'Bangalore',
    jobId: '35653',
    requisitionId: '528760',
    sourceUrl: 'https://ltts.sensehq.com/careers/iframe/jobs/35653?isIframe=true',
    applyUrl: 'https://ltts.sensehq.com/careers/iframe/jobs/35653?isIframe=true',
    employmentType: 'Full-time',
    experienceRequired: '4-7 Years',
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills: [
      'BIW Design',
      'Automotive BIW',
      'UG NX',
    ],
    postingDate: '2026-06-10',
    closingDate: null,
    jobDescription: 'BIW Designer JD (Location: Bangalore): Experience: 4-7 Years in BIW Key Skills: BIW Design, Automotive BIW, UG NX Responsibilities: Design and development of BIW panels.',
  })

  assert.deepEqual(extractPaginationSummary(html), {
    currentPage: 1,
    pageSize: 2,
    totalCount: 4,
    totalPages: 2,
    hasNext: true,
  })
})

test('run paginates LTTS listing pages, filters India jobs, and decorates shared runner fields', async () => {
  const {
    buildListingUrl,
    createLttsScraper,
  } = await loadLttsModule()
  const page1 = readFixture('listing-page-1.html')
  const page2 = readFixture('listing-page-2.html')
  const requests = []
  const scraper = createLttsScraper({ maxPages: 2, maxJobs: 2 })

  const jobs = await scraper.run({
    fetchText: async (url) => {
      requests.push(url)

      if (url === buildListingUrl({ page: 1 })) return page1
      if (url === buildListingUrl({ page: 2 })) return page2

      throw new Error(`Unexpected LTTS URL: ${url}`)
    },
  })

  assert.deepEqual(requests, [
    buildListingUrl({ page: 1 }),
    buildListingUrl({ page: 2 }),
  ])
  assert.equal(jobs.length, 2)
  assert.equal(jobs[0].source, 'ltts')
  assert.equal(jobs[0].company, 'LTTS')
  assert.equal(jobs[0].link, jobs[0].applyUrl)
  assert.equal(jobs[1].title, 'Validation Engineer')
  assert.equal(jobs[1].location, 'Pune, India')
  assert.deepEqual(jobs[1].requiredSkills, [
    'Python',
    'CANoe',
    'Automotive Testing',
  ])
  assert.ok(jobs.every((job) => typeof job.scrapedAt === 'string' && job.scrapedAt.length > 0))
})
