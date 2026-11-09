import assert from 'node:assert/strict'
import test from 'node:test'
import { readInventoryEvidence } from '../utils/inventoryEvidence.js'

const homepageHtml = `
<!doctype html>
<html lang="en-US">
  <head>
    <title>Advanced Intelligence &amp; Technology Solutions | AKTEK</title>
    <link rel="canonical" href="https://www.aktek.io/">
  </head>
  <body>
    <a href="https://aktek.io/software/">Software</a>
    <a href="https://aktek.io/intelligence/">Intelligence</a>
    <a href="https://aktek.io/integrated-services/">Integrated Services</a>
    <a href="https://aktek.io/about-us/">About Us</a>
    <h1>Empowering those who protect</h1>
    <p>AKTEK provides intelligence software, curated intelligence feeds, and investigative support.</p>
    <p>AKTEK helps organizations protect people, assets, and operations through unique software, data and expertise.</p>
  </body>
</html>
`

const homepageHtmlWithDeploymentCanonical = homepageHtml.replace(
  '<link rel="canonical" href="https://www.aktek.io/">',
  '<link rel="canonical" href="https://3.11.131.178/es/">',
)

const robotsTxt = `
# START YOAST BLOCK
# ---------------------------
User-agent: *
Disallow:

Sitemap: https://aktek.io/sitemap_index.xml
# ---------------------------
# END YOAST BLOCK
`

const sitemapIndexXml = `
<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <sitemap>
    <loc>https://aktek.io/post-sitemap.xml</loc>
  </sitemap>
  <sitemap>
    <loc>https://aktek.io/page-sitemap.xml</loc>
  </sitemap>
  <sitemap>
    <loc>https://aktek.io/category-sitemap.xml</loc>
  </sitemap>
</sitemapindex>
`

const pageSitemapXml = `
<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url><loc>https://aktek.io/</loc></url>
  <url><loc>https://aktek.io/security/</loc></url>
  <url><loc>https://aktek.io/software/</loc></url>
  <url><loc>https://aktek.io/integrated-services/</loc></url>
  <url><loc>https://aktek.io/intelligence/</loc></url>
  <url><loc>https://aktek.io/about-us/</loc></url>
</urlset>
`

const notFoundHtml = `
<!doctype html>
<html lang="en-US">
  <head>
    <title>Page not found - AKTEK</title>
  </head>
  <body>
    <h1>Page not found</h1>
    <p>Sorry, this page could not be found.</p>
  </body>
</html>
`

const publicJobsHtml = `
<!doctype html>
<html lang="en-US">
  <head>
    <title>Careers - AKTEK</title>
    <script type="application/ld+json">
      {"@context":"https://schema.org","@type":"JobPosting","title":"Threat Analyst"}
    </script>
  </head>
  <body>
    <h1>Current Openings</h1>
    <a href="https://jobs.lever.co/aktek/apply">Apply now</a>
  </body>
</html>
`

const loadAktekModule = async () => {
  try {
    return await import('../../scraper/aktek/script.js')
  } catch {
    assert.fail('Expected Aktek scraper module at ../../scraper/aktek/script.js')
  }
}

test('Aktek scraper constants stay pinned to the verified homepage, crawl surfaces, and missing careers routes', async () => {
  const aktek = await loadAktekModule()

  assert.equal(aktek.SOURCE, 'aktek')
  assert.equal(aktek.COMPANY, 'Aktek')
  assert.equal(aktek.HOMEPAGE_URL, 'https://aktek.io/')
  assert.equal(aktek.ROBOTS_TXT_URL, 'https://aktek.io/robots.txt')
  assert.equal(aktek.SITEMAP_INDEX_URL, 'https://aktek.io/sitemap_index.xml')
  assert.equal(aktek.PAGE_SITEMAP_URL, 'https://aktek.io/page-sitemap.xml')
  assert.deepEqual(aktek.CAREERS_ROUTE_URLS, [
    'https://aktek.io/careers',
    'https://aktek.io/career',
    'https://aktek.io/jobs',
    'https://aktek.io/join-us',
    'https://aktek.io/work-with-us',
    'https://aktek.io/openings',
    'https://aktek.io/current-openings',
  ])
  assert.equal(aktek.hasOfficialHomepageSignal(homepageHtml), true)
  assert.equal(aktek.hasFirstPartyCareerLikeLink(homepageHtml), false)
  assert.equal(aktek.hasPublicJobsSignal(homepageHtml), false)
  assert.equal(aktek.hasExpectedRobotsTxtSignal(robotsTxt), true)
  assert.equal(aktek.hasExpectedSitemapIndexSignal(sitemapIndexXml), true)
  assert.equal(aktek.hasExpectedPageSitemapSignal(pageSitemapXml), true)
  assert.deepEqual(aktek.extractSitemapUrls(pageSitemapXml), [
    'https://aktek.io/',
    'https://aktek.io/security/',
    'https://aktek.io/software/',
    'https://aktek.io/integrated-services/',
    'https://aktek.io/intelligence/',
    'https://aktek.io/about-us/',
  ])
  assert.equal(
    aktek.isMissingCareerRoute({
      status: 404,
      url: 'https://aktek.io/careers',
      html: notFoundHtml,
    }),
    true,
  )
  assert.equal(aktek.hasPublicJobsSignal(publicJobsHtml), true)
})

test('Aktek corporate crawl discovery returns explicit incomplete evidence instead of claiming an empty jobs inventory', async () => {
  const aktek = await loadAktekModule()
  const requestedUrls = []

  const jobs = await aktek.createAktekScraper().run({
    fetchPage: async (url) => {
      requestedUrls.push(url)

      if (url === aktek.HOMEPAGE_URL) {
        return { status: 200, url, html: homepageHtml }
      }

      if (url === aktek.ROBOTS_TXT_URL) {
        return { status: 200, url, html: robotsTxt }
      }

      if (url === aktek.SITEMAP_INDEX_URL) {
        return { status: 200, url: 'https://aktek.io/sitemap_index.xml', html: sitemapIndexXml }
      }

      if (url === aktek.PAGE_SITEMAP_URL) {
        return { status: 200, url, html: pageSitemapXml }
      }

      if (aktek.CAREERS_ROUTE_URLS.includes(url)) {
        return { status: 404, url, html: notFoundHtml }
      }

      throw new Error(`Unexpected URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [
    aktek.HOMEPAGE_URL,
    aktek.ROBOTS_TXT_URL,
    aktek.SITEMAP_INDEX_URL,
    aktek.PAGE_SITEMAP_URL,
  ])
  assert.deepEqual(jobs, [])
  assert.equal(readInventoryEvidence(jobs).status, 'coverage-gap')
  assert.equal(readInventoryEvidence(jobs).listingComplete, false)
  assert.equal(readInventoryEvidence(jobs).reportedTotal, null)
})

test('Aktek accepts the current homepage deployment canonical while the trusted first-party navigation stays intact', async () => {
  const aktek = await loadAktekModule()

  assert.equal(aktek.hasOfficialHomepageSignal(homepageHtmlWithDeploymentCanonical), true)

  const jobs = await aktek.createAktekScraper().run({
    fetchPage: async (url) => {
      if (url === aktek.HOMEPAGE_URL) {
        return { status: 200, url, html: homepageHtmlWithDeploymentCanonical }
      }

      if (url === aktek.ROBOTS_TXT_URL) {
        return { status: 200, url, html: robotsTxt }
      }

      if (url === aktek.SITEMAP_INDEX_URL) {
        return { status: 200, url: 'https://aktek.io/sitemap_index.xml', html: sitemapIndexXml }
      }

      if (url === aktek.PAGE_SITEMAP_URL) {
        return { status: 200, url, html: pageSitemapXml }
      }

      if (aktek.CAREERS_ROUTE_URLS.includes(url)) {
        return { status: 404, url, html: notFoundHtml }
      }

      throw new Error(`Unexpected URL: ${url}`)
    },
  })

  assert.deepEqual(jobs, [])
  assert.equal(readInventoryEvidence(jobs).indiaFacetCount, null)
})

test('Aktek fails closed when the homepage, crawl surfaces, or checked missing routes drift into a public careers surface', async () => {
  const aktek = await loadAktekModule()

  await assert.rejects(
    aktek.createAktekScraper().run({
      fetchPage: async (url) => {
        if (url === aktek.HOMEPAGE_URL) {
          return { status: 200, url, html: '<html><title>Unexpected</title></html>' }
        }

        throw new Error(`Unexpected URL: ${url}`)
      },
    }),
    /verified official homepage/i,
  )

  await assert.rejects(
    aktek.createAktekScraper().run({
      fetchPage: async (url) => {
        if (url === aktek.HOMEPAGE_URL) {
          return { status: 200, url, html: `${homepageHtml}<a href="https://aktek.io/careers">Careers</a>` }
        }

        throw new Error(`Unexpected URL: ${url}`)
      },
    }),
    /homepage now exposes a first-party careers or jobs link/i,
  )

  await assert.rejects(
    aktek.createAktekScraper().run({
      fetchPage: async (url) => {
        if (url === aktek.HOMEPAGE_URL) {
          return { status: 200, url, html: homepageHtml }
        }

        if (url === aktek.ROBOTS_TXT_URL) {
          return { status: 200, url, html: robotsTxt }
        }

        if (url === aktek.SITEMAP_INDEX_URL) {
          return { status: 200, url: 'https://aktek.io/sitemap_index.xml', html: sitemapIndexXml }
        }

        if (url === aktek.PAGE_SITEMAP_URL) {
          return {
            status: 200,
            url,
            html: `${pageSitemapXml}<url><loc>https://aktek.io/careers/</loc></url>`,
          }
        }

        throw new Error(`Unexpected URL: ${url}`)
      },
    }),
    /verified page sitemap/i,
  )

  assert.equal(aktek.isMissingCareerRoute({status:200, url:aktek.CAREERS_ROUTE_URLS[0], html:publicJobsHtml}, aktek.CAREERS_ROUTE_URLS[0]), false)
})
