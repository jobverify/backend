import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const fixturesDir = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../scraper/mayacardio/fixtures',
)

const readHtmlFixture = (name) => readFileSync(path.join(fixturesDir, name), 'utf8')

const verifiedHomepageHtml = readHtmlFixture('homepage.html')
const verifiedCareersHtml = readHtmlFixture('careers.html')

const loadMayacardioModule = async () => {
  try {
    return await import('../../scraper/mayacardio/script.js')
  } catch {
    assert.fail('Expected MayaCardio scraper module at ../../scraper/mayacardio/script.js')
  }
}

test('MayaCardio validates the verified homepage and first-party careers/jobs routes', async () => {
  const mayacardio = await loadMayacardioModule()

  assert.equal(mayacardio.SOURCE, 'mayacardio')
  assert.equal(mayacardio.COMPANY, 'MayaCardio')
  assert.equal(mayacardio.HOMEPAGE_URL, 'https://mayacardio.com/')
  assert.deepEqual(mayacardio.NO_PUBLIC_CAREERS_ROUTE_URLS, [
    'https://mayacardio.com/careers',
    'https://mayacardio.com/jobs',
  ])
  assert.equal(mayacardio.hasOfficialHomepageSignal(verifiedHomepageHtml), true)
  assert.equal(mayacardio.hasPublicJobsSignal(verifiedHomepageHtml), false)
  assert.equal(mayacardio.hasPublicJobsSignal(verifiedCareersHtml), false)
})

test('MayaCardio returns no jobs while the verified homepage and careers/jobs routes remain unchanged', async () => {
  const mayacardio = await loadMayacardioModule()
  const requestedUrls = []

  const jobs = await mayacardio.createMayacardioScraper().run({
    fetchPage: async (url) => {
      requestedUrls.push(url)

      if (url === mayacardio.HOMEPAGE_URL) {
        return {
          status: 200,
          url,
          headers: {},
          html: verifiedHomepageHtml,
        }
      }

      if (mayacardio.NO_PUBLIC_CAREERS_ROUTE_URLS.includes(url)) {
        return {
          status: 200,
          url,
          headers: {},
          html: verifiedCareersHtml,
        }
      }

      throw new Error(`Unexpected fixture URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [
    mayacardio.HOMEPAGE_URL,
    ...mayacardio.NO_PUBLIC_CAREERS_ROUTE_URLS,
  ])
  assert.deepEqual(jobs, [])
})

test('MayaCardio fails closed when the homepage or careers/jobs contract changes', async () => {
  const mayacardio = await loadMayacardioModule()

  await assert.rejects(
    mayacardio.createMayacardioScraper().run({
      fetchPage: async (url) => {
        if (url === mayacardio.HOMEPAGE_URL) {
          return {
            status: 200,
            url,
            headers: {},
            html: '<html><head><title>Unexpected</title></head><body></body></html>',
          }
        }

        return {
          status: 200,
          url,
          headers: {},
          html: verifiedCareersHtml,
        }
      },
    }),
    /verified official homepage/i,
  )

  await assert.rejects(
    mayacardio.createMayacardioScraper().run({
      fetchPage: async (url) => {
        if (url === mayacardio.HOMEPAGE_URL) {
          return {
            status: 200,
            url,
            headers: {},
            html: verifiedHomepageHtml,
          }
        }

        return {
          status: 200,
          url,
          headers: {},
          html: '<html><body><h1>Open positions</h1><a href="/jobs/engineer">Apply now</a></body></html>',
        }
      },
    }),
    /careers\/jobs routes changed materially or now expose public jobs/i,
  )
})
