import assert from 'node:assert/strict'
import test from 'node:test'

const HOMEPAGE_HTML = `
<!DOCTYPE html>
<html>
  <head>
    <title>Netrack | Server Enclosures | Network Enclosures | Server Racks</title>
  </head>
  <body>
    <h1>Netrack</h1>
    <p>Server Enclosures | Network Enclosures | Server Racks</p>
  </body>
</html>
`

const CONTACT_HTML = `
<!DOCTYPE html>
<html>
  <head>
    <title>Contact | Netrack | quiet server cabinet Manufacturers</title>
  </head>
  <body>
    <h1>Contact</h1>
    <p>Netrack contact information.</p>
  </body>
</html>
`

const TEAM_HTML = `
<!DOCTYPE html>
<html>
  <head>
    <title>Netrack Team | Server enclosures manufacturers</title>
  </head>
  <body>
    <h1>Netrack Team</h1>
    <p>Meet the Netrack leadership team.</p>
  </body>
</html>
`

const PUBLIC_JOBS_HTML = `
<!DOCTYPE html>
<html lang="en">
  <head>
    <script type="application/ld+json">
      {"@context":"https://schema.org","@type":"JobPosting","title":"Sales Engineer"}
    </script>
  </head>
  <body>
    <h1>Open Positions</h1>
    <a href="https://jobs.example.com/sales-engineer">Apply now</a>
  </body>
</html>
`

const loadModule = async () => {
  try {
    return await import('../../scraper/netrack/script.js')
  } catch {
    assert.fail('Expected Netrack scraper module at ../../scraper/netrack/script.js')
  }
}

test('Netrack sentinel helpers stay pinned to the verified informational-page-plus-missing-route state', async () => {
  const netrack = await loadModule()

  assert.equal(netrack.SOURCE, 'netrack')
  assert.equal(netrack.COMPANY, 'Netrack')
  assert.equal(netrack.OFFICIAL_BRAND_NAME, 'NetRack Enclosures Private Ltd.')
  assert.equal(netrack.VERIFIED_ON, '2026-08-03')
  assert.equal(netrack.HOMEPAGE_URL, 'https://www.netrackindia.com/en')
  assert.equal(netrack.CONTACT_URL, 'https://www.netrackindia.com/en/contact-0')
  assert.equal(netrack.TEAM_URL, 'https://www.netrackindia.com/en/about-us/about-company/team')
  assert.deepEqual(netrack.BLOCKED_ROUTE_URLS, [
    'https://www.netrackindia.com/en',
    'https://www.netrackindia.com/en/contact-0',
    'https://www.netrackindia.com/en/about-us/about-company/team',
    'https://www.netrackindia.com/en/careers',
    'https://www.netrackindia.com/careers',
    'https://www.netrackindia.com/en/jobs',
    'https://www.netrackindia.com/jobs',
  ])
  assert.match(netrack.VERIFIED_SURFACE_SUMMARY, /\b404\b/i)
  assert.doesNotMatch(netrack.VERIFIED_SURFACE_SUMMARY, /Access Denied/i)
  assert.deepEqual(netrack.INFORMATIONAL_ROUTE_URLS, [
    'https://www.netrackindia.com/en',
    'https://www.netrackindia.com/en/contact-0',
    'https://www.netrackindia.com/en/about-us/about-company/team',
  ])
  assert.deepEqual(netrack.MISSING_ROUTE_URLS, [
    'https://www.netrackindia.com/en/careers',
    'https://www.netrackindia.com/careers',
    'https://www.netrackindia.com/en/jobs',
    'https://www.netrackindia.com/jobs',
  ])
  assert.equal(netrack.hasPublicJobsSignal(HOMEPAGE_HTML), false)
  assert.equal(netrack.hasPublicJobsSignal(PUBLIC_JOBS_HTML), true)
  assert.equal(
    netrack.hasVerifiedInformationalSurface({
      status: 200,
      url: netrack.HOMEPAGE_URL,
      html: HOMEPAGE_HTML,
    }, {
      expectedUrl: netrack.HOMEPAGE_URL,
      expectedTitle: netrack.VERIFIED_ROUTE_TITLES[netrack.HOMEPAGE_URL],
    }),
    true,
  )
  assert.equal(
    netrack.hasVerifiedMissingJobsRoute({
      status: 404,
      url: netrack.MISSING_ROUTE_URLS[0],
      html: '',
    }, netrack.MISSING_ROUTE_URLS[0]),
    true,
  )
})

test('Netrack returns [] only while the verified informational pages and missing hiring routes remain unchanged', async () => {
  const netrack = await loadModule()
  const requestedUrls = []

  const jobs = await netrack.createNetrackScraper().run({
    fetchPage: async (url) => {
      requestedUrls.push(url)
      if (url === netrack.HOMEPAGE_URL) {
        return { status: 200, url, html: HOMEPAGE_HTML }
      }
      if (url === netrack.CONTACT_URL) {
        return { status: 200, url, html: CONTACT_HTML }
      }
      if (url === netrack.TEAM_URL) {
        return { status: 200, url, html: TEAM_HTML }
      }

      return { status: 404, url, html: '' }
    },
  })

  assert.deepEqual(requestedUrls, netrack.BLOCKED_ROUTE_URLS)
  assert.deepEqual(jobs, [])
})

test('Netrack fails closed when the informational or missing-route sentinel drifts', async () => {
  const netrack = await loadModule()

  await assert.rejects(
    netrack.createNetrackScraper().run({
      fetchPage: async (url) => ({
        status: 200,
        url,
        html: '<html><body>Unexpected</body></html>',
      }),
    }),
    /informational surface changed|missing careers route changed/i,
  )

  await assert.rejects(
    netrack.createNetrackScraper().run({
      fetchPage: async (url) => {
        if (url === netrack.MISSING_ROUTE_URLS[0]) {
          return { status: 404, url, html: PUBLIC_JOBS_HTML }
        }

        if (url === netrack.HOMEPAGE_URL) {
          return { status: 200, url, html: HOMEPAGE_HTML }
        }
        if (url === netrack.CONTACT_URL) {
          return { status: 200, url, html: CONTACT_HTML }
        }
        if (url === netrack.TEAM_URL) {
          return { status: 200, url, html: TEAM_HTML }
        }

        return { status: 404, url, html: '' }
      },
    }),
    /now appears to expose public jobs/i,
  )
})
