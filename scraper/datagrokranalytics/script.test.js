import assert from 'node:assert/strict'
import test from 'node:test'

const loadModule = async () => import('./script.js')

const unrelatedHomepageHtml = `
<!doctype html>
<html lang="hu-HU">
  <head>
    <title>Chicken Road Jatek 2025 | Ismerje Meg a Nepszeru Kaszino Jatekot</title>
    <meta name="description" content="Chicken Road casino review and bonus guide.">
  </head>
  <body>
    <main>
      <h1>Chicken Road</h1>
      <p>A Chicken Road egy izgalmas crash jatek.</p>
      <p>Curacao licensing information and casino gameplay details.</p>
    </main>
    <footer>
      <p>Email: support@chickenroad.com</p>
    </footer>
  </body>
</html>
`

const unrelated404Html = `
<!doctype html>
<html lang="hu-HU">
  <head>
    <title>404 - Page not found - Chicken Road</title>
  </head>
  <body>
    <main>
      <h1>404</h1>
      <p>Page not found.</p>
      <p>Chicken Road</p>
      <p>Email: support@chickenroad.com</p>
    </main>
  </body>
</html>
`

const unresolvedError = Object.assign(new Error('getaddrinfo ENOTFOUND datagrokranalytics.com'), {
  cause: { code: 'ENOTFOUND' },
})

const publicJobsHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Datagrokr Analytics Careers</title>
  </head>
  <body>
    <main>
      <h1>Current Openings</h1>
      <a href="https://jobs.lever.co/datagrokr/platform-engineer">Apply now</a>
    </main>
  </body>
</html>
`

test('Datagrokr Analytics sentinel pins the verified unrelated live domain and unresolved candidate first-party domains', async () => {
  const datagrokr = await loadModule()

  assert.equal(datagrokr.SOURCE, 'datagrokranalytics')
  assert.equal(datagrokr.COMPANY, 'Datagrokr Analytics')
  assert.equal(datagrokr.HOMEPAGE_URL, 'https://datagrokr.com/')
  assert.deepEqual(datagrokr.CAREERS_ROUTE_URLS, [
    'https://datagrokr.com/careers',
    'https://datagrokr.com/careers/',
    'https://datagrokr.com/jobs',
    'https://datagrokr.com/jobs/',
  ])
  assert.deepEqual(datagrokr.UNRESOLVED_CANDIDATE_URLS, [
    'https://datagrokranalytics.com/',
    'https://www.datagrokranalytics.com/',
    'https://datagrokranalytics.in/',
    'https://www.datagrokranalytics.in/',
    'https://datagrokr.ai/',
    'https://www.datagrokr.ai/',
    'https://datagrokranalytics.co.in/',
    'https://www.datagrokranalytics.co.in/',
  ])

  assert.equal(datagrokr.hasVerifiedUnrelatedHomepageSignal(unrelatedHomepageHtml), true)
  assert.equal(datagrokr.hasVerifiedUnrelatedHomepageSignal(publicJobsHtml), false)
  assert.equal(datagrokr.hasPublicJobsSignal(publicJobsHtml), true)
  assert.equal(
    datagrokr.isVerifiedUnrelatedCareers404({
      status: 404,
      url: 'https://datagrokr.com/careers',
      html: unrelated404Html,
    }),
    true,
  )
  assert.equal(datagrokr.isUnresolvedCandidateDomainError(unresolvedError), true)
})

test('Datagrokr Analytics sentinel returns [] only while the verified unrelated shell and unresolved candidate domains remain unchanged', async () => {
  const datagrokr = await loadModule()
  const requestedUrls = []

  const jobs = await datagrokr.createDatagrokrAnalyticsScraper().run({
    fetchPage: async (url) => {
      requestedUrls.push(url)

      if (url === datagrokr.HOMEPAGE_URL) {
        return { status: 200, url, html: unrelatedHomepageHtml }
      }

      if (datagrokr.CAREERS_ROUTE_URLS.includes(url)) {
        return { status: 404, url, html: unrelated404Html }
      }

      if (datagrokr.UNRESOLVED_CANDIDATE_URLS.includes(url)) {
        return { status: null, url, html: '', error: unresolvedError }
      }

      throw new Error(`Unexpected URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [
    datagrokr.HOMEPAGE_URL,
    ...datagrokr.CAREERS_ROUTE_URLS,
    ...datagrokr.UNRESOLVED_CANDIDATE_URLS,
  ])
  assert.deepEqual(jobs, [])
})

test('Datagrokr Analytics sentinel fails closed when the live shell drifts into a company or public-jobs surface', async () => {
  const datagrokr = await loadModule()

  await assert.rejects(
    datagrokr.createDatagrokrAnalyticsScraper().run({
      fetchPage: async (url) => {
        if (url === datagrokr.HOMEPAGE_URL) {
          return { status: 200, url, html: publicJobsHtml }
        }

        throw new Error(`Unexpected URL: ${url}`)
      },
    }),
    /homepage no longer matches|public jobs surface/i,
  )

  await assert.rejects(
    datagrokr.createDatagrokrAnalyticsScraper().run({
      fetchPage: async (url) => {
        if (url === datagrokr.HOMEPAGE_URL) {
          return { status: 200, url, html: unrelatedHomepageHtml }
        }

        if (datagrokr.CAREERS_ROUTE_URLS.includes(url)) {
          return {
            status: 200,
            url,
            html: publicJobsHtml,
          }
        }

        throw new Error(`Unexpected URL: ${url}`)
      },
    }),
    /careers-like routes changed materially|public jobs/i,
  )

  await assert.rejects(
    datagrokr.createDatagrokrAnalyticsScraper().run({
      fetchPage: async (url) => {
        if (url === datagrokr.HOMEPAGE_URL) {
          return { status: 200, url, html: unrelatedHomepageHtml }
        }

        if (datagrokr.CAREERS_ROUTE_URLS.includes(url)) {
          return { status: 404, url, html: unrelated404Html }
        }

        if (datagrokr.UNRESOLVED_CANDIDATE_URLS.includes(url)) {
          return {
            status: 200,
            url,
            html: '<html><body><h1>Datagrokr Analytics</h1></body></html>',
          }
        }

        throw new Error(`Unexpected URL: ${url}`)
      },
    }),
    /candidate first-party domain now resolves|no longer unresolved/i,
  )
})
