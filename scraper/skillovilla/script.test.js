import assert from 'node:assert/strict'
import test from 'node:test'

import {
  CAREER_PAGE_URL,
  CAREERS_ROUTE_URL,
  JOBS_ROUTE_URL,
  createSkilloVillaScraper,
  hasOfficialHomepageSignal,
  isVerifiedMissingRouteError,
} from './script.js'

const officialHomepageHtml = `
  <html lang="en">
    <head>
      <title>Data Analytics & Data Science Courses Online | SkilloVilla</title>
    </head>
    <body>
      <nav>
        <a href="/programs">Programs</a>
        <a href="/placements">Placements</a>
        <a href="https://www.blogs.skillovilla.com/">Blogs</a>
        <a href="/hire-from-us">Hire From Us</a>
      </nav>
      <main>
        <p>Your upskilling partner</p>
        <h1>Land your dream job by learning from the top 1%</h1>
        <p>Learn skills you didn't get in school, directly from India's best experts</p>
      </main>
    </body>
  </html>
`

const liveLikeHomepageHtml = `
  <html lang="en">
    <head>
      <title>Data Analytics &amp; Data Science Courses Online | SkilloVilla</title>
    </head>
    <body>
      <main>
        <p>Your upskilling partner</p>
        <h1>
          Land your
          dream job
          by learning from the top 1%
        </h1>
      </main>
    </body>
  </html>
`

test('SkilloVilla scraper recognizes the verified official homepage and missing-route errors', () => {
  assert.equal(CAREER_PAGE_URL, 'https://www.skillovilla.com/')
  assert.equal(CAREERS_ROUTE_URL, 'https://www.skillovilla.com/careers')
  assert.equal(JOBS_ROUTE_URL, 'https://www.skillovilla.com/jobs')
  assert.equal(hasOfficialHomepageSignal(officialHomepageHtml), true)
  assert.equal(hasOfficialHomepageSignal(liveLikeHomepageHtml), true)
  assert.equal(hasOfficialHomepageSignal('<html><title>Placeholder</title></html>'), false)
  assert.equal(isVerifiedMissingRouteError(new Error(`HTTP 404 for ${CAREERS_ROUTE_URL}`), CAREERS_ROUTE_URL), true)
  assert.equal(isVerifiedMissingRouteError(new Error(`HTTP 404 for ${JOBS_ROUTE_URL}`), JOBS_ROUTE_URL), true)
  assert.equal(isVerifiedMissingRouteError(new Error('HTTP 500 for https://www.skillovilla.com/careers'), CAREERS_ROUTE_URL), false)
})

test('run returns no jobs when SkilloVilla only exposes the verified official homepage and missing careers routes', async () => {
  const requestedUrls = []
  const jobs = await createSkilloVillaScraper().run({
    fetchText: async (url) => {
      requestedUrls.push(url)

      if (url === CAREER_PAGE_URL) {
        return officialHomepageHtml
      }

      if (url === CAREERS_ROUTE_URL || url === JOBS_ROUTE_URL) {
        throw new Error(`HTTP 404 for ${url}`)
      }

      throw new Error(`Unexpected URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [CAREER_PAGE_URL, CAREERS_ROUTE_URL, JOBS_ROUTE_URL])
  assert.deepEqual(jobs, [])
})

test('run fails closed when the SkilloVilla homepage no longer matches the verified official surface', async () => {
  await assert.rejects(
    createSkilloVillaScraper().run({
      fetchText: async () => '<html><head><title>Unexpected</title></head><body>Coming soon</body></html>',
    }),
    /SkilloVilla homepage no longer matches the verified official site/i,
  )
})

test('run fails closed when a previously missing SkilloVilla route starts resolving publicly', async () => {
  await assert.rejects(
    createSkilloVillaScraper().run({
      fetchText: async (url) => {
        if (url === CAREER_PAGE_URL) {
          return officialHomepageHtml
        }

        if (url === CAREERS_ROUTE_URL) {
          return '<html><head><title>Careers</title></head><body><h1>Careers</h1></body></html>'
        }

        if (url === JOBS_ROUTE_URL) {
          throw new Error(`HTTP 404 for ${url}`)
        }

        throw new Error(`Unexpected URL: ${url}`)
      },
    }),
    /SkilloVilla careers routes no longer match the verified public missing-route surface/i,
  )
})
