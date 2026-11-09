import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

const loadErelegoModule = async () => {
  try {
    return await import('./script.js')
  } catch {
    assert.fail('Expected eReleGo Technologies scraper module at ./script.js')
  }
}

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const fixturesDir = path.join(currentDir, 'fixtures')

const homepageHtml = fs.readFileSync(path.join(fixturesDir, 'homepage.html'), 'utf8')
const careersHtml = fs.readFileSync(path.join(fixturesDir, 'careers.html'), 'utf8')
const missingRouteHtml = fs.readFileSync(path.join(fixturesDir, 'missing-route-404.html'), 'utf8')

test('eReleGo Technologies scraper validates the verified homepage, careers page, redirect aliases, and missing jobs routes', async () => {
  const erelego = await loadErelegoModule()

  assert.equal(erelego.SOURCE, 'erelegotechnologies')
  assert.equal(erelego.COMPANY, 'eReleGo Technologies')
  assert.equal(erelego.HOMEPAGE_URL, 'https://erelego.com/')
  assert.equal(erelego.CAREERS_URL, 'https://erelego.com/career/')
  assert.deepEqual(erelego.CAREERS_ALIAS_URLS, [
    'https://erelego.com/careers',
    'https://erelego.com/careers/',
  ])
  assert.deepEqual(erelego.MISSING_ROUTE_URLS, [
    'https://erelego.com/jobs',
    'https://erelego.com/jobs/',
    'https://erelego.com/join-us',
    'https://erelego.com/join-us/',
    'https://erelego.com/current-openings/',
    'https://erelego.com/openings/',
  ])
  assert.equal(erelego.hasOfficialHomepageSignal(homepageHtml), true)
  assert.equal(erelego.hasVerifiedCareersLink(homepageHtml), true)
  assert.equal(erelego.hasOfficialCareersSignal(careersHtml), true)
  assert.equal(erelego.extractApplyEmail(careersHtml), 'hr@erelego.com')
  assert.equal(erelego.hasEmailOnlyCareersSignal(careersHtml), true)
  assert.equal(erelego.hasUnexpectedPublicJobsSignal(careersHtml), false)
  assert.equal(
    erelego.isVerifiedCareersAlias({
      status: 200,
      url: erelego.CAREERS_URL,
      html: careersHtml,
    }),
    true,
  )
  assert.equal(
    erelego.isVerifiedMissingRoute({
      status: 404,
      url: erelego.MISSING_ROUTE_URLS[0],
      html: missingRouteHtml,
    }),
    true,
  )
})

test('eReleGo Technologies scraper returns no jobs while the verified first-party careers surface remains email-only', async () => {
  const erelego = await loadErelegoModule()
  const requestedUrls = []

  const jobs = await erelego.createErelegoTechnologiesScraper().run({
    fetchPage: async (url) => {
      requestedUrls.push(url)

      if (url === erelego.HOMEPAGE_URL) {
        return { status: 200, url, html: homepageHtml }
      }

      if (url === erelego.CAREERS_URL) {
        return { status: 200, url, html: careersHtml }
      }

      if (erelego.CAREERS_ALIAS_URLS.includes(url)) {
        return { status: 200, url: erelego.CAREERS_URL, html: careersHtml }
      }

      if (erelego.MISSING_ROUTE_URLS.includes(url)) {
        return { status: 404, url, html: missingRouteHtml }
      }

      throw new Error(`Unexpected URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [
    erelego.HOMEPAGE_URL,
    erelego.CAREERS_URL,
    ...erelego.CAREERS_ALIAS_URLS,
    ...erelego.MISSING_ROUTE_URLS,
  ])
  assert.deepEqual(jobs, [])
})

test('eReleGo Technologies scraper fails closed when the verified zero-job surface drifts', async () => {
  const erelego = await loadErelegoModule()

  await assert.rejects(
    erelego.createErelegoTechnologiesScraper().run({
      fetchPage: async (url) => {
        if (url === erelego.HOMEPAGE_URL) {
          return {
            status: 200,
            url,
            html: '<html><body><h1>Placeholder</h1></body></html>',
          }
        }

        throw new Error(`Unexpected URL: ${url}`)
      },
    }),
    /official homepage/i,
  )

  await assert.rejects(
    erelego.createErelegoTechnologiesScraper().run({
      fetchPage: async (url) => {
        if (url === erelego.HOMEPAGE_URL) {
          return { status: 200, url, html: homepageHtml }
        }

        if (url === erelego.CAREERS_URL) {
          return {
            status: 200,
            url,
            html: careersHtml.replace(
              '</body>',
              `
                <section>
                  <h2>Current Openings</h2>
                  <a href="/career/frontend-engineer">Frontend Engineer</a>
                </section>
              </body>
              `,
            ),
          }
        }

        if (erelego.CAREERS_ALIAS_URLS.includes(url)) {
          return { status: 200, url: erelego.CAREERS_URL, html: careersHtml }
        }

        if (erelego.MISSING_ROUTE_URLS.includes(url)) {
          return { status: 404, url, html: missingRouteHtml }
        }

        throw new Error(`Unexpected URL: ${url}`)
      },
    }),
    /public jobs surface|email-only careers surface/i,
  )

  await assert.rejects(
    erelego.createErelegoTechnologiesScraper().run({
      fetchPage: async (url) => {
        if (url === erelego.HOMEPAGE_URL) {
          return { status: 200, url, html: homepageHtml }
        }

        if (url === erelego.CAREERS_URL) {
          return { status: 200, url, html: careersHtml }
        }

        if (erelego.CAREERS_ALIAS_URLS.includes(url)) {
          return { status: 200, url, html: careersHtml }
        }

        if (erelego.MISSING_ROUTE_URLS.includes(url)) {
          return { status: 404, url, html: missingRouteHtml }
        }

        throw new Error(`Unexpected URL: ${url}`)
      },
    }),
    /careers aliases changed materially/i,
  )

  await assert.rejects(
    erelego.createErelegoTechnologiesScraper().run({
      fetchPage: async (url) => {
        if (url === erelego.HOMEPAGE_URL) {
          return { status: 200, url, html: homepageHtml }
        }

        if (url === erelego.CAREERS_URL) {
          return { status: 200, url, html: careersHtml }
        }

        if (erelego.CAREERS_ALIAS_URLS.includes(url)) {
          return { status: 200, url: erelego.CAREERS_URL, html: careersHtml }
        }

        if (url === erelego.MISSING_ROUTE_URLS[0]) {
          return {
            status: 200,
            url,
            html: '<html><head><title>Jobs - ETPL</title></head><body><h1>Open positions</h1></body></html>',
          }
        }

        if (erelego.MISSING_ROUTE_URLS.slice(1).includes(url)) {
          return { status: 404, url, html: missingRouteHtml }
        }

        throw new Error(`Unexpected URL: ${url}`)
      },
    }),
    /missing jobs routes changed materially/i,
  )
})
