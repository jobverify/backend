import assert from 'node:assert/strict'
import test from 'node:test'

import {
  CAREERS_URL,
  COMPANY,
  HOMEPAGE_URL,
  SOURCE,
  createFragmaDataSystemsScraper,
  hasHomepageCareersEmailOnlySignal,
  isExpectedMissingCareersRoute,
  pageExposesPublicJobs,
} from './script.js'

const homepageHtml = `
  <html>
    <head><title>Fragma Data</title></head>
    <body>
      <h1>Transforming Your Enterprise Data into Growth Engines</h1>
      <p>Careers/Job Enquiry:</p>
      <p>careers@fragmadata.com</p>
      <a href="/contact">Contact</a>
    </body>
  </html>
`

test('validates the Fragma Data homepage-only careers contact sentinel', () => {
  assert.equal(SOURCE, 'fragmadatasystems')
  assert.equal(COMPANY, 'Fragma Data Systems')
  assert.equal(HOMEPAGE_URL, 'https://fragmadata.com/')
  assert.equal(CAREERS_URL, 'https://fragmadata.com/careers/')
  assert.equal(hasHomepageCareersEmailOnlySignal(homepageHtml), true)
  assert.equal(pageExposesPublicJobs(homepageHtml), false)
  assert.equal(pageExposesPublicJobs('<a href="/careers/openings">Careers</a>'), true)
  assert.equal(
    isExpectedMissingCareersRoute({
      status: 404,
      html: '<html><body><h1>Page Not Found</h1></body></html>',
    }),
    true,
  )
})

test('run returns no jobs when the homepage keeps only the careers email and the exact careers route stays missing', async () => {
  const requestedUrls = []
  const jobs = await createFragmaDataSystemsScraper().run({
    fetchPage: async (url) => {
      requestedUrls.push(url)
      if (url === HOMEPAGE_URL) {
        return {
          status: 200,
          url,
          html: homepageHtml,
        }
      }

      if (url === CAREERS_URL) {
        return {
          status: 404,
          url,
          html: '<html><body><h1>Page Not Found</h1></body></html>',
        }
      }

      throw new Error(`Unexpected URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [HOMEPAGE_URL, CAREERS_URL])
  assert.deepEqual(jobs, [])
})

test('run fails closed when Fragma Data starts exposing public jobs or the missing careers route changes', async () => {
  await assert.rejects(
    createFragmaDataSystemsScraper().run({
      fetchPage: async (url) => {
        if (url === HOMEPAGE_URL) {
          return {
            status: 200,
            url,
            html: homepageHtml.replace('<a href="/contact">Contact</a>', '<a href="/careers/openings">Open roles</a>'),
          }
        }

        return {
          status: 404,
          url,
          html: '<html><body><h1>Page Not Found</h1></body></html>',
        }
      },
    }),
    /homepage now exposes public jobs/i,
  )

  await assert.rejects(
    createFragmaDataSystemsScraper().run({
      fetchPage: async (url) => {
        if (url === HOMEPAGE_URL) {
          return {
            status: 200,
            url,
            html: homepageHtml,
          }
        }

        return {
          status: 200,
          url,
          html: '<html><body><h1>Careers</h1></body></html>',
        }
      },
    }),
    /exact-name careers route no longer returns the verified missing-page response/i,
  )
})
