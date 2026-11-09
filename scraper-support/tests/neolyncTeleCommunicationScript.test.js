import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const fixturesDir = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  'fixtures',
  'neolynctelecommunication',
)

const readFixture = (name) => readFileSync(path.join(fixturesDir, name), 'utf8')

const loadNeolyncModule = async () => {
  try {
    return await import('../../scraper/neolynctelecommunication/script.js')
  } catch {
    assert.fail('Expected NeoLync scraper module at ../../scraper/neolynctelecommunication/script.js')
  }
}

const verifiedHomepageHtml = readFixture('homepage.html')
const verifiedZeroJobRouteHtml = '<html><head><title>404 Not Found</title></head><body>Not Found</body></html>'
const expectedPublicJobRouteUrls = [
  'https://neolync.com/careers',
  'https://neolync.com/careers/',
  'https://neolync.com/career',
  'https://neolync.com/career/',
  'https://neolync.com/jobs',
  'https://neolync.com/jobs/',
  'https://neolync.com/join-us',
  'https://neolync.com/join-us/',
  'https://neolync.com/work-with-us',
  'https://neolync.com/work-with-us/',
]

test('NeoLync recognizes the verified homepage careers-email contract and public-jobs route list', async () => {
  const neolync = await loadNeolyncModule()

  assert.equal(neolync.SOURCE, 'neolynctelecommunication')
  assert.equal(neolync.COMPANY, 'NeoLync')
  assert.equal(neolync.HOMEPAGE_URL, 'https://neolync.com/')
  assert.deepEqual(neolync.PUBLIC_JOB_ROUTE_URLS, expectedPublicJobRouteUrls)
  assert.equal(neolync.hasOfficialHomepageSignal(verifiedHomepageHtml), true)
  assert.equal(neolync.hasInlineCareersBlockSignal(verifiedHomepageHtml), true)
  assert.equal(neolync.hasPublicJobsSignal(verifiedHomepageHtml), false)
})

test('NeoLync returns no jobs while the verified homepage careers block stays unchanged and public jobs routes remain 404', async () => {
  const neolync = await loadNeolyncModule()
  const requestedUrls = []

  const jobs = await neolync.createNeolyncTeleCommunicationScraper().run({
    fetchPage: async (url) => {
      requestedUrls.push(url)

      if (url === neolync.HOMEPAGE_URL) {
        return {
          status: 200,
          url,
          html: verifiedHomepageHtml,
        }
      }

      if (neolync.PUBLIC_JOB_ROUTE_URLS.includes(url)) {
        return {
          status: 404,
          url,
          html: verifiedZeroJobRouteHtml,
        }
      }

      throw new Error(`Unexpected URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [neolync.HOMEPAGE_URL, ...neolync.PUBLIC_JOB_ROUTE_URLS])
  assert.deepEqual(jobs, [])
})

test('NeoLync fails closed when the verified homepage careers block changes materially or a public jobs route appears', async () => {
  const neolync = await loadNeolyncModule()

  await assert.rejects(
    neolync.createNeolyncTeleCommunicationScraper().run({
      fetchPage: async (url) => {
        if (url === neolync.HOMEPAGE_URL) {
          return {
            status: 200,
            url,
            html: '<html><head><title>Unexpected</title></head><body>No NeoLync signals</body></html>',
          }
        }

        return {
          status: 404,
          url,
          html: verifiedZeroJobRouteHtml,
        }
      },
    }),
    /verified official homepage/i,
  )

  await assert.rejects(
    neolync.createNeolyncTeleCommunicationScraper().run({
      fetchPage: async (url) => {
        if (url === neolync.HOMEPAGE_URL) {
          return {
            status: 200,
            url,
            html: '<html><head><title>NeoLync</title></head><body>Electronic Product Creation Reimagined contact@neolync.com State-of-the-art 90k+ sq ft manufacturing facility</body></html>',
          }
        }

        return {
          status: 404,
          url,
          html: verifiedZeroJobRouteHtml,
        }
      },
    }),
    /verified inline careers block/i,
  )

  await assert.rejects(
    neolync.createNeolyncTeleCommunicationScraper().run({
      fetchPage: async (url) => {
        if (url === neolync.HOMEPAGE_URL) {
          return {
            status: 200,
            url,
            html: verifiedHomepageHtml,
          }
        }

        if (url === neolync.PUBLIC_JOB_ROUTE_URLS[0]) {
          return {
            status: 200,
            url,
            html: '<html><body><h1>Current Openings</h1><a href="/apply">Apply now</a></body></html>',
          }
        }

        return {
          status: 404,
          url,
          html: verifiedZeroJobRouteHtml,
        }
      },
    }),
    /verified 404 zero-job state/i,
  )
})
