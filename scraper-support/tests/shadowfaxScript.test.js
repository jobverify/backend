import assert from 'node:assert/strict'
import test from 'node:test'

const HOMEPAGE_HTML = `
<!doctype html>
<html lang="en">
  <head>
    <title>Shadowfax - Best Indian Logistics Company for Express Deliveries</title>
  </head>
  <body>
    <nav>
      <a href="/about-us">About Us</a>
      <a href="/innovation">Innovation</a>
      <a href="/social-impact">Social Impact</a>
      <a href="/careers">Careers</a>
    </nav>
    <main>
      <h1>India's Trusted Partner for Fast, Reliable Delivery</h1>
      <p>Your trusted partner for express parcel delivery, returns, same-day, next-day, 30-minute delivery, and fulfilment solutions.</p>
    </main>
    <footer>
      <span>© 2026 All rights reserved. Shadowfax Technologies Limited</span>
    </footer>
  </body>
</html>
`

const CAREERS_HTML = `
<!doctype html>
<html lang="en">
  <head>
    <title>Build Your Career at a Leading Logistics Company | Shadowfax</title>
  </head>
  <body>
    <main>
      <h1>Join the Shadowfax Team!</h1>
      <h2>Join a team of passionate people moving the world forward. We&#8217;re hiring those who want to help shape the future of logistics with us.</h2>
      <h3>Our Openings</h3>
      <div>All Categories All Job Types All Locations</div>
      <button>Search</button>
      <h3>Our Openings</h3>
      <p>No job openings available at the moment.</p>
      <h4>Join our talent pool</h4>
      <h4>Couldn&#8217;t find a suitable vacancy?</h4>
      <p>Upload your CV and we&#8217;ll get back to you when something opens up</p>
      <label>Enter your full name</label>
      <label>Enter your email</label>
      <label>Preffered department</label>
      <label>Upload your CV</label>
      <button>Submit</button>
      <footer>
        <span>© 2026 All rights reserved. Shadowfax Technologies Limited</span>
      </footer>
    </main>
  </body>
</html>
`

const FIRST_PARTY_404_HTML = `
<!doctype html>
<html lang="en">
  <head>
    <title>Page Not Found (404) | Shadowfax | Shadowfax</title>
  </head>
  <body>
    <h1>404</h1>
    <p>The page you were looking for doesn’t exist.</p>
  </body>
</html>
`

const loadModule = async () => {
  try {
    return await import('../../scraper/shadowfax/script.js')
  } catch {
    assert.fail('Expected Shadowfax scraper module at ../../scraper/shadowfax/script.js')
  }
}

test('Shadowfax sentinel recognizes the verified homepage, empty careers page, and adjacent 404 routes', async () => {
  const shadowfax = await loadModule()

  assert.equal(shadowfax.SOURCE, 'shadowfax')
  assert.equal(shadowfax.COMPANY, 'Shadowfax')
  assert.equal(shadowfax.OFFICIAL_BRAND_NAME, 'Shadowfax')
  assert.equal(shadowfax.LEGAL_ENTITY_NAME, 'Shadowfax Technologies Limited')
  assert.equal(shadowfax.VERIFIED_ON, '2026-07-17')
  assert.equal(shadowfax.HOMEPAGE_URL, 'https://www.shadowfax.in/')
  assert.equal(shadowfax.CAREERS_URL, 'https://www.shadowfax.in/careers')
  assert.deepEqual(shadowfax.CAREERS_ROUTE_URLS, [
    'https://www.shadowfax.in/career',
    'https://www.shadowfax.in/jobs',
  ])
  assert.equal(shadowfax.extractCareersUrl(HOMEPAGE_HTML), 'https://www.shadowfax.in/careers')
  assert.equal(shadowfax.hasVerifiedHomepageSignal(HOMEPAGE_HTML), true)
  assert.equal(shadowfax.hasVerifiedCareersSignal(CAREERS_HTML), true)
  assert.equal(shadowfax.hasEmptyOpeningsSignal(CAREERS_HTML), true)
  assert.equal(
    shadowfax.isVerifiedNoPublicJobsRoute({
      status: 404,
      url: 'https://www.shadowfax.in/career',
      html: FIRST_PARTY_404_HTML,
    }),
    true,
  )
})

test('Shadowfax returns [] only while the verified homepage, empty careers page, and adjacent 404 routes remain unchanged', async () => {
  const shadowfax = await loadModule()
  const requestedUrls = []

  const jobs = await shadowfax.createShadowfaxScraper().run({
    fetchPage: async (url) => {
      requestedUrls.push(url)

      if (url === shadowfax.HOMEPAGE_URL) {
        return { status: 200, url, html: HOMEPAGE_HTML }
      }

      if (url === shadowfax.CAREERS_URL) {
        return { status: 200, url, html: CAREERS_HTML }
      }

      if (shadowfax.CAREERS_ROUTE_URLS.includes(url)) {
        return { status: 404, url, html: FIRST_PARTY_404_HTML }
      }

      throw new Error(`Unexpected Shadowfax URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [
    shadowfax.HOMEPAGE_URL,
    shadowfax.CAREERS_URL,
    ...shadowfax.CAREERS_ROUTE_URLS,
  ])
  assert.deepEqual(jobs, [])
})

test('Shadowfax fails closed when the verified homepage, careers empty state, or adjacent routes drift into a jobs surface', async () => {
  const shadowfax = await loadModule()

  await assert.rejects(
    shadowfax.createShadowfaxScraper().run({
      fetchPage: async (url) => {
        if (url === shadowfax.HOMEPAGE_URL) {
          return { status: 200, url, html: '<html><body><h1>Unexpected</h1></body></html>' }
        }

        if (url === shadowfax.CAREERS_URL) {
          return { status: 200, url, html: CAREERS_HTML }
        }

        return { status: 404, url, html: FIRST_PARTY_404_HTML }
      },
    }),
    /verified Shadowfax homepage/i,
  )

  await assert.rejects(
    shadowfax.createShadowfaxScraper().run({
      fetchPage: async (url) => {
        if (url === shadowfax.HOMEPAGE_URL) {
          return { status: 200, url, html: HOMEPAGE_HTML }
        }

        if (url === shadowfax.CAREERS_URL) {
          return {
            status: 200,
            url,
            html: CAREERS_HTML.replace(
              'No job openings available at the moment.',
              'Senior Operations Manager - Bangalore',
            ),
          }
        }

        return { status: 404, url, html: FIRST_PARTY_404_HTML }
      },
    }),
    /verified empty openings state/i,
  )

  await assert.rejects(
    shadowfax.createShadowfaxScraper().run({
      fetchPage: async (url) => {
        if (url === shadowfax.HOMEPAGE_URL) {
          return { status: 200, url, html: HOMEPAGE_HTML }
        }

        if (url === shadowfax.CAREERS_URL) {
          return { status: 200, url, html: CAREERS_HTML }
        }

        if (url === shadowfax.CAREERS_ROUTE_URLS[0]) {
          return {
            status: 200,
            url,
            html: '<html><body><h1>Open Positions</h1><a href="/jobview/backend-engineer">Apply now</a></body></html>',
          }
        }

        return { status: 404, url, html: FIRST_PARTY_404_HTML }
      },
    }),
    /Shadowfax adjacent careers routes changed materially or now expose public jobs/i,
  )
})
