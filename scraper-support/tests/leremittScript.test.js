import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

const fixturesDir = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  'fixtures',
  'leremitt',
)

const readFixture = (name) => readFileSync(path.join(fixturesDir, name), 'utf8')

const HOMEPAGE_HTML = readFixture('axodian-homepage.html')
const PRODUCT_PAGE_HTML = readFixture('leremitt-page.html')
const MISSING_ROUTE_HTML = readFixture('missing-route-404.html')
const CURRENT_HOMEPAGE_HTML = HOMEPAGE_HTML
  .replace(
    '<title>Axodian | Global Trade, Simplified</title>',
    '<title data-next-head="">Axodian | Global Trade, Simplified</title>',
  )
  .replace(
    /<p>\s*We simplify international Payments,\s*automate global trade\s*Documentation &amp; Compliance\s*<\/p>/i,
    '',
  )
const CURRENT_PRODUCT_PAGE_HTML = PRODUCT_PAGE_HTML.replace(
  '<title>LeRemitt | Cross Border Payments Platform For Exporters | Axodian</title>',
  '<title data-next-head="">LeRemitt | Cross Border Payments Platform For Exporters | Axodian</title>',
)
const CURRENT_MISSING_ROUTE_HTML = MISSING_ROUTE_HTML
  .replace('<title>404-error</title>', '')
  .replace('<h1>404-error</h1>', '<h1 class="text-gray-900 mb-4">404-error</h1>')

const loadModule = async () => {
  try {
    return await import('../../scraper/leremitt/script.js')
  } catch {
    assert.fail('Expected LeRemitt scraper module at ../../scraper/leremitt/script.js')
  }
}

test('LeRemitt scraper recognizes the verified Axodian homepage, product page, and missing-route careers surfaces', async () => {
  const leremitt = await loadModule()

  assert.equal(leremitt.SOURCE, 'leremitt')
  assert.equal(leremitt.COMPANY, 'LeRemitt')
  assert.equal(leremitt.HOMEPAGE_URL, 'https://www.axodian.com/')
  assert.equal(leremitt.PRODUCT_PAGE_URL, 'https://www.axodian.com/leremitt')
  assert.deepEqual(leremitt.CAREERS_ROUTE_URLS, [
    'https://www.axodian.com/careers',
    'https://www.axodian.com/career',
    'https://www.axodian.com/jobs',
    'https://www.axodian.com/join-us',
    'https://www.axodian.com/work-with-us',
  ])
  assert.equal(leremitt.hasOfficialHomepageSignal(HOMEPAGE_HTML), true)
  assert.equal(leremitt.hasOfficialHomepageSignal(CURRENT_HOMEPAGE_HTML), true)
  assert.equal(leremitt.hasOfficialProductPageSignal(PRODUCT_PAGE_HTML), true)
  assert.equal(leremitt.hasOfficialProductPageSignal(CURRENT_PRODUCT_PAGE_HTML), true)
  assert.equal(leremitt.hasFirstPartyCareerLikeLink(HOMEPAGE_HTML), false)
  assert.equal(leremitt.hasFirstPartyCareerLikeLink(PRODUCT_PAGE_HTML), false)
  assert.equal(leremitt.hasPublicJobsSignal(HOMEPAGE_HTML), false)
  assert.equal(leremitt.hasPublicJobsSignal(PRODUCT_PAGE_HTML), false)
  assert.equal(
    leremitt.isVerifiedMissingCareersRoute({
      status: 404,
      html: MISSING_ROUTE_HTML,
    }),
    true,
  )
  assert.equal(
    leremitt.isVerifiedMissingCareersRoute({
      status: 404,
      html: CURRENT_MISSING_ROUTE_HTML,
    }),
    true,
  )
  assert.equal(
    leremitt.isVerifiedMissingCareersRoute({
      status: 200,
      html: MISSING_ROUTE_HTML,
    }),
    false,
  )
})

test('LeRemitt returns no jobs only while the verified Axodian homepage, product page, and missing careers routes remain unchanged', async () => {
  const leremitt = await loadModule()
  const requestedUrls = []

  const jobs = await leremitt.createLeRemittScraper().run({
    fetchPage: async (url) => {
      requestedUrls.push(url)

      if (url === leremitt.HOMEPAGE_URL) {
        return {
          status: 200,
          url,
          headers: {},
          html: HOMEPAGE_HTML,
        }
      }

      if (url === leremitt.PRODUCT_PAGE_URL) {
        return {
          status: 200,
          url,
          headers: {},
          html: PRODUCT_PAGE_HTML,
        }
      }

      if (leremitt.CAREERS_ROUTE_URLS.includes(url)) {
        return {
          status: 404,
          url,
          headers: {},
          html: MISSING_ROUTE_HTML,
        }
      }

      throw new Error(`Unexpected URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [
    leremitt.HOMEPAGE_URL,
    leremitt.PRODUCT_PAGE_URL,
    ...leremitt.CAREERS_ROUTE_URLS,
  ])
  assert.deepEqual(jobs, [])
})

test('LeRemitt fails closed when the verified homepage, product page, or parent careers routes drift', async () => {
  const leremitt = await loadModule()

  await assert.rejects(
    leremitt.createLeRemittScraper().run({
      fetchPage: async (url) => {
        if (url === leremitt.HOMEPAGE_URL) {
          return {
            status: 200,
            url,
            headers: {},
            html: '<html><head><title>Unexpected</title></head><body>No Axodian markers</body></html>',
          }
        }

        if (url === leremitt.PRODUCT_PAGE_URL) {
          return {
            status: 200,
            url,
            headers: {},
            html: PRODUCT_PAGE_HTML,
          }
        }

        return {
          status: 404,
          url,
          headers: {},
          html: MISSING_ROUTE_HTML,
        }
      },
    }),
    /verified Axodian homepage/i,
  )

  await assert.rejects(
    leremitt.createLeRemittScraper().run({
      fetchPage: async (url) => {
        if (url === leremitt.HOMEPAGE_URL) {
          return {
            status: 200,
            url,
            headers: {},
            html: HOMEPAGE_HTML,
          }
        }

        if (url === leremitt.PRODUCT_PAGE_URL) {
          return {
            status: 200,
            url,
            headers: {},
            html: '<html><head><title>LeRemitt</title></head><body>Broken</body></html>',
          }
        }

        return {
          status: 404,
          url,
          headers: {},
          html: MISSING_ROUTE_HTML,
        }
      },
    }),
    /verified LeRemitt product page/i,
  )

  await assert.rejects(
    leremitt.createLeRemittScraper().run({
      fetchPage: async (url) => {
        if (url === leremitt.HOMEPAGE_URL) {
          return {
            status: 200,
            url,
            headers: {},
            html: HOMEPAGE_HTML,
          }
        }

        if (url === leremitt.PRODUCT_PAGE_URL) {
          return {
            status: 200,
            url,
            headers: {},
            html: PRODUCT_PAGE_HTML,
          }
        }

        if (url === leremitt.CAREERS_ROUTE_URLS[0]) {
          return {
            status: 200,
            url,
            headers: {},
            html: '<html><body><h1>Careers</h1><a href="/jobs/export-ops">Apply now</a></body></html>',
          }
        }

        return {
          status: 404,
          url,
          headers: {},
          html: MISSING_ROUTE_HTML,
        }
      },
    }),
    /careers routes changed materially or now expose public jobs/i,
  )
})
