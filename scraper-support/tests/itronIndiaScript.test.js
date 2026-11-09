import assert from 'node:assert/strict'
import test from 'node:test'

const loadItronIndiaModule = async () => {
  try {
    return await import('../../scraper/itronindia.workday/script.js')
  } catch {
    assert.fail('Expected Itron India scraper module at ../../scraper/itronindia.workday/script.js')
  }
}

const officialCareersHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Careers - Itron</title>
  </head>
  <body>
    <main>
      <h1>Careers</h1>
      <a href="https://itron.wd5.myworkdayjobs.com/Itron?locationCountry=c4f78be1a8f14da0ab49ce1162348a5e">
        View Jobs in India
      </a>
    </main>
  </body>
</html>
`

const officialWorkdayBoardHtml = `
<!doctype html>
<html lang="en-US">
  <head>
    <link rel="canonical" href="https://itron.wd5.myworkdayjobs.com/Itron" />
    <script>
      window.workday = window.workday || {tenant: "itron", siteId: "Itron", appName: "cxs"}
    </script>
  </head>
  <body>
    <div id="mainContent">Open Jobs</div>
  </body>
</html>
`

test('Itron India pins the verified official careers handoff and India Workday board wrapper', async () => {
  const itronIndia = await loadItronIndiaModule()
  const options = itronIndia.buildScraperOptions()

  assert.equal(itronIndia.SOURCE, 'itronindia')
  assert.equal(itronIndia.COMPANY, 'Itron India')
  assert.equal(itronIndia.VERIFIED_ON, '2026-07-16')
  assert.equal(itronIndia.CAREERS_URL, 'https://na.itron.com/careers')
  assert.equal(itronIndia.WORKDAY_BOARD_URL, 'https://itron.wd5.myworkdayjobs.com/Itron')
  assert.equal(
    itronIndia.INDIA_WORKDAY_URL,
    'https://itron.wd5.myworkdayjobs.com/Itron?locationCountry=c4f78be1a8f14da0ab49ce1162348a5e',
  )
  assert.deepEqual(itronIndia.WORKDAY_BOARD_ACCEPTED_URLS, [
    'https://itron.wd5.myworkdayjobs.com/Itron',
    'https://itron.wd5.myworkdayjobs.com/en-US/Itron',
    'https://itron.wd5.myworkdayjobs.com/Itron?locationCountry=c4f78be1a8f14da0ab49ce1162348a5e',
  ])
  assert.equal(itronIndia.hasOfficialCareersSignal(officialCareersHtml), true)
  assert.equal(
    itronIndia.extractVerifiedIndiaWorkdayUrl(officialCareersHtml),
    'https://itron.wd5.myworkdayjobs.com/Itron?locationCountry=c4f78be1a8f14da0ab49ce1162348a5e',
  )
  assert.equal(itronIndia.hasOfficialWorkdayBoardSignal(officialWorkdayBoardHtml), true)
  assert.deepEqual(options, {
    company: 'Itron India',
    baseUrl: 'https://itron.wd5.myworkdayjobs.com/Itron?locationCountry=c4f78be1a8f14da0ab49ce1162348a5e',
    locationCountry: 'c4f78be1a8f14da0ab49ce1162348a5e',
    source: 'itronindia',
    scraperDir: options.scraperDir,
  })
  assert.match(options.scraperDir, /itronindia\.workday$/i)
})

test('Itron India run verifies the official handoff chain and delegates to the shared Workday runner', async () => {
  const itronIndia = await loadItronIndiaModule()
  const requestedPages = []
  let receivedRunnerOptions = null

  const jobs = await itronIndia.createItronIndiaScraper().run({
    fetchPage: async (url) => {
      requestedPages.push(url)

      if (url === itronIndia.CAREERS_URL) {
        return {
          status: 200,
          url,
          html: officialCareersHtml,
        }
      }

      if (url === itronIndia.INDIA_WORKDAY_URL) {
        return {
          status: 200,
          url,
          html: officialWorkdayBoardHtml,
        }
      }

      throw new Error(`Unexpected Itron India page URL: ${url}`)
    },
    workdayRunner: async (options) => {
      receivedRunnerOptions = options
      return [{ jobId: 'JR-1', title: 'Sample Itron Job' }]
    },
  })

  assert.deepEqual(requestedPages, [
    itronIndia.CAREERS_URL,
    itronIndia.INDIA_WORKDAY_URL,
  ])
  assert.deepEqual(jobs, [{ jobId: 'JR-1', title: 'Sample Itron Job' }])
  assert.deepEqual(receivedRunnerOptions, itronIndia.buildScraperOptions())
})

test('Itron India fails closed when the verified official careers handoff or Workday board changes materially', async () => {
  const itronIndia = await loadItronIndiaModule()

  await assert.rejects(
    itronIndia.createItronIndiaScraper().run({
      fetchPage: async (url) => {
        if (url === itronIndia.CAREERS_URL) {
          return {
            status: 200,
            url,
            html: '<html><body><h1>Join Itron</h1></body></html>',
          }
        }

        throw new Error(`Unexpected Itron India page URL: ${url}`)
      },
      workdayRunner: async () => [],
    }),
    /verified official careers surface/i,
  )

  await assert.rejects(
    itronIndia.createItronIndiaScraper().run({
      fetchPage: async (url) => {
        if (url === itronIndia.CAREERS_URL) {
          return {
            status: 200,
            url,
            html: officialCareersHtml,
          }
        }

        if (url === itronIndia.INDIA_WORKDAY_URL) {
          return {
            status: 200,
            url,
            html: '<html><body>No Workday signal</body></html>',
          }
        }

        throw new Error(`Unexpected Itron India page URL: ${url}`)
      },
      workdayRunner: async () => [],
    }),
    /verified public workday board changed materially/i,
  )
})

test('Itron revalidates its own careers redirect and propagates the Workday outage instead of returning empty', async () => {
  const itron = await loadItronIndiaModule()
  const outage = Object.assign(new Error('Workday is currently unavailable'), {code:'WORKDAY_UPSTREAM_UNAVAILABLE'})
  const requests = []
  await assert.rejects(itron.run({
    fetchPage: async url => {
      requests.push(url)
      return {status:200,url:itron.CAREERS_URL,html:officialCareersHtml}
    },
    workdayRunner: async options => {
      assert.equal(options.baseUrl,itron.INDIA_WORKDAY_URL)
      assert.equal(options.locationCountry,itron.LOCATION_COUNTRY)
      throw outage
    },
  }), error => error === outage)
  assert.deepEqual(requests,[itron.CAREERS_URL,itron.INDIA_WORKDAY_URL])
})

test('Itron rejects a foreign redirect and its own careers page if the India handoff changed', async () => {
  const itron = await loadItronIndiaModule()
  for (const [url, html] of [
    ['https://unrelated.example/careers', officialCareersHtml],
    [itron.CAREERS_URL, officialCareersHtml.replace(itron.LOCATION_COUNTRY,'unverified-country')],
  ]) {
    await assert.rejects(itron.run({
      fetchPage: async requested => requested === itron.CAREERS_URL ? {status:200,url:requested,html:officialCareersHtml} : {status:200,url,html},
      workdayRunner: async () => {throw new Error('Must not delegate unverified redirect')},
    }), /verified public workday board changed materially/i)
  }
})
