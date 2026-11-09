import assert from 'node:assert/strict'
import test from 'node:test'

const HOMEPAGE_HTML = `
<!doctype html>
<html lang="en">
  <body>
    <nav>
      <a href="/#test-ride">Test Ride</a>
      <a href="/#pricing">Pricing</a>
      <a href="/#contact">Contact Us</a>
    </nav>
    <main>
      <h1>Bounce Infinity Electric Scooters</h1>
      <p>Made for Indian Roads. Made in India.</p>
      <p>Reserve for ₹499/-</p>
      <section>
        <h2>Our Products</h2>
        <p>e.1+</p>
        <p>e.1LE</p>
      </section>
    </main>
  </body>
</html>
`

const ABOUT_HTML = `
<!doctype html>
<html lang="en">
  <head>
    <title>About Team Bounce</title>
  </head>
  <body>
    <main>
      <h1>The leap before the bounce.</h1>
      <p>Meet the founders who dared to make mobility fun and easy.</p>
      <p>Vivekananda Hallekere</p>
      <p>Anil</p>
      <p>Varun Agni</p>
      <p>Launched in May 2018, Bounce is the brainchild of Vivekananda Hallekere, Anil G and Varun Agni.</p>
      <p>India’s first smart mobility solution</p>
    </main>
  </body>
</html>
`

const MISSING_CAREERS_HTML = `
<!doctype html>
<html lang="en">
  <head>
    <title>404: This page could not be found</title>
  </head>
  <body>
    <main>
      <h1>404</h1>
      <p>This page could not be found.</p>
    </main>
  </body>
</html>
`

const PUBLIC_JOBS_HTML = `
<!doctype html>
<html lang="en">
  <body>
    <h1>Careers</h1>
    <article>
      <h2>EV Supply Chain Manager</h2>
      <p>Bengaluru, India</p>
      <a href="https://jobs.example.com/bounce-supply-chain-manager">Apply Now</a>
    </article>
  </body>
</html>
`

const loadModule = async () => {
  try {
    return await import('../../scraper/bounce/script.js')
  } catch {
    assert.fail('Expected Bounce scraper module at ../../scraper/bounce/script.js')
  }
}

test('Bounce helper signals stay pinned to the verified homepage, legacy about page, and missing careers route from Thursday, July 30, 2026', async () => {
  const bounce = await loadModule()

  assert.equal(bounce.SOURCE, 'bounce')
  assert.equal(bounce.COMPANY, 'Bounce')
  assert.equal(bounce.VERIFIED_ON, '2026-08-01')
  assert.equal(bounce.HOMEPAGE_URL, 'https://bounceinfinity.com/')
  assert.equal(bounce.ABOUT_URL, 'https://bounce-v2.bounceinfinity.com/about.html')
  assert.equal(bounce.CAREERS_URL, 'https://bounceinfinity.com/careers')
  assert.equal(bounce.hasOfficialHomepageSignal(HOMEPAGE_HTML), true)
  assert.equal(bounce.hasOfficialAboutPageSignal(ABOUT_HTML), true)
  assert.equal(bounce.pageExposesPublicJobListings(HOMEPAGE_HTML), false)
  assert.equal(bounce.pageExposesPublicJobListings(ABOUT_HTML), false)
  assert.equal(bounce.pageExposesPublicJobListings(PUBLIC_JOBS_HTML), true)
  assert.equal(
    bounce.isVerifiedMissingCareerRoute(
      { status: 404, url: bounce.CAREERS_URL, html: MISSING_CAREERS_HTML },
      bounce.CAREERS_URL,
    ),
    true,
  )
})

test('Bounce returns [] only while the verified homepage and about page stay company-identifying and /careers stays missing', async () => {
  const bounce = await loadModule()
  const requestedUrls = []

  const jobs = await bounce.createBounceScraper().run({
    fetchPage: async (url) => {
      requestedUrls.push(url)

      if (url === bounce.HOMEPAGE_URL) {
        return { status: 200, url, html: HOMEPAGE_HTML }
      }

      if (url === bounce.ABOUT_URL) {
        return { status: 200, url, html: ABOUT_HTML }
      }

      if (url === bounce.CAREERS_URL) {
        return { status: 404, url, html: MISSING_CAREERS_HTML }
      }

      throw new Error(`Unexpected Bounce URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [
    bounce.HOMEPAGE_URL,
    bounce.ABOUT_URL,
    bounce.CAREERS_URL,
  ])
  assert.deepEqual(jobs, [])
})

test('Bounce fails closed when the verified company surface changes materially', async () => {
  const bounce = await loadModule()

  await assert.rejects(
    bounce.createBounceScraper().run({
      fetchPage: async (url) => {
        if (url === bounce.HOMEPAGE_URL) {
          return { status: 200, url, html: '<html><body>Unexpected</body></html>' }
        }

        if (url === bounce.ABOUT_URL) {
          return { status: 200, url, html: ABOUT_HTML }
        }

        if (url === bounce.CAREERS_URL) {
          return { status: 404, url, html: MISSING_CAREERS_HTML }
        }

        throw new Error(`Unexpected Bounce URL: ${url}`)
      },
    }),
    /homepage for bounce/i,
  )

  await assert.rejects(
    bounce.createBounceScraper().run({
      fetchPage: async (url) => {
        if (url === bounce.HOMEPAGE_URL) {
          return { status: 200, url, html: HOMEPAGE_HTML }
        }

        if (url === bounce.ABOUT_URL) {
          return { status: 200, url, html: PUBLIC_JOBS_HTML }
        }

        if (url === bounce.CAREERS_URL) {
          return { status: 404, url, html: MISSING_CAREERS_HTML }
        }

        throw new Error(`Unexpected Bounce URL: ${url}`)
      },
    }),
    /about page for bounce/i,
  )

  await assert.rejects(
    bounce.createBounceScraper().run({
      fetchPage: async (url) => {
        if (url === bounce.HOMEPAGE_URL) {
          return { status: 200, url, html: HOMEPAGE_HTML }
        }

        if (url === bounce.ABOUT_URL) {
          return { status: 200, url, html: ABOUT_HTML }
        }

        if (url === bounce.CAREERS_URL) {
          return { status: 200, url, html: PUBLIC_JOBS_HTML }
        }

        throw new Error(`Unexpected Bounce URL: ${url}`)
      },
    }),
    /verified no-public-careers route changed/i,
  )
})
