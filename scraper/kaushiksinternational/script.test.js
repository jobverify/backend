import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

const loadKaushiksInternationalModule = async () => {
  try {
    return await import('./script.js')
  } catch {
    assert.fail('Expected KAUSHIKS INTERNATIONAL scraper module at ./script.js')
  }
}

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const fixturesDir = path.join(currentDir, 'fixtures')
const homepageHtml = fs.readFileSync(path.join(fixturesDir, 'homepage.html'), 'utf8')
const missingRouteHtml = fs.readFileSync(path.join(fixturesDir, 'missing-route.html'), 'utf8')

test('KAUSHIKS INTERNATIONAL scraper validates the verified first-party homepage and zero-job routes', async () => {
  const kaushiksInternational = await loadKaushiksInternationalModule()

  assert.equal(kaushiksInternational.SOURCE, 'kaushiksinternational')
  assert.equal(kaushiksInternational.COMPANY, 'KAUSHIKS INTERNATIONAL')
  assert.equal(kaushiksInternational.HOMEPAGE_URL, 'https://www.kaushiksinternational.com/')
  assert.deepEqual(kaushiksInternational.CAREERS_ROUTE_URLS, [
    'https://www.kaushiksinternational.com/career',
    'https://www.kaushiksinternational.com/careers',
    'https://www.kaushiksinternational.com/jobs',
    'https://www.kaushiksinternational.com/job',
    'https://www.kaushiksinternational.com/openings',
    'https://www.kaushiksinternational.com/vacancies',
  ])
  assert.equal(kaushiksInternational.hasOfficialHomepageSignal(homepageHtml), true)
  assert.equal(kaushiksInternational.hasFirstPartyCareerLikeLink(homepageHtml), false)
  assert.equal(kaushiksInternational.hasPublicJobsSignal(homepageHtml), false)
  assert.equal(
    kaushiksInternational.isVerifiedMissingCareersRoute({ status: 404, html: missingRouteHtml }),
    true,
  )
})

test('KAUSHIKS INTERNATIONAL scraper returns no jobs while the verified homepage and zero-job routes remain stable', async () => {
  const kaushiksInternational = await loadKaushiksInternationalModule()
  const requestedUrls = []

  const jobs = await kaushiksInternational.createKaushiksInternationalScraper().run({
    fetchPage: async (url) => {
      requestedUrls.push(url)

      if (url === kaushiksInternational.HOMEPAGE_URL) {
        return { status: 200, url, headers: {}, html: homepageHtml }
      }

      if (kaushiksInternational.CAREERS_ROUTE_URLS.includes(url)) {
        return { status: 404, url, headers: {}, html: missingRouteHtml }
      }

      throw new Error(`Unexpected page URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [
    kaushiksInternational.HOMEPAGE_URL,
    ...kaushiksInternational.CAREERS_ROUTE_URLS,
  ])
  assert.deepEqual(jobs, [])
})

test('KAUSHIKS INTERNATIONAL scraper fails closed when the homepage or common careers routes drift', async () => {
  const kaushiksInternational = await loadKaushiksInternationalModule()

  await assert.rejects(
    kaushiksInternational.createKaushiksInternationalScraper().run({
      fetchPage: async (url) => {
        if (url === kaushiksInternational.HOMEPAGE_URL) {
          return { status: 200, url, headers: {}, html: '<html><title>Unexpected</title></html>' }
        }

        return { status: 404, url, headers: {}, html: missingRouteHtml }
      },
    }),
    /verified official homepage/i,
  )

  await assert.rejects(
    kaushiksInternational.createKaushiksInternationalScraper().run({
      fetchPage: async (url) => {
        if (url === kaushiksInternational.HOMEPAGE_URL) {
          return {
            status: 200,
            url,
            headers: {},
            html: homepageHtml.replace('</body>', '<a href="/careers">Careers</a></body>'),
          }
        }

        return { status: 404, url, headers: {}, html: missingRouteHtml }
      },
    }),
    /first-party careers|public jobs surface/i,
  )

  await assert.rejects(
    kaushiksInternational.createKaushiksInternationalScraper().run({
      fetchPage: async (url) => {
        if (url === kaushiksInternational.HOMEPAGE_URL) {
          return { status: 200, url, headers: {}, html: homepageHtml }
        }

        if (url === kaushiksInternational.CAREERS_ROUTE_URLS[0]) {
          return {
            status: 200,
            url,
            headers: {},
            html: '<html><body><h1>Current Openings</h1><a href="/apply">Apply now</a></body></html>',
          }
        }

        return { status: 404, url, headers: {}, html: missingRouteHtml }
      },
    }),
    /careers routes changed materially|public jobs/i,
  )
})
