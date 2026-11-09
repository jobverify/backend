import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const fixturesDir = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  'fixtures',
  'globalpayex',
)

const readHtmlFixture = (name) => readFileSync(path.join(fixturesDir, name), 'utf8')
const readJsonFixture = (name) => JSON.parse(readFileSync(path.join(fixturesDir, name), 'utf8'))

const verifiedHomepageHtml = readHtmlFixture('homepage.html')
const verifiedCareersRedirect = readJsonFixture('careers-route-redirect.json')
const publicJobsHtml = readHtmlFixture('careers-public-jobs.html')

const loadGlobalPayexModule = async () => {
  try {
    return await import('../../scraper/globalpayex/script.js')
  } catch {
    assert.fail('Expected Global PayEX scraper module at ../../scraper/globalpayex/script.js')
  }
}

test('Global PayEX sentinel recognizes the verified homepage, careers handoff, and broken careers route', async () => {
  const globalPayex = await loadGlobalPayexModule()

  assert.equal(globalPayex.SOURCE, 'globalpayex')
  assert.equal(globalPayex.COMPANY, 'Global PayEX')
  assert.equal(globalPayex.HOMEPAGE_URL, 'https://globalpayex.com/')
  assert.equal(globalPayex.CAREERS_HANDOFF_URL, 'https://globalpayex.com/careers/#jobs')
  assert.equal(globalPayex.CAREERS_ROUTE_URL, 'https://globalpayex.com/careers/')
  assert.equal(
    globalPayex.CAREERS_SLUG_API_URL,
    'https://globalpayex.com/wp-json/wp/v2/pages?slug=careers&per_page=20',
  )
  assert.equal(globalPayex.hasOfficialHomepageSignal(verifiedHomepageHtml), true)
  assert.equal(globalPayex.hasVerifiedCareersHandoff(verifiedHomepageHtml), true)
  assert.equal(globalPayex.hasPublicJobsSignal(verifiedHomepageHtml), false)
  assert.equal(globalPayex.hasPublicJobsSignal(publicJobsHtml), true)
  assert.equal(globalPayex.isVerifiedBrokenCareersRoute(verifiedCareersRedirect), true)
  assert.equal(globalPayex.isAbsentCareersSlugPayload([]), true)
  assert.equal(globalPayex.isAbsentCareersSlugPayload([{ id: 7880 }]), false)
})

test('Global PayEX returns no jobs only while the verified first-party empty state holds', async () => {
  const globalPayex = await loadGlobalPayexModule()
  const requestedPages = []
  const requestedJson = []

  const jobs = await globalPayex.createGlobalPayexScraper().run({
    fetchPage: async (url) => {
      requestedPages.push(url)

      if (url === globalPayex.HOMEPAGE_URL) {
        return {
          status: 200,
          url,
          headers: {},
          html: verifiedHomepageHtml,
        }
      }

      if (url === globalPayex.CAREERS_ROUTE_URL) {
        return verifiedCareersRedirect
      }

      throw new Error(`Unexpected page URL: ${url}`)
    },
    fetchJson: async (url) => {
      requestedJson.push(url)

      if (url === globalPayex.CAREERS_SLUG_API_URL) {
        return []
      }

      throw new Error(`Unexpected JSON URL: ${url}`)
    },
  })

  assert.deepEqual(requestedPages, [
    globalPayex.HOMEPAGE_URL,
    globalPayex.CAREERS_ROUTE_URL,
  ])
  assert.deepEqual(requestedJson, [globalPayex.CAREERS_SLUG_API_URL])
  assert.deepEqual(jobs, [])
})

test('Global PayEX fails closed when the homepage changes, the careers route resolves, or a careers page appears', async () => {
  const globalPayex = await loadGlobalPayexModule()

  await assert.rejects(
    globalPayex.createGlobalPayexScraper().run({
      fetchPage: async (url) => {
        if (url === globalPayex.HOMEPAGE_URL) {
          return { status: 200, url, headers: {}, html: '<html><title>Unexpected</title></html>' }
        }

        return verifiedCareersRedirect
      },
      fetchJson: async () => [],
    }),
    /verified official homepage/i,
  )

  await assert.rejects(
    globalPayex.createGlobalPayexScraper().run({
      fetchPage: async (url) => {
        if (url === globalPayex.HOMEPAGE_URL) {
          return { status: 200, url, headers: {}, html: verifiedHomepageHtml }
        }

        if (url === globalPayex.CAREERS_ROUTE_URL) {
          return { status: 200, url, headers: {}, html: publicJobsHtml }
        }

        throw new Error(`Unexpected page URL: ${url}`)
      },
      fetchJson: async () => [],
    }),
    /careers route changed materially or now exposes public jobs/i,
  )

  await assert.rejects(
    globalPayex.createGlobalPayexScraper().run({
      fetchPage: async (url) => {
        if (url === globalPayex.HOMEPAGE_URL) {
          return { status: 200, url, headers: {}, html: verifiedHomepageHtml }
        }

        if (url === globalPayex.CAREERS_ROUTE_URL) {
          return verifiedCareersRedirect
        }

        throw new Error(`Unexpected page URL: ${url}`)
      },
      fetchJson: async () => [{ id: 7880, slug: 'careers' }],
    }),
    /careers slug api no longer matches the verified absent-page state/i,
  )
})
