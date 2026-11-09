import assert from 'node:assert/strict'
import test from 'node:test'

const HOMEPAGE_HTML = `
<!doctype html>
<html lang="en">
  <head>
    <title>Arivihan - India's First Fully Automated Vernacular Online Learning Platform</title>
  </head>
  <body>
    <nav>
      <a>Home</a>
      <a>About</a>
      <a>Contact</a>
      <a>Blogs</a>
      <a>Results</a>
    </nav>
    <button>Install Now</button>
  </body>
</html>
`

const ABOUT_PAGE_HTML = `
<!doctype html>
<html lang="en">
  <head>
    <title>Arivihan - India's First Fully Automated Vernacular Online Learning Platform</title>
    <meta name="description" content="Arivihan is India's first fully automated vernacular online learning platform.">
  </head>
  <body>
    <h5>About Us</h5>
    <p>
      We Are Building India's 1st Ever Fully Automated Online Learning Platform,
      Providing 1on1, Interactive, And Personalized High-Quality Lectures.
    </p>
    <h5>Our Mission</h5>
    <p>
      To solve this problem affecting the careers of millions of students in our country,
      we are building India's 1st fully automated online learning platform which is extremely affordable.
    </p>
    <h5>Our Leadership</h5>
    <h5>Ritesh Singh</h5>
  </body>
</html>
`

const MISSING_ROUTE_HTML = `
<!doctype html>
<html lang="en">
  <head>
    <title>Not Found</title>
  </head>
  <body>
    <div>404</div>
    <div>Not Found</div>
  </body>
</html>
`

const PUBLIC_JOBS_HTML = `
<!doctype html>
<html lang="en">
  <body>
    <h1>Current Openings</h1>
    <a href="https://jobs.example.com/founding-engineer">Apply now</a>
  </body>
</html>
`

const loadModule = async () => {
  try {
    return await import('../../scraper/arivihan/script.js')
  } catch {
    assert.fail('Expected Arivihan scraper module at ../../scraper/arivihan/script.js')
  }
}

test('Arivihan helper signals stay pinned to the verified homepage, about page, and missing careers routes', async () => {
  const arivihan = await loadModule()

  assert.equal(arivihan.SOURCE, 'arivihan')
  assert.equal(arivihan.COMPANY, 'Arivihan')
  assert.equal(arivihan.VERIFIED_ON, '2026-08-01')
  assert.equal(arivihan.HOMEPAGE_URL, 'https://www.arivihan.com/')
  assert.equal(arivihan.ABOUT_URL, 'https://www.arivihan.com/about')
  assert.equal(arivihan.CAREERS_URL, 'https://www.arivihan.com/careers')
  assert.equal(arivihan.NON_WWW_CAREERS_URL, 'https://arivihan.com/careers')
  assert.equal(arivihan.hasOfficialHomepageSignal(HOMEPAGE_HTML), true)
  assert.equal(arivihan.hasOfficialAboutPageSignal(ABOUT_PAGE_HTML), true)
  assert.equal(arivihan.hasOfficialCompanySignal(ABOUT_PAGE_HTML), true)
  assert.equal(arivihan.pageExposesPublicJobListings(ABOUT_PAGE_HTML), false)
  assert.equal(arivihan.pageExposesPublicJobListings(PUBLIC_JOBS_HTML), true)
  assert.equal(
    arivihan.isVerifiedMissingCareerRoute(
      { status: 404, url: arivihan.CAREERS_URL, html: MISSING_ROUTE_HTML },
      arivihan.CAREERS_URL,
    ),
    true,
  )
})

test('Arivihan returns [] only while the verified homepage and about page stay company-identifying and /careers stays missing', async () => {
  const arivihan = await loadModule()
  const requestedUrls = []

  const jobs = await arivihan.createArivihanScraper().run({
    fetchPage: async (url) => {
      requestedUrls.push(url)

      if (url === arivihan.HOMEPAGE_URL) {
        return { status: 200, url, html: HOMEPAGE_HTML }
      }

      if (url === arivihan.ABOUT_URL) {
        return { status: 200, url, html: ABOUT_PAGE_HTML }
      }

      if (url === arivihan.CAREERS_URL) {
        return { status: 404, url, html: MISSING_ROUTE_HTML }
      }

      if (url === arivihan.NON_WWW_CAREERS_URL) {
        return { status: 404, url, html: MISSING_ROUTE_HTML }
      }

      throw new Error(`Unexpected Arivihan URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [
    arivihan.HOMEPAGE_URL,
    arivihan.ABOUT_URL,
    arivihan.CAREERS_URL,
    arivihan.NON_WWW_CAREERS_URL,
  ])
  assert.deepEqual(jobs, [])
})

test('Arivihan fails closed when the verified company surface changes materially', async () => {
  const arivihan = await loadModule()

  await assert.rejects(
    arivihan.createArivihanScraper().run({
      fetchPage: async (url) => {
        if (url === arivihan.HOMEPAGE_URL) {
          return { status: 200, url, html: '<html><body>Unexpected</body></html>' }
        }

        if (url === arivihan.ABOUT_URL) {
          return { status: 200, url, html: ABOUT_PAGE_HTML }
        }

        if (url === arivihan.CAREERS_URL) {
          return { status: 404, url, html: MISSING_ROUTE_HTML }
        }

        if (url === arivihan.NON_WWW_CAREERS_URL) {
          return { status: 404, url, html: MISSING_ROUTE_HTML }
        }

        throw new Error(`Unexpected Arivihan URL: ${url}`)
      },
    }),
    /homepage for arivihan/i,
  )

  await assert.rejects(
    arivihan.createArivihanScraper().run({
      fetchPage: async (url) => {
        if (url === arivihan.HOMEPAGE_URL) {
          return { status: 200, url, html: HOMEPAGE_HTML }
        }

        if (url === arivihan.ABOUT_URL) {
          return { status: 200, url, html: PUBLIC_JOBS_HTML }
        }

        if (url === arivihan.CAREERS_URL) {
          return { status: 404, url, html: MISSING_ROUTE_HTML }
        }

        if (url === arivihan.NON_WWW_CAREERS_URL) {
          return { status: 404, url, html: MISSING_ROUTE_HTML }
        }

        throw new Error(`Unexpected Arivihan URL: ${url}`)
      },
    }),
    /about page for arivihan/i,
  )

  await assert.rejects(
    arivihan.createArivihanScraper().run({
      fetchPage: async (url) => {
        if (url === arivihan.HOMEPAGE_URL) {
          return { status: 200, url, html: HOMEPAGE_HTML }
        }

        if (url === arivihan.ABOUT_URL) {
          return { status: 200, url, html: ABOUT_PAGE_HTML }
        }

        if (url === arivihan.CAREERS_URL) {
          return { status: 200, url, html: PUBLIC_JOBS_HTML }
        }

        if (url === arivihan.NON_WWW_CAREERS_URL) {
          return { status: 404, url, html: MISSING_ROUTE_HTML }
        }

        throw new Error(`Unexpected Arivihan URL: ${url}`)
      },
    }),
    /verified no-public-careers route changed/i,
  )

  await assert.rejects(
    arivihan.createArivihanScraper().run({
      fetchPage: async (url) => {
        if (url === arivihan.HOMEPAGE_URL) {
          return { status: 200, url, html: HOMEPAGE_HTML }
        }

        if (url === arivihan.ABOUT_URL) {
          return { status: 200, url, html: ABOUT_PAGE_HTML }
        }

        if (url === arivihan.CAREERS_URL) {
          return { status: 404, url, html: MISSING_ROUTE_HTML }
        }

        if (url === arivihan.NON_WWW_CAREERS_URL) {
          return { status: 200, url, html: PUBLIC_JOBS_HTML }
        }

        throw new Error(`Unexpected Arivihan URL: ${url}`)
      },
    }),
    /non-www careers alias/i,
  )
})
