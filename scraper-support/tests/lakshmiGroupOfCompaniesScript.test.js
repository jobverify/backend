import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

const fixturesDir = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  'fixtures',
  'lakshmigroupofcompanies',
)

const readFixture = (name) => readFileSync(path.join(fixturesDir, name), 'utf8')

const HOMEPAGE_HTML = readFixture('homepage.html')
const MISSING_ROUTE_HTML = readFixture('missing-route-404.html')

const loadModule = async () => {
  try {
    return await import('../../scraper/lakshmigroupofcompanies/script.js')
  } catch {
    assert.fail(
      'Expected Lakshmi Group of Companies scraper module at ../../scraper/lakshmigroupofcompanies/script.js',
    )
  }
}

test('Lakshmi Group of Companies scraper recognizes the verified homepage and first-party missing-route careers surfaces', async () => {
  const lakshmi = await loadModule()

  assert.equal(lakshmi.SOURCE, 'lakshmigroupofcompanies')
  assert.equal(lakshmi.COMPANY, 'Lakshmi Group of Companies')
  assert.equal(lakshmi.HOMEPAGE_URL, 'http://www.lakshmigroup.co.in/')
  assert.deepEqual(lakshmi.CAREERS_ROUTE_URLS, [
    'http://www.lakshmigroup.co.in/careers',
    'http://www.lakshmigroup.co.in/career',
    'http://www.lakshmigroup.co.in/jobs',
    'http://www.lakshmigroup.co.in/join-us',
  ])
  assert.equal(lakshmi.hasOfficialHomepageSignal(HOMEPAGE_HTML), true)
  assert.equal(lakshmi.hasFirstPartyCareerLikeLink(HOMEPAGE_HTML), false)
  assert.equal(lakshmi.hasPublicJobsSignal(HOMEPAGE_HTML), false)
  assert.equal(
    lakshmi.isVerifiedMissingCareersRoute({
      status: 404,
      html: MISSING_ROUTE_HTML,
    }),
    true,
  )
  assert.equal(
    lakshmi.isVerifiedMissingCareersRoute({
      status: 200,
      html: MISSING_ROUTE_HTML,
    }),
    false,
  )
})

test('Lakshmi Group of Companies returns no jobs only while the verified homepage and missing-route careers surfaces remain unchanged', async () => {
  const lakshmi = await loadModule()
  const requestedUrls = []

  const jobs = await lakshmi.createLakshmiGroupOfCompaniesScraper().run({
    fetchPage: async (url) => {
      requestedUrls.push(url)

      if (url === lakshmi.HOMEPAGE_URL) {
        return {
          status: 200,
          url,
          headers: {},
          html: HOMEPAGE_HTML,
        }
      }

      if (lakshmi.CAREERS_ROUTE_URLS.includes(url)) {
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

  assert.deepEqual(requestedUrls, [lakshmi.HOMEPAGE_URL, ...lakshmi.CAREERS_ROUTE_URLS])
  assert.deepEqual(jobs, [])
})

test('Lakshmi Group of Companies fails closed when the verified homepage or missing-route careers surfaces drift', async () => {
  const lakshmi = await loadModule()

  await assert.rejects(
    lakshmi.createLakshmiGroupOfCompaniesScraper().run({
      fetchPage: async (url) => {
        if (url === lakshmi.HOMEPAGE_URL) {
          return {
            status: 200,
            url,
            headers: {},
            html: '<html><head><title>Unexpected</title></head><body>No Lakshmi markers</body></html>',
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
    /Lakshmi Group of Companies verified official homepage no longer matches the known public surface/i,
  )

  await assert.rejects(
    lakshmi.createLakshmiGroupOfCompaniesScraper().run({
      fetchPage: async (url) => {
        if (url === lakshmi.HOMEPAGE_URL) {
          return {
            status: 200,
            url,
            headers: {},
            html: HOMEPAGE_HTML,
          }
        }

        if (url === lakshmi.CAREERS_ROUTE_URLS[0]) {
          return {
            status: 200,
            url,
            headers: {},
            html: '<html><body><h1>Careers</h1><a href="/jobs/sales-executive">Apply now</a></body></html>',
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
    /Lakshmi Group of Companies careers routes changed materially or now expose public jobs/i,
  )
})
