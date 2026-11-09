import assert from 'node:assert/strict'
import test from 'node:test'

const HOMEPAGE_HTML = `
<!doctype html>
<html lang="en">
  <head>
    <title>Pregnancy Delivery Packages </title>
    <link rel="canonical" href="https://www.parentlane.com/" />
  </head>
  <body>
    <main>
      <p>Parentlane is an AI powered digital health platform empowering the new age parents through pregnancy.</p>
      <h2>Download the Parentlane App for Pregnancy Care</h2>
      <a href="mailto:info@parentlane.com">info@parentlane.com</a>
      <footer>&copy; 2023- Parentlane, ACKO Technology & Services Pvt Ltd</footer>
    </main>
  </body>
</html>
`

const ABOUT_HTML = `
<!doctype html>
<html lang="en">
  <head>
    <title>About Parentlane - Pregnancy, Parenting, Baby Care & Child Development</title>
  </head>
  <body>
    <main>
      <p class="pink-text ds">Data Science and</p>
      <p>
        We’re a data science and technology firm based in Bangalore, India, and
        we build products for pregnancy, parenting, baby care and child development.
      </p>
    </main>
  </body>
</html>
`

const CAREERS_404_HTML = `
<!doctype html>
<html>
  <head>
    <title>404 Not Found</title>
  </head>
  <body>
    <h1>Not Found</h1>
    <p>The requested URL /careers was not found on this server.</p>
  </body>
</html>
`

const PUBLIC_JOBS_HTML = `
<!doctype html>
<html lang="en">
  <body>
    <h1>Current Openings</h1>
    <script type="application/ld+json">
      {"@context":"https://schema.org","@type":"JobPosting","title":"Care Navigator"}
    </script>
    <a href="https://jobs.example.com/parentlane/care-navigator">Apply now</a>
  </body>
</html>
`

const loadScriptModule = async () => {
  try {
    return await import('../../scraper/parentlane/script.js')
  } catch {
    assert.fail('Expected Parentlane scraper module at ../../scraper/parentlane/script.js')
  }
}

test('Parentlane sentinel helpers stay pinned to the verified homepage, about page, and missing careers route', async () => {
  const parentlane = await loadScriptModule()

  assert.equal(parentlane.SOURCE, 'parentlane')
  assert.equal(parentlane.COMPANY, 'Parentlane')
  assert.equal(parentlane.OFFICIAL_BRAND_NAME, 'Parentlane')
  assert.equal(parentlane.VERIFIED_ON, '2026-07-17')
  assert.equal(parentlane.HOMEPAGE_URL, 'https://www.parentlane.com/')
  assert.equal(parentlane.ABOUT_URL, 'https://www.parentlane.com/aboutus.html')
  assert.equal(parentlane.CAREERS_URL, 'https://www.parentlane.com/careers')
  assert.equal(parentlane.SUPPORT_EMAIL, 'info@parentlane.com')
  assert.equal(parentlane.extractSupportEmail(HOMEPAGE_HTML), 'info@parentlane.com')
  assert.equal(parentlane.hasOfficialHomepageSignal(HOMEPAGE_HTML), true)
  assert.equal(parentlane.hasOfficialAboutPageSignal(ABOUT_HTML), true)
  assert.equal(parentlane.hasMissingCareersRouteSignal(CAREERS_404_HTML), true)
  assert.equal(parentlane.pageExposesPublicJobListings(HOMEPAGE_HTML), false)
  assert.equal(parentlane.pageExposesPublicJobListings(CAREERS_404_HTML), false)
  assert.equal(parentlane.pageExposesPublicJobListings(PUBLIC_JOBS_HTML), true)
  assert.equal(
    parentlane.isExpectedTlsFailure({
      message: 'fetch failed',
      cause: {
        code: 'DEPTH_ZERO_SELF_SIGNED_CERT',
        message: 'self-signed certificate; if the root CA is installed locally, try running Node.js with --use-system-ca',
      },
    }),
    true,
  )
})

test('Parentlane returns [] when the exact-name domain currently fails standard TLS validation', async () => {
  const parentlane = await loadScriptModule()
  const requestedUrls = []

  const jobs = await parentlane.createParentlaneScraper().run({
    fetchPage: async (url) => {
      requestedUrls.push(url)
      throw Object.assign(new TypeError('fetch failed'), {
        cause: {
          code: 'DEPTH_ZERO_SELF_SIGNED_CERT',
          message: 'self-signed certificate; if the root CA is installed locally, try running Node.js with --use-system-ca',
        },
      })
    },
  })

  assert.deepEqual(requestedUrls, [parentlane.HOMEPAGE_URL])
  assert.deepEqual(jobs, [])
})

test('Parentlane also returns [] when the verified homepage and about page exist but the careers route is still missing', async () => {
  const parentlane = await loadScriptModule()
  const requestedUrls = []

  const jobs = await parentlane.createParentlaneScraper().run({
    fetchPage: async (url) => {
      requestedUrls.push(url)

      if (url === parentlane.HOMEPAGE_URL) {
        return { status: 200, url, html: HOMEPAGE_HTML }
      }

      if (url === parentlane.ABOUT_URL) {
        return { status: 200, url, html: ABOUT_HTML }
      }

      if (url === parentlane.CAREERS_URL) {
        return { status: 404, url, html: CAREERS_404_HTML }
      }

      throw new Error(`Unexpected Parentlane URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [
    parentlane.HOMEPAGE_URL,
    parentlane.ABOUT_URL,
    parentlane.CAREERS_URL,
  ])
  assert.deepEqual(jobs, [])
})

test('Parentlane fails closed when the verified surface drifts or starts exposing public jobs', async () => {
  const parentlane = await loadScriptModule()

  await assert.rejects(
    parentlane.createParentlaneScraper().run({
      fetchPage: async (url) => {
        if (url === parentlane.HOMEPAGE_URL) {
          return { status: 200, url, html: '<html><body><h1>Unexpected</h1></body></html>' }
        }

        throw new Error(`Unexpected Parentlane URL: ${url}`)
      },
    }),
    /verified official homepage/i,
  )

  await assert.rejects(
    parentlane.createParentlaneScraper().run({
      fetchPage: async (url) => {
        if (url === parentlane.HOMEPAGE_URL) {
          return { status: 200, url, html: HOMEPAGE_HTML }
        }

        if (url === parentlane.ABOUT_URL) {
          return { status: 200, url, html: ABOUT_HTML }
        }

        if (url === parentlane.CAREERS_URL) {
          return { status: 200, url, html: PUBLIC_JOBS_HTML }
        }

        throw new Error(`Unexpected Parentlane URL: ${url}`)
      },
    }),
    /careers route now appears to expose public jobs/i,
  )
})
