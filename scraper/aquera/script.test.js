import assert from 'node:assert/strict'
import test from 'node:test'

import {
  CAREERS_PAGE_URL,
  HOMEPAGE_URL,
  createAqueraScraper,
  hasOfficialHomepageSignal,
  hasMissingCareerRouteSignal,
  hasOfficialSiteSignal,
  hasPublicJobsBoardSignal,
} from './script.js'

const homepageHtml = `
  <!doctype html>
  <html lang="en">
    <head>
      <title>Aquera | HR &amp; Identity Integration Platform as a Service</title>
    </head>
    <body>
      <header>
        <a href="/about">About</a>
        <a href="/contact">Contact Us</a>
      </header>
      <main>
        <h1>HR-Driven Automated IT Onboarding</h1>
        <p>Provision HRIS workers to any directory or application</p>
        <section>
          <h2>About Aquera</h2>
          <p>
            Each day, Aquera automates over four million Joiner, Mover, Leaver
            transactions for millions of workers worldwide.
          </p>
        </section>
      </main>
    </body>
  </html>
`

const missingCareersRouteHtml = `
  <!doctype html>
  <html lang="en">
    <head>
      <meta charset="utf-8">
    </head>
    <body>
      <main>
        <h1>404</h1>
        <p>Not Found</p>
      </main>
    </body>
  </html>
`

const brandedCareersShellHtml = `
  <!doctype html>
  <html lang="en">
    <head>
      <title>Aquera | HR &amp; Identity Integration Platform as a Service</title>
      <link rel="canonical" href="https://aquera.com/careers">
    </head>
    <body>
      <main>
        <h1>HR-Driven Automated IT Onboarding</h1>
        <p>Provision HRIS workers to any directory or application</p>
        <section>
          <h2>About Aquera</h2>
          <p>Aquera 360 HR & Identity Integration Platform.</p>
        </section>
      </main>
    </body>
  </html>
`

const jobsBoardHtml = `
  <html>
    <body>
      <main>
        <h1>Careers</h1>
        <a href="/jobs/software-engineer">Software Engineer</a>
        <a href="/jobs/product-manager">Product Manager</a>
      </main>
    </body>
  </html>
`

test('detects the verified Aquera public site shell and absence of a jobs board', () => {
  assert.equal(HOMEPAGE_URL, 'https://aquera.com/')
  assert.equal(CAREERS_PAGE_URL, 'https://aquera.com/careers')
  assert.equal(hasOfficialHomepageSignal(homepageHtml), true)
  assert.equal(hasOfficialSiteSignal(brandedCareersShellHtml), true)
  assert.equal(hasMissingCareerRouteSignal(missingCareersRouteHtml), true)
  assert.equal(hasPublicJobsBoardSignal(brandedCareersShellHtml), false)
  assert.equal(hasPublicJobsBoardSignal(jobsBoardHtml), true)
})

test('run returns no jobs when Aquera exposes no public listings and the careers route is missing', async () => {
  const requestedUrls = []
  const jobs = await createAqueraScraper().run({
    fetchText: async (url) => {
      requestedUrls.push(url)

      if (url === HOMEPAGE_URL) return homepageHtml
      if (url === CAREERS_PAGE_URL) throw new Error(`HTTP 404 for ${url}`)

      throw new Error(`Unexpected URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [HOMEPAGE_URL, CAREERS_PAGE_URL])
  assert.deepEqual(jobs, [])
})

test('rejects unexpected public page shapes so the empty result stays truthful', async () => {
  await assert.rejects(
    createAqueraScraper().run({
      fetchText: async (url) => {
        if (url === HOMEPAGE_URL) return '<html><title>Home</title></html>'
        return brandedCareersShellHtml
      },
    }),
    /Aquera homepage no longer matches the verified official public site/,
  )

  await assert.rejects(
    createAqueraScraper().run({
      fetchText: async (url) => {
        if (url === HOMEPAGE_URL) return homepageHtml
        return jobsBoardHtml
      },
    }),
    /Aquera careers route now appears to expose public job listings/,
  )

  await assert.rejects(
    createAqueraScraper().run({
      fetchText: async (url) => {
        if (url === HOMEPAGE_URL) return homepageHtml
        return '<html><body><main>Coming soon</main></body></html>'
      },
    }),
    /Aquera careers route no longer matches the verified official public site shape/,
  )
})
