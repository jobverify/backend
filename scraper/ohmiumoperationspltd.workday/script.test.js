import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import { loadConfig } from '../../scraper-support/utils/loadConfig.js'
import { assertMappedInventoryEvidence } from '../../scraper-support/tests/helpers/assertMappedInventoryEvidence.js'

const loadOhmiumModule = async () => {
  try {
    return await import('./script.js')
  } catch {
    assert.fail('Expected Ohmium scraper module at ./script.js')
  }
}

const scraperDir = path.dirname(fileURLToPath(import.meta.url))

const homepageHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Ohmium | Home</title>
  </head>
  <body>
    <footer>
      <a href="https://ohmium.wd12.myworkdayjobs.com/Ohmium_Careers" target="_blank">Careers</a>
    </footer>
  </body>
</html>
`

const workdayHtml = `
<!doctype html>
<html lang="en-US">
  <head>
    <link rel="canonical" href="https://ohmium.wd12.myworkdayjobs.com/Ohmium_Careers" />
    <meta
      name="description"
      property="og:description"
      content="Welcome to Ohmium Careers! Please know that all interview communications from Ohmium will only come from an official @ohmium.com email."
    >
    <script type="text/javascript">
      window.workday = window.workday || {
        tenant: "ohmium",
        siteId: "Ohmium_Careers",
        requestLocale: "en-US"
      };
    </script>
  </head>
  <body>
    <div id="root"></div>
  </body>
</html>
`

test('Ohmium requisition normalization retains native Workday inventory authority', async t => {
  const ohmium = await loadOhmiumModule()
  await assertMappedInventoryEvidence(t, jobs => ohmium.run({
    workdayRunner: async () => jobs,
    fetchText: async url => {
      if (url === ohmium.HOMEPAGE_URL) return homepageHtml
      if (url === ohmium.WORKDAY_BASE_URL) return workdayHtml
      throw new Error(`Unexpected inventory fixture URL: ${url}`)
    },
  }), { surface: ohmium.WORKDAY_BASE_URL,
    job: { title: 'Engineer', requisitionId: 'R-100921', country: 'India' } })
})

test('buildScraperOptions keeps Ohmium on the verified Workday board and India lane', async () => {
  const ohmium = await loadOhmiumModule()
  const options = ohmium.buildScraperOptions()

  assert.equal(ohmium.SOURCE, 'ohmiumoperationspltd')
  assert.equal(ohmium.COMPANY_NAME, 'Ohmium Operations (P) Ltd')
  assert.equal(ohmium.HOMEPAGE_URL, 'https://www.ohmium.com/')
  assert.equal(ohmium.WORKDAY_BASE_URL, 'https://ohmium.wd12.myworkdayjobs.com/Ohmium_Careers')
  assert.equal(ohmium.INDIA_LOCATION_COUNTRY, 'c4f78be1a8f14da0ab49ce1162348a5e')
  assert.equal(options.company, 'Ohmium Operations (P) Ltd')
  assert.equal(options.baseUrl, 'https://ohmium.wd12.myworkdayjobs.com/Ohmium_Careers')
  assert.equal(options.locationCountry, 'c4f78be1a8f14da0ab49ce1162348a5e')
  assert.equal(options.source, 'ohmiumoperationspltd')
  assert.match(options.scraperDir, /ohmiumoperationspltd\.workday$/)
})

test('loads the India location guardrail for the shared Workday runner', () => {
  const config = loadConfig(scraperDir)

  assert.match(config.locationPattern, /india/i)
  assert.match(config.locationPattern, /bengaluru|bangalore/i)
  assert.match(config.locationPattern, /hyderabad/i)
})

test('Ohmium verifies the official homepage handoff and live Workday board before delegating', async () => {
  const ohmium = await loadOhmiumModule()
  const expectedJobs = [{
    jobId: 'R-100921',
    requisitionId: 'R-100921',
    title: 'Manufacturing Engineer',
  }]
  const requestedUrls = []
  let receivedOptions = null

  const jobs = await ohmium.run({
    fetchText: async (url) => {
      requestedUrls.push(url)
      if (url === ohmium.HOMEPAGE_URL) return homepageHtml
      if (url === ohmium.WORKDAY_BASE_URL) return workdayHtml
      return ''
    },
    workdayRunner: async (options) => {
      receivedOptions = options
      return [{
        jobId: null,
        requisitionId: 'R-100921',
        title: 'Manufacturing Engineer',
      }]
    },
  })

  assert.deepEqual(jobs, expectedJobs)
  assert.deepEqual(requestedUrls, [
    'https://www.ohmium.com/',
    'https://ohmium.wd12.myworkdayjobs.com/Ohmium_Careers',
  ])
  assert.ok(receivedOptions)
  assert.equal(receivedOptions.company, 'Ohmium Operations (P) Ltd')
  assert.equal(receivedOptions.baseUrl, 'https://ohmium.wd12.myworkdayjobs.com/Ohmium_Careers')
  assert.equal(receivedOptions.locationCountry, 'c4f78be1a8f14da0ab49ce1162348a5e')
  assert.equal(receivedOptions.source, 'ohmiumoperationspltd')
  assert.match(receivedOptions.scraperDir, /ohmiumoperationspltd\.workday$/)
})

test('run fails closed when the verified Ohmium handoff or board changes', async () => {
  const ohmium = await loadOhmiumModule()

  await assert.rejects(
    ohmium.run({
      fetchText: async () => '<html><body><h1>Ohmium</h1></body></html>',
      workdayRunner: async () => [],
    }),
    /official homepage surface changed/i,
  )

  await assert.rejects(
    ohmium.run({
      fetchText: async (url) => {
        if (url === ohmium.HOMEPAGE_URL) {
          return `
            <html>
              <head><title>Ohmium | Home</title></head>
              <body>
                <a href="https://example.com/jobs">Careers</a>
              </body>
            </html>
          `
        }

        return workdayHtml
      },
      workdayRunner: async () => [],
    }),
    /verified workday handoff changed/i,
  )

  await assert.rejects(
    ohmium.run({
      fetchText: async (url) => {
        if (url === ohmium.HOMEPAGE_URL) return homepageHtml
        return '<html><body><h1>Careers</h1></body></html>'
      },
      workdayRunner: async () => [],
    }),
    /verified workday board changed/i,
  )
})
