import assert from 'node:assert/strict'
import test from 'node:test'

const HOMEPAGE_HTML = `
<!doctype html>
<html lang="en">
  <head>
    <title>Men&#x27;s Clothing | Buy Mens Apparel Online in India | Damensch</title>
  </head>
  <body>
    <p>DOWNLOAD THE APP!</p>
    <p>EVERYTHING IS BETTER ON THE APP</p>
    <nav>
      <a href="/collections/innerwear">Innerwear</a>
      <a href="/collections/topwear">Topwear</a>
      <a href="/collections/bottomwear">Bottomwear</a>
    </nav>
    <p>30 Day Free Trial</p>
  </body>
</html>
`

const ABOUT_HTML = `
<!doctype html>
<html lang="en">
  <head>
    <title>About us - Premium &amp; Sustainable Menswear brand - DaMENSCH</title>
  </head>
  <body>
    <main>
      <h1>About Damensch</h1>
      <h2>Fashion That Thinks</h2>
      <p>We believe thoughtfulness can bridge any gap - traditional and modern, near and far, people and planet.</p>
      <p>We took the gap in the men&#x27;s fashion industry for innovation and designed it for the way we aspire to live.</p>
      <h2>Think Sustainability</h2>
    </main>
  </body>
</html>
`

const MISSING_ROUTE_HTML = `
<!doctype html>
<html lang="en">
  <head>
    <title>DaMENSCH</title>
  </head>
  <body>
    <main>
      <h1>404 Page not found</h1>
      <p>The page you’re looking for doesn’t exist or the link is incorrect.</p>
      <a href="/">Go to Home</a>
      <p>Browse Products</p>
    </main>
  </body>
</html>
`

const STOREFRONT_SHELL_HTML = `
<!doctype html>
<html lang="en">
  <body>
    <p>DOWNLOAD THE APP!</p>
    <p>EVERYTHING IS BETTER ON THE APP</p>
    <nav>
      <a href="/collections/innerwear">Innerwear</a>
      <a href="/collections/topwear">Topwear</a>
      <a href="/collections/bottomwear">Bottomwear</a>
    </nav>
    <p>30 Day Free Trial</p>
    <section>
      <h2>Company</h2>
      <a href="/pages/about-us">About Us</a>
      <a href="/policies/terms-of-service">Terms</a>
    </section>
    <p>Experience the DaMENSCH Mobile App</p>
  </body>
</html>
`

const PUBLIC_JOBS_HTML = `
<!doctype html>
<html lang="en">
  <body>
    <h1>Current Openings</h1>
    <article>
      <h2>Product Designer</h2>
      <p>Bengaluru, India</p>
      <a href="https://jobs.example.com/damensch-product-designer">Apply Now</a>
    </article>
  </body>
</html>
`

const loadModule = async () => {
  try {
    return await import('../../scraper/damensch/script.js')
  } catch {
    assert.fail('Expected DaMENSCH scraper module at ../../scraper/damensch/script.js')
  }
}

test('DaMENSCH helper signals stay pinned to the verified official surfaces from Thursday, July 30, 2026', async () => {
  const damensch = await loadModule()

  assert.equal(damensch.SOURCE, 'damensch')
  assert.equal(damensch.COMPANY, 'DaMENSCH')
  assert.equal(damensch.VERIFIED_ON, '2026-07-30')
  assert.equal(damensch.HOMEPAGE_URL, 'https://www.damensch.com/')
  assert.equal(damensch.ABOUT_URL, 'https://www.damensch.com/about-us')
  assert.equal(damensch.CAREERS_URL, 'https://www.damensch.com/careers')
  assert.equal(damensch.JOBS_URL, 'https://www.damensch.com/jobs')
  assert.equal(damensch.PAGES_CAREERS_URL, 'https://www.damensch.com/pages/careers')
  assert.equal(damensch.hasOfficialHomepageSignal(HOMEPAGE_HTML), true)
  assert.equal(damensch.hasOfficialAboutPageSignal(ABOUT_HTML), true)
  assert.equal(damensch.hasStorefrontShellSignal(STOREFRONT_SHELL_HTML), true)
  assert.equal(damensch.pageExposesPublicJobListings(STOREFRONT_SHELL_HTML), false)
  assert.equal(damensch.pageExposesPublicJobListings(PUBLIC_JOBS_HTML), true)
  assert.equal(
    damensch.isVerifiedMissingCareerRoute(
      {
        status: 404,
        url: damensch.CAREERS_URL,
        html: MISSING_ROUTE_HTML,
      },
      damensch.CAREERS_URL,
    ),
    true,
  )
  assert.equal(
    damensch.isVerifiedStorefrontShellPage(
      {
        status: 200,
        url: damensch.PAGES_CAREERS_URL,
        html: STOREFRONT_SHELL_HTML,
      },
      damensch.PAGES_CAREERS_URL,
    ),
    true,
  )
})

test('DaMENSCH returns [] only while the verified official and missing-careers routes keep the same contract', async () => {
  const damensch = await loadModule()
  const requestedUrls = []

  const jobs = await damensch.createDamenschScraper().run({
    fetchPage: async (url) => {
      requestedUrls.push(url)

      if (url === damensch.HOMEPAGE_URL) {
        return { status: 200, url, html: HOMEPAGE_HTML }
      }

      if (url === damensch.ABOUT_URL) {
        return { status: 200, url, html: ABOUT_HTML }
      }

      if (url === damensch.CAREERS_URL || url === damensch.JOBS_URL) {
        return { status: 404, url, html: MISSING_ROUTE_HTML }
      }

      if (url === damensch.PAGES_CAREERS_URL) {
        return { status: 200, url, html: STOREFRONT_SHELL_HTML }
      }

      throw new Error(`Unexpected DaMENSCH URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [
    damensch.HOMEPAGE_URL,
    damensch.ABOUT_URL,
    damensch.CAREERS_URL,
    damensch.JOBS_URL,
    damensch.PAGES_CAREERS_URL,
  ])
  assert.deepEqual(jobs, [])
})

test('DaMENSCH fails closed when a verified route starts exposing public jobs or stops matching the verified shell', async () => {
  const damensch = await loadModule()

  await assert.rejects(
    damensch.createDamenschScraper().run({
      fetchPage: async (url) => {
        if (url === damensch.HOMEPAGE_URL) {
          return { status: 200, url, html: '<html><body>Unexpected</body></html>' }
        }

        if (url === damensch.ABOUT_URL) {
          return { status: 200, url, html: ABOUT_HTML }
        }

        if (url === damensch.CAREERS_URL || url === damensch.JOBS_URL) {
          return { status: 404, url, html: MISSING_ROUTE_HTML }
        }

        if (url === damensch.PAGES_CAREERS_URL) {
          return { status: 200, url, html: STOREFRONT_SHELL_HTML }
        }

        throw new Error(`Unexpected DaMENSCH URL: ${url}`)
      },
    }),
    /homepage for damensch/i,
  )

  await assert.rejects(
    damensch.createDamenschScraper().run({
      fetchPage: async (url) => {
        if (url === damensch.HOMEPAGE_URL) {
          return { status: 200, url, html: HOMEPAGE_HTML }
        }

        if (url === damensch.ABOUT_URL) {
          return { status: 200, url, html: ABOUT_HTML }
        }

        if (url === damensch.CAREERS_URL) {
          return { status: 404, url, html: MISSING_ROUTE_HTML }
        }

        if (url === damensch.JOBS_URL) {
          return { status: 200, url, html: PUBLIC_JOBS_HTML }
        }

        if (url === damensch.PAGES_CAREERS_URL) {
          return { status: 200, url, html: STOREFRONT_SHELL_HTML }
        }

        throw new Error(`Unexpected DaMENSCH URL: ${url}`)
      },
    }),
    /jobs route for damensch/i,
  )

  await assert.rejects(
    damensch.createDamenschScraper().run({
      fetchPage: async (url) => {
        if (url === damensch.HOMEPAGE_URL) {
          return { status: 200, url, html: HOMEPAGE_HTML }
        }

        if (url === damensch.ABOUT_URL) {
          return { status: 200, url, html: ABOUT_HTML }
        }

        if (url === damensch.CAREERS_URL || url === damensch.JOBS_URL) {
          return { status: 404, url, html: MISSING_ROUTE_HTML }
        }

        if (url === damensch.PAGES_CAREERS_URL) {
          return { status: 200, url, html: PUBLIC_JOBS_HTML }
        }

        throw new Error(`Unexpected DaMENSCH URL: ${url}`)
      },
    }),
    /pages\/careers route for damensch/i,
  )
})
