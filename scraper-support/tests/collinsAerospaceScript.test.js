import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

const loadCollinsAerospaceModule = async () => {
  try {
    return await import('../../scraper/collinsaerospace/script.js')
  } catch {
    assert.fail('Expected Collins Aerospace scraper module at ../../scraper/scraper/collinsaerospace/script.js')
  }
}

const fixturesDir = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  'fixtures',
  'collinsaerospace',
)

const readFixture = (name) => readFileSync(path.join(fixturesDir, name), 'utf8')

test('buildSearchResultsPageUrl keeps Collins Aerospace listings on the official RTX Collins listing route', async () => {
  const { buildSearchResultsPageUrl } = await loadCollinsAerospaceModule()

  assert.equal(
    buildSearchResultsPageUrl(),
    'https://careers.rtx.com/global/en/collins-aerospace-search-results-general',
  )
  assert.equal(
    buildSearchResultsPageUrl(200),
    'https://careers.rtx.com/global/en/collins-aerospace-search-results-general?from=200',
  )
})

test('extractSearchPayload reads Collins Aerospace targetedJobs payloads from the official landing page', async () => {
  const { extractSearchPayload } = await loadCollinsAerospaceModule()
  const payload = extractSearchPayload(readFixture('search-results-page-200-size-100.html'))

  assert.equal(payload.widgetApiEndpoint, 'https://careers.rtx.com/widgets')
  assert.equal(payload.totalHits, 1144)
  assert.equal(payload.hits, 100)
  assert.equal(payload.jobs.length, 100)
})

test('extractSearchResults normalizes Collins Aerospace India listings into the shared scraper fields', async () => {
  const {
    extractSearchPayload,
    extractSearchResults,
  } = await loadCollinsAerospaceModule()
  const jobs = extractSearchResults(
    extractSearchPayload(readFixture('search-results-page-200-size-100.html')),
  )
  const managerScm = jobs.find((job) => job.jobId === '01849281')

  assert.deepEqual({ ...managerScm, requiredSkills: [] }, {
    title: 'Manager - SCM',
    location: 'bengaluru, Karnātaka, India',
    city: 'bengaluru',
    country: 'India',
    jobId: '01849281',
    requisitionId: '01849281',
    department: 'Supply Chain',
    employmentType: 'Full-time',
    sourceEmploymentType: 'Full-time',
    sourceExperienceRequired: null,
    experienceRequired: null,
    jobDescription:
      'Date Posted. 2026-06-24Country. IndiaLocation. IN-KA-BENGALURU-008 ~ Hitech, Defence & Aerospace Park ~ HI TECH DEFENSEPosition Role Type. Hybrid. At RTX, the world\'s largest aerospace and defense com...',
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills: [],
    postingDate: '2026-06-24T00:00:00.000+0000',
    applyUrl: 'https://globalhr.wd5.myworkdayjobs.com/REC_RTX_Ext_Gateway/job/IN-KA-BENGALURU-008--Hitech-Defence--Aerospace-Park--HI-TECH-DEFENSE/Manager---SCM_01849281/apply',
    sourceUrl: 'https://careers.rtx.com/global/en/job/01849281/Manager-SCM',
  })
})

test('extractJobDetail reads Collins Aerospace job detail metadata and the official Workday apply link', async () => {
  const { extractJobDetail } = await loadCollinsAerospaceModule()
  const detail = extractJobDetail(readFixture('job-detail-01849281.html'), {
    title: 'Manager - SCM',
    location: 'bengaluru, Karnātaka, India',
    city: 'bengaluru',
    country: 'India',
    jobId: '01849281',
    requisitionId: '01849281',
    department: 'Supply Chain',
    sourceUrl: 'https://careers.rtx.com/global/en/job/01849281/Manager-SCM',
  })

  assert.equal(detail.title, 'Manager - SCM')
  assert.equal(detail.location, 'bengaluru, Karnātaka, India')
  assert.equal(detail.city, 'bengaluru')
  assert.equal(detail.country, 'India')
  assert.equal(detail.jobId, '01849281')
  assert.equal(detail.requisitionId, '01849281')
  assert.equal(detail.department, 'Supply Chain')
  assert.equal(detail.employmentType, 'Full-time')
  assert.equal(detail.postingDate, '2026-07-01')
  assert.equal(
    detail.applyUrl,
    'https://globalhr.wd5.myworkdayjobs.com/REC_RTX_Ext_Gateway/job/IN-KA-BENGALURU-008--Hitech-Defence--Aerospace-Park--HI-TECH-DEFENSE/Manager---SCM_01849281/apply',
  )
  assert.equal(
    detail.sourceUrl,
    'https://careers.rtx.com/global/en/job/01849281/Manager-SCM',
  )
  assert.match(detail.jobDescription, /as a procurement manager/i)
  assert.equal(detail.experienceRequired, '12+ years')
  assert.match(detail.minimumQualification, /BE\/ Masters Degree/i)
})

test('run preserves the selected Collins listing when optional detail HTML belongs to another role', async () => {
  const {
    buildSearchResultsPageUrl,
    run,
  } = await loadCollinsAerospaceModule()
  const requestedUrls = []

  const jobs = await run({
    initialFrom: 200,
    maxPages: 1,
    maxJobs: 1,
    fetchJson: async (url, options) => {
      requestedUrls.push(url)
      assert.equal(Number(JSON.parse(options.body).from), 200)
      const { extractSearchPayload } = await loadCollinsAerospaceModule()
      const payload = extractSearchPayload(readFixture('search-results-page-200-size-100.html'))
      return { refineSearch: { status: 200, totalHits: payload.totalHits, hits: payload.hits,
        data: { jobs: payload.jobs, aggregations: [] } } }
    },
    fetchText: async (url) => {
      requestedUrls.push(url)
      if (/https:\/\/careers\.rtx\.com\/global\/en\/job\//.test(url)) {
        return readFixture('job-detail-01849281.html')
      }
      throw new Error(`Unexpected Collins Aerospace fixture URL: ${url}`)
    },
  })

  assert.equal(requestedUrls[0], 'https://careers.rtx.com/widgets')
  assert.match(requestedUrls[1], /https:\/\/careers\.rtx\.com\/global\/en\/job\//)
  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].company, 'Collins Aerospace')
  assert.equal(jobs[0].source, 'collinsaerospace')
  assert.equal(jobs[0].jobId, '01853778')
  assert.equal(jobs[0].title, 'Senior Lead Engineer - Systems (Hybrid)')
  assert.equal(jobs[0].sourceListingComplete, false)
  assert.equal(jobs[0].country, 'India')
  assert.equal(jobs[0].location, 'bengaluru, Karnātaka, India')
  assert.equal(
    jobs[0].applyUrl,
    'https://globalhr.wd5.myworkdayjobs.com/REC_RTX_Ext_Gateway/job/IN-KA-BENGALURU-NORTHGATE--Sy-No-22-Venkatala-Village--SY-NO-22-VENKATALA-VILLAGE-Yelahanka-Hobli/Senior-Lead-Engineer---Systems--Hybrid-_01853778/apply',
  )
})
