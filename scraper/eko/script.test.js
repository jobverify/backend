import assert from 'node:assert/strict'
import test from 'node:test'
import { readInventoryEvidence } from '../../scraper-support/utils/inventoryEvidence.js'

import {
  CAREERS_ROUTE_URLS,
  COMPANY,
  CORPORATE_CAREERS_ROUTE_URLS,
  CORPORATE_HOMEPAGE_URL,
  CORPORATE_ROBOTS_TXT_URL,
  CORPORATE_SITEMAP_URL,
  HOMEPAGE_URL,
  ROBOTS_TXT_URL,
  SITEMAP_URL,
  SOURCE,
  createEkoScraper,
  hasOfficialCorporateHomepageSignal,
  hasOfficialHomepageSignal,
  hasOfficialRobotsTxtSignal,
  hasOfficialSitemapSignal,
  isMissingCareerRoute,
  isMissingCorporateSitemap,
} from './script.js'

const homepageHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Eko Bharat Ventures Private Limited | The Leading Fintech Company in India</title>
  </head>
  <body>
    <a href="https://about.eko.in">Corporate</a>
    <p>Best way to send money and do Aadhaar based withdrawal</p>
    <p>Checkout our new websites</p>
    <p>Become a Banking &amp; Financial institution</p>
  </body>
</html>
`

const corporateHomepageHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Eko | Financial Infrastructure for Micro-Entrepreneurs</title>
    <meta
      name="description"
      content="Eko builds fintech infrastructure enabling micro-entrepreneurs, enterprises, and financial institutions to deliver digital financial services at scale."
    >
    <meta
      property="og:description"
      content="Eko builds fintech infrastructure enabling micro-entrepreneurs, enterprises, and financial institutions to deliver digital financial services at scale."
    >
    <script type="application/ld+json">
      {
        "@context": "https://schema.org",
        "@type": "Organization",
        "description": "Financial infrastructure for micro-entrepreneurs across the developing world"
      }
    </script>
  </head>
  <body>
    <div id="root"></div>
  </body>
</html>
`

const robotsTxt = `
User-agent: *
Disallow: /admin/
Disallow: /404.html
Sitemap: https://eko.in/sitemap.xml
`

const sitemapXml = `
<urlset>
  <url><loc>https://eko.in/</loc></url>
  <url><loc>https://eko.in/about-us/</loc></url>
  <url><loc>https://eko.in/retailer/</loc></url>
  <url><loc>https://eko.in/developers/eps/</loc></url>
</urlset>
`

const missingHomepageCareerRoute = {
  status: 404,
  url: 'https://eko.in/careers',
  html: `
    <!doctype html>
    <html><body><h1>Oops! 404 - Page Not Found</h1></body></html>
  `,
}

const corporateRobotsTxt = `
User-agent: *
Disallow: /
`

const missingCorporateSitemap = {
  status: 404,
  url: 'https://about.eko.in/sitemap.xml',
  html: 'The page could not be found NOT_FOUND',
}

test('Eko current public and corporate homepage contracts stay verified', () => {
  assert.equal(SOURCE, 'eko')
  assert.equal(COMPANY, 'Eko')
  assert.equal(HOMEPAGE_URL, 'https://eko.in/')
  assert.equal(CORPORATE_HOMEPAGE_URL, 'https://about.eko.in/')
  assert.equal(ROBOTS_TXT_URL, 'https://eko.in/robots.txt')
  assert.equal(SITEMAP_URL, 'https://eko.in/sitemap.xml')
  assert.equal(CORPORATE_ROBOTS_TXT_URL, 'https://about.eko.in/robots.txt')
  assert.equal(CORPORATE_SITEMAP_URL, 'https://about.eko.in/sitemap.xml')
  assert.deepEqual(CAREERS_ROUTE_URLS.length, 6)
  assert.deepEqual(CORPORATE_CAREERS_ROUTE_URLS.length, 6)
  assert.equal(hasOfficialHomepageSignal(homepageHtml), true)
  assert.equal(hasOfficialCorporateHomepageSignal(corporateHomepageHtml), true)
  assert.equal(hasOfficialRobotsTxtSignal(robotsTxt), true)
  assert.equal(hasOfficialSitemapSignal(sitemapXml), true)
  assert.equal(isMissingCareerRoute(missingHomepageCareerRoute), true)
  assert.equal(isMissingCorporateSitemap(missingCorporateSitemap), true)
})

test('Eko scraper records incomplete discovery rather than certifying zero vacancies', async () => {
  const jobs = await createEkoScraper().run({
    now: () => '2026-10-09T00:00:00Z',
    fetchPage: async (url) => {
      if (url === HOMEPAGE_URL) return { status: 200, url, html: homepageHtml }
      if (url === CORPORATE_HOMEPAGE_URL) return { status: 200, url, html: corporateHomepageHtml }
      if (url === ROBOTS_TXT_URL) return { status: 200, url, html: robotsTxt }
      if (url === SITEMAP_URL) return { status: 200, url, html: sitemapXml }
      if (url === CORPORATE_ROBOTS_TXT_URL) return { status: 200, url, html: corporateRobotsTxt }
      if (url === CORPORATE_SITEMAP_URL) return missingCorporateSitemap
      if ([...CAREERS_ROUTE_URLS, ...CORPORATE_CAREERS_ROUTE_URLS].includes(url)) {
        return { ...missingHomepageCareerRoute, url }
      }
      throw new Error(`Unexpected URL: ${url}`)
    },
  })

  assert.deepEqual(jobs, [])
  assert.deepEqual(readInventoryEvidence(jobs), {
    status: 'discovery-only', surface: HOMEPAGE_URL, firstParty: true, listingComplete: false,
    pagesFetched: 18, reportedTotal: null, indiaFacetCount: null, verifiedAt: '2026-10-09T00:00:00.000Z',
    reason: 'first-party-pages-and-missing-careers-routes-do-not-prove-active-vacancy-inventory',
  })
})
