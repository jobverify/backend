import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

const loadPerfintModule = async () => {
  try {
    return await import('./script.js')
  } catch {
    assert.fail('Expected Perfint Healthcare scraper module at ./script.js')
  }
}

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const fixturesDir = path.join(currentDir, 'fixtures')

const homepageHtml = fs.readFileSync(path.join(fixturesDir, 'homepage.html'), 'utf8')
const careersHtml = fs.readFileSync(path.join(fixturesDir, 'careers.html'), 'utf8')
const missingRouteHtml = fs.readFileSync(path.join(fixturesDir, 'missing-route-404.html'), 'utf8')

test('Perfint Healthcare scraper validates the verified homepage, email-only careers page, and missing jobs routes', async () => {
  const perfint = await loadPerfintModule()

  assert.equal(perfint.SOURCE, 'perfinthealthcare')
  assert.equal(perfint.COMPANY, 'Perfint Healthcare')
  assert.equal(perfint.HOMEPAGE_URL, 'https://www.perfinthealthcare.com/')
  assert.equal(perfint.CAREERS_URL, 'https://www.perfinthealthcare.com/careers.php')
  assert.deepEqual(perfint.MISSING_ROUTE_URLS, [
    'https://www.perfinthealthcare.com/careers',
    'https://www.perfinthealthcare.com/careers/',
    'https://www.perfinthealthcare.com/career.php',
    'https://www.perfinthealthcare.com/jobs',
    'https://www.perfinthealthcare.com/current-openings',
  ])
  assert.equal(perfint.hasOfficialHomepageSignal(homepageHtml), true)
  assert.equal(perfint.hasVerifiedCareersLink(homepageHtml), true)
  assert.equal(perfint.hasOfficialCareersSignal(careersHtml), true)
  assert.equal(perfint.extractApplicationEmail(careersHtml), 'hr@perfinthealthcare.com')
  assert.equal(perfint.hasEmailOnlyCareersSignal(careersHtml), true)
  assert.equal(perfint.hasUnexpectedPublicJobsSignal(careersHtml), false)
  assert.equal(
    perfint.isVerifiedMissingRoute({
      status: 404,
      html: missingRouteHtml,
    }),
    true,
  )
})

test('Perfint Healthcare scraper returns no jobs while the verified first-party careers surface remains email-only', async () => {
  const perfint = await loadPerfintModule()
  const requestedUrls = []

  const jobs = await perfint.createPerfintHealthcareScraper().run({
    fetchPage: async (url) => {
      requestedUrls.push(url)

      if (url === perfint.HOMEPAGE_URL) {
        return { status: 200, url, html: homepageHtml }
      }

      if (url === perfint.CAREERS_URL) {
        return { status: 200, url, html: careersHtml }
      }

      if (perfint.MISSING_ROUTE_URLS.includes(url)) {
        return { status: 404, url, html: missingRouteHtml }
      }

      throw new Error(`Unexpected URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [
    perfint.HOMEPAGE_URL,
    perfint.CAREERS_URL,
    ...perfint.MISSING_ROUTE_URLS,
  ])
  assert.deepEqual(jobs, [])
})

test('Perfint Healthcare scraper fails closed when the verified zero-job surface drifts', async () => {
  const perfint = await loadPerfintModule()

  await assert.rejects(
    perfint.createPerfintHealthcareScraper().run({
      fetchPage: async (url) => {
        if (url === perfint.HOMEPAGE_URL) {
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
    perfint.createPerfintHealthcareScraper().run({
      fetchPage: async (url) => {
        if (url === perfint.HOMEPAGE_URL) {
          return { status: 200, url, html: homepageHtml }
        }

        if (url === perfint.CAREERS_URL) {
          return {
            status: 200,
            url,
            html: careersHtml.replace(
              '</section>',
              `
                <section>
                  <h2>Current Openings</h2>
                  <a href="/careers/software-engineer">Software Engineer</a>
                </section>
              </section>
              `,
            ),
          }
        }

        if (perfint.MISSING_ROUTE_URLS.includes(url)) {
          return { status: 404, url, html: missingRouteHtml }
        }

        throw new Error(`Unexpected URL: ${url}`)
      },
    }),
    /public jobs surface|email-only careers surface/i,
  )

  await assert.rejects(
    perfint.createPerfintHealthcareScraper().run({
      fetchPage: async (url) => {
        if (url === perfint.HOMEPAGE_URL) {
          return { status: 200, url, html: homepageHtml }
        }

        if (url === perfint.CAREERS_URL) {
          return { status: 200, url, html: careersHtml }
        }

        if (url === perfint.MISSING_ROUTE_URLS[0]) {
          return {
            status: 200,
            url,
            html: '<html><head><title>Jobs - Perfint</title></head><body><h1>Open Positions</h1></body></html>',
          }
        }

        if (perfint.MISSING_ROUTE_URLS.slice(1).includes(url)) {
          return { status: 404, url, html: missingRouteHtml }
        }

        throw new Error(`Unexpected URL: ${url}`)
      },
    }),
    /missing jobs routes changed materially/i,
  )
})
