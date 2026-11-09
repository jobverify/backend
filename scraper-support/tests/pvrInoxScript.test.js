import assert from 'node:assert/strict'
import test from 'node:test'

const loadModule = async () => {
  try {
    return await import('../../scraper/pvrinox/script.js')
  } catch {
    assert.fail('Expected PVR INOX scraper module at ../../scraper/pvrinox/script.js')
  }
}

const GENERIC_SPA_HTML = `
<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta
      name="description"
      content="Book movie tickets online at PVR Cinemas. Check latest movie showtimes, now-showing films, upcoming releases and premium cinema experiences across India."
    />
    <meta property="og:title" content="Book Movie Tickets Online | PVR INOX Cinemas" />
    <meta property="og:url" content="https://www.inoxmovies.com/" />
    <meta property="og:site_name" content="PVR INOX Cinemas" />
    <script defer="defer" src="/static/js/main.eb5dae66.js"></script>
  </head>
  <body>
    <noscript>You need to enable JavaScript to run this app.</noscript>
    <div id="root"></div>
  </body>
</html>
`

const PUBLIC_JOBS_HTML = `
<!doctype html>
<html lang="en">
  <body>
    <main>
      <h1>Current Openings</h1>
      <article>
        <h2>Assistant Manager - HR</h2>
        <a href="https://jobs.lever.co/pvrinox/example">Apply now</a>
      </article>
    </main>
  </body>
</html>
`

test('PVR INOX helper exports stay pinned to the verified generic careers shell routes', async () => {
  const pvrInox = await loadModule()

  assert.equal(pvrInox.SOURCE, 'pvrinox')
  assert.equal(pvrInox.COMPANY, 'PVR INOX')
  assert.equal(pvrInox.OFFICIAL_BRAND_NAME, 'PVR INOX')
  assert.equal(pvrInox.VERIFIED_ON, '2026-07-17')
  assert.equal(pvrInox.HOMEPAGE_URL, 'https://www.pvrcinemas.com/')
  assert.deepEqual(pvrInox.CAREERS_ROUTE_URLS, [
    'https://www.pvrcinemas.com/careers-us',
    'https://www.pvrcinemas.com/career',
    'https://www.pvrcinemas.com/careers',
  ])
  assert.equal(pvrInox.hasGenericSpaShellSignal(GENERIC_SPA_HTML), true)
  assert.equal(pvrInox.hasPublicJobsSignal(GENERIC_SPA_HTML), false)
  assert.equal(pvrInox.hasPublicJobsSignal(PUBLIC_JOBS_HTML), true)
})

test('PVR INOX sentinel returns [] only while the public careers routes stay on the verified generic SPA shell', async () => {
  const pvrInox = await loadModule()
  const requestedUrls = []

  const jobs = await pvrInox.createPvrInoxScraper().run({
    fetchPage: async (url) => {
      requestedUrls.push(url)
      return { status: 200, url, html: GENERIC_SPA_HTML }
    },
  })

  assert.deepEqual(requestedUrls, pvrInox.CAREERS_ROUTE_URLS)
  assert.deepEqual(jobs, [])
})

test('PVR INOX sentinel fails closed when a verified route drifts or starts exposing public jobs', async () => {
  const pvrInox = await loadModule()

  await assert.rejects(
    pvrInox.createPvrInoxScraper().run({
      fetchPage: async (url) => {
        if (url === pvrInox.CAREERS_ROUTE_URLS[0]) {
          return { status: 200, url, html: GENERIC_SPA_HTML }
        }

        return { status: 200, url, html: '<html><body><h1>Unexpected</h1></body></html>' }
      },
    }),
    /verified careers route changed materially/i,
  )

  await assert.rejects(
    pvrInox.createPvrInoxScraper().run({
      fetchPage: async (url) => ({
        status: 200,
        url,
        html: url === pvrInox.CAREERS_ROUTE_URLS[1] ? PUBLIC_JOBS_HTML : GENERIC_SPA_HTML,
      }),
    }),
    /public jobs surface/i,
  )
})
