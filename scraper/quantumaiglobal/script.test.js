import assert from 'node:assert/strict'
import test from 'node:test'

const loadModule = async () => {
  try {
    return await import('./script.js')
  } catch {
    assert.fail('Expected Quantum AI Global scraper module at ./script.js')
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

const robotsText = `
User-agent: *
Allow: /
LLM-Policy: /llms.txt
Sitemap: /sitemap.xml
`

const sitemapXml = `
<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>https://quantumaiglobal.com/lander</loc>
  </url>
</urlset>
`

const publicJobsHtml = `
  <html>
    <body>
      <h1>Current Openings</h1>
      <a href="/jobs/founding-engineer">Apply now</a>
    </body>
  </html>
`

test('Quantum AI Global sentinel pins the verified parked first-party surface from July 13, 2026', async () => {
  const scraper = await loadModule()

  assert.equal(scraper.SOURCE, 'quantumaiglobal')
  assert.equal(scraper.COMPANY, 'Quantum AI Global')
  assert.equal(scraper.VERIFIED_AT, '2026-07-13')
  assert.equal(scraper.HOMEPAGE_URL, 'https://quantumaiglobal.com/')
  assert.equal(scraper.WWW_HOMEPAGE_URL, 'https://www.quantumaiglobal.com/')
  assert.equal(scraper.LANDER_URL, 'https://quantumaiglobal.com/lander')
  assert.equal(scraper.ROBOTS_URL, 'https://quantumaiglobal.com/robots.txt')
  assert.equal(scraper.SITEMAP_URL, 'https://quantumaiglobal.com/sitemap.xml')
  assert.deepEqual(scraper.CHECKED_ROUTE_URLS, [
    'https://quantumaiglobal.com/careers',
    'https://quantumaiglobal.com/career',
    'https://quantumaiglobal.com/jobs',
    'https://quantumaiglobal.com/join-us',
    'https://quantumaiglobal.com/about',
    'https://quantumaiglobal.com/contact',
  ])

  assert.equal(scraper.hasRedirectShellSignal(redirectShellHtml), true)
  assert.equal(scraper.extractRedirectTarget(redirectShellHtml), '/lander')
  assert.equal(scraper.hasParkedLanderSignal(parkedLanderHtml), true)
  assert.equal(scraper.hasVerifiedRobotsSignal(robotsText), true)
  assert.equal(scraper.hasVerifiedSitemapSignal(sitemapXml), true)
  assert.equal(scraper.hasPublicJobsSignal(redirectShellHtml), false)
  assert.equal(scraper.hasPublicJobsSignal(parkedLanderHtml), false)
  assert.equal(scraper.hasPublicJobsSignal(publicJobsHtml), true)
})

test('Quantum AI Global sentinel returns [] only while the verified parked-domain contract remains unchanged', async () => {
  const scraper = await loadModule()
  const requestedUrls = []

  const jobs = await scraper.createQuantumAIGlobalScraper().run({
    fetchPage: async (url) => {
      requestedUrls.push(url)

      if (
        url === scraper.HOMEPAGE_URL
        || url === scraper.WWW_HOMEPAGE_URL
        || scraper.CHECKED_ROUTE_URLS.includes(url)
      ) {
        return {
          status: 200,
          url,
          html: redirectShellHtml,
        }
      }

      if (url === scraper.LANDER_URL) {
        return {
          status: 200,
          url,
          html: parkedLanderHtml,
        }
      }

      if (url === scraper.ROBOTS_URL) {
        return {
          status: 200,
          url,
          html: robotsText,
        }
      }

      if (url === scraper.SITEMAP_URL) {
        return {
          status: 200,
          url,
          html: sitemapXml,
        }
      }

      throw new Error(`Unexpected URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [
    scraper.HOMEPAGE_URL,
    scraper.WWW_HOMEPAGE_URL,
    ...scraper.CHECKED_ROUTE_URLS,
    scraper.LANDER_URL,
    scraper.ROBOTS_URL,
    scraper.SITEMAP_URL,
  ])
  assert.deepEqual(jobs, [])
})

test('Quantum AI Global sentinel fails closed when the verified first-party contract drifts', async () => {
  const scraper = await loadModule()

  await assert.rejects(
    scraper.createQuantumAIGlobalScraper().run({
      fetchPage: async (url) => {
        if (url === scraper.HOMEPAGE_URL) {
          return {
            status: 200,
            url,
            html: publicJobsHtml,
          }
        }

        throw new Error(`Unexpected URL: ${url}`)
      },
    }),
    /public jobs|redirect shell/i,
  )

  await assert.rejects(
    scraper.createQuantumAIGlobalScraper().run({
      fetchPage: async (url) => {
        if (
          url === scraper.HOMEPAGE_URL
          || url === scraper.WWW_HOMEPAGE_URL
          || scraper.CHECKED_ROUTE_URLS.includes(url)
        ) {
          return {
            status: 200,
            url,
            html: redirectShellHtml,
          }
        }

        if (url === scraper.LANDER_URL) {
          return {
            status: 200,
            url,
            html: '<html><body><h1>Quantum AI Global</h1></body></html>',
          }
        }

        if (url === scraper.ROBOTS_URL) {
          return {
            status: 200,
            url,
            html: robotsText,
          }
        }

        if (url === scraper.SITEMAP_URL) {
          return {
            status: 200,
            url,
            html: sitemapXml,
          }
        }

        throw new Error(`Unexpected URL: ${url}`)
      },
    }),
    /lander|parked/i,
  )

  await assert.rejects(
    scraper.createQuantumAIGlobalScraper().run({
      fetchPage: async (url) => {
        if (
          url === scraper.HOMEPAGE_URL
          || url === scraper.WWW_HOMEPAGE_URL
          || scraper.CHECKED_ROUTE_URLS.includes(url)
        ) {
          return {
            status: 200,
            url,
            html: redirectShellHtml,
          }
        }

        if (url === scraper.LANDER_URL) {
          return {
            status: 200,
            url,
            html: parkedLanderHtml,
          }
        }

        if (url === scraper.ROBOTS_URL) {
          return {
            status: 200,
            url,
            html: 'User-agent: *\nAllow: /\nSitemap: /jobs.xml\n',
          }
        }

        if (url === scraper.SITEMAP_URL) {
          return {
            status: 200,
            url,
            html: sitemapXml,
          }
        }

        throw new Error(`Unexpected URL: ${url}`)
      },
    }),
    /robots/i,
  )
})
