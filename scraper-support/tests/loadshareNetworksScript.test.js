import assert from 'node:assert/strict'
import test from 'node:test'

const OFFICIAL_CAREERS_HTML = `
<!doctype html>
<html lang="en">
  <head>
    <title>Careers | LoadShare Networks</title>
    <meta name="description" content="Jobs at Loadshare Networks">
    <base href="/loadshare/">
  </head>
  <body>
    <app-root></app-root>
    <script>
      $("#current_openings").click(function() {});
    </script>
  </body>
</html>
`

const LISTING_PAGE_1_HTML = String.raw`<!DOCTYPE html><html><body><script id="__NEXT_DATA__" type="application/json">{"props":{"pageProps":{"jobsData":{"rows":[{"id":54441,"created_on":1783036800000,"job_status":"OPEN","department":"Finance","title":"Business Finance Manager","location":"Bangalore","experience_end":8,"experience_start":5,"description_external":"<p><strong>Skills :</strong> Finance Planning, Business Partnering</p><p>Own finance planning and stakeholder alignment.</p>","job_type":"FULLTIME","code":"FIN00841","office":{"city":"Bangalore","country":"India","location":"Bangalore","name":"HQ - Bangalore"}},{"id":54439,"created_on":1783123200000,"job_status":"OPEN","department":"Tech","title":"Senior Data Scientist","location":"Bangalore","experience_end":9,"experience_start":4,"description_external":"<div><b>Skills :</b> Python, Machine Learning, Optimization</div><div>Build allocation and demand models.</div>","job_type":"FULLTIME","code":"TEC00857","office":{"city":"Bangalore","country":"India","location":"Bangalore","name":"HQ - Bangalore"}}],"count":3}}},"page":"/","query":{},"buildId":"loadshare-build","isFallback":false,"gssp":true}</script></body></html>`

const LISTING_PAGE_2_HTML = String.raw`<!DOCTYPE html><html><body><script id="__NEXT_DATA__" type="application/json">{"props":{"pageProps":{"jobsData":{"rows":[{"id":54378,"created_on":1783209600000,"job_status":"OPEN","department":"Tech","title":"SDE3-Backend","location":"Chennai","experience_end":4,"experience_start":2,"description_external":"<div><b>Skills :</b> Node.js, Distributed Systems</div><div>Build backend systems for logistics operations.</div>","job_type":"FULLTIME","code":"TEC00796","office":{"city":"Chennai","country":"India","location":"Chennai","name":"RO - Chennai - Tech"}}],"count":3}}},"page":"/","query":{"page":"2"},"buildId":"loadshare-build","isFallback":false,"gssp":true}</script></body></html>`

const loadModule = async () => {
  try {
    return await import('../../scraper/loadsharenetworks/script.js')
  } catch {
    assert.fail('Expected Loadshare Networks scraper module at ../../scraper/loadsharenetworks/script.js')
  }
}

test('Loadshare Networks helpers keep the verified official careers page and public SenseHQ URLs stable', async () => {
  const loadshare = await loadModule()

  assert.equal(loadshare.COMPANY, 'Loadshare Networks')
  assert.equal(loadshare.OFFICIAL_BRAND_NAME, 'LoadShare Networks Pvt. Ltd.')
  assert.equal(loadshare.VERIFIED_ON, '2026-07-16')
  assert.equal(loadshare.HOMEPAGE_URL, 'https://loadshare.net/')
  assert.equal(loadshare.ROOT_CAREERS_URL, 'https://careers.loadshare.net/')
  assert.equal(loadshare.OFFICIAL_CAREERS_URL, 'https://careers.loadshare.net/loadshare/')
  assert.equal(loadshare.PUBLIC_BOARD_URL, 'https://loadshare.sensehq.com/careers')
  assert.equal(loadshare.SAMPLE_JOB_URL, 'https://loadshare.sensehq.com/careers/jobs/54441')
  assert.equal(loadshare.hasOfficialCareersPageSignal(OFFICIAL_CAREERS_HTML), true)
  assert.equal(loadshare.buildListingUrl(), 'https://loadshare.sensehq.com/careers')
  assert.equal(loadshare.buildListingUrl({ page: 2 }), 'https://loadshare.sensehq.com/careers?page=2')
  assert.equal(loadshare.buildJobUrl(54441), 'https://loadshare.sensehq.com/careers/jobs/54441')
})

test('extractSearchResults keeps only open India jobs from the Loadshare public SenseHQ board payload', async () => {
  const loadshare = await loadModule()
  const jobs = loadshare.extractSearchResults(LISTING_PAGE_1_HTML)

  assert.equal(jobs.length, 2)
  assert.deepEqual(jobs[0], {
    title: 'Business Finance Manager',
    company: 'Loadshare Networks',
    department: 'Finance',
    location: 'Bangalore, India',
    city: 'Bangalore',
    jobId: '54441',
    requisitionId: 'FIN00841',
    sourceUrl: 'https://loadshare.sensehq.com/careers/jobs/54441',
    applyUrl: 'https://loadshare.sensehq.com/careers/jobs/54441',
    employmentType: 'Full-time',
    experienceRequired: '5-8 years',
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills: [
      'Finance Planning',
      'Business Partnering',
    ],
    postingDate: '2026-07-03',
    closingDate: null,
    jobDescription: 'Skills : Finance Planning, Business Partnering Own finance planning and stakeholder alignment.',
  })

  assert.deepEqual(loadshare.extractBoardSummary(LISTING_PAGE_1_HTML), {
    currentPage: 1,
    pageSize: 2,
    totalCount: 3,
    totalPages: 2,
    hasNext: true,
  })
})

test('run verifies the official careers page, paginates the Loadshare board, and decorates shared runner fields', async () => {
  const loadshare = await loadModule()
  const requests = []
  const scraper = loadshare.createLoadshareNetworksScraper({ maxPages: 2, maxJobs: 3 })

  const jobs = await scraper.run({
    fetchText: async (url) => {
      requests.push(url)

      if (url === loadshare.OFFICIAL_CAREERS_URL) return OFFICIAL_CAREERS_HTML
      if (url === loadshare.buildListingUrl({ page: 1 })) return LISTING_PAGE_1_HTML
      if (url === loadshare.buildListingUrl({ page: 2 })) return LISTING_PAGE_2_HTML

      throw new Error(`Unexpected Loadshare Networks URL: ${url}`)
    },
  })

  assert.deepEqual(requests, [
    loadshare.OFFICIAL_CAREERS_URL,
    loadshare.buildListingUrl({ page: 1 }),
    loadshare.buildListingUrl({ page: 2 }),
  ])
  assert.equal(jobs.length, 3)
  assert.equal(jobs[0].source, 'loadsharenetworks')
  assert.equal(jobs[0].company, 'Loadshare Networks')
  assert.equal(jobs[0].link, jobs[0].applyUrl)
  assert.equal(jobs[2].title, 'SDE3-Backend')
  assert.deepEqual(jobs[2].requiredSkills, [
    'Node.js',
    'Distributed Systems',
  ])
  assert.ok(jobs.every((job) => typeof job.scrapedAt === 'string' && job.scrapedAt.length > 0))
})

test('run falls back to the verified public board when the official Loadshare careers page times out from Node', async () => {
  const loadshare = await loadModule()
  const requests = []
  const scraper = loadshare.createLoadshareNetworksScraper({ maxPages: 1, maxJobs: 2 })

  const jobs = await scraper.run({
    fetchText: async (url) => {
      requests.push(url)

      if (url === loadshare.OFFICIAL_CAREERS_URL) {
        const error = new TypeError('fetch failed')
        error.cause = { code: 'UND_ERR_CONNECT_TIMEOUT' }
        throw error
      }

      if (url === loadshare.buildListingUrl({ page: 1 })) return LISTING_PAGE_1_HTML

      throw new Error(`Unexpected Loadshare Networks URL: ${url}`)
    },
  })

  assert.deepEqual(requests, [
    loadshare.OFFICIAL_CAREERS_URL,
    loadshare.buildListingUrl({ page: 1 }),
  ])
  assert.equal(jobs.length, 2)
  assert.equal(jobs[0].jobId, '54441')
})
