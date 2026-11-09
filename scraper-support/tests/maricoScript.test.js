import assert from 'node:assert/strict'
import test from 'node:test'

const loadMaricoModule = async () => {
  try {
    return await import('../../scraper/marico/script.js')
  } catch {
    assert.fail('Expected Marico scraper module at ../../scraper/marico/script.js')
  }
}

const OFFICIAL_CAREERS_HTML = `
<html>
  <head>
    <title>Marico - make a difference</title>
  </head>
  <body>
    <h1>Work With Us</h1>
    <p>Marico Limited is one of India's leading consumer products companies.</p>
    <a href="https://marico.sensehq.com/careers">APPLY NOW</a>
  </body>
</html>
`

const LISTING_PAGE_1_HTML = String.raw`<!DOCTYPE html><html><body><script id="__NEXT_DATA__" type="application/json">{"props":{"pageProps":{"jobsData":{"rows":[{"id":31806,"created_on":1783036800000,"job_status":"OPEN","department":"Production (IN053)","title":"Senior Officer - Production","location":"Perundurai (IN092)","open_positions":1,"experience_end":5,"experience_start":2,"description_external":"<p><strong>Skills :</strong> Utilities, Boiler Operations</p><p>Handle utility operations across the production shift.</p>","job_type":"FULLTIME","code":"18654","office":{"city":"Perundurai (IN092)","country":"India","location":"Perundurai (IN092)","name":"Perundurai (IN092)"}},{"id":31544,"created_on":1783123200000,"job_status":"CLOSED","department":"Supply Chain (IN046)","title":"Closed Role","location":"Perundurai (IN092)","open_positions":1,"experience_end":5,"experience_start":2,"description_external":"<p>Closed posting.</p>","job_type":"FULLTIME","code":"18638","office":{"city":"Perundurai (IN092)","country":"India","location":"Perundurai (IN092)","name":"Perundurai (IN092)"}}],"count":3}}},"page":"/","query":{},"buildId":"marico-build","isFallback":false,"gssp":true}</script></body></html>`

const LISTING_PAGE_2_HTML = String.raw`<!DOCTYPE html><html><body><script id="__NEXT_DATA__" type="application/json">{"props":{"pageProps":{"jobsData":{"rows":[{"id":30982,"created_on":1783209600000,"job_status":"OPEN","department":"Brand (IN116)","title":"Brand Manager - Personal Care","location":"CORPORATE CENTRE","open_positions":1,"experience_end":6,"experience_start":4,"description_external":"<div><b>Skills :</b> Brand Strategy, Consumer Insights</div><div>Own end-to-end brand growth and profitability.</div>","job_type":"FULLTIME","code":"17604","office":{"city":"CORPORATE CENTRE","country":"India","location":"CORPORATE CENTRE","name":"CORPORATE CENTRE"}}],"count":3}}},"page":"/","query":{"page":"2"},"buildId":"marico-build","isFallback":false,"gssp":true}</script></body></html>`

test('Marico helpers verify the official careers handoff and keep SenseHQ URLs stable', async () => {
  const marico = await loadMaricoModule()

  assert.equal(marico.COMPANY, 'Marico')
  assert.equal(marico.OFFICIAL_BRAND_NAME, 'Marico Limited')
  assert.equal(marico.VERIFIED_ON, '2026-07-16')
  assert.equal(marico.HOMEPAGE_URL, 'https://marico.com/')
  assert.equal(marico.OFFICIAL_CAREERS_URL, 'https://marico.com/india/careers/work-with-us')
  assert.equal(marico.PUBLIC_BOARD_URL, 'https://marico.sensehq.com/careers')
  assert.equal(marico.hasOfficialCareersPageSignal(OFFICIAL_CAREERS_HTML), true)
  assert.equal(marico.extractSenseHqCareersUrl(OFFICIAL_CAREERS_HTML), marico.PUBLIC_BOARD_URL)
  assert.equal(marico.buildListingUrl(), 'https://marico.sensehq.com/careers')
  assert.equal(marico.buildListingUrl({ page: 2 }), 'https://marico.sensehq.com/careers?page=2')
  assert.equal(marico.buildJobUrl(31806), 'https://marico.sensehq.com/careers/jobs/31806')
})

test('extractSearchResults keeps only open India jobs from the Marico public SenseHQ board payload', async () => {
  const marico = await loadMaricoModule()
  const jobs = marico.extractSearchResults(LISTING_PAGE_1_HTML)

  assert.equal(jobs.length, 1)
  assert.deepEqual(jobs[0], {
    title: 'Senior Officer - Production',
    company: 'Marico',
    department: 'Production (IN053)',
    location: 'Perundurai (IN092), India',
    city: 'Perundurai (IN092)',
    jobId: '31806',
    requisitionId: '18654',
    sourceUrl: 'https://marico.sensehq.com/careers/jobs/31806',
    applyUrl: 'https://marico.sensehq.com/careers/jobs/31806',
    employmentType: 'Full-time',
    experienceRequired: '2-5 years',
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills: [
      'Utilities',
      'Boiler Operations',
    ],
    postingDate: '2026-07-03',
    closingDate: null,
    jobDescription: 'Skills : Utilities, Boiler Operations Handle utility operations across the production shift.',
  })

  assert.deepEqual(marico.extractBoardSummary(LISTING_PAGE_1_HTML), {
    currentPage: 1,
    pageSize: 2,
    totalCount: 3,
    totalPages: 2,
    hasNext: true,
  })
})

test('run verifies the official Marico handoff, paginates the public SenseHQ board, and decorates shared runner fields', async () => {
  const marico = await loadMaricoModule()
  const requests = []
  const scraper = marico.createMaricoScraper({ maxPages: 2, maxJobs: 2 })

  const jobs = await scraper.run({
    fetchText: async (url) => {
      requests.push(url)

      if (url === marico.OFFICIAL_CAREERS_URL) return OFFICIAL_CAREERS_HTML
      if (url === marico.buildListingUrl({ page: 1 })) return LISTING_PAGE_1_HTML
      if (url === marico.buildListingUrl({ page: 2 })) return LISTING_PAGE_2_HTML

      throw new Error(`Unexpected Marico URL: ${url}`)
    },
  })

  assert.deepEqual(requests, [
    marico.OFFICIAL_CAREERS_URL,
    marico.buildListingUrl({ page: 1 }),
    marico.buildListingUrl({ page: 2 }),
  ])
  assert.equal(jobs.length, 2)
  assert.equal(jobs[0].source, 'marico')
  assert.equal(jobs[0].company, 'Marico')
  assert.equal(jobs[0].link, jobs[0].applyUrl)
  assert.equal(jobs[1].title, 'Brand Manager - Personal Care')
  assert.deepEqual(jobs[1].requiredSkills, [
    'Brand Strategy',
    'Consumer Insights',
  ])
  assert.ok(jobs.every((job) => typeof job.scrapedAt === 'string' && job.scrapedAt.length > 0))
})

test('run falls back to the verified public board when the official Marico careers page times out from Node', async () => {
  const marico = await loadMaricoModule()
  const requests = []
  const scraper = marico.createMaricoScraper({ maxPages: 1, maxJobs: 1 })

  const jobs = await scraper.run({
    fetchText: async (url) => {
      requests.push(url)

      if (url === marico.OFFICIAL_CAREERS_URL) {
        const error = new TypeError('fetch failed')
        error.cause = { code: 'UND_ERR_CONNECT_TIMEOUT' }
        throw error
      }

      if (url === marico.buildListingUrl({ page: 1 })) return LISTING_PAGE_1_HTML

      throw new Error(`Unexpected Marico URL: ${url}`)
    },
  })

  assert.deepEqual(requests, [
    marico.OFFICIAL_CAREERS_URL,
    marico.buildListingUrl({ page: 1 }),
  ])
  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].jobId, '31806')
})
