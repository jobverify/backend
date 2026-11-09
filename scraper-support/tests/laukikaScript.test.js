import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

const fixturesDir = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  'fixtures',
  'laukika',
)

const readFixture = (name) => readFileSync(path.join(fixturesDir, name), 'utf8')

const HOMEPAGE_HTML = readFixture('homepage.html')
const CAREERS_HTML = readFixture('know-our-brand.html')

const loadModule = async () => {
  try {
    return await import('../../scraper/laukika/script.js')
  } catch {
    assert.fail('Expected Laukika scraper module at ../../scraper/laukika/script.js')
  }
}

test('Laukika scraper recognizes the verified homepage, brand hiring page, and homepage-redirect careers routes', async () => {
  const laukika = await loadModule()

  assert.equal(laukika.SOURCE, 'laukika')
  assert.equal(laukika.COMPANY, 'Laukika Consultancy Solutions Private Limited')
  assert.equal(laukika.HOMEPAGE_URL, 'https://www.laukika.com/')
  assert.equal(laukika.CAREERS_URL, 'https://www.laukika.com/know-our-brand/')
  assert.deepEqual(laukika.CAREERS_ROUTE_URLS, [
    'https://www.laukika.com/careers',
    'https://www.laukika.com/career',
    'https://www.laukika.com/jobs',
    'https://www.laukika.com/job',
    'https://www.laukika.com/join-us',
    'https://www.laukika.com/work-with-us',
    'https://www.laukika.com/openings',
    'https://www.laukika.com/vacancies',
  ])
  assert.equal(laukika.hasOfficialHomepageSignal(HOMEPAGE_HTML), true)
  assert.equal(laukika.hasOfficialCareersSignal(CAREERS_HTML), true)
  assert.deepEqual(laukika.extractSuspiciousPublicJobLinks(HOMEPAGE_HTML), [])
  assert.deepEqual(laukika.extractSuspiciousPublicJobLinks(CAREERS_HTML), [])
  assert.equal(
    laukika.isVerifiedHomepageRedirectRoute(
      {
        status: 200,
        url: laukika.HOMEPAGE_URL,
        html: HOMEPAGE_HTML,
      },
      laukika.CAREERS_ROUTE_URLS[0],
    ),
    true,
  )
  assert.equal(
    laukika.isVerifiedHomepageRedirectRoute(
      {
        status: 200,
        url: laukika.CAREERS_ROUTE_URLS[0],
        html: HOMEPAGE_HTML,
      },
      laukika.CAREERS_ROUTE_URLS[0],
    ),
    false,
  )
})

test('Laukika tolerates the current homepage hero copy while the verified first-party contract stays the same', async () => {
  const laukika = await loadModule()
  const currentHomepageHtml = HOMEPAGE_HTML.replaceAll(
    'BEST DIGITAL MARKETING AGENCY IN BANGALORE & MYSURU',
    'TURN STORIES TO MEASURABLE SUCCESS ✦ DIGITAL MARKETING AGENCY IN BANGALORE',
  )

  assert.equal(laukika.hasOfficialHomepageSignal(currentHomepageHtml), true)
})

test('Laukika returns no jobs only while the verified first-party homepage, hiring page, and homepage-redirect routes remain unchanged', async () => {
  const laukika = await loadModule()
  const requestedUrls = []

  const jobs = await laukika.createLaukikaScraper().run({
    fetchPage: async (url) => {
      requestedUrls.push(url)

      if (url === laukika.HOMEPAGE_URL) {
        return {
          status: 200,
          url,
          headers: {},
          html: HOMEPAGE_HTML,
        }
      }

      if (url === laukika.CAREERS_URL) {
        return {
          status: 200,
          url,
          headers: {},
          html: CAREERS_HTML,
        }
      }

      if (laukika.CAREERS_ROUTE_URLS.includes(url)) {
        return {
          status: 200,
          url: laukika.HOMEPAGE_URL,
          headers: {},
          html: HOMEPAGE_HTML,
        }
      }

      throw new Error(`Unexpected URL: ${url}`)
    },
  })

  assert.deepEqual(
    requestedUrls,
    [laukika.HOMEPAGE_URL, laukika.CAREERS_URL, ...laukika.CAREERS_ROUTE_URLS],
  )
  assert.deepEqual(jobs, [])
})

test('Laukika fails closed when the verified first-party surface drifts into a public jobs surface', async () => {
  const laukika = await loadModule()

  await assert.rejects(
    laukika.createLaukikaScraper().run({
      fetchPage: async (url) => {
        if (url === laukika.HOMEPAGE_URL) {
          return {
            status: 200,
            url,
            headers: {},
            html: '<html><head><title>Unexpected</title></head><body>No Laukika markers</body></html>',
          }
        }

        if (url === laukika.CAREERS_URL) {
          return {
            status: 200,
            url,
            headers: {},
            html: CAREERS_HTML,
          }
        }

        return {
          status: 200,
          url: laukika.HOMEPAGE_URL,
          headers: {},
          html: HOMEPAGE_HTML,
        }
      },
    }),
    /verified official homepage/i,
  )

  await assert.rejects(
    laukika.createLaukikaScraper().run({
      fetchPage: async (url) => {
        if (url === laukika.HOMEPAGE_URL) {
          return {
            status: 200,
            url,
            headers: {},
            html: HOMEPAGE_HTML,
          }
        }

        if (url === laukika.CAREERS_URL) {
          return {
            status: 200,
            url,
            headers: {},
            html: CAREERS_HTML.replace(
              '</body>',
              '<a href="https://jobs.laukika.com/open-role">View jobs</a></body>',
            ),
          }
        }

        return {
          status: 200,
          url: laukika.HOMEPAGE_URL,
          headers: {},
          html: HOMEPAGE_HTML,
        }
      },
    }),
    /public job links|public jobs surface/i,
  )

  await assert.rejects(
    laukika.createLaukikaScraper().run({
      fetchPage: async (url) => {
        if (url === laukika.HOMEPAGE_URL) {
          return {
            status: 200,
            url,
            headers: {},
            html: HOMEPAGE_HTML,
          }
        }

        if (url === laukika.CAREERS_URL) {
          return {
            status: 200,
            url,
            headers: {},
            html: CAREERS_HTML,
          }
        }

        if (url === laukika.CAREERS_ROUTE_URLS[0]) {
          return {
            status: 200,
            url,
            headers: {},
            html: '<html><body><h1>Careers</h1><a href="/jobs/seo-specialist">Apply now</a></body></html>',
          }
        }

        return {
          status: 200,
          url: laukika.HOMEPAGE_URL,
          headers: {},
          html: HOMEPAGE_HTML,
        }
      },
    }),
    /careers routes changed materially|public jobs/i,
  )
})
