import assert from 'node:assert/strict'
import test from 'node:test'

const loadModule = async () => {
  try {
    return await import('./script.js')
  } catch {
    return null
  }
}

const CAREERS_HTML = `
<!doctype html>
<html lang="en">
  <head>
    <title>Careers - Dedalus Global</title>
  </head>
  <body>
    <main>
      <h1>CAREERS</h1>
      <p>Join Dedalus and become part of a pioneering industry leader!</p>
      <p>WHY DEDALUS</p>
      <p>CAREER PATH</p>
      <a href="/global/en/working-at-dedalus/our-job-offers/">Our Job Offers</a>
    </main>
  </body>
</html>
`

const JOB_OFFERS_HTML = `
<!doctype html>
<html lang="en">
  <head>
    <title>Our Job Offers - Dedalus Global</title>
  </head>
  <body>
    <main>
      <h1>Our Job Offers</h1>
      <p>Join the Dedalus adventure</p>
      <a href="https://dedalus.wd3.myworkdayjobs.com/External">Go to open positions</a>
    </main>
  </body>
</html>
`

const WORKDAY_BOARD_HTML = `
<!doctype html>
<html lang="en-US">
  <head>
    <link rel="canonical" href="https://dedalus.wd3.myworkdayjobs.com/External">
    <meta property="og:title" content="Careers">
    <script src="cx-jobs.min.js"></script>
  </head>
  <body></body>
</html>
`

const STALE_INDIA_DETAIL_HTML = `
<!doctype html>
<html lang="en-US">
  <head>
    <meta property="og:title">
    <meta property="og:description">
  </head>
  <body></body>
</html>
`

test('Dedalus recognizes the current blank stale-India Workday detail shell', async () => {
  const dedalus = await loadModule()
  assert.ok(dedalus, 'Dedalus scraper module should load')

  assert.equal(dedalus.hasVerifiedStaleIndiaDetailShell(STALE_INDIA_DETAIL_HTML), true)
  assert.equal(
    dedalus.extractIndiaCountryFacetId({
      facets: [
        {
          facetParameter: 'locationMainGroup',
          values: [
            {
              facetParameter: 'locationCountry',
              values: [{ descriptor: 'India', id: 'india-facet' }],
            },
          ],
        },
      ],
    }),
    'india-facet',
  )
})

test('Dedalus returns [] when the India facet disappears and the previously verified India job URLs only serve stale blank Workday shells', async () => {
  const dedalus = await loadModule()
  assert.ok(dedalus, 'Dedalus scraper module should load')

  const staleUrls = new Set(dedalus.VERIFIED_INDIA_JOB_URLS)
  const jobs = await dedalus.createDedalusScraper({
    now: () => '2026-08-04T00:00:00.000Z',
  }).run({
    fetchPage: async (url) => {
      if (url === dedalus.CAREERS_URL) {
        return { status: 200, url, html: CAREERS_HTML }
      }
      if (url === dedalus.JOB_OFFERS_URL) {
        return { status: 200, url, html: JOB_OFFERS_HTML }
      }
      if (url === dedalus.WORKDAY_BOARD_URL) {
        return { status: 200, url, html: WORKDAY_BOARD_HTML }
      }
      if (staleUrls.has(url)) {
        return { status: 200, url, html: STALE_INDIA_DETAIL_HTML }
      }

      throw new Error(`Unexpected page URL: ${url}`)
    },
    fetchJson: async () => ({
      facets: [
        {
          facetParameter: 'locationMainGroup',
          values: [
            {
              facetParameter: 'locationCountry',
              descriptor: 'Location Country',
              values: [{ descriptor: 'Germany', id: 'de' }],
            },
          ],
        },
      ],
      jobPostings: [],
    }),
  })

  assert.deepEqual(jobs, [])
})

test('Dedalus still fails closed if the India facet disappears but the stale India URLs stop matching the verified blank shell', async () => {
  const dedalus = await loadModule()
  assert.ok(dedalus, 'Dedalus scraper module should load')

  const staleUrls = new Set(dedalus.VERIFIED_INDIA_JOB_URLS)
  await assert.rejects(
    dedalus.createDedalusScraper().run({
      fetchPage: async (url) => {
        if (url === dedalus.CAREERS_URL) {
          return { status: 200, url, html: CAREERS_HTML }
        }
        if (url === dedalus.JOB_OFFERS_URL) {
          return { status: 200, url, html: JOB_OFFERS_HTML }
        }
        if (url === dedalus.WORKDAY_BOARD_URL) {
          return { status: 200, url, html: WORKDAY_BOARD_HTML }
        }
        if (staleUrls.has(url)) {
          return {
            status: 200,
            url,
            html: '<html lang="en-US"><head><meta property="og:title" content="Integration Engineer"></head><body></body></html>',
          }
        }

        throw new Error(`Unexpected page URL: ${url}`)
      },
      fetchJson: async () => ({
        facets: [
          {
            facetParameter: 'locationMainGroup',
            values: [
              {
                facetParameter: 'locationCountry',
                descriptor: 'Location Country',
                values: [{ descriptor: 'Germany', id: 'de' }],
              },
            ],
          },
        ],
        jobPostings: [],
      }),
    }),
    /India-empty Workday sentinel changed materially/i,
  )
})
