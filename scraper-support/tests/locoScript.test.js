import assert from 'node:assert/strict'
import test from 'node:test'

const HOMEPAGE_HTML = `
<!doctype html>
<html lang="en">
  <head>
    <title>Loco: Free Online Gaming, Esports Tournaments &amp; Live Streaming</title>
  </head>
  <body>
    <link rel="preload" as="script" href="https://static.loco.gg/next-assets/_next/static/chunks/main-app.js" />
    <h1>Loco: Free Online Gaming, Esports Tournaments &amp; Live Streaming</h1>
  </body>
</html>
`

const TERMS_HTML = `
<!doctype html>
<html lang="en">
  <head>
    <title>Loco | Terms Of Use</title>
    <meta name="description" content="terms of use">
  </head>
  <body>
    <p><strong class="section-title">TERMS OF USE</strong></p>
    <p>Last updated: 19 June, 2026</p>
    <p>"Company" refers to Loco Streaming Ltd, a company incorporated in Cyprus.</p>
    <p>The provider of services is Loco Streaming Ltd.</p>
    <a href="mailto:publishing_legal@loco.gg">publishing_legal@loco.gg</a>
  </body>
</html>
`

const PUBLIC_JOBS_HTML = `
<!doctype html>
<html lang="en">
  <body>
    <h1>Open Jobs</h1>
    <a href="https://jobs.example.com/community-manager">Apply now</a>
  </body>
</html>
`

const loadModule = async () => {
  try {
    return await import('../../scraper/loco/script.js')
  } catch {
    assert.fail('Expected Loco scraper module at ../../scraper/loco/script.js')
  }
}

test('Loco sentinel helpers stay pinned to the exact-name homepage, legacy redirect, and legal company surface', async () => {
  const loco = await loadModule()

  assert.equal(loco.COMPANY, 'Loco')
  assert.equal(loco.OFFICIAL_BRAND_NAME, 'Loco Streaming Ltd')
  assert.equal(loco.VERIFIED_ON, '2026-08-03')
  assert.equal(loco.HOMEPAGE_URL, 'https://loco.com/')
  assert.equal(loco.LEGACY_HOMEPAGE_URL, 'https://www.loco.gg/')
  assert.equal(loco.TERMS_OF_USE_URL, 'https://loco.com/legal/termsOfUse/terms-en.html')
  assert.equal(loco.hasOfficialHomepageSignal(HOMEPAGE_HTML), true)
  assert.equal(loco.hasTermsOfUseSignal(TERMS_HTML), true)
  assert.equal(loco.pageExposesPublicJobListings(HOMEPAGE_HTML), false)
  assert.equal(loco.pageExposesPublicJobListings(TERMS_HTML), false)
  assert.equal(loco.pageExposesPublicJobListings(PUBLIC_JOBS_HTML), true)
})

test('Loco returns [] only while the exact-name homepage, legacy redirect, and common careers routes stay non-listing', async () => {
  const loco = await loadModule()
  const requestedUrls = []

  const jobs = await loco.createLocoScraper().run({
    fetchPage: async (url) => {
      requestedUrls.push(url)

      if (url === loco.HOMEPAGE_URL) {
        return { status: 200, url, html: HOMEPAGE_HTML }
      }

      if (url === loco.LEGACY_HOMEPAGE_URL) {
        return { status: 200, url: loco.HOMEPAGE_URL, html: HOMEPAGE_HTML }
      }

      if (url === loco.TERMS_OF_USE_URL) {
        return { status: 200, url, html: TERMS_HTML }
      }

      if (loco.NO_PUBLIC_CAREER_ROUTE_URLS.includes(url)) {
        return { status: 404, url, html: '<html><body>404</body></html>' }
      }

      throw new Error(`Unexpected Loco URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [
    loco.HOMEPAGE_URL,
    loco.LEGACY_HOMEPAGE_URL,
    loco.TERMS_OF_USE_URL,
    ...loco.NO_PUBLIC_CAREER_ROUTE_URLS,
  ])
  assert.deepEqual(jobs, [])
})

test('Loco fails closed when the verified exact-name sentinel surface changes materially', async () => {
  const loco = await loadModule()

  await assert.rejects(
    loco.createLocoScraper().run({
      fetchPage: async (url) => {
        if (url === loco.HOMEPAGE_URL) {
          return { status: 200, url, html: '<html><body>Unexpected</body></html>' }
        }

        if (url === loco.LEGACY_HOMEPAGE_URL) {
          return { status: 200, url: loco.HOMEPAGE_URL, html: HOMEPAGE_HTML }
        }

        if (url === loco.TERMS_OF_USE_URL) {
          return { status: 200, url, html: TERMS_HTML }
        }

        if (loco.NO_PUBLIC_CAREER_ROUTE_URLS.includes(url)) {
          return { status: 404, url, html: '<html><body>404</body></html>' }
        }

        throw new Error(`Unexpected Loco URL: ${url}`)
      },
    }),
    /verified exact-name homepage/i,
  )

  await assert.rejects(
    loco.createLocoScraper().run({
      fetchPage: async (url) => {
        if (url === loco.HOMEPAGE_URL) {
          return { status: 200, url, html: HOMEPAGE_HTML }
        }

        if (url === loco.LEGACY_HOMEPAGE_URL) {
          return { status: 200, url: 'https://www.loco.gg/', html: HOMEPAGE_HTML }
        }

        if (url === loco.TERMS_OF_USE_URL) {
          return { status: 200, url, html: TERMS_HTML }
        }

        if (loco.NO_PUBLIC_CAREER_ROUTE_URLS.includes(url)) {
          return { status: 404, url, html: '<html><body>404</body></html>' }
        }

        throw new Error(`Unexpected Loco URL: ${url}`)
      },
    }),
    /legacy homepage redirect/i,
  )

  await assert.rejects(
    loco.createLocoScraper().run({
      fetchPage: async (url) => {
        if (url === loco.HOMEPAGE_URL) {
          return { status: 200, url, html: HOMEPAGE_HTML }
        }

        if (url === loco.LEGACY_HOMEPAGE_URL) {
          return { status: 200, url: loco.HOMEPAGE_URL, html: HOMEPAGE_HTML }
        }

        if (url === loco.TERMS_OF_USE_URL) {
          return { status: 200, url, html: TERMS_HTML }
        }

        if (loco.NO_PUBLIC_CAREER_ROUTE_URLS.includes(url)) {
          return { status: 200, url, html: PUBLIC_JOBS_HTML }
        }

        throw new Error(`Unexpected Loco URL: ${url}`)
      },
    }),
    /verified no-public-careers route changed/i,
  )
})
