import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

const readFixture = (name) => fs.readFileSync(path.join(currentDir, 'fixtures', name), 'utf8')

const homepageHtml = readFixture('homepage.html')
const soft404Html = readFixture('careers-soft-404.html')
const forbiddenHomepageHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>403 Forbidden</title>
  </head>
  <body>
    <main>
      <h1>403 Forbidden</h1>
      <p>Forbidden</p>
      <p>You don't have permission to access this resource.</p>
    </main>
  </body>
</html>
`

const missingRouteHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>404 Not Found</title>
  </head>
  <body>
    <main>
      <h1>404 Not Found</h1>
      <p>Not Found</p>
      <p>The requested URL was not found on this server.</p>
    </main>
  </body>
</html>
`

const loadModule = async () => {
  try {
    return await import('./script.js')
  } catch {
    assert.fail('Expected RS Academy scraper module at ./script.js')
  }
}

test('RS Academy sentinels recognize the verified homepage and non-listing careers routes', async () => {
  const rsacademy = await loadModule()

  assert.equal(rsacademy.SOURCE, 'rsacademy')
  assert.equal(rsacademy.COMPANY, 'RS Academy')
  assert.equal(rsacademy.HOMEPAGE_URL, 'https://www.rsacademy.co.in/')
  assert.deepEqual(rsacademy.NON_LISTING_ROUTE_URLS, [
    'https://www.rsacademy.co.in/careers',
    'https://www.rsacademy.co.in/careers/',
    'https://www.rsacademy.co.in/career',
    'https://www.rsacademy.co.in/jobs',
    'https://www.rsacademy.co.in/join-us',
  ])
  assert.equal(rsacademy.hasOfficialHomepageSignal(homepageHtml), true)
  assert.equal(rsacademy.hasPublicJobsSignal(homepageHtml), false)
  assert.equal(
    rsacademy.hasSoft404NonListingSignal(soft404Html, rsacademy.NON_LISTING_ROUTE_URLS[0]),
    true,
  )
  assert.equal(
    rsacademy.hasPublicJobsSignal(soft404Html, rsacademy.NON_LISTING_ROUTE_URLS[0]),
    false,
  )
  assert.equal(
    rsacademy.hasPublicJobsSignal(soft404Html, 'https://www.rsacademy.co.in/unrelated'),
    true,
  )
})

test('RS Academy returns no jobs only while the verified homepage and non-listing routes remain unchanged', async () => {
  const rsacademy = await loadModule()
  const requestedUrls = []

  const jobs = await rsacademy.createRsAcademyScraper().run({
    fetchPage: async (url) => {
      requestedUrls.push(url)

      if (url === rsacademy.HOMEPAGE_URL) {
        return { status: 200, url, html: homepageHtml }
      }

      if (rsacademy.NON_LISTING_ROUTE_URLS.includes(url)) {
        return {
          status: 200,
          url,
          html: soft404Html.replace('https://www.rsacademy.co.in/careers', url),
        }
      }

      throw new Error(`Unexpected RS Academy URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [
    rsacademy.HOMEPAGE_URL,
    ...rsacademy.NON_LISTING_ROUTE_URLS,
  ])
  assert.deepEqual(jobs, [])
})

test('RS Academy fails closed when the homepage or non-listing routes drift into a jobs surface', async () => {
  const rsacademy = await loadModule()

  await assert.rejects(
    rsacademy.createRsAcademyScraper().run({
      fetchPage: async (url) => {
        if (url === rsacademy.HOMEPAGE_URL) {
          return { status: 200, url, html: '<html><head><title>Unexpected</title></head><body></body></html>' }
        }

        return { status: 200, url, html: soft404Html }
      },
    }),
    /verified official homepage/i,
  )

  await assert.rejects(
    rsacademy.createRsAcademyScraper().run({
      fetchPage: async (url) => {
        if (url === rsacademy.HOMEPAGE_URL) {
          return {
            status: 200,
            url,
            html: homepageHtml.replace(
              '</body>',
              '<a href="https://jobs.lever.co/rsacademy">Current Openings</a></body>',
            ),
          }
        }

        return {
          status: 200,
          url,
          html: soft404Html.replace('https://www.rsacademy.co.in/careers', url),
        }
      },
    }),
    /public careers or jobs signal/i,
  )

  await assert.rejects(
    rsacademy.createRsAcademyScraper().run({
      fetchPage: async (url) => {
        if (url === rsacademy.HOMEPAGE_URL) {
          return { status: 200, url, html: homepageHtml }
        }

        if (url === rsacademy.NON_LISTING_ROUTE_URLS[0]) {
          return {
            status: 200,
            url,
            html: soft404Html.replace(
              'Page not found',
              'Current Openings',
            ).replace(
              '</body>',
              '<a href="/jobs/senior-stylist">Apply now</a></body>',
            ),
          }
        }

        return {
          status: 200,
          url,
          html: soft404Html.replace('https://www.rsacademy.co.in/careers', url),
        }
      },
    }),
    /verified non-listing route changed|public careers or jobs signal/i,
  )
})

test('RS Academy returns no jobs when the homepage is currently blocked and the legacy careers routes all resolve to the verified 404 shell', async () => {
  const rsacademy = await loadModule()

  const jobs = await rsacademy.createRsAcademyScraper().run({
    fetchPage: async (url) => {
      if (url === rsacademy.HOMEPAGE_URL) {
        return { status: 403, url, html: forbiddenHomepageHtml }
      }

      return { status: 404, url, html: missingRouteHtml }
    },
  })

  assert.deepEqual(jobs, [])
})
