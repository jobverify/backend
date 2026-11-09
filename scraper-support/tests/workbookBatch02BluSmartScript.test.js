import assert from 'node:assert/strict'
import test from 'node:test'

const PLACEHOLDER_HTML = `
<!doctype html>
<html lang="en">
  <head>
    <title>BluSmart tablets</title>
    <meta property="og:title" content="BluSmart Tablets">
  </head>
  <body>
    <h2>bluSmart</h2>
    <a href="http://blusmart.com">info@blusmart.com</a>
    <a href="https://www.facebook.com/profile.php?id=100084280016307">Facebook</a>
  </body>
</html>
`

const MISSING_ROUTE_HTML = `
<!doctype html>
<html lang="en">
  <head>
    <title>404 Not Found</title>
  </head>
  <body>
    <h1>Not Found</h1>
    <p>The requested URL was not found on this server.</p>
  </body>
</html>
`

const PUBLIC_JOBS_HTML = `
<!doctype html>
<html lang="en">
  <body>
    <h1>Current Openings</h1>
    <a href="https://jobs.example.com/community-manager">Apply now</a>
  </body>
</html>
`

const loadModule = async () => {
  try {
    return await import('../../scraper/blusmart/script.js')
  } catch {
    assert.fail('Expected BluSmart scraper module at ../../scraper/blusmart/script.js')
  }
}

test('BluSmart helper signals stay pinned to the verified placeholder homepage, legacy alias, and missing careers route', async () => {
  const blusmart = await loadModule()

  assert.equal(blusmart.SOURCE, 'blusmart')
  assert.equal(blusmart.COMPANY, 'BluSmart')
  assert.equal(blusmart.VERIFIED_ON, '2026-07-30')
  assert.equal(blusmart.HOMEPAGE_URL, 'https://blusmart.com/')
  assert.equal(blusmart.LEGACY_CAREERS_URL, 'https://www.blusmart.in/careers')
  assert.equal(blusmart.MISSING_CAREERS_URL, 'https://blusmart.com/careers')
  assert.equal(blusmart.hasOfficialPlaceholderSignal(PLACEHOLDER_HTML), true)
  assert.equal(blusmart.pageExposesPublicJobListings(PLACEHOLDER_HTML), false)
  assert.equal(blusmart.pageExposesPublicJobListings(PUBLIC_JOBS_HTML), true)
  assert.equal(
    blusmart.isVerifiedMissingCareerRoute(
      { status: 404, url: blusmart.MISSING_CAREERS_URL, html: MISSING_ROUTE_HTML },
      blusmart.MISSING_CAREERS_URL,
    ),
    true,
  )
})

test('BluSmart returns [] only while the verified placeholder homepage and legacy alias stay non-listing and /careers stays missing', async () => {
  const blusmart = await loadModule()
  const requestedUrls = []

  const jobs = await blusmart.createBluSmartScraper().run({
    fetchPage: async (url) => {
      requestedUrls.push(url)

      if (url === blusmart.HOMEPAGE_URL) {
        return { status: 200, url, html: PLACEHOLDER_HTML }
      }

      if (url === blusmart.LEGACY_CAREERS_URL) {
        return { status: 200, url: 'http://blusmart.com/', html: PLACEHOLDER_HTML }
      }

      if (url === blusmart.MISSING_CAREERS_URL) {
        return { status: 404, url, html: MISSING_ROUTE_HTML }
      }

      throw new Error(`Unexpected BluSmart URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [
    blusmart.HOMEPAGE_URL,
    blusmart.LEGACY_CAREERS_URL,
    blusmart.MISSING_CAREERS_URL,
  ])
  assert.deepEqual(jobs, [])
})

test('BluSmart fails closed when the verified no-public-careers placeholder surface changes materially', async () => {
  const blusmart = await loadModule()

  await assert.rejects(
    blusmart.createBluSmartScraper().run({
      fetchPage: async (url) => {
        if (url === blusmart.HOMEPAGE_URL) {
          return { status: 200, url, html: '<html><body>Unexpected</body></html>' }
        }

        if (url === blusmart.LEGACY_CAREERS_URL) {
          return { status: 200, url: 'http://blusmart.com/', html: PLACEHOLDER_HTML }
        }

        if (url === blusmart.MISSING_CAREERS_URL) {
          return { status: 404, url, html: MISSING_ROUTE_HTML }
        }

        throw new Error(`Unexpected BluSmart URL: ${url}`)
      },
    }),
    /exact-name homepage/i,
  )

  await assert.rejects(
    blusmart.createBluSmartScraper().run({
      fetchPage: async (url) => {
        if (url === blusmart.HOMEPAGE_URL) {
          return { status: 200, url, html: PLACEHOLDER_HTML }
        }

        if (url === blusmart.LEGACY_CAREERS_URL) {
          return { status: 200, url: 'https://www.blusmart.in/careers', html: PUBLIC_JOBS_HTML }
        }

        if (url === blusmart.MISSING_CAREERS_URL) {
          return { status: 404, url, html: MISSING_ROUTE_HTML }
        }

        throw new Error(`Unexpected BluSmart URL: ${url}`)
      },
    }),
    /legacy careers alias/i,
  )

  await assert.rejects(
    blusmart.createBluSmartScraper().run({
      fetchPage: async (url) => {
        if (url === blusmart.HOMEPAGE_URL) {
          return { status: 200, url, html: PLACEHOLDER_HTML }
        }

        if (url === blusmart.LEGACY_CAREERS_URL) {
          return { status: 200, url: 'http://blusmart.com/', html: PLACEHOLDER_HTML }
        }

        if (url === blusmart.MISSING_CAREERS_URL) {
          return { status: 200, url, html: PUBLIC_JOBS_HTML }
        }

        throw new Error(`Unexpected BluSmart URL: ${url}`)
      },
    }),
    /verified no-public-careers route changed/i,
  )
})
