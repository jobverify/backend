import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

const loadKeshavSoftModule = async () => {
  try {
    return await import('./script.js')
  } catch {
    assert.fail('Expected KeshavSoft scraper module at ./script.js')
  }
}

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const fixturesDir = path.join(currentDir, 'fixtures')

const homepageHtml = fs.readFileSync(path.join(fixturesDir, 'homepage.html'), 'utf8')
const internshipHtml = fs.readFileSync(path.join(fixturesDir, 'register-for-interns.html'), 'utf8')
const missingRouteHtml = fs.readFileSync(path.join(fixturesDir, 'missing-route-404.html'), 'utf8')

test('KeshavSoft scraper validates the verified homepage, internship form, and missing careers routes', async () => {
  const keshavsoft = await loadKeshavSoftModule()

  assert.equal(keshavsoft.SOURCE, 'keshavsoft')
  assert.equal(keshavsoft.COMPANY, 'KeshavSoft')
  assert.equal(keshavsoft.HOMEPAGE_URL, 'https://keshavsoft.com/')
  assert.equal(
    keshavsoft.INTERNSHIP_URL,
    'https://keshavsoft.com/Students/HtmlFiles/registerForInternsV5.html',
  )
  assert.deepEqual(keshavsoft.MISSING_ROUTE_URLS, [
    'https://keshavsoft.com/careers',
    'https://keshavsoft.com/career',
    'https://keshavsoft.com/jobs',
  ])
  assert.equal(keshavsoft.hasOfficialHomepageSignal(homepageHtml), true)
  assert.equal(keshavsoft.hasOfficialInternshipSignal(internshipHtml), true)
  assert.equal(keshavsoft.hasPublicJobsSignal(homepageHtml), false)
  assert.equal(keshavsoft.hasPublicJobsSignal(internshipHtml), false)
  assert.equal(
    keshavsoft.hasVerifiedInternshipLink(homepageHtml),
    true,
  )
  assert.equal(
    keshavsoft.isVerifiedMissingRoute({
      status: 404,
      html: missingRouteHtml,
    }),
    true,
  )
})

test('KeshavSoft scraper returns no jobs while the verified first-party public surface only exposes an internship interest form', async () => {
  const keshavsoft = await loadKeshavSoftModule()
  const requestedUrls = []

  const jobs = await keshavsoft.createKeshavSoftScraper().run({
    fetchPage: async (url) => {
      requestedUrls.push(url)

      if (url === keshavsoft.HOMEPAGE_URL) {
        return { status: 200, html: homepageHtml }
      }

      if (url === keshavsoft.INTERNSHIP_URL) {
        return { status: 200, html: internshipHtml }
      }

      if (keshavsoft.MISSING_ROUTE_URLS.includes(url)) {
        return { status: 404, html: missingRouteHtml }
      }

      throw new Error(`Unexpected URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [
    keshavsoft.HOMEPAGE_URL,
    keshavsoft.INTERNSHIP_URL,
    ...keshavsoft.MISSING_ROUTE_URLS,
  ])
  assert.deepEqual(jobs, [])
})

test('KeshavSoft scraper fails closed when the verified zero-job first-party surface drifts', async () => {
  const keshavsoft = await loadKeshavSoftModule()

  await assert.rejects(
    keshavsoft.createKeshavSoftScraper().run({
      fetchPage: async (url) => {
        if (url === keshavsoft.HOMEPAGE_URL) {
          return {
            status: 200,
            html: '<html><body><h1>Placeholder</h1></body></html>',
          }
        }

        throw new Error(`Unexpected URL: ${url}`)
      },
    }),
    /verified official homepage/i,
  )

  await assert.rejects(
    keshavsoft.createKeshavSoftScraper().run({
      fetchPage: async (url) => {
        if (url === keshavsoft.HOMEPAGE_URL) {
          return { status: 200, html: homepageHtml }
        }

        if (url === keshavsoft.INTERNSHIP_URL) {
          return {
            status: 200,
            html: internshipHtml.replace(
              '</main>',
              `
                <section>
                  <h1>Current Openings</h1>
                  <a href="https://jobs.ashbyhq.com/keshavsoft/software-engineer">Apply now</a>
                </section>
              </main>
              `,
            ),
          }
        }

        throw new Error(`Unexpected URL: ${url}`)
      },
    }),
    /internship page now appears to expose public jobs/i,
  )

  await assert.rejects(
    keshavsoft.createKeshavSoftScraper().run({
      fetchPage: async (url) => {
        if (url === keshavsoft.HOMEPAGE_URL) {
          return { status: 200, html: homepageHtml }
        }

        if (url === keshavsoft.INTERNSHIP_URL) {
          return { status: 200, html: internshipHtml }
        }

        if (url === keshavsoft.MISSING_ROUTE_URLS[0]) {
          return {
            status: 200,
            html: '<html><body><h1>Careers</h1><p>Now hiring</p></body></html>',
          }
        }

        if (keshavsoft.MISSING_ROUTE_URLS.slice(1).includes(url)) {
          return { status: 404, html: missingRouteHtml }
        }

        throw new Error(`Unexpected URL: ${url}`)
      },
    }),
    /missing first-party careers routes changed materially/i,
  )
})
