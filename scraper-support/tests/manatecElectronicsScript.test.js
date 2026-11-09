import assert from 'node:assert/strict'
import test from 'node:test'

import { readInventoryEvidence } from '../utils/inventoryEvidence.js'

import {
  CAREERS_URL,
  COMPANY,
  DEFAULT_FETCH_TIMEOUT_MS,
  EXPECTED_DEPARTMENTS,
  HOMEPAGE_URL,
  MISSING_ROUTE_URL,
  PAGE_SITEMAP_URL,
  SOURCE,
  createManatecElectronicsScraper,
  extractDepartmentOptions,
  hasApplicationOnlyCareersSignal,
  hasOfficialHomepageSignal,
  hasVerifiedPageSitemapSignal,
  isVerifiedMissingRoute,
} from '../../scraper/manatecelectronics/script.js'

const homepageHtml = `
  <html>
    <head>
      <title>MANATEC &#8211; ALIGNED TO EXCELLENCE</title>
    </head>
    <body>
      <nav>
        <a href="/career/">Career</a>
      </nav>
      <section>
        <h2>Manatec Group of Companies</h2>
        <p>Trusted in 70+ countries</p>
        <p>Garage Equipment</p>
        <p>We work for you since 1987</p>
        <p>Industrial Shaft Alignment Systems</p>
        <p>Automotive Aftermarket Equipment Industry in 1991</p>
      </section>
    </body>
  </html>
`

const pageSitemapXml = `
  <?xml version="1.0" encoding="UTF-8"?>
  <urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
    <url><loc>https://manatec.in/</loc></url>
    <url><loc>https://manatec.in/career/</loc></url>
  </urlset>
`

const careersHtml = `
  <html>
    <head>
      <title>Career &#8211; MANATEC</title>
    </head>
    <body>
      <section>
        <h1>Opportunities</h1>
        <p>At Manatec, we believe that our greatest asset is our people.</p>
        <p>We are always on the lookout for passionate, innovative, and talented individuals who are eager to make a difference.</p>
        <p>Whether you are a seasoned professional or just starting your career, we offer exciting opportunities for growth and development in a collaborative environment.</p>
      </section>
      <form>
        <select name="department">
          ${EXPECTED_DEPARTMENTS.map((department) => `<option value="${department}">${department}</option>`).join('')}
        </select>
        <label>Upload Resume / CV</label>
        <label>Message</label>
        <button type="submit">Send</button>
      </form>
    </body>
  </html>
`

const missingRouteHtml = `
  <html>
    <head>
      <title>Page not found &#8211; MANATEC</title>
    </head>
    <body>
      <h1>404</h1>
      <p>Opps! The page you requested was not found.</p>
      <a href="https://manatec.in/">Back to homepage</a>
    </body>
  </html>
`

test('Manatec Electronics recognizes the verified homepage, sitemap, current careers form surface, and missing route', () => {
  assert.equal(SOURCE, 'manatecelectronics')
  assert.equal(COMPANY, 'Manatec Electronics Private Limited')
  assert.equal(HOMEPAGE_URL, 'https://manatec.in/')
  assert.equal(CAREERS_URL, 'https://manatec.in/career/')
  assert.equal(PAGE_SITEMAP_URL, 'https://manatec.in/wp-sitemap-posts-page-1.xml')
  assert.equal(MISSING_ROUTE_URL, 'https://manatec.in/join-us')
  assert.equal(DEFAULT_FETCH_TIMEOUT_MS, 15000)
  assert.equal(hasOfficialHomepageSignal(homepageHtml), true)
  assert.equal(hasVerifiedPageSitemapSignal(pageSitemapXml), true)
  assert.equal(hasApplicationOnlyCareersSignal(careersHtml), true)
  assert.deepEqual(extractDepartmentOptions(careersHtml), EXPECTED_DEPARTMENTS)
  assert.equal(
    isVerifiedMissingRoute({
      status: 404,
      html: missingRouteHtml,
    }),
    true,
  )
})

test('Manatec Electronics returns discovery-only evidence for the verified application-only form', async () => {
  const requestedUrls = []

  const jobs = await createManatecElectronicsScraper({
    now: () => '2026-09-14T00:00:00.000Z',
  }).run({
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
  const evidence = readInventoryEvidence(jobs)
  assert.equal(evidence?.status, 'discovery-only')
  assert.equal(evidence?.surface, CAREERS_URL)
  assert.equal(evidence?.listingComplete, false)
})

test('Manatec Electronics returns discovery-only evidence on the first unavailable route without requesting more blocked surfaces', async () => {
  const requestedUrls = []

  const jobs = await createManatecElectronicsScraper({
    now: () => '2026-09-14T00:00:00.000Z',
  }).run({
    fetchPage: async (url) => {
      requestedUrls.push(url)

      if (url === HOMEPAGE_URL) {
        throw new Error('fetch failed | Connect Timeout Error (attempted address: manatec.in:443, timeout: 10000ms)')
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

  assert.deepEqual(requestedUrls, [HOMEPAGE_URL])
  assert.deepEqual(jobs, [])
  const evidence = readInventoryEvidence(jobs)
  assert.equal(evidence?.status, 'discovery-only')
  assert.equal(evidence?.surface, HOMEPAGE_URL)
  assert.equal(evidence?.listingComplete, false)
})

test('Manatec Electronics fails closed when the careers page drifts into a public jobs surface', async () => {
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
            html: careersHtml.replace(
              '</form>',
              '<a href="/career/openings">Current openings</a><button>Apply now</button></form>',
            ),
          }
        }

        return { status: 404, url, html: missingRouteHtml }
      },
    }),
    /careers page no longer matches the verified application-only public surface/i,
  )
})
