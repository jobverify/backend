import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

const loadModule = async () => {
  try {
    return await import('./script.js')
  } catch {
    return null
  }
}

const readFixture = (name) =>
  fs.readFileSync(path.join(currentDir, 'fixtures', name), 'utf8')

const homepageHtml = readFixture('homepage.html')
const careersHtml = readFixture('careers.html')

test('YelloSKYE constants and helpers stay pinned to the verified official redirect and first-party shell contract', async () => {
  const yelloskye = await loadModule()
  assert.ok(yelloskye, 'YelloSKYE scraper module should load')

  assert.equal(yelloskye.SOURCE, 'yelloskye')
  assert.equal(yelloskye.COMPANY, 'YelloSKYE')
  assert.equal(yelloskye.HOMEPAGE_URL, 'https://yelloskye.com/')
  assert.equal(yelloskye.CAREERS_URL, 'https://yelloskye.com/careers/')
  assert.deepEqual(yelloskye.CAREERS_ROUTE_URLS, [
    'https://yelloskye.com/careers/',
    'https://yelloskye.com/career/',
    'https://yelloskye.com/jobs/',
  ])
  assert.equal(yelloskye.CANONICAL_HOMEPAGE_URL, 'https://www.yelloskye.ai/')
  assert.deepEqual(yelloskye.CANONICAL_CAREERS_ROUTE_URLS, [
    'https://www.yelloskye.ai/careers/',
    'https://www.yelloskye.ai/career/',
    'https://www.yelloskye.ai/jobs/',
  ])
  assert.equal(yelloskye.hasVerifiedAppShell(homepageHtml), true)
  assert.equal(yelloskye.hasVerifiedAppShell(careersHtml), true)
  assert.equal(yelloskye.hasPublicJobSignals(homepageHtml), false)
  assert.equal(yelloskye.hasPublicJobSignals(careersHtml), false)
})

test('YelloSKYE returns an empty discovery snapshot while the verified official homepage and careers-like routes stay on the same first-party app shell', async () => {
  const yelloskye = await loadModule()
  assert.ok(yelloskye, 'YelloSKYE scraper module should load')

  const requestedUrls = []
  const jobs = await yelloskye.createYelloSkyeScraper().run({
    fetchPage: async (url) => {
      requestedUrls.push(url)

      if (url === yelloskye.HOMEPAGE_URL) {
        return {
          status: 200,
          url: yelloskye.CANONICAL_HOMEPAGE_URL,
          html: homepageHtml,
        }
      }

      if (url === yelloskye.CAREERS_URL) {
        return {
          status: 200,
          url: 'https://www.yelloskye.ai/careers/',
          html: careersHtml,
        }
      }

      if (url === 'https://yelloskye.com/career/') {
        return {
          status: 200,
          url: 'https://www.yelloskye.ai/career/',
          html: careersHtml,
        }
      }

      if (url === 'https://yelloskye.com/jobs/') {
        return {
          status: 200,
          url: 'https://www.yelloskye.ai/jobs/',
          html: careersHtml,
        }
      }

      throw new Error(`Unexpected YelloSKYE URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [
    yelloskye.HOMEPAGE_URL,
    yelloskye.CAREERS_URL,
    'https://yelloskye.com/career/',
    'https://yelloskye.com/jobs/',
  ])
  assert.deepEqual(jobs, [])
})

test('YelloSKYE fails closed when the redirect target, app shell, or no-public-jobs contract drifts', async () => {
  const yelloskye = await loadModule()
  assert.ok(yelloskye, 'YelloSKYE scraper module should load')

  await assert.rejects(
    yelloskye.createYelloSkyeScraper().run({
      fetchPage: async () => ({
        status: 200,
        url: 'https://www.yelloskye.ai/',
        html: '<html><body><h1>Unexpected page</h1></body></html>',
      }),
    }),
    /official homepage/i,
  )

  await assert.rejects(
    yelloskye.createYelloSkyeScraper().run({
      fetchPage: async (url) => {
        if (url === yelloskye.HOMEPAGE_URL) {
          return {
            status: 200,
            url: yelloskye.CANONICAL_HOMEPAGE_URL,
            html: homepageHtml,
          }
        }

        return {
          status: 200,
          url: 'https://www.example.com/careers/',
          html: careersHtml,
        }
      },
    }),
    /verified careers-like route/i,
  )

  await assert.rejects(
    yelloskye.createYelloSkyeScraper().run({
      fetchPage: async (url) => ({
        status: 200,
        url: url === yelloskye.HOMEPAGE_URL
          ? yelloskye.CANONICAL_HOMEPAGE_URL
          : `https://www.yelloskye.ai${new URL(url).pathname}`,
        html: careersHtml.replace(
          '</body>',
          '<a href="https://boards.greenhouse.io/yelloskye">Open Roles</a></body>',
        ),
      }),
    }),
    /public jobs/i,
  )
})
