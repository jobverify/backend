import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

const loadKampdModule = async () => {
  try {
    return await import('./script.js')
  } catch {
    assert.fail('Expected Kampd scraper module at ./script.js')
  }
}

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const fixturesDir = path.join(currentDir, '../../scraper-support/tests/fixtures/kampd')

const officialHomepageHtml = fs.readFileSync(path.join(fixturesDir, 'homepage.html'), 'utf8')
const officialFaqHtml = fs.readFileSync(path.join(fixturesDir, 'faq.html'), 'utf8')
const missingCareersRouteHtml = fs.readFileSync(path.join(fixturesDir, 'missing-route-404.html'), 'utf8')

test('Kampd scraper validates the verified homepage, FAQ, and missing first-party careers routes', async () => {
  const kampd = await loadKampdModule()

  assert.equal(kampd.SOURCE, 'kampd')
  assert.equal(kampd.COMPANY, 'Kampd')
  assert.equal(kampd.HOMEPAGE_URL, 'https://www.kampd.com/')
  assert.equal(kampd.FAQ_URL, 'https://www.kampd.com/faq/')
  assert.deepEqual(kampd.CAREERS_ROUTE_URLS, [
    'https://www.kampd.com/careers/',
    'https://www.kampd.com/jobs/',
    'https://www.kampd.com/join-us/',
    'https://www.kampd.com/work-with-us/',
  ])
  assert.equal(kampd.hasOfficialHomepageSignal(officialHomepageHtml), true)
  assert.equal(kampd.hasOfficialFaqSignal(officialFaqHtml), true)
  assert.equal(
    kampd.isVerifiedMissingCareersRoute({
      status: 404,
      html: missingCareersRouteHtml,
    }),
    true,
  )
})

test('Kampd scraper returns no jobs while the verified first-party public surface has no careers pages', async () => {
  const kampd = await loadKampdModule()
  const requestedUrls = []

  const jobs = await kampd.createKampdScraper().run({
    fetchPage: async (url) => {
      requestedUrls.push(url)

      if (url === kampd.HOMEPAGE_URL) {
        return { status: 200, html: officialHomepageHtml }
      }

      if (url === kampd.FAQ_URL) {
        return { status: 200, html: officialFaqHtml }
      }

      if (kampd.CAREERS_ROUTE_URLS.includes(url)) {
        return { status: 404, html: missingCareersRouteHtml }
      }

      throw new Error(`Unexpected URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [
    kampd.HOMEPAGE_URL,
    kampd.FAQ_URL,
    ...kampd.CAREERS_ROUTE_URLS,
  ])
  assert.deepEqual(jobs, [])
})

test('Kampd scraper fails closed when the verified first-party zero-job surface drifts', async () => {
  const kampd = await loadKampdModule()

  await assert.rejects(
    kampd.createKampdScraper().run({
      fetchPage: async (url) => {
        if (url === kampd.HOMEPAGE_URL) {
          return {
            status: 200,
            html: '<html><body><h1>Careers</h1></body></html>',
          }
        }

        throw new Error(`Unexpected URL: ${url}`)
      },
    }),
    /verified official homepage/i,
  )

  await assert.rejects(
    kampd.createKampdScraper().run({
      fetchPage: async (url) => {
        if (url === kampd.HOMEPAGE_URL) {
          return { status: 200, html: officialHomepageHtml }
        }

        if (url === kampd.FAQ_URL) {
          return { status: 200, html: '<html><body><h1>Help Center</h1></body></html>' }
        }

        throw new Error(`Unexpected URL: ${url}`)
      },
    }),
    /verified faq/i,
  )

  await assert.rejects(
    kampd.createKampdScraper().run({
      fetchPage: async (url) => {
        if (url === kampd.HOMEPAGE_URL) {
          return { status: 200, html: officialHomepageHtml }
        }

        if (url === kampd.FAQ_URL) {
          return { status: 200, html: officialFaqHtml }
        }

        if (url === kampd.CAREERS_ROUTE_URLS[0]) {
          return {
            status: 200,
            html: `
              <html>
                <body>
                  <h1>Current Openings</h1>
                  <a href="https://jobs.ashbyhq.com/kampd/software-engineer">Apply now</a>
                </body>
              </html>
            `,
          }
        }

        if (kampd.CAREERS_ROUTE_URLS.slice(1).includes(url)) {
          return { status: 404, html: missingCareersRouteHtml }
        }

        throw new Error(`Unexpected URL: ${url}`)
      },
    }),
    /careers routes changed materially or now expose public jobs/i,
  )
})
