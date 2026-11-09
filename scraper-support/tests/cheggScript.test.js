import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'
import test from 'node:test'

const loadCheggModule = async () => {
  try {
    return await import('../../scraper/chegg.workday/script.js')
  } catch {
    assert.fail('Expected Chegg scraper module at ../../scraper/scraper/chegg.workday/script.js')
  }
}

const careersHtml = `
  <html>
    <head><title>Jobs - Chegg</title></head>
    <body>
      <h1>Jobs at Chegg</h1>
      <a href="https://osv-chegg.wd5.myworkdayjobs.com/Chegg" rel="noopener noreferrer" target="_blank" aria-label="View jobs (Opens in a new tab)">View jobs</a>
    </body>
  </html>
`

const workdayBoardHtml = `
  <html lang="en-US"><head>
    <link rel="canonical" href="https://osv-chegg.wd5.myworkdayjobs.com/Chegg" />
    <meta property="og:description" content="What is Chegg? An always on digital learning platform." />
    <script>
      window.workday = { tenant: "osv_chegg", siteId: "Chegg", isExternal: true, appName: "cxs" };
    </script>
  </head><body><div id="root"></div></body></html>
`

test('Chegg exposes the expected Workday options and validates the official careers handoff', async () => {
  const chegg = await loadCheggModule()

  assert.equal(chegg.SOURCE, 'chegg')
  assert.equal(chegg.COMPANY_NAME, 'Chegg')
  assert.equal(chegg.CAREERS_PAGE_URL, 'https://osv-chegg.wd5.myworkdayjobs.com/Chegg')
  assert.equal(chegg.WORKDAY_BASE_URL, 'https://osv-chegg.wd5.myworkdayjobs.com/Chegg')
  assert.equal(chegg.INDIA_LOCATION_COUNTRY, 'c4f78be1a8f14da0ab49ce1162348a5e')
  assert.equal(chegg.hasOfficialCareersSignal(careersHtml), true)
  assert.equal(
    chegg.extractVerifiedWorkdayHandoffUrl(careersHtml),
    'https://osv-chegg.wd5.myworkdayjobs.com/Chegg',
  )
  assert.deepEqual(chegg.buildScraperOptions(), {
    company: 'Chegg',
    baseUrl: 'https://osv-chegg.wd5.myworkdayjobs.com/Chegg',
    locationCountry: 'c4f78be1a8f14da0ab49ce1162348a5e',
    source: 'chegg',
    scraperDir: chegg.SCRAPER_DIR,
  })
})

test('Chegg fetches its public careers handoff with a neutral source identifier', async () => {
  const chegg = await loadCheggModule()

  const html = await chegg.fetchOfficialCareersPage({
    fetchImpl: async (_url, options) => {
      const userAgent = options.headers['User-Agent']
      if (/Mozilla|Chrome|Safari/i.test(userAgent)) {
        return {
          ok: false,
          status: 403,
          text: async () => '<title>Access to this page has been denied</title>',
        }
      }

      return {
        ok: true,
        status: 200,
        text: async () => careersHtml,
      }
    },
  })

  assert.equal(chegg.hasOfficialCareersSignal(html), true)
})

test('Chegg supplies a source-local Workday jobs API config for the current public job surface', async () => {
  const chegg = await loadCheggModule()
  const configPath = path.join(chegg.SCRAPER_DIR, 'config.json')

  assert.equal(existsSync(configPath), true)

  const config = JSON.parse(readFileSync(configPath, 'utf8'))
  assert.deepEqual(config, {
    listingStrategy: 'jobs-api',
    jobsApiUrl: 'https://osv-chegg.wd5.myworkdayjobs.com/wday/cxs/osv_chegg/Chegg/jobs',
    detailUrlBase: 'https://osv-chegg.wd5.myworkdayjobs.com/Chegg',
    countryFacetParameter: 'locationCountry',
  })
})

test('run delegates to the shared Workday runner after the official Chegg handoff is verified', async () => {
  const chegg = await loadCheggModule()
  const requestedUrls = []

  const jobs = await chegg.run({
    fetchText: async (url) => {
      requestedUrls.push(url)
      if (url === chegg.CAREERS_PAGE_URL) return careersHtml
      throw new Error(`Unexpected URL: ${url}`)
    },
    workdayRunner: async (options) => [
      {
        title: 'Senior Data Analyst',
        company: 'Chegg',
        location: 'Delhi, India',
        city: 'Delhi',
        country: 'India',
        jobId: 'WD-1',
        requisitionId: 'WD-1',
        sourceUrl: 'https://osv-chegg.wd5.myworkdayjobs.com/Chegg/job/Delhi/Senior-Data-Analyst_WD-1',
        applyUrl: 'https://osv-chegg.wd5.myworkdayjobs.com/Chegg/job/Delhi/Senior-Data-Analyst_WD-1',
        source: 'chegg',
        scrapedAt: '2026-07-14T00:00:00.000Z',
        runnerOptions: options,
      },
    ],
  })

  assert.deepEqual(requestedUrls, [chegg.CAREERS_PAGE_URL])
  assert.equal(jobs.length, 1)
  assert.deepEqual(jobs[0].runnerOptions, { ...chegg.buildScraperOptions(), boardIdentityVerified: true })
})

test('Chegg validates its live Workday board without requiring the retired marketing jobs page', async () => {
  const chegg = await loadCheggModule()
  await chegg.run({
    fetchText: async (url) => {
      if (url === 'https://osv-chegg.wd5.myworkdayjobs.com/Chegg') return workdayBoardHtml
      throw new Error(`HTTP 404 for ${url}`)
    },
    workdayRunner: async (options) => {
      assert.equal(options.baseUrl, 'https://osv-chegg.wd5.myworkdayjobs.com/Chegg')
      assert.equal(options.locationCountry, 'c4f78be1a8f14da0ab49ce1162348a5e')
      assert.equal(options.boardIdentityVerified, true)
      return []
    },
  })
})

test('Chegg recognizes the canonical Workday board and rejects a mismatched tenant, site, or board URL', async () => {
  const chegg = await loadCheggModule()
  assert.equal(chegg.hasOfficialCareersSignal(workdayBoardHtml), true)
  for (const html of [
    workdayBoardHtml.replace('tenant: "osv_chegg"', 'tenant: "other_company"'),
    workdayBoardHtml.replace('siteId: "Chegg"', 'siteId: "OtherSite"'),
    workdayBoardHtml.replace('https://osv-chegg.wd5.myworkdayjobs.com/Chegg', 'https://other.wd5.myworkdayjobs.com/Chegg'),
  ]) {
    await assert.rejects(chegg.run({
      fetchText: async () => html,
      workdayRunner: async () => { throw new Error('Workday runner must not receive an unverified board') },
    }), /official jobs page changed/)
  }
})
