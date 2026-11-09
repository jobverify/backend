import assert from 'node:assert/strict'
import test from 'node:test'

const homepageHtml = `
<!DOCTYPE html>
<html lang="en-US">
  <head>
    <title>Bamboo Rose | PLM &amp; Supply Chain Technology</title>
  </head>
  <body>
    <nav>
      <a href="/">Home</a>
      <a href="/careers/">Careers</a>
    </nav>
    <main>
      <h1>AI-Native TotalPLM</h1>
      <p>The Ultimate End-to-End Retail Supply Chain Platform</p>
      <p>These Global Retailers &amp; Brands Trust Bamboo Rose</p>
    </main>
    <footer>
      <p>© 2026 Bamboo Rose, Inc. All Rights Reserved.</p>
    </footer>
  </body>
</html>
`

const careersHtml = `
<!DOCTYPE html>
<html lang="en-US">
  <head>
    <title>Careers - Bamboo Rose</title>
  </head>
  <body>
    <main>
      <h1>The Next Chapter of Your Career is Waiting</h1>
      <p>Join the Bamboo Rose team today.</p>
      <p>Find Your Next Adventure</p>
      <p>Manager, Application Development | India</p>
      <a class="cta" href="https://www.linkedin.com/company/bamboorose/jobs/">View Current Openings</a>
    </main>
  </body>
</html>
`

const missingRouteHtml = `
<!DOCTYPE html>
<html lang="en-US">
  <head>
    <title>Page not found - Bamboo Rose</title>
  </head>
  <body>
    <h1>Page not found</h1>
  </body>
</html>
`

const sitemapIndexXml = `
<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <sitemap>
    <loc>http://bamboorose.com/post-sitemap.xml</loc>
    <lastmod>2026-06-30T21:44:32+00:00</lastmod>
  </sitemap>
  <sitemap>
    <loc>http://bamboorose.com/page-sitemap.xml</loc>
    <lastmod>2026-07-13T20:26:37+00:00</lastmod>
  </sitemap>
</sitemapindex>
`

const pageSitemapXml = `
<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url><loc>https://bamboorose.com/</loc></url>
  <url><loc>https://bamboorose.com/about/</loc></url>
  <url><loc>https://bamboorose.com/careers/</loc></url>
</urlset>
`

const pageSitemapWithUnexpectedJobUrl = `
<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url><loc>https://bamboorose.com/</loc></url>
  <url><loc>https://bamboorose.com/careers/</loc></url>
  <url><loc>https://bamboorose.com/jobs/platform-engineer/</loc></url>
</urlset>
`

const careersHtmlWithFirstPartyJobs = `
<!DOCTYPE html>
<html lang="en-US">
  <head>
    <title>Careers - Bamboo Rose</title>
    <script type="application/ld+json">
      { "@context": "https://schema.org", "@type": "JobPosting", "title": "Platform Engineer" }
    </script>
  </head>
  <body>
    <main>
      <h1>The Next Chapter of Your Career is Waiting</h1>
      <a href="https://www.linkedin.com/company/bamboorose/jobs/">View Current Openings</a>
      <a href="/jobs/platform-engineer/">Platform Engineer</a>
    </main>
  </body>
</html>
`

const loadBambooRoseIndiaModule = async () => {
  try {
    return await import('../../scraper/bambooroseindia/script.js')
  } catch {
    assert.fail('Expected Bamboo Rose India scraper module at ../../scraper/bambooroseindia/script.js')
  }
}

test('Bamboo Rose India helpers stay pinned to the verified homepage, careers page, LinkedIn handoff, and sitemap route set', async () => {
  const bambooRoseIndia = await loadBambooRoseIndiaModule()

  assert.equal(bambooRoseIndia.SOURCE, 'bambooroseindia')
  assert.equal(bambooRoseIndia.COMPANY, 'Bamboo Rose India')
  assert.equal(bambooRoseIndia.OFFICIAL_BRAND_NAME, 'Bamboo Rose')
  assert.equal(bambooRoseIndia.VERIFIED_ON, '2026-07-15')
  assert.equal(bambooRoseIndia.HOMEPAGE_URL, 'https://bamboorose.com/')
  assert.equal(bambooRoseIndia.CAREER_PAGE_URL, 'https://bamboorose.com/careers/')
  assert.equal(bambooRoseIndia.LINKEDIN_JOBS_URL, 'https://www.linkedin.com/company/bamboorose/jobs/')
  assert.equal(bambooRoseIndia.SITEMAP_INDEX_URL, 'https://bamboorose.com/sitemap_index.xml')
  assert.equal(bambooRoseIndia.PAGE_SITEMAP_URL, 'https://bamboorose.com/page-sitemap.xml')
  assert.deepEqual(bambooRoseIndia.CHECKED_MISSING_ROUTE_URLS, [
    'https://bamboorose.com/jobs/',
    'https://bamboorose.com/career/',
    'https://bamboorose.com/join-us/',
    'https://bamboorose.com/openings/',
  ])
  assert.equal(bambooRoseIndia.hasOfficialHomepageSignal(homepageHtml), true)
  assert.equal(bambooRoseIndia.hasOfficialCareersPageSignal(careersHtml), true)
  assert.equal(
    bambooRoseIndia.extractLinkedInJobsUrl(careersHtml),
    'https://www.linkedin.com/company/bamboorose/jobs/',
  )
  assert.deepEqual(
    bambooRoseIndia.extractCareerLikeUrlsFromPageSitemap(pageSitemapXml),
    ['https://bamboorose.com/careers/'],
  )
  assert.equal(
    bambooRoseIndia.isMissingCareerRoute({
      status: 404,
      url: bambooRoseIndia.CHECKED_MISSING_ROUTE_URLS[0],
      html: missingRouteHtml,
    }),
    true,
  )
  assert.equal(bambooRoseIndia.hasFirstPartyPublicJobsSignal(careersHtml), false)
  assert.equal(bambooRoseIndia.hasFirstPartyPublicJobsSignal(careersHtmlWithFirstPartyJobs), true)
  assert.equal(bambooRoseIndia.hasPageSitemapSignal(sitemapIndexXml), true)
})

test('Bamboo Rose India returns [] only while the verified first-party page stays a LinkedIn-handoff sentinel with no public jobs', async () => {
  const bambooRoseIndia = await loadBambooRoseIndiaModule()
  const requestedUrls = []

  const jobs = await bambooRoseIndia.createBambooRoseIndiaScraper().run({
    fetchPage: async (url) => {
      requestedUrls.push(url)

      if (url === bambooRoseIndia.HOMEPAGE_URL) {
        return { status: 200, url, html: homepageHtml }
      }

      if (url === bambooRoseIndia.CAREER_PAGE_URL) {
        return { status: 200, url, html: careersHtml }
      }

      if (url === bambooRoseIndia.SITEMAP_INDEX_URL) {
        return { status: 200, url, html: sitemapIndexXml }
      }

      if (url === bambooRoseIndia.PAGE_SITEMAP_URL) {
        return { status: 200, url, html: pageSitemapXml }
      }

      if (bambooRoseIndia.CHECKED_MISSING_ROUTE_URLS.includes(url)) {
        return { status: 404, url, html: missingRouteHtml }
      }

      throw new Error(`Unexpected Bamboo Rose India URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [
    bambooRoseIndia.HOMEPAGE_URL,
    bambooRoseIndia.CAREER_PAGE_URL,
    ...bambooRoseIndia.CHECKED_MISSING_ROUTE_URLS,
    bambooRoseIndia.SITEMAP_INDEX_URL,
    bambooRoseIndia.PAGE_SITEMAP_URL,
  ])
  assert.deepEqual(jobs, [])
})

test('Bamboo Rose India fails closed when the homepage, careers page, LinkedIn handoff, missing routes, or sitemap route set drifts', async () => {
  const bambooRoseIndia = await loadBambooRoseIndiaModule()

  await assert.rejects(
    bambooRoseIndia.createBambooRoseIndiaScraper().run({
      fetchPage: async (url) => {
        if (url === bambooRoseIndia.HOMEPAGE_URL) {
          return { status: 200, url, html: '<html><head><title>Unexpected</title></head><body></body></html>' }
        }

        throw new Error(`Unexpected Bamboo Rose India URL: ${url}`)
      },
    }),
    /official homepage/i,
  )

  await assert.rejects(
    bambooRoseIndia.createBambooRoseIndiaScraper().run({
      fetchPage: async (url) => {
        if (url === bambooRoseIndia.HOMEPAGE_URL) {
          return { status: 200, url, html: homepageHtml }
        }

        if (url === bambooRoseIndia.CAREER_PAGE_URL) {
          return {
            status: 200,
            url,
            html: careersHtml.replace(
              'https://www.linkedin.com/company/bamboorose/jobs/',
              'https://www.linkedin.com/company/other-company/jobs/',
            ),
          }
        }

        throw new Error(`Unexpected Bamboo Rose India URL: ${url}`)
      },
    }),
    /linkedin handoff/i,
  )

  await assert.rejects(
    bambooRoseIndia.createBambooRoseIndiaScraper().run({
      fetchPage: async (url) => {
        if (url === bambooRoseIndia.HOMEPAGE_URL) {
          return { status: 200, url, html: homepageHtml }
        }

        if (url === bambooRoseIndia.CAREER_PAGE_URL) {
          return { status: 200, url, html: careersHtmlWithFirstPartyJobs }
        }

        throw new Error(`Unexpected Bamboo Rose India URL: ${url}`)
      },
    }),
    /first-party public jobs surface/i,
  )

  await assert.rejects(
    bambooRoseIndia.createBambooRoseIndiaScraper().run({
      fetchPage: async (url) => {
        if (url === bambooRoseIndia.HOMEPAGE_URL) {
          return { status: 200, url, html: homepageHtml }
        }

        if (url === bambooRoseIndia.CAREER_PAGE_URL) {
          return { status: 200, url, html: careersHtml }
        }

        if (url === bambooRoseIndia.CHECKED_MISSING_ROUTE_URLS[0]) {
          return { status: 200, url, html: careersHtml }
        }

        if (url === bambooRoseIndia.SITEMAP_INDEX_URL) {
          return { status: 200, url, html: sitemapIndexXml }
        }

        if (url === bambooRoseIndia.PAGE_SITEMAP_URL) {
          return { status: 200, url, html: pageSitemapXml }
        }

        return { status: 404, url, html: missingRouteHtml }
      },
    }),
    /missing career route changed/i,
  )

  await assert.rejects(
    bambooRoseIndia.createBambooRoseIndiaScraper().run({
      fetchPage: async (url) => {
        if (url === bambooRoseIndia.HOMEPAGE_URL) {
          return { status: 200, url, html: homepageHtml }
        }

        if (url === bambooRoseIndia.CAREER_PAGE_URL) {
          return { status: 200, url, html: careersHtml }
        }

        if (bambooRoseIndia.CHECKED_MISSING_ROUTE_URLS.includes(url)) {
          return { status: 404, url, html: missingRouteHtml }
        }

        if (url === bambooRoseIndia.SITEMAP_INDEX_URL) {
          return { status: 200, url, html: sitemapIndexXml }
        }

        if (url === bambooRoseIndia.PAGE_SITEMAP_URL) {
          return { status: 200, url, html: pageSitemapWithUnexpectedJobUrl }
        }

        throw new Error(`Unexpected Bamboo Rose India URL: ${url}`)
      },
    }),
    /page sitemap career surface changed/i,
  )
})
