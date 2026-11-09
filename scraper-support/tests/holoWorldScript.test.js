import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const fixturesDir = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../scraper/holoworld/fixtures',
)

const readHtmlFixture = (name) => readFileSync(path.join(fixturesDir, name), 'utf8')

const verifiedHomepageHtml = readHtmlFixture('homepage.html')
const verifiedCareers404Html = readHtmlFixture('careers-404.html')

const loadHoloWorldModule = async () => {
  try {
    return await import('../../scraper/holoworld/script.js')
  } catch {
    assert.fail('Expected HoloWorld scraper module at ../../scraper/holoworld/script.js')
  }
}

test('HoloWorld validates the verified homepage and branded missing careers routes', async () => {
  const holoWorld = await loadHoloWorldModule()

  assert.equal(holoWorld.SOURCE, 'holoworld')
  assert.equal(holoWorld.COMPANY, 'HoloWorld')
  assert.equal(holoWorld.HOMEPAGE_URL, 'https://holoworld.com/')
  assert.deepEqual(holoWorld.CAREERS_ROUTE_URLS, [
    'https://holoworld.com/careers',
    'https://holoworld.com/careers/',
    'https://holoworld.com/career',
    'https://holoworld.com/career/',
    'https://holoworld.com/jobs',
    'https://holoworld.com/jobs/',
  ])
  assert.equal(holoWorld.hasOfficialHomepageSignal(verifiedHomepageHtml), true)
  assert.equal(holoWorld.hasPublicJobsSignal(verifiedHomepageHtml), false)
  assert.equal(
    holoWorld.isVerifiedMissingCareersRoute({
      status: 404,
      url: holoWorld.CAREERS_ROUTE_URLS[0],
      headers: {},
      html: verifiedCareers404Html,
    }),
    true,
  )
  assert.equal(
    holoWorld.isVerifiedMissingCareersRoute({
      status: 200,
      url: holoWorld.CAREERS_ROUTE_URLS[0],
      headers: {},
      html: '<html><body><h1>Careers</h1><a href="https://jobs.lever.co/holoworld">Open positions</a></body></html>',
    }),
    false,
  )
})

test('HoloWorld returns no jobs only while the verified homepage and missing careers routes remain unchanged', async () => {
  const holoWorld = await loadHoloWorldModule()
  const requestedUrls = []

  const jobs = await holoWorld.createHoloWorldScraper().run({
    fetchPage: async (url) => {
      requestedUrls.push(url)

      if (url === holoWorld.HOMEPAGE_URL) {
        return {
          status: 200,
          url,
          headers: {},
          html: verifiedHomepageHtml,
        }
      }

      if (holoWorld.CAREERS_ROUTE_URLS.includes(url)) {
        return {
          status: 404,
          url,
          headers: {},
          html: verifiedCareers404Html,
        }
      }

      throw new Error(`Unexpected fixture URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [
    holoWorld.HOMEPAGE_URL,
    ...holoWorld.CAREERS_ROUTE_URLS,
  ])
  assert.deepEqual(jobs, [])
})

test('HoloWorld fails closed when the homepage or missing careers route contract changes', async () => {
  const holoWorld = await loadHoloWorldModule()

  await assert.rejects(
    holoWorld.createHoloWorldScraper().run({
      fetchPage: async (url) => {
        if (url === holoWorld.HOMEPAGE_URL) {
          return {
            status: 200,
            url,
            headers: {},
            html: '<html><body><h1>Unexpected homepage</h1></body></html>',
          }
        }

        return {
          status: 404,
          url,
          headers: {},
          html: verifiedCareers404Html,
        }
      },
    }),
    /verified official homepage/i,
  )

  await assert.rejects(
    holoWorld.createHoloWorldScraper().run({
      fetchPage: async (url) => {
        if (url === holoWorld.HOMEPAGE_URL) {
          return {
            status: 200,
            url,
            headers: {},
            html: `${verifiedHomepageHtml}<a href="https://boards.greenhouse.io/holoworld">Open positions</a>`,
          }
        }

        return {
          status: 404,
          url,
          headers: {},
          html: verifiedCareers404Html,
        }
      },
    }),
    /homepage now appears to expose a public jobs surface/i,
  )

  await assert.rejects(
    holoWorld.createHoloWorldScraper().run({
      fetchPage: async (url) => {
        if (url === holoWorld.HOMEPAGE_URL) {
          return {
            status: 200,
            url,
            headers: {},
            html: verifiedHomepageHtml,
          }
        }

        if (url === holoWorld.CAREERS_ROUTE_URLS[0]) {
          return {
            status: 200,
            url,
            headers: {},
            html: '<html><body><h1>Careers</h1><a href="https://jobs.lever.co/holoworld">Open positions</a></body></html>',
          }
        }

        return {
          status: 404,
          url,
          headers: {},
          html: verifiedCareers404Html,
        }
      },
    }),
    /careers routes changed materially or now expose public jobs/i,
  )
})
