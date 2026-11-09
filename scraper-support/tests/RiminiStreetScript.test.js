import assert from 'node:assert/strict'
import test from 'node:test'

const loadModule = async () => {
  try {
    return await import('../../scraper/riministreet.workday/script.js')
  } catch {
    assert.fail('Expected Rimini Street scraper module at ../../scraper/riministreet.workday/script.js')
  }
}

const careersHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Rimini Street Careers &amp; Job Opportunities | Rimini Street</title>
  </head>
  <body>
    <h1>Rimini Street Careers</h1>
    <p>See open positions and apply through Workday.</p>
    <a href="https://riministreet.wd1.myworkdayjobs.com/en-US/RiminiStreet">See open positions</a>
  </body>
</html>
`

const workdayBoardHtml = `
<!doctype html>
<html lang="en">
  <head>
    <link rel="canonical" href="https://riministreet.wd1.myworkdayjobs.com/RiminiStreet" />
    <meta
      property="og:description"
      content="In 2005, we disrupted the industry by pioneering extraordinary enterprise software support powered by extraordinary people. Rimini Street Career Job Alerts."
    />
    <script src="/assets/cx-jobs.min.js"></script>
    <script>
      window.workday = { tenant: "riministreet", siteId: "RiminiStreet" }
    </script>
  </head>
  <body></body>
</html>
`

test('Rimini Street validates the verified first-party careers handoff and delegates to the shared Workday runner', async () => {
  const riminiStreet = await loadModule()

  assert.equal(riminiStreet.hasOfficialCareersSignal(careersHtml), true)
  assert.equal(riminiStreet.hasOfficialWorkdayBoardSignal(workdayBoardHtml), true)
  assert.equal(
    riminiStreet.extractVerifiedWorkdayHandoffUrl(careersHtml),
    'https://riministreet.wd1.myworkdayjobs.com/RiminiStreet',
  )
  assert.deepEqual(riminiStreet.buildScraperOptions(), {
    company: 'Rimini Street',
    baseUrl: 'https://riministreet.wd1.myworkdayjobs.com/RiminiStreet',
    locationCountry: 'c4f78be1a8f14da0ab49ce1162348a5e',
    source: 'riministreet',
    scraperDir: riminiStreet.SCRAPER_DIR,
  })
})

test('Rimini Street run hands verified first-party Workday jobs through unchanged', async () => {
  const riminiStreet = await loadModule()
  const requestedUrls = []

  const jobs = await riminiStreet.createRiminiStreetScraper({
    fetchText: async (url) => {
      requestedUrls.push(url)
      if (url === riminiStreet.CAREERS_URL) return careersHtml
      if (url === riminiStreet.WORKDAY_BASE_URL) return workdayBoardHtml
      throw new Error(`Unexpected URL: ${url}`)
    },
    workdayRunner: async (options) => [
      { title: 'Security Analyst', company: options.company, source: options.source },
    ],
  }).run()

  assert.deepEqual(requestedUrls, [riminiStreet.CAREERS_URL, riminiStreet.WORKDAY_BASE_URL])
  assert.deepEqual(jobs, [
    { title: 'Security Analyst', company: 'Rimini Street', source: 'riministreet' },
  ])
})

test('Rimini Street tolerates transient first-party blocking when the canonical public Workday board still verifies cleanly', async () => {
  const riminiStreet = await loadModule()

  const jobs = await riminiStreet.createRiminiStreetScraper({
    fetchText: async (url) => {
      if (url === riminiStreet.CAREERS_URL) {
        const error = new Error('HTTP 403 for https://www.riministreet.com/company/careers/')
        error.status = 403
        throw error
      }
      if (url === riminiStreet.WORKDAY_BASE_URL) return workdayBoardHtml
      throw new Error(`Unexpected URL: ${url}`)
    },
    workdayRunner: async () => [{ title: 'DevOps Engineer' }],
  }).run()

  assert.deepEqual(jobs, [{ title: 'DevOps Engineer' }])
})

test('Rimini Street fails closed when the verified careers surface or Workday handoff changes', async () => {
  const riminiStreet = await loadModule()

  await assert.rejects(
    riminiStreet.createRiminiStreetScraper({
      fetchText: async () => '<html><body><h1>Unexpected shell</h1></body></html>',
      workdayRunner: async () => [],
    }).run(),
    /verified first-party careers page/i,
  )

  await assert.rejects(
    riminiStreet.createRiminiStreetScraper({
      fetchText: async () => careersHtml.replace(
        'https://riministreet.wd1.myworkdayjobs.com/en-US/RiminiStreet',
        'https://example.com/jobs',
      ),
      workdayRunner: async () => [],
    }).run(),
    /verified Workday handoff changed/i,
  )

  await assert.rejects(
    riminiStreet.createRiminiStreetScraper({
      fetchText: async (url) => {
        if (url === riminiStreet.CAREERS_URL) return careersHtml
        if (url === riminiStreet.WORKDAY_BASE_URL) return '<html><body><h1>Unexpected board</h1></body></html>'
        throw new Error(`Unexpected URL: ${url}`)
      },
      workdayRunner: async () => [],
    }).run(),
    /verified public Workday board changed materially/i,
  )
})
