import assert from 'node:assert/strict'
import test from 'node:test'

const homepageHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Eternal</title>
  </head>
  <body>
    <nav>
      <a href="/">Home</a>
      <a href="/culture">Culture</a>
      <a href="/careers">Careers</a>
      <a href="/investors">Investors</a>
      <a href="/impact">Impact</a>
      <a href="/contact">Contact</a>
    </nav>
  </body>
</html>
`

const careersHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Careers - Hiring at Eternal</title>
    <link rel="canonical" href="https://eternal.com/careers" />
    <script type="application/ld+json">
      {"@context":"https://schema.org","@type":"Organization","name":"Eternal","url":"https://eternal.com"}
    </script>
  </head>
  <body>
    <nav>
      Home Culture Careers Investors Impact Contact
    </nav>
    <footer>
      Our businesses Zomato Blinkit District Hyperpure
    </footer>
  </body>
</html>
`

const notFoundRouteHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Page Not Found | Eternal</title>
  </head>
  <body>
    <nav>Home Culture Careers Investors Impact Contact</nav>
    <main>
      <h1>Lost in the Eternal void?</h1>
      <p>We couldn’t find the page you were looking for. It might have drifted off or never existed at all.</p>
      <a href="/">Go back home</a>
    </main>
    <footer>Our businesses Zomato Blinkit District Hyperpure</footer>
  </body>
</html>
`

const publicJobsHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Current Openings</title>
    <script type="application/ld+json">
      {"@context":"https://schema.org","@type":"JobPosting","title":"Backend Engineer"}
    </script>
  </head>
  <body>
    <main>
      <h1>Current Openings</h1>
      <a href="https://jobs.lever.co/eternal/backend-engineer">Apply now</a>
    </main>
  </body>
</html>
`

const loadModule = async () => {
  try {
    return await import('../../scraper/eternal/script.js')
  } catch {
    assert.fail('Expected Eternal scraper module at ../../scraper/eternal/script.js')
  }
}

test('Eternal helpers stay pinned to the verified no-public-jobs surface', async () => {
  const eternal = await loadModule()

  assert.equal(eternal.SOURCE, 'eternal')
  assert.equal(eternal.COMPANY, 'Eternal')
  assert.equal(eternal.OFFICIAL_BRAND_NAME, 'Eternal')
  assert.equal(eternal.HOMEPAGE_URL, 'https://www.eternal.com/')
  assert.equal(eternal.CAREERS_URL, 'https://www.eternal.com/careers/')
  assert.equal(eternal.CANONICAL_CAREERS_URL, 'https://eternal.com/careers')
  assert.deepEqual(eternal.CHECKED_NO_JOBS_ROUTE_URLS, [
    'https://www.eternal.com/jobs/',
    'https://www.eternal.com/join-us/',
    'https://www.eternal.com/work-with-us/',
  ])
  assert.equal(eternal.ROBOTS_TXT_URL, 'https://www.eternal.com/robots.txt')
  assert.equal(eternal.SITEMAP_URL, 'https://www.eternal.com/sitemap.xml')
  assert.equal(eternal.NOT_FOUND_PAGE_TITLE, 'Page Not Found | Eternal')
  assert.equal(eternal.hasOfficialHomepageSignal(homepageHtml), true)
  assert.equal(eternal.hasVerifiedCareersShellSignal(careersHtml), true)
  assert.equal(eternal.hasPublicJobsSignal(careersHtml), false)
  assert.equal(eternal.hasPublicJobsSignal(publicJobsHtml), true)
  assert.equal(
    eternal.isVerifiedMissingJobRoute(
      { status: 200, url: 'https://www.eternal.com/jobs/', html: notFoundRouteHtml },
      'https://www.eternal.com/jobs/',
    ),
    true,
  )
  assert.equal(
    eternal.isVerifiedMissingDiscoveryRoute(
      { status: 404, url: 'https://www.eternal.com/robots.txt', html: '' },
      'https://www.eternal.com/robots.txt',
    ),
    true,
  )
})

test('Eternal returns [] only while the verified careers shell still exposes no public jobs surface', async () => {
  const eternal = await loadModule()
  const requestedUrls = []

  const jobs = await eternal.createEternalScraper().run({
    fetchPage: async (url) => {
      requestedUrls.push(url)

      if (url === eternal.HOMEPAGE_URL) {
        return { status: 200, url, html: homepageHtml }
      }

      if (url === eternal.CAREERS_URL) {
        return { status: 200, url, html: careersHtml }
      }

      if (url === eternal.ROBOTS_TXT_URL) {
        return { status: 404, url, html: '' }
      }

      if (url === eternal.SITEMAP_URL) {
        return { status: 404, url, html: '' }
      }

      if (eternal.CHECKED_NO_JOBS_ROUTE_URLS.includes(url)) {
        return { status: 200, url, html: notFoundRouteHtml }
      }

      throw new Error(`Unexpected URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [
    eternal.HOMEPAGE_URL,
    eternal.CAREERS_URL,
    eternal.ROBOTS_TXT_URL,
    eternal.SITEMAP_URL,
    ...eternal.CHECKED_NO_JOBS_ROUTE_URLS,
  ])
  assert.deepEqual(jobs, [])
})

test('Eternal fails closed when the homepage, careers shell, discovery routes, or no-jobs routes drift', async () => {
  const eternal = await loadModule()

  await assert.rejects(
    eternal.createEternalScraper().run({
      fetchPage: async (url) => {
        if (url === eternal.HOMEPAGE_URL) {
          return { status: 200, url, html: '<html><body>No careers link here</body></html>' }
        }

        throw new Error(`Unexpected URL: ${url}`)
      },
    }),
    /verified homepage/i,
  )

  await assert.rejects(
    eternal.createEternalScraper().run({
      fetchPage: async (url) => {
        if (url === eternal.HOMEPAGE_URL) {
          return { status: 200, url, html: homepageHtml }
        }

        if (url === eternal.CAREERS_URL) {
          return { status: 200, url, html: publicJobsHtml }
        }

        throw new Error(`Unexpected URL: ${url}`)
      },
    }),
    /careers page now appears to expose a public jobs surface/i,
  )

  await assert.rejects(
    eternal.createEternalScraper().run({
      fetchPage: async (url) => {
        if (url === eternal.HOMEPAGE_URL) {
          return { status: 200, url, html: homepageHtml }
        }

        if (url === eternal.CAREERS_URL) {
          return { status: 200, url, html: careersHtml }
        }

        if (url === eternal.ROBOTS_TXT_URL) {
          return { status: 200, url, html: '<html><body>robots page now exists</body></html>' }
        }

        throw new Error(`Unexpected URL: ${url}`)
      },
    }),
    /verified robots\.txt/i,
  )

  await assert.rejects(
    eternal.createEternalScraper().run({
      fetchPage: async (url) => {
        if (url === eternal.HOMEPAGE_URL) {
          return { status: 200, url, html: homepageHtml }
        }

        if (url === eternal.CAREERS_URL) {
          return { status: 200, url, html: careersHtml }
        }

        if (url === eternal.ROBOTS_TXT_URL || url === eternal.SITEMAP_URL) {
          return { status: 404, url, html: '' }
        }

        if (url === eternal.CHECKED_NO_JOBS_ROUTE_URLS[0]) {
          return { status: 200, url, html: '<html><head><title>Jobs</title></head><body>Unexpected jobs page</body></html>' }
        }

        if (eternal.CHECKED_NO_JOBS_ROUTE_URLS.slice(1).includes(url)) {
          return { status: 200, url, html: notFoundRouteHtml }
        }

        throw new Error(`Unexpected URL: ${url}`)
      },
    }),
    /verified no-jobs route changed/i,
  )
})
