import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const fixturesDir = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  'fixtures',
  'indianshades',
)

const readFixture = (name) => readFileSync(path.join(fixturesDir, name), 'utf8')

const verifiedHomepageHtml = readFixture('homepage.html')
const verifiedLanderHtml = readFixture('lander.html')

const loadIndianShadesModule = async () => {
  try {
    return await import('../../scraper/indianshades/script.js')
  } catch {
    assert.fail('Expected Indian Shades scraper module at ../../scraper/indianshades/script.js')
  }
}

test('Indian Shades sentinels recognize the verified redirect shell and parked lander surface', async () => {
  const indianshades = await loadIndianShadesModule()

  assert.equal(indianshades.SOURCE, 'indianshades')
  assert.equal(indianshades.COMPANY, 'Indian Shades')
  assert.equal(indianshades.HOMEPAGE_URL, 'http://indianshades.in/')
  assert.equal(indianshades.LANDER_URL, 'http://indianshades.in/lander')
  assert.deepEqual(indianshades.CHECKED_ROUTE_URLS, [
    'http://indianshades.in/careers',
    'http://indianshades.in/career',
    'http://indianshades.in/jobs',
    'http://indianshades.in/join-us',
  ])
  assert.equal(indianshades.hasRedirectShellSignal(verifiedHomepageHtml), true)
  assert.equal(indianshades.extractRedirectTarget(verifiedHomepageHtml), '/lander')
  assert.equal(indianshades.hasParkedLanderSignal(verifiedLanderHtml), true)
  assert.equal(indianshades.hasPublicJobsSignal(verifiedHomepageHtml), false)
  assert.equal(indianshades.hasPublicJobsSignal(verifiedLanderHtml), false)
})

test('Indian Shades returns no jobs only while the official domain remains a parked first-party shell', async () => {
  const indianshades = await loadIndianShadesModule()
  const requestedUrls = []

  const jobs = await indianshades.createIndianShadesScraper().run({
    fetchPage: async (url) => {
      requestedUrls.push(url)

      if (url === indianshades.HOMEPAGE_URL || indianshades.CHECKED_ROUTE_URLS.includes(url)) {
        return {
          status: 200,
          url,
          html: verifiedHomepageHtml,
        }
      }

      if (url === indianshades.LANDER_URL) {
        return {
          status: 200,
          url,
          html: verifiedLanderHtml,
        }
      }

      throw new Error(`Unexpected page URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [
    indianshades.HOMEPAGE_URL,
    ...indianshades.CHECKED_ROUTE_URLS,
    indianshades.LANDER_URL,
  ])
  assert.deepEqual(jobs, [])
})

test('Indian Shades fails closed when a checked route diverges or the parked shell changes materially', async () => {
  const indianshades = await loadIndianShadesModule()

  await assert.rejects(
    indianshades.createIndianShadesScraper().run({
      fetchPage: async (url) => {
        if (url === indianshades.LANDER_URL) {
          return { status: 200, url, html: verifiedLanderHtml }
        }

        return {
          status: 200,
          url,
          html: '<html><head><title>Unexpected</title></head><body>Different</body></html>',
        }
      },
    }),
    /verified redirect shell/i,
  )

  await assert.rejects(
    indianshades.createIndianShadesScraper().run({
      fetchPage: async (url) => {
        if (url === indianshades.HOMEPAGE_URL) {
          return { status: 200, url, html: verifiedHomepageHtml }
        }

        if (url === indianshades.CHECKED_ROUTE_URLS[0]) {
          return {
            status: 200,
            url,
            html: '<html><body><h1>Careers</h1><a href="/apply">Apply now</a></body></html>',
          }
        }

        if (url === indianshades.LANDER_URL) {
          return { status: 200, url, html: verifiedLanderHtml }
        }

        return { status: 200, url, html: verifiedHomepageHtml }
      },
    }),
    /checked first-party route changed/i,
  )

  await assert.rejects(
    indianshades.createIndianShadesScraper().run({
      fetchPage: async (url) => {
        if (url === indianshades.LANDER_URL) {
          return {
            status: 200,
            url,
            html: '<html><body><h1>Open roles</h1><a href="/jobs">Jobs</a></body></html>',
          }
        }

        return { status: 200, url, html: verifiedHomepageHtml }
      },
    }),
    /verified parked lander surface/i,
  )
})
