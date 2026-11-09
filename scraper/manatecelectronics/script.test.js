import assert from 'node:assert/strict'
import test from 'node:test'
import { readInventoryEvidence, isVerifiedEmptyEvidence } from '../../scraper-support/utils/inventoryEvidence.js'
import { inventoryCleanupOptions } from '../../scraper-support/utils/scraperOutcome.js'

import {
  CAREERS_URL,
  COMPANY,
  EXPECTED_DEPARTMENTS,
  HOMEPAGE_URL,
  MISSING_ROUTE_URL,
  PAGE_SITEMAP_URL,
  SOURCE,
  createManatecElectronicsScraper,
  extractDepartmentOptions,
  fetchPageWithWwwFallback,
  hasApplicationOnlyCareersSignal,
  hasOfficialHomepageSignal,
  hasVerifiedPageSitemapSignal,
  isVerifiedMissingRoute,
} from './script.js'

const homepageHtml = `
  <!doctype html>
  <html lang="en-US">
    <head>
      <title>MANATEC &#8211; ALIGNED TO EXCELLENCE</title>
    </head>
    <body>
      <h1>MANATEC - ALIGNED TO EXCELLENCE</h1>
      <nav>
        <a href="https://manatec.in/career/">Career</a>
      </nav>
      <p>Manatec Group of Companies</p>
      <p>Trusted in 70+ Countries</p>
      <p>Garage Equipment</p>
      <p>We work for you since 1987.</p>
      <p>
        Established in the year 1987, as a manufacturer of industrial shaft
        alignment systems, Manatec diversified into automotive aftermarket
        equipment industry in 1991.
      </p>
      <p>Chambre de Commerce, Pondicherry</p>
    </body>
  </html>
`

const pageSitemapXml = `
  <?xml version="1.0" encoding="UTF-8"?>
  <urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
    <url><loc>https://manatec.in/contact/</loc></url>
    <url><loc>https://manatec.in/</loc></url>
    <url><loc>https://manatec.in/career/</loc></url>
  </urlset>
`

const careersHtml = `
  <!doctype html>
  <html lang="en-US">
    <head>
      <title>Career &#8211; MANATEC</title>
    </head>
    <body>
      <nav>
        <a href="https://manatec.in/career/">Career</a>
      </nav>
      <h2>Opportunities</h2>
      <p>
        At Manatec, we believe that our greatest asset is our people. We are
        always on the lookout for passionate, innovative, and talented
        individuals who are eager to make a difference. Whether you are a
        seasoned professional or just starting your career, we offer exciting
        opportunities for growth and development in a dynamic work environment.
      </p>
      <h3>Application</h3>
      <label>First Name</label>
      <label>Last Name</label>
      <label>Email</label>
      <label>Contact</label>
      <label>Departments</label>
      <select name="department">
        <option value="Commercial and Despatch">Commercial and Despatch</option>
        <option value="CSD">CSD</option>
        <option value="Engineering">Engineering</option>
        <option value="Exports Marketing">Exports Marketing</option>
        <option value="Domestic Marketing">Domestic Marketing</option>
        <option value="Finance">Finance</option>
        <option value="HR &amp; Admin">HR &amp; Admin</option>
        <option value="Pricing">Pricing</option>
        <option value="Production">Production</option>
        <option value="Purchase and vendor">Purchase and vendor</option>
        <option value="Quality">Quality</option>
        <option value="R &amp; D">R &amp; D</option>
        <option value="Stores">Stores</option>
        <option value="Testing and Assembling">Testing and Assembling</option>
        <option value="Trading">Trading</option>
      </select>
      <label>Upload Resume / CV</label>
      <label>Message</label>
      <button type="submit">Send</button>
      <div class="email">
        <span class="label">Interested in working with us?</span>
        <a href="mailto:hrdmel@manatec.in">hrdmel@manatec.in</a>
      </div>
    </body>
  </html>
`

const missingRouteHtml = `
  <!doctype html>
  <html lang="en-US">
    <head>
      <title>Page not found &#8211; MANATEC</title>
    </head>
    <body>
      <h1>404</h1>
      <p>Opps! the page you requested was not found.</p>
      <a href="https://manatec.in/">Back To Homepage</a>
    </body>
  </html>
`

const blockedShellHtml = `
  <!doctype html>
  <html lang="en-US">
    <head>
      <title>403 Forbidden</title>
    </head>
    <body>
      <h1>403 Forbidden</h1>
      <p>Forbidden</p>
      <p>You don't have permission to access / on this server.</p>
      <p>Additionally, a 403 Forbidden error was encountered while trying to use an ErrorDocument to handle the request.</p>
    </body>
  </html>
`

// These retained legacy templates are controlled inputs, not fresh native evidence.
const assertDiscoveryOnly = (jobs, surface) => {
  const evidence = readInventoryEvidence(jobs)
  assert.equal(evidence?.status, 'discovery-only')
  assert.equal(evidence.surface, surface)
  assert.equal(evidence.listingComplete, false)
  assert.equal(evidence.reportedTotal, null)
  assert.equal(evidence.indiaFacetCount, null)
  assert.equal(isVerifiedEmptyEvidence(evidence), false)
  assert.deepEqual(inventoryCleanupOptions({ inventoryEvidence: evidence }), { replaceExisting: false })
}

test('Manatec Electronics recognizes the verified homepage, sitemap, careers page, and missing-route shell', () => {
  assert.equal(SOURCE, 'manatecelectronics')
  assert.equal(COMPANY, 'Manatec Electronics Private Limited')
  assert.equal(HOMEPAGE_URL, 'https://manatec.in/')
  assert.equal(CAREERS_URL, 'https://manatec.in/career/')
  assert.equal(PAGE_SITEMAP_URL, 'https://manatec.in/wp-sitemap-posts-page-1.xml')
  assert.equal(MISSING_ROUTE_URL, 'https://manatec.in/join-us')
  assert.equal(hasOfficialHomepageSignal(homepageHtml), true)
  assert.equal(hasVerifiedPageSitemapSignal(pageSitemapXml), true)
  assert.equal(hasApplicationOnlyCareersSignal(careersHtml), true)
  assert.equal(
    isVerifiedMissingRoute({
      status: 404,
      html: missingRouteHtml,
      url: MISSING_ROUTE_URL,
    }),
    true,
  )
})

test('Manatec Electronics extracts the exact verified application departments', () => {
  assert.deepEqual(extractDepartmentOptions(careersHtml), EXPECTED_DEPARTMENTS)
})

test('Manatec Electronics run() validates the verified application-only public surface and returns no structured jobs', async () => {
  const requestedUrls = []

  const jobs = await createManatecElectronicsScraper().run({
    fetchPage: async (url) => {
      requestedUrls.push(url)

      if (url === HOMEPAGE_URL) {
        return { status: 200, url, html: homepageHtml }
      }

      if (url === PAGE_SITEMAP_URL) {
        return { status: 200, url, html: pageSitemapXml }
      }

      if (url === CAREERS_URL) {
        return { status: 200, url, html: careersHtml }
      }

      if (url === MISSING_ROUTE_URL) {
        return { status: 404, url, html: missingRouteHtml }
      }

      throw new Error(`Unexpected URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [HOMEPAGE_URL, CAREERS_URL])
  assert.deepEqual(jobs, [])
  assertDiscoveryOnly(jobs, CAREERS_URL)
})

test('Manatec Electronics returns no jobs when the verified public site is uniformly blocked by the current 403 shell', async () => {
  const requestedUrls = []

  const jobs = await createManatecElectronicsScraper().run({
    fetchPage: async (url) => {
      requestedUrls.push(url)

      if ([HOMEPAGE_URL, PAGE_SITEMAP_URL, CAREERS_URL, MISSING_ROUTE_URL].includes(url)) {
        return { status: 403, url, html: blockedShellHtml }
      }

      throw new Error(`Unexpected URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [HOMEPAGE_URL])
  assert.deepEqual(jobs, [])
  assertDiscoveryOnly(jobs, HOMEPAGE_URL)
})

test('Manatec Electronics fails closed when the careers surface drifts or starts exposing structured openings', async () => {
  await assert.rejects(
    createManatecElectronicsScraper().run({
      fetchPage: async (url) => {
        if (url === HOMEPAGE_URL) {
          return { status: 200, url, html: homepageHtml }
        }

        if (url === PAGE_SITEMAP_URL) {
          return { status: 200, url, html: pageSitemapXml }
        }

        if (url === CAREERS_URL) {
          return {
            status: 200,
            url,
            html: '<html><body><h1>Current openings</h1><a href="/jobs/design-engineer">View Details</a></body></html>',
          }
        }

        if (url === MISSING_ROUTE_URL) {
          return { status: 404, url, html: missingRouteHtml }
        }

        throw new Error(`Unexpected URL: ${url}`)
      },
    }),
    /application-only/i,
  )

  const requestedUrls = []
  // The historical missing-route input stays below as an unvisited route and
  // a direct negative helper control, never as evidence of complete inventory.
  const jobs = await createManatecElectronicsScraper().run({
      fetchPage: async (url) => {
        requestedUrls.push(url)
        if (url === HOMEPAGE_URL) {
          return { status: 200, url, html: homepageHtml }
        }

        if (url === PAGE_SITEMAP_URL) {
          return { status: 200, url, html: pageSitemapXml }
        }

        if (url === CAREERS_URL) {
          return { status: 200, url, html: careersHtml }
        }

        if (url === MISSING_ROUTE_URL) {
          return { status: 200, url, html: careersHtml }
        }

        throw new Error(`Unexpected URL: ${url}`)
      },
    })
  assert.deepEqual(requestedUrls, [HOMEPAGE_URL, CAREERS_URL])
  assert.equal(isVerifiedMissingRoute({ status: 200, url: MISSING_ROUTE_URL, html: careersHtml }), false)
  assertDiscoveryOnly(jobs, CAREERS_URL)
})

test('Manatec Electronics retries the public site through the www host when the canonical host connect-times out', async () => {
  const requestedUrls = []
  const timeoutError = new TypeError('fetch failed')
  timeoutError.cause = { code: 'UND_ERR_CONNECT_TIMEOUT' }

  const snapshot = await fetchPageWithWwwFallback(HOMEPAGE_URL, {
    fetchImpl: async (url) => {
      requestedUrls.push(url)

      if (url === HOMEPAGE_URL) {
        throw timeoutError
      }

      assert.equal(url, 'https://www.manatec.in/')

      return {
        status: 200,
        url: HOMEPAGE_URL,
        text: async () => homepageHtml,
      }
    },
  })

  assert.deepEqual(requestedUrls, [
    'https://manatec.in/',
    'https://www.manatec.in/',
  ])
  assert.equal(snapshot.status, 200)
  assert.equal(snapshot.url, HOMEPAGE_URL)
  assert.equal(snapshot.html, homepageHtml)
})

test('Manatec homepage identity drift stays an error before any careers or legacy route read', async () => {
  const requestedUrls = []
  await assert.rejects(createManatecElectronicsScraper().run({ fetchPage: async url => {
    requestedUrls.push(url)
    return { status: 200, url, html: homepageHtml.replace('Manatec Group of Companies', '') }
  } }), /homepage no longer matches/)
  assert.deepEqual(requestedUrls, [HOMEPAGE_URL])
})
