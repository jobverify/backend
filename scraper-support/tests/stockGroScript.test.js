import assert from 'node:assert/strict'
import test from 'node:test'

const CAREERS_HTML = `
<!doctype html>
<html lang="en">
  <head>
    <title>Careers - easiest way to master trading &amp; investments</title>
    <link rel="canonical" href="https://www.stockgro.club/careers/" />
  </head>
  <body>
    <main>
      <h1>Explore our current job openings and join us!</h1>
      <p>WeWork Galaxy, 43, Residency Rd, Bengaluru, Karnataka 560025</p>
      <p>Assetgro Fintech Private Limited</p>
      <a href="https://app.stockgro.club">Open app</a>
    </main>
  </body>
</html>
`

const PUBLIC_JOBS_HTML = `
<!doctype html>
<html lang="en">
  <body>
    <h1>Current Openings</h1>
    <script type="application/ld+json">
      {"@context":"https://schema.org","@type":"JobPosting","title":"Community Lead"}
    </script>
    <a href="https://boards.greenhouse.io/stockgro/jobs/123">Apply now</a>
  </body>
</html>
`

const loadScriptModule = async () => {
  try {
    return await import('../../scraper/stockgro/script.js')
  } catch {
    assert.fail('Expected StockGro scraper module at ../../scraper/stockgro/script.js')
  }
}

test('StockGro sentinel helpers stay pinned to the verified first-party careers copy and missing public-job surface', async () => {
  const stockGro = await loadScriptModule()

  assert.equal(stockGro.SOURCE, 'stockgro')
  assert.equal(stockGro.COMPANY, 'StockGro')
  assert.equal(stockGro.OFFICIAL_BRAND_NAME, 'StockGro')
  assert.equal(stockGro.VERIFIED_ON, '2026-07-17')
  assert.equal(stockGro.HOMEPAGE_URL, 'https://www.stockgro.club/')
  assert.equal(stockGro.CAREERS_URL, 'https://www.stockgro.club/careers/')
  assert.equal(stockGro.OFFICIAL_OPERATING_ENTITY, 'Assetgro Fintech Private Limited')
  assert.equal(stockGro.hasOfficialCareersPageSignal(CAREERS_HTML), true)
  assert.equal(stockGro.extractOperatingEntity(CAREERS_HTML), 'Assetgro Fintech Private Limited')
  assert.deepEqual(stockGro.extractTrustedPublicJobLinks(CAREERS_HTML), [])
  assert.equal(stockGro.pageExposesPublicJobListings(CAREERS_HTML), false)
  assert.equal(stockGro.pageExposesPublicJobListings(PUBLIC_JOBS_HTML), true)
})

test('StockGro returns [] for the verified static careers page and fails closed if a public jobs surface appears', async () => {
  const stockGro = await loadScriptModule()
  const requestedUrls = []

  const jobs = await stockGro.createStockGroScraper().run({
    fetchPage: async (url) => {
      requestedUrls.push(url)

      if (url === stockGro.CAREERS_URL) {
        return { status: 200, url, html: CAREERS_HTML }
      }

      throw new Error(`Unexpected StockGro URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [stockGro.CAREERS_URL])
  assert.deepEqual(jobs, [])

  await assert.rejects(
    stockGro.createStockGroScraper().run({
      fetchPage: async () => ({
        status: 200,
        url: stockGro.CAREERS_URL,
        html: PUBLIC_JOBS_HTML,
      }),
    }),
    /public jobs surface/i,
  )

  await assert.rejects(
    stockGro.createStockGroScraper().run({
      fetchPage: async () => ({
        status: 200,
        url: stockGro.CAREERS_URL,
        html: '<html><body><h1>Unexpected</h1></body></html>',
      }),
    }),
    /verified careers page changed materially/i,
  )
})
