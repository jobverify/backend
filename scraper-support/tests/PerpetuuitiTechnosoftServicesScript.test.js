import assert from 'node:assert/strict'
import test from 'node:test'

const HOMEPAGE_HTML = `
<!doctype html>
<html lang="en">
  <head>
    <title>Autonomous Resilience Platform | Perpetuuiti</title>
  </head>
  <body>
    <main>
      <h1>RESILIENCE REDEFINED</h1>
      <p>Autonomous resilience for the AI era.</p>
      <p>Built on 15 years of enterprise resilience expertise.</p>
      <a href="/contact/">Contact</a>
      <a href="/book-demo/">Book a Resilience Assessment</a>
    </main>
  </body>
</html>
`

const SITEMAP_XML = `
<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url><loc>https://ptechnosoft.com/</loc></url>
  <url><loc>https://ptechnosoft.com/about/</loc></url>
  <url><loc>https://ptechnosoft.com/contact/</loc></url>
</urlset>
`

const loadModule = async () => {
  try {
    return await import('../../scraper/perpetuuititechnosoftservices/script.js')
  } catch {
    assert.fail('Expected Perpetuuiti Technosoft Services scraper module at ../../scraper/perpetuuititechnosoftservices/script.js')
  }
}

test('Perpetuuiti Technosoft Services recognizes the verified homepage redirect sentinel and missing careers routes', async () => {
  const perpetuuiti = await loadModule()

  assert.equal(perpetuuiti.SOURCE, 'perpetuuititechnosoftservices')
  assert.equal(perpetuuiti.HOMEPAGE_URL, 'https://ptechnosoft.com/')
  assert.equal(perpetuuiti.LEGACY_CAREERS_URL, 'https://perpetuuiti.com/Careers.php')
  assert.equal(perpetuuiti.LEGACY_CAREERS_FORM_URL, 'https://perpetuuiti.com/Careers-Form.php')
  assert.equal(perpetuuiti.SITEMAP_URL, 'https://www.ptechnosoft.com/sitemap.xml')
  assert.equal(perpetuuiti.CAREERS_ROUTE_URL, 'https://ptechnosoft.com/careers')
  assert.equal(perpetuuiti.CAREER_ROUTE_URL, 'https://ptechnosoft.com/career')
  assert.equal(perpetuuiti.JOBS_ROUTE_URL, 'https://ptechnosoft.com/jobs')
  assert.equal(perpetuuiti.hasOfficialHomepageSignal(HOMEPAGE_HTML), true)
  assert.equal(perpetuuiti.hasExpectedSitemapSurface(SITEMAP_XML), true)
  assert.equal(perpetuuiti.hasCareersLikeRoute(SITEMAP_XML), false)
  assert.equal(
    perpetuuiti.isHomepageRedirectSurface({
      status: 200,
      url: perpetuuiti.HOMEPAGE_URL,
      text: HOMEPAGE_HTML,
    }),
    true,
  )
  assert.equal(
    perpetuuiti.isExpectedMissingCareerRoute({
      status: 404,
      url: perpetuuiti.CAREERS_ROUTE_URL,
      text: '404 Not Found',
    }, perpetuuiti.CAREERS_ROUTE_URL),
    true,
  )
})

test('Perpetuuiti Technosoft Services returns [] only while the legacy careers URLs collapse into the verified homepage and public careers routes stay missing', async () => {
  const perpetuuiti = await loadModule()
  const pages = new Map([
    [
      perpetuuiti.HOMEPAGE_URL,
      { status: 200, url: perpetuuiti.HOMEPAGE_URL, text: HOMEPAGE_HTML },
    ],
    [
      perpetuuiti.LEGACY_CAREERS_URL,
      { status: 200, url: perpetuuiti.HOMEPAGE_URL, text: HOMEPAGE_HTML },
    ],
    [
      perpetuuiti.LEGACY_CAREERS_FORM_URL,
      { status: 200, url: perpetuuiti.HOMEPAGE_URL, text: HOMEPAGE_HTML },
    ],
    [
      perpetuuiti.SITEMAP_URL,
      { status: 200, url: perpetuuiti.SITEMAP_URL, text: SITEMAP_XML },
    ],
    [
      perpetuuiti.CAREERS_ROUTE_URL,
      { status: 404, url: perpetuuiti.CAREERS_ROUTE_URL, text: '404 Not Found' },
    ],
    [
      perpetuuiti.CAREER_ROUTE_URL,
      { status: 404, url: perpetuuiti.CAREER_ROUTE_URL, text: '404 Not Found' },
    ],
    [
      perpetuuiti.JOBS_ROUTE_URL,
      { status: 404, url: perpetuuiti.JOBS_ROUTE_URL, text: '404 Not Found' },
    ],
  ])

  const jobs = await perpetuuiti.createPerpetuuitiTechnosoftServicesScraper().run({
    fetchPage: async (url) => {
      const page = pages.get(url)
      if (!page) {
        assert.fail(`Unexpected Perpetuuiti URL: ${url}`)
      }
      return page
    },
  })

  assert.deepEqual(jobs, [])
})

test('Perpetuuiti Technosoft Services fails closed when a checked route starts exposing public jobs', async () => {
  const perpetuuiti = await loadModule()

  await assert.rejects(
    perpetuuiti.createPerpetuuitiTechnosoftServicesScraper().run({
      fetchPage: async (url) => {
        if (url === perpetuuiti.HOMEPAGE_URL) {
          return { status: 200, url, text: HOMEPAGE_HTML }
        }

        if (url === perpetuuiti.LEGACY_CAREERS_URL || url === perpetuuiti.LEGACY_CAREERS_FORM_URL) {
          return { status: 200, url: perpetuuiti.HOMEPAGE_URL, text: HOMEPAGE_HTML }
        }

        if (url === perpetuuiti.SITEMAP_URL) {
          return { status: 200, url, text: SITEMAP_XML }
        }

        if (url === perpetuuiti.CAREERS_ROUTE_URL) {
          return { status: 404, url, text: '404 Not Found' }
        }

        if (url === perpetuuiti.CAREER_ROUTE_URL) {
          return { status: 404, url, text: '404 Not Found' }
        }

        if (url === perpetuuiti.JOBS_ROUTE_URL) {
          return { status: 200, url, text: '<html><body><h1>Open Positions</h1><a>Apply now</a></body></html>' }
        }

        assert.fail(`Unexpected Perpetuuiti URL: ${url}`)
      },
    }),
    /no-public-careers route changed materially/i,
  )
})
