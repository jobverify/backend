import assert from 'node:assert/strict'
import test from 'node:test'

const homepageHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Reliance Retail Ltd India’s largest retailer</title>
  </head>
  <body>
    <nav>
      <a href="/about-us">About Us</a>
      <a href="/brands">Our Brands</a>
      <a href="/store-locator">Store Locator</a>
    </nav>
    <main>
      <h1>Reliance Retail Customer First</h1>
      <p>Building India's largest retail company</p>
      <p>Delivering Happiness</p>
      <p>Building a billion relationships</p>
      <p>Since its inception in 2006, Reliance Retail has grown to become India’s largest retailer delivering superior value to its customers, suppliers and shareholders.</p>
    </main>
  </body>
</html>
`

const missingRoutePage = {
  status: 404,
  url: 'https://www.relianceretail.com/careers',
  html: `
    <!doctype html>
    <html lang="en">
      <head>
        <title>404 - File or directory not found.</title>
      </head>
      <body>
        <main>
          <h1>Server Error</h1>
          <p>404 - File or directory not found.</p>
          <p>The resource you are looking for might have been removed, had its name changed, or is temporarily unavailable.</p>
        </main>
      </body>
    </html>
  `,
}

const loadModule = async () => {
  try {
    return await import('./script.js')
  } catch {
    return null
  }
}

test('Reliance Retail sentinel recognizes the verified homepage and shared missing-route shell', async () => {
  const relianceRetail = await loadModule()
  assert.ok(relianceRetail, 'Expected scraper module at ./script.js')

  assert.equal(relianceRetail.SOURCE, 'relianceretail')
  assert.equal(relianceRetail.COMPANY, 'Reliance Retail')
  assert.equal(relianceRetail.HOMEPAGE_URL, 'https://www.relianceretail.com/')
  assert.deepEqual(relianceRetail.NO_PUBLIC_ROUTE_URLS, [
    'https://www.relianceretail.com/careers',
    'https://www.relianceretail.com/careers/',
    'https://www.relianceretail.com/career',
    'https://www.relianceretail.com/career/',
    'https://www.relianceretail.com/jobs',
    'https://www.relianceretail.com/jobs/',
    'https://www.relianceretail.com/join-us',
    'https://www.relianceretail.com/join-us/',
    'https://www.relianceretail.com/openings',
    'https://www.relianceretail.com/openings/',
    'https://www.relianceretail.com/sitemap.xml',
    'https://www.relianceretail.com/robots.txt',
  ])

  assert.equal(relianceRetail.hasOfficialHomepageSignal(homepageHtml), true)
  assert.equal(relianceRetail.hasUnexpectedCareerLikeLink(homepageHtml), false)
  assert.equal(relianceRetail.hasPublicJobsSignal(homepageHtml), false)
  assert.equal(
    relianceRetail.isVerifiedMissingRoute(missingRoutePage, 'https://www.relianceretail.com/careers'),
    true,
  )
})

test('Reliance Retail sentinel returns no jobs only while the verified first-party surface stays unchanged', async () => {
  const relianceRetail = await loadModule()
  assert.ok(relianceRetail, 'Expected scraper module at ./script.js')

  const requestedUrls = []
  const jobs = await relianceRetail.createRelianceRetailScraper().run({
    fetchPage: async (url) => {
      requestedUrls.push(url)

      if (url === relianceRetail.HOMEPAGE_URL) {
        return { status: 200, url, html: homepageHtml }
      }

      if (relianceRetail.NO_PUBLIC_ROUTE_URLS.includes(url)) {
        return { ...missingRoutePage, url }
      }

      throw new Error(`Unexpected URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [
    relianceRetail.HOMEPAGE_URL,
    ...relianceRetail.NO_PUBLIC_ROUTE_URLS,
  ])
  assert.deepEqual(jobs, [])
})

test('Reliance Retail sentinel fails closed when the homepage or a checked route starts exposing careers content', async () => {
  const relianceRetail = await loadModule()
  assert.ok(relianceRetail, 'Expected scraper module at ./script.js')

  await assert.rejects(
    relianceRetail.createRelianceRetailScraper().run({
      fetchPage: async (url) => {
        if (url === relianceRetail.HOMEPAGE_URL) {
          return { status: 200, url, html: '<html><body><h1>Unexpected</h1></body></html>' }
        }

        throw new Error(`Unexpected URL: ${url}`)
      },
    }),
    /official homepage/i,
  )

  await assert.rejects(
    relianceRetail.createRelianceRetailScraper().run({
      fetchPage: async (url) => {
        if (url === relianceRetail.HOMEPAGE_URL) {
          return {
            status: 200,
            url,
            html: homepageHtml.replace('</nav>', '<a href="/careers">Careers</a></nav>'),
          }
        }

        throw new Error(`Unexpected URL: ${url}`)
      },
    }),
    /homepage now exposes a first-party careers path/i,
  )

  await assert.rejects(
    relianceRetail.createRelianceRetailScraper().run({
      fetchPage: async (url) => {
        if (url === relianceRetail.HOMEPAGE_URL) {
          return { status: 200, url, html: homepageHtml }
        }

        if (url === relianceRetail.NO_PUBLIC_ROUTE_URLS[0]) {
          return {
            status: 200,
            url,
            html: '<html><body><h1>Careers</h1><p>Current Openings</p></body></html>',
          }
        }

        if (relianceRetail.NO_PUBLIC_ROUTE_URLS.slice(1).includes(url)) {
          return { ...missingRoutePage, url }
        }

        throw new Error(`Unexpected URL: ${url}`)
      },
    }),
    /missing first-party route changed or now exposes a public careers surface/i,
  )
})
