import assert from 'node:assert/strict'
import test from 'node:test'

const loadApolloModule = async () => {
  try {
    return await import('../../scraper/apollo247/script.js')
  } catch {
    assert.fail('Expected Apollo 24/7 scraper module at ../../scraper/apollo247/script.js')
  }
}

const homepageHtml = `
  <html>
    <head><title>Apollo 24|7</title></head>
    <body>
      <a href="/AboutUs">About Us</a>
      <p>Book doctor consultations online.</p>
    </body>
  </html>
`

const aboutHtml = `
  <html>
    <head><title>About Us | Apollo 24|7</title></head>
    <body>
      <h1>About Us</h1>
      <p>Apollo 24|7 is a digital healthcare platform.</p>
    </body>
  </html>
`

const sitemapXml = `
  <urlset>
    <url><loc>https://www.apollo247.com/</loc></url>
    <url><loc>https://www.apollo247.com/AboutUs</loc></url>
  </urlset>
`

const sitemapHtml = `
  <html>
    <body>
      <h1>A POLLO 24|7 SITE MAP</h1>
      <a href="/">Home</a>
      <a href="/static/sitemap">Sitemap</a>
      <a href="/sitemap/static">Static Sitemap</a>
      <h3>About Apollo 247</h3>
      <span>About Us</span>
      <a href="/contactUs">Contact Us / Grievance</a>
    </body>
  </html>
`

const robotsTxt = `
  User-agent: *
  Sitemap: https://www.apollo247.com/static/sitemap
`

const robotsTxtWithoutSitemap = `
  User-agent: *
  Disallow: /api/
`

const missingCareersRouteHtml = `
  <html>
    <body>
      <h1>404</h1>
      <a href="/AboutUs">About Us</a>
      <p>Careers page not found.</p>
    </body>
  </html>
`

test('Apollo 24/7 scraper pins the verified first-party informational surfaces and checked careers routes', async () => {
  const apollo = await loadApolloModule()

  assert.equal(apollo.HOMEPAGE_URL, 'https://www.apollo247.com/')
  assert.equal(apollo.ABOUT_URL, 'https://www.apollo247.com/AboutUs')
  assert.equal(apollo.SITEMAP_URL, 'https://www.apollo247.com/static/sitemap')
  assert.equal(apollo.ROBOTS_URL, 'https://www.apollo247.com/robots.txt')
  assert.equal(apollo.hasOfficialHomepageSignal(homepageHtml), true)
  assert.equal(apollo.hasOfficialAboutSignal(aboutHtml), true)
  assert.equal(apollo.hasOfficialSitemapSignal(sitemapXml), true)
  assert.equal(apollo.hasOfficialSitemapSignal(sitemapHtml), true)
  assert.equal(apollo.hasOfficialRobotsSignal(robotsTxt), true)
  assert.equal(apollo.hasOfficialRobotsSignal(robotsTxtWithoutSitemap), true)
  assert.equal(apollo.hasPublicJobsSignal(missingCareersRouteHtml), false)
})

test('Apollo 24/7 run returns no jobs when the verified first-party routes expose no public careers surface', async () => {
  const apollo = await loadApolloModule()
  const requestedUrls = []

  const jobs = await apollo.createApollo247Scraper().run({
    fetchPage: async (url) => {
      requestedUrls.push(url)

      if (url === apollo.HOMEPAGE_URL) return { status: 200, url, html: homepageHtml }
      if (url === apollo.ABOUT_URL) return { status: 200, url, html: aboutHtml }
      if (url === apollo.SITEMAP_URL) return { status: 200, url, html: sitemapXml }
      if (url === apollo.ROBOTS_URL) return { status: 200, url, html: robotsTxt }
      if (apollo.NO_PUBLIC_CAREERS_ROUTE_URLS.includes(url)) {
        return { status: 404, url, html: '<html><body>Not Found</body></html>' }
      }

      throw new Error(`Unexpected URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [
    apollo.HOMEPAGE_URL,
    apollo.ABOUT_URL,
    apollo.SITEMAP_URL,
    apollo.ROBOTS_URL,
    ...apollo.NO_PUBLIC_CAREERS_ROUTE_URLS,
  ])
  assert.deepEqual(jobs, [])
})

test('Apollo 24/7 run fails closed when a checked careers route starts exposing public jobs', async () => {
  const apollo = await loadApolloModule()

  await assert.rejects(
    apollo.createApollo247Scraper().run({
      fetchPage: async (url) => {
        if (url === apollo.HOMEPAGE_URL) return { status: 200, url, html: homepageHtml }
        if (url === apollo.ABOUT_URL) return { status: 200, url, html: aboutHtml }
        if (url === apollo.SITEMAP_URL) return { status: 200, url, html: sitemapXml }
        if (url === apollo.ROBOTS_URL) return { status: 200, url, html: robotsTxt }
        if (apollo.NO_PUBLIC_CAREERS_ROUTE_URLS.includes(url)) {
          return {
            status: 200,
            url,
            html: '<html><body><h1>Current Openings</h1><a href="https://jobs.lever.co/apollo247">Apply now</a></body></html>',
          }
        }

        throw new Error(`Unexpected URL: ${url}`)
      },
    }),
    /public careers surface/i,
  )
})
