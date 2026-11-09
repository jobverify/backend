import assert from 'node:assert/strict'
import test from 'node:test'

const HOMEPAGE_HTML = `
<!DOCTYPE html>
<html lang="en">
  <body>
    <main>
      <section>
        <h1>#GoingPlaces</h1>
        <p>We believe humans are like sharks. They have to keep moving to thrive.</p>
      </section>
      <footer>
        <a href="mailto:careers@mokobara.com">Join our team! - careers@mokobara.com</a>
        <p>Need assistance? Write to us at support@mokobara.com.</p>
        <p>For Gifting &amp; Corporate orders email bulkorders@mokobara.com</p>
        <p>&copy; 2026 Mokobara Lifestyle Private Limited. All Rights Reserved.</p>
      </footer>
    </main>
  </body>
</html>
`

const FAQ_HTML = `
<!DOCTYPE html>
<html lang="en">
  <body>
    <main>
      <h2>How do I join the Mokobara team?</h2>
      <p>
        We are always looking for fellow travellers to join us in #GoingPlaces. Shoot your shot
        with us at careers@mokobara.com!
      </p>
      <footer>
        <a href="mailto:careers@mokobara.com">Join our team! - careers@mokobara.com</a>
      </footer>
    </main>
  </body>
</html>
`

const MISSING_ROUTE_HTML = `
<!DOCTYPE html>
<html lang="en">
  <body>
    <main>
      <h1>404</h1>
      <p>Page not found</p>
    </main>
  </body>
</html>
`

const PUBLIC_JOBS_HTML = `
<!DOCTYPE html>
<html lang="en">
  <head>
    <script type="application/ld+json">
      {"@context":"https://schema.org","@type":"JobPosting","title":"Retail Manager"}
    </script>
  </head>
  <body>
    <h1>Current Openings</h1>
    <a href="https://jobs.example.com/retail-manager">Apply now</a>
  </body>
</html>
`

const loadModule = async () => {
  try {
    return await import('../../scraper/mokobara/script.js')
  } catch {
    assert.fail('Expected Mokobara scraper module at ../../scraper/mokobara/script.js')
  }
}

test('Mokobara sentinel helpers stay pinned to the verified homepage footer, FAQ email handoff, and careers route state', async () => {
  const mokobara = await loadModule()

  assert.equal(mokobara.SOURCE, 'mokobara')
  assert.equal(mokobara.COMPANY, 'Mokobara')
  assert.equal(mokobara.OFFICIAL_BRAND_NAME, 'Mokobara Lifestyle Private Limited')
  assert.equal(mokobara.VERIFIED_ON, '2026-07-16')
  assert.equal(mokobara.HOMEPAGE_URL, 'https://mokobara.com/')
  assert.equal(mokobara.FAQ_URL, 'https://mokobara.com/apps/frequently-asked-questions')
  assert.equal(mokobara.CAREERS_URL, 'https://mokobara.com/careers')
  assert.equal(mokobara.PAGES_CAREERS_URL, 'https://mokobara.com/pages/careers')
  assert.equal(mokobara.APPLICATION_EMAIL, 'careers@mokobara.com')
  assert.equal(mokobara.APPLICATION_URL, 'mailto:careers@mokobara.com')
  assert.deepEqual(mokobara.NO_PUBLIC_CAREER_ROUTE_URLS, [
    'https://mokobara.com/pages/careers',
    'https://mokobara.com/careers',
  ])
  assert.match(mokobara.VERIFIED_SURFACE_SUMMARY, /Shoot your shot with us at careers@mokobara\.com/i)
  assert.match(mokobara.VERIFIED_SURFACE_SUMMARY, /no trustworthy public jobs surface/i)
  assert.equal(mokobara.hasOfficialHomepageSignal(HOMEPAGE_HTML), true)
  assert.equal(mokobara.hasOfficialFaqSignal(FAQ_HTML), true)
  assert.equal(mokobara.pageExposesPublicJobListings(FAQ_HTML), false)
  assert.equal(mokobara.pageExposesPublicJobListings(PUBLIC_JOBS_HTML), true)
  assert.equal(
    mokobara.isVerifiedMissingCareerRoute({
      status: 404,
      url: mokobara.PAGES_CAREERS_URL,
      html: MISSING_ROUTE_HTML,
    }),
    true,
  )
  assert.equal(
    mokobara.isVerifiedHomepageRedirect({
      status: 200,
      url: mokobara.HOMEPAGE_URL,
      html: HOMEPAGE_HTML,
    }),
    true,
  )
})

test('Mokobara returns [] only while the verified surface remains email-only with no public careers board', async () => {
  const mokobara = await loadModule()
  const requestedUrls = []

  const jobs = await mokobara.createMokobaraScraper().run({
    fetchPage: async (url) => {
      requestedUrls.push(url)

      if (url === mokobara.HOMEPAGE_URL) {
        return { status: 200, url, html: HOMEPAGE_HTML }
      }

      if (url === mokobara.FAQ_URL) {
        return { status: 200, url, html: FAQ_HTML }
      }

      if (url === mokobara.PAGES_CAREERS_URL) {
        return { status: 404, url, html: MISSING_ROUTE_HTML }
      }

      if (url === mokobara.CAREERS_URL) {
        return { status: 200, url: mokobara.HOMEPAGE_URL, html: HOMEPAGE_HTML }
      }

      throw new Error(`Unexpected Mokobara URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [
    mokobara.HOMEPAGE_URL,
    mokobara.FAQ_URL,
    mokobara.PAGES_CAREERS_URL,
    mokobara.CAREERS_URL,
  ])
  assert.deepEqual(jobs, [])
})

test('Mokobara fails closed when the verified homepage, FAQ, or careers-route state drifts', async () => {
  const mokobara = await loadModule()

  await assert.rejects(
    mokobara.createMokobaraScraper().run({
      fetchPage: async (url) => ({
        status: 200,
        url,
        html: '<html><body>Unexpected</body></html>',
      }),
    }),
    /verified Mokobara homepage/i,
  )

  await assert.rejects(
    mokobara.createMokobaraScraper().run({
      fetchPage: async (url) => {
        if (url === mokobara.HOMEPAGE_URL) {
          return { status: 200, url, html: HOMEPAGE_HTML }
        }

        if (url === mokobara.FAQ_URL) {
          return { status: 200, url, html: PUBLIC_JOBS_HTML }
        }

        if (url === mokobara.PAGES_CAREERS_URL) {
          return { status: 404, url, html: MISSING_ROUTE_HTML }
        }

        return { status: 200, url: mokobara.HOMEPAGE_URL, html: HOMEPAGE_HTML }
      },
    }),
    /faq page now appears to expose public job listings|verified Mokobara faq/i,
  )

  await assert.rejects(
    mokobara.createMokobaraScraper().run({
      fetchPage: async (url) => {
        if (url === mokobara.HOMEPAGE_URL) {
          return { status: 200, url, html: HOMEPAGE_HTML }
        }

        if (url === mokobara.FAQ_URL) {
          return { status: 200, url, html: FAQ_HTML }
        }

        if (url === mokobara.PAGES_CAREERS_URL) {
          return { status: 200, url, html: PUBLIC_JOBS_HTML }
        }

        return { status: 200, url: mokobara.HOMEPAGE_URL, html: HOMEPAGE_HTML }
      },
    }),
    /verified no-public-careers route changed/i,
  )

  await assert.rejects(
    mokobara.createMokobaraScraper().run({
      fetchPage: async (url) => {
        if (url === mokobara.HOMEPAGE_URL) {
          return { status: 200, url, html: HOMEPAGE_HTML }
        }

        if (url === mokobara.FAQ_URL) {
          return { status: 200, url, html: FAQ_HTML }
        }

        if (url === mokobara.PAGES_CAREERS_URL) {
          return { status: 404, url, html: MISSING_ROUTE_HTML }
        }

        return { status: 200, url, html: PUBLIC_JOBS_HTML }
      },
    }),
    /verified Mokobara careers redirect changed/i,
  )
})
