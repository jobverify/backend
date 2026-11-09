import assert from 'node:assert/strict'
import test from 'node:test'

const homepageHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>NK Securities Research - High Frequency Algorithmic Trading</title>
    <meta
      name="description"
      content="NK Securities Research is a high-frequency algorithmic trading firm founded in 2011. A global leader in speed and accuracy in trading."
    />
  </head>
  <body>
    <span class="label hero-tagline">EST. 2011 · SEBI REG. INZ000206920</span>
    <h1 class="display-lg hero-title">
      <span class="line">Where Technology</span>
      <span class="line italic">Meets Markets</span>
      <span class="line accent-text">Analyze. Execute. Excel.</span>
    </h1>
    <p class="body-text hero-description">
      A high-frequency proprietary trading firm at the intersection of technology, data science, and global financial markets.
      We solve complex market problems in real time with speed, precision, and innovation at scale.
    </p>
    <a href="open-positions.html" class="link-arrow accent">Open positions</a>
    <p>SEBI Regd. No: INZ000206920</p>
  </body>
</html>
`

const openPositionsHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Open Positions - NK Securities Research</title>
    <meta
      name="description"
      content="Explore career opportunities at NK Securities Research. We are hiring quantitative researchers, software engineers, and more."
    />
  </head>
  <body>
    <span class="label fade-up">CURRENT OPENINGS</span>
    <h2 class="display-md fade-up">Find your role</h2>
    <div class="gh-filters fade-up">
      <input type="text" class="gh-filter-input" id="ghSearch" placeholder="Search by role or location">
      <select class="gh-filter-select" id="ghLocation">
        <option value="">All Locations</option>
      </select>
    </div>
    <p class="gh-jobs-count fade-up" id="gh-jobs-count"></p>
    <div id="gh-jobs-board" class="fade-up"></div>
    <script>
      fetch('https://api.greenhouse.io/v1/boards/nksecuritiesresearch/jobs')
      .then(function(r) { return r.json(); });
      var empty = 'No open positions at this time. Check back soon.';
    </script>
  </body>
</html>
`

const currentOpenPositionsHtml = openPositionsHtml
  .replace('Search by role or location', 'Search by role, team or location')
  .replace(
    "fetch('https://api.greenhouse.io/v1/boards/nksecuritiesresearch/jobs')",
    "var BOARD_API = 'https://api.greenhouse.io/v1/boards/nksecuritiesresearch'; getJson(BOARD_API + '/jobs?content=true')",
  )

const greenhousePayload = {
  jobs: [
    {
      absolute_url: 'https://job-boards.eu.greenhouse.io/nksecuritiesresearch/jobs/4914411101',
      internal_job_id: 4494849101,
      location: { name: 'Gurugram, Haryana, India' },
      id: 4914411101,
      updated_at: '2026-07-01T05:15:15-04:00',
      requisition_id: '90',
      title: 'AI/ML Researcher',
      company_name: 'NK Securities Research',
      first_published: '2026-07-01T05:13:42-04:00',
      language: 'en',
      application_deadline: null,
    },
    {
      absolute_url: 'https://job-boards.eu.greenhouse.io/nksecuritiesresearch/jobs/4524655101',
      internal_job_id: 4303638101,
      location: { name: 'Gurugram/Singapore' },
      id: 4524655101,
      updated_at: '2026-07-02T09:04:19-04:00',
      requisition_id: '41',
      title: 'Network Infrastructure Manager',
      company_name: 'NK Securities Research',
      first_published: '2025-01-24T01:53:42-05:00',
      language: 'en',
      application_deadline: null,
    },
    {
      absolute_url: 'https://job-boards.eu.greenhouse.io/nksecuritiesresearch/jobs/9999999001',
      internal_job_id: 4999999001,
      location: { name: 'Singapore' },
      id: 9999999001,
      updated_at: '2026-06-01T09:04:19-04:00',
      requisition_id: '999',
      title: 'Singapore Quant Trader',
      company_name: 'NK Securities Research',
      first_published: '2026-06-01T09:04:19-04:00',
      language: 'en',
      application_deadline: null,
    },
  ],
}

const loadModule = async () => {
  try {
    return await import('../../scraper/nksecurities/script.js')
  } catch {
    assert.fail('Expected NK Securities scraper module at ../../scraper/nksecurities/script.js')
  }
}

test('NK Securities pins the verified first-party homepage, official jobs page, and Greenhouse API contract', async () => {
  const nk = await loadModule()

  assert.equal(nk.SOURCE, 'nksecurities')
  assert.equal(nk.COMPANY, 'NK Securities')
  assert.equal(nk.OFFICIAL_BRAND_NAME, 'NK Securities Research')
  assert.equal(nk.VERIFIED_ON, '2026-07-16')
  assert.equal(nk.HOMEPAGE_URL, 'https://www.nksecurities.com/')
  assert.equal(nk.OPEN_POSITIONS_URL, 'https://www.nksecurities.com/open-positions.html')
  assert.equal(nk.GREENHOUSE_JOBS_API_URL, 'https://api.greenhouse.io/v1/boards/nksecuritiesresearch/jobs')
  assert.equal(nk.GREENHOUSE_JOBS_API_WITH_CONTENT_URL, 'https://api.greenhouse.io/v1/boards/nksecuritiesresearch/jobs?content=true')
  assert.equal(nk.GREENHOUSE_BOARD_URL, 'https://job-boards.eu.greenhouse.io/nksecuritiesresearch')
  assert.equal(nk.hasOfficialHomepageSignal(homepageHtml), true)
  assert.equal(nk.hasOfficialOpenPositionsSignal(openPositionsHtml), true)
  assert.equal(nk.extractGreenhouseApiUrl(openPositionsHtml), nk.GREENHOUSE_JOBS_API_URL)
  assert.equal(nk.hasOfficialOpenPositionsSignal(currentOpenPositionsHtml), true)
  assert.equal(nk.extractGreenhouseApiUrl(currentOpenPositionsHtml), nk.GREENHOUSE_JOBS_API_URL)
})

test('NK Securities extracts India jobs from the verified Greenhouse payload shape', async () => {
  const nk = await loadModule()
  const jobs = nk.extractIndiaJobsFromGreenhousePayload(greenhousePayload)

  assert.deepEqual(jobs, [
    {
      title: 'AI/ML Researcher',
      company: 'NK Securities Research',
      department: null,
      location: 'Gurugram, Haryana, India',
      city: 'Gurugram',
      country: 'India',
      jobId: '4914411101',
      requisitionId: '90',
      sourceUrl: 'https://job-boards.eu.greenhouse.io/nksecuritiesresearch/jobs/4914411101',
      applyUrl: 'https://job-boards.eu.greenhouse.io/nksecuritiesresearch/jobs/4914411101#application',
      employmentType: null,
      experienceRequired: null,
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate: '2026-07-01T09:13:42.000Z',
      closingDate: null,
      jobDescription: null,
    },
    {
      title: 'Network Infrastructure Manager',
      company: 'NK Securities Research',
      department: null,
      location: 'Gurugram/Singapore',
      city: 'Gurugram',
      country: 'India',
      jobId: '4524655101',
      requisitionId: '41',
      sourceUrl: 'https://job-boards.eu.greenhouse.io/nksecuritiesresearch/jobs/4524655101',
      applyUrl: 'https://job-boards.eu.greenhouse.io/nksecuritiesresearch/jobs/4524655101#application',
      employmentType: null,
      experienceRequired: null,
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate: '2025-01-24T06:53:42.000Z',
      closingDate: null,
      jobDescription: null,
    },
  ])
})

test('NK Securities run validates the official jobs page and returns normalized India roles', async () => {
  const nk = await loadModule()
  const requestedPages = []
  const requestedJson = []

  const jobs = await nk.createNkSecuritiesScraper({
    now: () => '2026-07-16T12:00:00.000Z',
  }).run({
    fetchPage: async (url) => {
      requestedPages.push(url)

      if (url === nk.HOMEPAGE_URL) {
        return { status: 200, url, html: homepageHtml }
      }

      if (url === nk.OPEN_POSITIONS_URL) {
        return { status: 200, url, html: openPositionsHtml }
      }

      throw new Error(`Unexpected NK Securities page URL: ${url}`)
    },
    fetchJson: async (url) => {
      requestedJson.push(url)

      if (url === nk.GREENHOUSE_JOBS_API_WITH_CONTENT_URL) {
        return greenhousePayload
      }

      throw new Error(`Unexpected NK Securities json URL: ${url}`)
    },
  })

  assert.deepEqual(requestedPages, [
    nk.HOMEPAGE_URL,
    nk.OPEN_POSITIONS_URL,
  ])
  assert.deepEqual(requestedJson, [nk.GREENHOUSE_JOBS_API_WITH_CONTENT_URL])
  assert.equal(jobs.length, 2)
  assert.equal(jobs[0].source, 'nksecurities')
  assert.equal(jobs[0].company, 'NK Securities Research')
  assert.equal(jobs[0].link, jobs[0].applyUrl)
  assert.equal(jobs[0].scrapedAt, '2026-07-16T12:00:00.000Z')
})

test('NK Securities fails closed when the official jobs surface or Greenhouse contract drifts', async () => {
  const nk = await loadModule()

  await assert.rejects(
    nk.createNkSecuritiesScraper().run({
      fetchPage: async (url) => ({
        status: 200,
        url,
        html: '<html><body><h1>Unexpected</h1></body></html>',
      }),
      fetchJson: async () => greenhousePayload,
    }),
    /homepage/i,
  )

  await assert.rejects(
    nk.createNkSecuritiesScraper().run({
      fetchPage: async (url) => {
        if (url === nk.HOMEPAGE_URL) {
          return { status: 200, url, html: homepageHtml }
        }

        return {
          status: 200,
          url,
          html: openPositionsHtml.replace(nk.GREENHOUSE_JOBS_API_URL, 'https://api.greenhouse.io/v1/boards/other/jobs'),
        }
      },
      fetchJson: async () => greenhousePayload,
    }),
    /greenhouse api/i,
  )
})
