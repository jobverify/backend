import assert from 'node:assert/strict'
import test from 'node:test'

const loadModule = async () => {
  try {
    return await import('./script.js')
  } catch {
    assert.fail('Expected Value Health Inc. scraper module at ./script.js')
  }
}

const redirectShellHtml = `
  <!DOCTYPE html>
  <html>
    <head>
      <script>window.onload=function(){window.location.href="/lander"}</script>
    </head>
  </html>
`

const parkedLanderHtml = `
  <!doctype html>
  <html lang="en">
    <head>
      <meta charset="UTF-8"/>
      <meta name="viewport" content="width=device-width,initial-scale=1,user-scalable=no"/>
      <link rel="icon" href="data:,"/>
      <script>window.LANDER_SYSTEM="PW"</script>
      <script>window._trfd=window._trfd||[],window._trfd.push({ap:"parking"})</script>
      <script>window._signalsDataLayer=window._signalsDataLayer||[]</script>
      <script async src="https://img1.wsimg.com/signals/js/clients/scc-c2/scc-c2.min.js"></script>
      <script defer="defer" src="https://img1.wsimg.com/parking-lander/static/js/main.98fc5cd3.js"></script>
      <link href="https://img1.wsimg.com/parking-lander/static/css/main.1a427d5f.css" rel="stylesheet">
    </head>
    <body>
      <div id="root"></div>
    </body>
  </html>
`

const sitemapXml = `
  <?xml version="1.0" encoding="UTF-8"?>
  <urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
    <url>
      <loc>https://valuehealth.com/lander</loc>
    </url>
  </urlset>
`

const publicJobsHtml = `
  <html>
    <body>
      <h1>Current Openings</h1>
      <a href="https://jobs.lever.co/valuehealth/software-engineer">Apply now</a>
    </body>
  </html>
`

test('Value Health Inc. sentinel pins the verified first-party parked-domain surface', async () => {
  const scraper = await loadModule()

  assert.equal(scraper.SOURCE, 'valuehealthinc')
  assert.equal(scraper.COMPANY, 'Value Health Inc.')
  assert.equal(scraper.VERIFIED_AT, '2026-07-13')
  assert.equal(scraper.HOMEPAGE_URL, 'https://valuehealth.com/')
  assert.equal(scraper.LANDER_URL, 'https://valuehealth.com/lander')
  assert.equal(scraper.SITEMAP_URL, 'https://valuehealth.com/sitemap.xml')
  assert.deepEqual(scraper.CHECKED_ROUTE_URLS, [
    'https://valuehealth.com/careers',
    'https://valuehealth.com/jobs',
  ])

  assert.equal(scraper.hasRedirectShellSignal(redirectShellHtml), true)
  assert.equal(scraper.extractRedirectTarget(redirectShellHtml), '/lander')
  assert.equal(scraper.hasParkedLanderSignal(parkedLanderHtml), true)
  assert.equal(scraper.hasKnownSitemapSignal(sitemapXml), true)
  assert.equal(scraper.hasPublicJobsSignal(redirectShellHtml), false)
  assert.equal(scraper.hasPublicJobsSignal(parkedLanderHtml), false)
  assert.equal(scraper.hasPublicJobsSignal(publicJobsHtml), true)
})

test('Value Health Inc. sentinel returns [] only while the verified first-party parked shell remains intact', async () => {
  const scraper = await loadModule()
  const requestedUrls = []

  const jobs = await scraper.createValueHealthIncScraper().run({
    fetchPage: async (url) => {
      requestedUrls.push(url)

      if (url === scraper.HOMEPAGE_URL || scraper.CHECKED_ROUTE_URLS.includes(url)) {
        return {
          status: 200,
          url,
          html: redirectShellHtml,
          errorMessage: '',
        }
      }

      if (url === scraper.SITEMAP_URL) {
        return {
          status: 200,
          url,
          html: sitemapXml,
          errorMessage: '',
        }
      }

      if (url === scraper.LANDER_URL) {
        return {
          status: 200,
          url,
          html: parkedLanderHtml,
          errorMessage: '',
        }
      }

      throw new Error(`Unexpected URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [
    scraper.HOMEPAGE_URL,
    ...scraper.CHECKED_ROUTE_URLS,
    scraper.SITEMAP_URL,
    scraper.LANDER_URL,
  ])
  assert.deepEqual(jobs, [])
})

test('Value Health Inc. sentinel fails closed when the first-party surface drifts or starts exposing jobs', async () => {
  const scraper = await loadModule()

  await assert.rejects(
    scraper.createValueHealthIncScraper().run({
      fetchPage: async (url) => {
        if (url === scraper.HOMEPAGE_URL) {
          return {
            status: 200,
            url,
            html: '<html><body><h1>Value Health</h1></body></html>',
            errorMessage: '',
          }
        }

        throw new Error(`Unexpected URL: ${url}`)
      },
    }),
    /verified redirect shell no longer matches/i,
  )

  await assert.rejects(
    scraper.createValueHealthIncScraper().run({
      fetchPage: async (url) => {
        if (url === scraper.HOMEPAGE_URL || scraper.CHECKED_ROUTE_URLS.includes(url)) {
          return {
            status: 200,
            url,
            html: redirectShellHtml,
            errorMessage: '',
          }
        }

        if (url === scraper.SITEMAP_URL) {
          return {
            status: 200,
            url,
            html: `
              <?xml version="1.0" encoding="UTF-8"?>
              <urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
                <url>
                  <loc>https://valuehealth.com/jobs</loc>
                </url>
              </urlset>
            `,
            errorMessage: '',
          }
        }

        if (url === scraper.LANDER_URL) {
          return {
            status: 200,
            url,
            html: parkedLanderHtml,
            errorMessage: '',
          }
        }

        throw new Error(`Unexpected URL: ${url}`)
      },
    }),
    /verified sitemap surface changed/i,
  )

  await assert.rejects(
    scraper.createValueHealthIncScraper().run({
      fetchPage: async (url) => {
        if (url === scraper.HOMEPAGE_URL) {
          return {
            status: 200,
            url,
            html: redirectShellHtml,
            errorMessage: '',
          }
        }

        if (url === scraper.CHECKED_ROUTE_URLS[0]) {
          return {
            status: 200,
            url,
            html: publicJobsHtml,
            errorMessage: '',
          }
        }

        if (scraper.CHECKED_ROUTE_URLS.includes(url)) {
          return {
            status: 200,
            url,
            html: redirectShellHtml,
            errorMessage: '',
          }
        }

        if (url === scraper.SITEMAP_URL) {
          return {
            status: 200,
            url,
            html: sitemapXml,
            errorMessage: '',
          }
        }

        if (url === scraper.LANDER_URL) {
          return {
            status: 200,
            url,
            html: parkedLanderHtml,
            errorMessage: '',
          }
        }

        throw new Error(`Unexpected URL: ${url}`)
      },
    }),
    /checked first-party route changed|checked first-party route now exposes jobs/i,
  )
})
