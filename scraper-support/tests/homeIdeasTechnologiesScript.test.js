import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const scraperDir = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../scraper/homeideastechnologies',
)

const readFixture = (name) =>
  readFileSync(path.join(scraperDir, 'fixtures', name), 'utf8')

const verifiedHomepageHtml = readFixture('homepage.html')
const verifiedCareersHtml = readFixture('careers.html')

const loadHomeIdeasTechnologiesModule = async () => {
  try {
    return await import('../../scraper/homeideastechnologies/script.js')
  } catch {
    assert.fail('Expected Home Ideas Technologies scraper module at ../../scraper/homeideastechnologies/script.js')
  }
}

test('Home Ideas Technologies validates the verified homepage shell and checked first-party routes', async () => {
  const homeIdeasTechnologies = await loadHomeIdeasTechnologiesModule()

  assert.equal(homeIdeasTechnologies.SOURCE, 'homeideastechnologies')
  assert.equal(homeIdeasTechnologies.COMPANY, 'Home Ideas Technologies')
  assert.equal(homeIdeasTechnologies.HOMEPAGE_URL, 'https://www.homeideastechnologies.com/')
  assert.deepEqual(homeIdeasTechnologies.CHECKED_ROUTE_URLS, [
    'https://www.homeideastechnologies.com/careers',
    'https://www.homeideastechnologies.com/careers/',
    'https://www.homeideastechnologies.com/career',
    'https://www.homeideastechnologies.com/career/',
    'https://www.homeideastechnologies.com/jobs',
    'https://www.homeideastechnologies.com/jobs/',
    'https://www.homeideastechnologies.com/job',
    'https://www.homeideastechnologies.com/job/',
    'https://www.homeideastechnologies.com/join-us',
    'https://www.homeideastechnologies.com/join-us/',
  ])
  assert.equal(homeIdeasTechnologies.hasOfficialHomepageSignal(verifiedHomepageHtml), true)
  assert.equal(homeIdeasTechnologies.extractBundlePath(verifiedHomepageHtml), '/assets/index-Bg2F4P6f.js')
  assert.equal(homeIdeasTechnologies.hasPublicJobsSignal(verifiedHomepageHtml), false)
  assert.equal(
    homeIdeasTechnologies.routeMatchesVerifiedShell(
      verifiedCareersHtml,
      '/assets/index-Bg2F4P6f.js',
    ),
    true,
  )
})

test('Home Ideas Technologies returns no jobs only while the verified first-party routes stay on the same empty shell', async () => {
  const homeIdeasTechnologies = await loadHomeIdeasTechnologiesModule()
  const requestedUrls = []

  const jobs = await homeIdeasTechnologies.createHomeIdeasTechnologiesScraper().run({
    fetchText: async (url) => {
      requestedUrls.push(url)
      return url === homeIdeasTechnologies.HOMEPAGE_URL
        ? verifiedHomepageHtml
        : verifiedCareersHtml
    },
  })

  assert.deepEqual(requestedUrls, [
    homeIdeasTechnologies.HOMEPAGE_URL,
    ...homeIdeasTechnologies.CHECKED_ROUTE_URLS,
  ])
  assert.deepEqual(jobs, [])
})

test('Home Ideas Technologies fails closed when the homepage shell changes or a checked route starts exposing public jobs', async () => {
  const homeIdeasTechnologies = await loadHomeIdeasTechnologiesModule()

  await assert.rejects(
    homeIdeasTechnologies.createHomeIdeasTechnologiesScraper().run({
      fetchText: async (url) => {
        if (url === homeIdeasTechnologies.HOMEPAGE_URL) {
          return '<html><body><h1>Unexpected homepage</h1></body></html>'
        }

        return verifiedCareersHtml
      },
    }),
    /verified official homepage/i,
  )

  await assert.rejects(
    homeIdeasTechnologies.createHomeIdeasTechnologiesScraper().run({
      fetchText: async (url) => {
        if (url === homeIdeasTechnologies.HOMEPAGE_URL) {
          return verifiedHomepageHtml
        }

        if (url === homeIdeasTechnologies.CHECKED_ROUTE_URLS[0]) {
          return verifiedCareersHtml.replace(
            '<div id="root"></div>',
            '<div id="root"><section><h1>Current Openings</h1><a href="https://jobs.ashbyhq.com/homeideas/frontend-engineer">Apply now</a></section></div>',
          )
        }

        return verifiedCareersHtml
      },
    }),
    /checked first-party route changed materially or now exposes public jobs/i,
  )
})
