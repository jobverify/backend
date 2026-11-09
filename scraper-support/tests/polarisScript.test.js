import assert from 'node:assert/strict'
import test from 'node:test'
import { assertMappedInventoryEvidence } from './helpers/assertMappedInventoryEvidence.js'

const FIXED_SCRAPED_AT = '2026-07-17T00:00:00.000Z'

const OFFICIAL_CAREERS_HTML = `
<!doctype html>
<html lang="en-US">
  <head>
    <title>Polaris Careers - Powersports Jobs & Internships</title>
  </head>
  <body>
    <h1>Find your Next Job at Polaris</h1>
    <a href="/en-us/careers/job-categories/all/">Job Categories</a>
    <a href="/en-us/locations/">Locations</a>
    <a href="/en-us/careers/job-categories/all/">Search Jobs Now</a>
  </body>
</html>
`

const CLOUDFLARE_BLOCK_HTML = `
<!doctype html>
<html lang="en-US">
  <head>
    <title>Attention Required! | Cloudflare</title>
  </head>
  <body>
    <h1>Sorry, you have been blocked</h1>
    <h2>You are unable to access polaris.com</h2>
    <p>Cloudflare Ray ID: abc123</p>
  </body>
</html>
`

const WORKDAY_BOARD_HTML = `
<!doctype html>
<html lang="en-US">
  <head>
    <link rel="canonical" href="https://polaris.wd5.myworkdayjobs.com/PolarisJobs" />
    <meta property="og:title" content="Polaris Jobs">
    <meta
      property="og:description"
      content="At Polaris, the need for diverse perspectives and experiences enables our vision of Best People, Best Team. Learn more at http://www.polaris.com/careers"
    >
  </head>
  <body>
    <div id="root"></div>
    <script>
      window.workday = {
        tenant: "polaris",
        siteId: "PolarisJobs"
      }
    </script>
  </body>
</html>
`

const loadPolarisModule = async () => {
  try {
    return await import('../../scraper/polaris.workday/script.js')
  } catch {
    assert.fail('Expected Polaris scraper module at ../../scraper/polaris.workday/script.js')
  }
}

test('Polaris timestamp mapping retains native Workday inventory authority', async t => {
  const polaris = await loadPolarisModule()
  await assertMappedInventoryEvidence(t, jobs => polaris.createPolarisScraper().run({
    workdayRunner: async () => jobs,
    fetchText: async url => {
      if (url === polaris.CAREERS_URL) return OFFICIAL_CAREERS_HTML
      if (url === polaris.WORKDAY_BOARD_URL) return WORKDAY_BOARD_HTML
      throw new Error(`Unexpected inventory fixture URL: ${url}`)
    },
  }), { surface: polaris.WORKDAY_BOARD_URL,
    job: { title: 'Engineer', jobId: 'R28999', country: 'India' } })
})

test('Polaris helpers pin the accepted first-party shell and public Workday board contract', async () => {
  const polaris = await loadPolarisModule()

  assert.equal(polaris.SOURCE, 'polaris')
  assert.equal(polaris.COMPANY_NAME, 'Polaris')
  assert.equal(polaris.CAREERS_URL, 'https://www.polaris.com/en-us/careers/')
  assert.equal(
    polaris.JOB_CATEGORIES_URL,
    'https://www.polaris.com/en-us/careers/job-categories/all/',
  )
  assert.equal(polaris.WORKDAY_BOARD_URL, 'https://polaris.wd5.myworkdayjobs.com/PolarisJobs')
  assert.equal(polaris.INDIA_LOCATION_COUNTRY, 'c4f78be1a8f14da0ab49ce1162348a5e')
  assert.equal(polaris.VERIFIED_ON, '2026-07-17')
  assert.equal(polaris.hasOfficialCareersSignal(OFFICIAL_CAREERS_HTML), true)
  assert.equal(polaris.hasCloudflareBlockSignal(CLOUDFLARE_BLOCK_HTML), true)
  assert.equal(polaris.hasAcceptedCareersShellSignal(OFFICIAL_CAREERS_HTML), true)
  assert.equal(polaris.hasAcceptedCareersShellSignal(CLOUDFLARE_BLOCK_HTML), false)
  assert.equal(polaris.hasOfficialWorkdayBoardSignal(WORKDAY_BOARD_HTML), true)
  assert.deepEqual(polaris.buildScraperOptions(), {
    company: 'Polaris',
    baseUrl: 'https://polaris.wd5.myworkdayjobs.com/PolarisJobs',
    locationCountry: 'c4f78be1a8f14da0ab49ce1162348a5e',
    source: 'polaris',
    scraperDir: polaris.SCRAPER_DIR,
  })
})

test('Polaris validates the accepted careers shell and then delegates to the shared Workday runner', async () => {
  const polaris = await loadPolarisModule()
  const requests = []
  const sampleJobs = [
    {
      title: 'Senior Software Engineer',
      company: 'Polaris',
      location: 'Bangalore, India',
      source: 'polaris',
      link:
        'https://polaris.wd5.myworkdayjobs.com/en-US/PolarisJobs/job/Bangalore-India/Senior-Software-Engineer_R28999/apply',
      scrapedAt: FIXED_SCRAPED_AT,
    },
  ]

  const jobs = await polaris.createPolarisScraper({
    now: () => FIXED_SCRAPED_AT,
  }).run({
    fetchText: async (url) => {
      requests.push(url)
      if (url === polaris.CAREERS_URL) return OFFICIAL_CAREERS_HTML
      if (url === polaris.WORKDAY_BOARD_URL) return WORKDAY_BOARD_HTML
      throw new Error(`Unexpected Polaris URL: ${url}`)
    },
    workdayRunner: async (options) => {
      assert.deepEqual(options, polaris.buildScraperOptions())
      return sampleJobs
    },
  })

  assert.deepEqual(requests, [
    polaris.CAREERS_URL,
    polaris.WORKDAY_BOARD_URL,
  ])
  assert.deepEqual(jobs, sampleJobs)
})

test('Polaris also accepts an unblocked first-party careers shell when it is directly fetchable', async () => {
  const polaris = await loadPolarisModule()
  const authoritativeEmpty = Symbol.for('jobverify.workday.authoritative-empty')
  const confirmedEmpty = []
  Object.defineProperty(confirmedEmpty, authoritativeEmpty, { value: true })

  const jobs = await polaris.createPolarisScraper().run({
    fetchText: async (url) => {
      if (url === polaris.CAREERS_URL) return OFFICIAL_CAREERS_HTML
      if (url === polaris.WORKDAY_BOARD_URL) return WORKDAY_BOARD_HTML
      throw new Error(`Unexpected Polaris URL: ${url}`)
    },
    workdayRunner: async () => confirmedEmpty,
  })

  assert.deepEqual(jobs, [])
  assert.equal(jobs[authoritativeEmpty], true)
})

test('Polaris stops when the first-party403 happens before challenge HTML is returned', async () => {
  const polaris = await loadPolarisModule()
  const requests = [], reason = new Error(`HTTP 403 for ${polaris.CAREERS_URL}`)
  await assert.rejects(polaris.createPolarisScraper().run({
    fetchText: async (url) => {
      requests.push(url)
      if (url === polaris.CAREERS_URL) {
        throw reason
      }
      if (url === polaris.WORKDAY_BOARD_URL) return WORKDAY_BOARD_HTML
      throw new Error(`Unexpected Polaris URL: ${url}`)
    },
    workdayRunner: async () => [],
  }), error => error === reason)
  assert.deepEqual(requests, [polaris.CAREERS_URL])
})

test('Polaris fails closed when the first-party shell or public Workday board changes materially', async () => {
  const polaris = await loadPolarisModule()

  await assert.rejects(
    polaris.createPolarisScraper().run({
      fetchText: async (url) => {
        if (url === polaris.CAREERS_URL) return '<html><body>Unexpected Polaris page</body></html>'
        if (url === polaris.WORKDAY_BOARD_URL) return WORKDAY_BOARD_HTML
        throw new Error(`Unexpected Polaris URL: ${url}`)
      },
      workdayRunner: async () => [],
    }),
    /careers shell/i,
  )

  await assert.rejects(
    polaris.createPolarisScraper().run({
      fetchText: async (url) => {
        if (url === polaris.CAREERS_URL) return OFFICIAL_CAREERS_HTML
        if (url === polaris.WORKDAY_BOARD_URL) {
          return WORKDAY_BOARD_HTML.replace('Polaris Jobs', 'Unexpected Jobs')
        }
        throw new Error(`Unexpected Polaris URL: ${url}`)
      },
      workdayRunner: async () => [],
    }),
    /workday board/i,
  )
})
