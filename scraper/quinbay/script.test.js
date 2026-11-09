import assert from 'node:assert/strict'
import test from 'node:test'

const loadQuinbayModule = async () => {
  try {
    return await import('./script.js')
  } catch {
    return null
  }
}

const redirectHtml = '<!DOCTYPE html><html><head><script>window.onload=function(){window.location.href="/lander"}</script></head></html>'

const sitemapXml = '<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><url><loc>https://quinbay.com/lander</loc></url></urlset>'

const parkedLanderHtml = `
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width,initial-scale=1,user-scalable=no" />
    <script>window.LANDER_SYSTEM="PW"</script>
    <script>window._trfd=window._trfd||[],window._trfd.push({ap:"parking"})</script>
    <script async src="https://img1.wsimg.com/signals/js/clients/scc-c2/scc-c2.min.js"></script>
    <script defer="defer" src="https://img1.wsimg.com/parking-lander/static/js/main.98fc5cd3.js"></script>
    <link href="https://img1.wsimg.com/parking-lander/static/css/main.1a427d5f.css" rel="stylesheet" />
  </head>
  <body>
    <div id="root"></div>
  </body>
</html>
`

test('Quinbay scraper pins the verified official parked first-party surface', async () => {
  const quinbay = await loadQuinbayModule()
  assert.ok(quinbay, 'Quinbay scraper module should load')

  assert.equal(quinbay.SOURCE, 'quinbay')
  assert.equal(quinbay.COMPANY, 'Quinbay Technologies')
  assert.equal(quinbay.HOMEPAGE_URL, 'https://quinbay.com/')
  assert.equal(quinbay.CAREERS_URL, 'https://quinbay.com/careers/')
  assert.equal(quinbay.JOBS_URL, 'https://quinbay.com/jobs/')
  assert.equal(quinbay.SITEMAP_URL, 'https://quinbay.com/sitemap.xml')
  assert.equal(quinbay.BLOCKED_LANDER_URL, 'https://quinbay.com/lander')
  assert.equal(
    quinbay.BLOCKED_REASON,
    'Official quinbay.com routes currently redirect to a parked /lander page and expose no public careers or apply surface.',
  )
  assert.equal(
    quinbay.extractRedirectTarget(redirectHtml, quinbay.HOMEPAGE_URL),
    'https://quinbay.com/lander',
  )
  assert.deepEqual(quinbay.extractSitemapUrls(sitemapXml), ['https://quinbay.com/lander'])
  assert.equal(
    quinbay.hasParkedLanderSignal({
      status: 200,
      url: quinbay.BLOCKED_LANDER_URL,
      html: parkedLanderHtml,
    }),
    true,
  )
})

test('Quinbay run returns no jobs while the official routes stay parked and non-public', async () => {
  const quinbay = await loadQuinbayModule()
  assert.ok(quinbay, 'Quinbay scraper module should load')

  const requestedUrls = []

  const jobs = await quinbay.createQuinbayScraper().run({
    fetchPage: async (url) => {
      requestedUrls.push(url)

      if (
        url === quinbay.HOMEPAGE_URL
        || url === quinbay.CAREERS_URL
        || url === quinbay.JOBS_URL
      ) {
        return {
          status: 200,
          url,
          html: redirectHtml,
        }
      }

      if (url === quinbay.SITEMAP_URL) {
        return {
          status: 200,
          url,
          html: sitemapXml,
        }
      }

      if (url === quinbay.BLOCKED_LANDER_URL) {
        return {
          status: 200,
          url,
          html: parkedLanderHtml,
        }
      }

      throw new Error(`Unexpected URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [
    quinbay.HOMEPAGE_URL,
    quinbay.CAREERS_URL,
    quinbay.JOBS_URL,
    quinbay.SITEMAP_URL,
    quinbay.BLOCKED_LANDER_URL,
  ])
  assert.deepEqual(jobs, [])
})

test('Quinbay run fails closed when an official route stops redirecting to the blocked lander', async () => {
  const quinbay = await loadQuinbayModule()
  assert.ok(quinbay, 'Quinbay scraper module should load')

  await assert.rejects(
    quinbay.createQuinbayScraper().run({
      fetchPage: async (url) => {
        if (url === quinbay.HOMEPAGE_URL || url === quinbay.JOBS_URL) {
          return { status: 200, url, html: redirectHtml }
        }

        if (url === quinbay.CAREERS_URL) {
          return {
            status: 200,
            url,
            html: '<html><body><h1>Careers</h1><a href="/apply">Apply now</a></body></html>',
          }
        }

        if (url === quinbay.SITEMAP_URL) {
          return { status: 200, url, html: sitemapXml }
        }

        if (url === quinbay.BLOCKED_LANDER_URL) {
          return { status: 200, url, html: parkedLanderHtml }
        }

        throw new Error(`Unexpected URL: ${url}`)
      },
    }),
    /verified official careers route changed materially/i,
  )
})

test('Quinbay run fails closed when the parked lander stops matching the blocked non-public surface', async () => {
  const quinbay = await loadQuinbayModule()
  assert.ok(quinbay, 'Quinbay scraper module should load')

  await assert.rejects(
    quinbay.createQuinbayScraper().run({
      fetchPage: async (url) => {
        if (
          url === quinbay.HOMEPAGE_URL
          || url === quinbay.CAREERS_URL
          || url === quinbay.JOBS_URL
        ) {
          return { status: 200, url, html: redirectHtml }
        }

        if (url === quinbay.SITEMAP_URL) {
          return { status: 200, url, html: sitemapXml }
        }

        if (url === quinbay.BLOCKED_LANDER_URL) {
          return {
            status: 200,
            url,
            html: `
              <html>
                <body>
                  <h1>Current Openings</h1>
                  <a href="/apply">Apply now</a>
                </body>
              </html>
            `,
          }
        }

        throw new Error(`Unexpected URL: ${url}`)
      },
    }),
    /blocked lander no longer matches the verified parked non-public surface/i,
  )
})
