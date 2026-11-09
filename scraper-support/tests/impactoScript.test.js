import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const fixturesDir = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  'fixtures',
  'impacto',
)

const readFixture = (name) => readFileSync(path.join(fixturesDir, name), 'utf8')

const verifiedHomepageHtml = readFixture('homepage.html')
const verifiedCareers404Html = readFixture('careers-404.html')

const loadImpactoModule = async () => {
  try {
    return await import('../../scraper/impacto/script.js')
  } catch {
    assert.fail('Expected Impacto scraper module at ../../scraper/impacto/script.js')
  }
}

test('Impacto recognizes the verified official homepage and branded missing careers routes', async () => {
  const impacto = await loadImpactoModule()

  assert.equal(impacto.SOURCE, 'impacto')
  assert.equal(impacto.COMPANY, 'Impacto')
  assert.equal(impacto.HOMEPAGE_URL, 'https://impacto.co.in/')
  assert.deepEqual(impacto.CAREERS_ROUTE_URLS, [
    'https://impacto.co.in/careers',
    'https://impacto.co.in/careers/',
    'https://impacto.co.in/career',
    'https://impacto.co.in/career/',
    'https://impacto.co.in/jobs',
    'https://impacto.co.in/jobs/',
  ])
  assert.equal(impacto.hasOfficialHomepageSignal(verifiedHomepageHtml), true)
  assert.equal(impacto.hasFirstPartyCareerLikeLink(verifiedHomepageHtml), false)
  assert.equal(impacto.hasPublicJobsSignal(verifiedHomepageHtml), false)
  assert.equal(
    impacto.isVerifiedMissingCareersRoute({
      status: 404,
      url: impacto.CAREERS_ROUTE_URLS[0],
      headers: {},
      html: verifiedCareers404Html,
    }),
    true,
  )
})

test('Impacto returns no jobs only while the verified homepage and missing careers routes remain unchanged', async () => {
  const impacto = await loadImpactoModule()
  const requestedUrls = []

  const jobs = await impacto.createImpactoScraper().run({
    fetchPage: async (url) => {
      requestedUrls.push(url)

      if (url === impacto.HOMEPAGE_URL) {
        return {
          status: 200,
          url,
          headers: {},
          html: verifiedHomepageHtml,
        }
      }

      if (impacto.CAREERS_ROUTE_URLS.includes(url)) {
        return {
          status: 404,
          url,
          headers: {},
          html: verifiedCareers404Html,
        }
      }

      throw new Error(`Unexpected fixture URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [
    impacto.HOMEPAGE_URL,
    ...impacto.CAREERS_ROUTE_URLS,
  ])
  assert.deepEqual(jobs, [])
})

test('Impacto fails closed when the homepage or missing careers-route contract changes', async () => {
  const impacto = await loadImpactoModule()

  await assert.rejects(
    impacto.createImpactoScraper().run({
      fetchPage: async (url) => {
        if (url === impacto.HOMEPAGE_URL) {
          return {
            status: 200,
            url,
            headers: {},
            html: '<html><body><h1>Unexpected homepage</h1></body></html>',
          }
        }

        return {
          status: 404,
          url,
          headers: {},
          html: verifiedCareers404Html,
        }
      },
    }),
    /verified official homepage/i,
  )

  await assert.rejects(
    impacto.createImpactoScraper().run({
      fetchPage: async (url) => {
        if (url === impacto.HOMEPAGE_URL) {
          return {
            status: 200,
            url,
            headers: {},
            html: verifiedHomepageHtml.replace(
              '<li><a href="contact-us.php">CONTACT US</a></li>',
              '<li><a href="/careers">Careers</a></li>',
            ),
          }
        }

        return {
          status: 404,
          url,
          headers: {},
          html: verifiedCareers404Html,
        }
      },
    }),
    /first-party careers or jobs link/i,
  )

  await assert.rejects(
    impacto.createImpactoScraper().run({
      fetchPage: async (url) => {
        if (url === impacto.HOMEPAGE_URL) {
          return {
            status: 200,
            url,
            headers: {},
            html: `${verifiedHomepageHtml}<a href="https://jobs.ashbyhq.com/impacto">Current Openings</a>`,
          }
        }

        return {
          status: 404,
          url,
          headers: {},
          html: verifiedCareers404Html,
        }
      },
    }),
    /public jobs surface/i,
  )

  await assert.rejects(
    impacto.createImpactoScraper().run({
      fetchPage: async (url) => {
        if (url === impacto.HOMEPAGE_URL) {
          return {
            status: 200,
            url,
            headers: {},
            html: verifiedHomepageHtml,
          }
        }

        if (url === impacto.CAREERS_ROUTE_URLS[0]) {
          return {
            status: 200,
            url,
            headers: {},
            html: '<html><body><h1>Careers</h1><a href="/jobs/design-engineer">Apply now</a></body></html>',
          }
        }

        return {
          status: 404,
          url,
          headers: {},
          html: verifiedCareers404Html,
        }
      },
    }),
    /careers routes changed materially or now expose public jobs/i,
  )
})
