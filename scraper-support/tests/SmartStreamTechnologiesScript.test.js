import assert from 'node:assert/strict'
import test from 'node:test'

const BLOCKED_PAGE_HTML = `
<!doctype html>
<html lang="en">
  <head>
    <title>Error 403 Forbidden</title>
  </head>
  <body>
    <h1>403 Forbidden</h1>
  </body>
</html>
`

const PUBLIC_JOBS_HTML = `
<!doctype html>
<html lang="en">
  <head>
    <title>Careers at Smartstream | Financial Technology Jobs</title>
  </head>
  <body>
    <p>Innovate. Grow. Lead the Future of Data Automation.</p>
    <p>Send us your CV to careers@smart.stream, and we'll reach out when a suitable opportunity arises.</p>
    <p>Apply Online. Browse roles &amp; submit your CV</p>
    <p>View All Roles</p>
    <p>Job Title: Senior Engineer</p>
    <a href="https://jobs.smart.stream/apply/senior-engineer">Apply now</a>
  </body>
</html>
`

const loadModule = async () => {
  try {
    return await import('../../scraper/smartstreamtechnologies/script.js')
  } catch {
    assert.fail('Expected SmartStream Technologies scraper module at ../../scraper/smartstreamtechnologies/script.js')
  }
}

test('SmartStream Technologies helpers stay pinned to the verified Cloudflare-blocked first-party surface', async () => {
  const smartstream = await loadModule()

  assert.equal(smartstream.SOURCE, 'smartstreamtechnologies')
  assert.equal(smartstream.COMPANY, 'SmartStream Technologies')
  assert.equal(smartstream.HOMEPAGE_URL, 'https://smart.stream/')
  assert.equal(smartstream.CAREERS_URL, 'https://smart.stream/careers/')
  assert.equal(smartstream.VERIFIED_ON, '2026-08-04')
  assert.equal(smartstream.hasForbiddenShellSignal(BLOCKED_PAGE_HTML), true)
  assert.equal(smartstream.hasPublicJobsCatalogSignal(BLOCKED_PAGE_HTML), false)
  assert.equal(smartstream.hasPublicJobsCatalogSignal(PUBLIC_JOBS_HTML), true)
  assert.equal(
    smartstream.isVerifiedCloudflareBlockedPage({
      status: 403,
      url: smartstream.CAREERS_URL,
      headers: {
        server: 'cloudflare',
        'cf-ray': 'abc123-MAA',
      },
      html: BLOCKED_PAGE_HTML,
    }, smartstream.CAREERS_URL),
    true,
  )
})

test('SmartStream Technologies returns [] only while the verified homepage and careers routes remain Cloudflare-blocked', async () => {
  const smartstream = await loadModule()
  const requestedUrls = []
  const jobs = await smartstream.createSmartStreamTechnologiesScraper().run({
    fetchPage: async (url) => {
      requestedUrls.push(url)
      return {
        status: 403,
        url,
        headers: {
          server: 'cloudflare',
          'cf-ray': `${requestedUrls.length}-MAA`,
        },
        html: BLOCKED_PAGE_HTML,
      }
    },
  })

  assert.deepEqual(requestedUrls, [
    smartstream.HOMEPAGE_URL,
    smartstream.CAREERS_URL,
  ])
  assert.deepEqual(jobs, [])
})

test('SmartStream Technologies fails closed when the verified blocked routes drift or the careers route exposes public job listings', async () => {
  const smartstream = await loadModule()

  await assert.rejects(
    smartstream.createSmartStreamTechnologiesScraper().run({
      fetchPage: async (url) => ({
        status: 200,
        url,
        headers: {},
        html: '<html><body><h1>Unexpected</h1></body></html>',
      }),
    }),
    /homepage no longer matches the verified Cloudflare-blocked first-party state/i,
  )

  await assert.rejects(
    smartstream.createSmartStreamTechnologiesScraper().run({
      fetchPage: async (url) => {
        if (url === smartstream.HOMEPAGE_URL) {
          return {
            status: 403,
            url,
            headers: {
              server: 'cloudflare',
              'cf-ray': 'abc123-MAA',
            },
            html: BLOCKED_PAGE_HTML,
          }
        }

        return {
          status: 200,
          url,
          headers: {},
          html: PUBLIC_JOBS_HTML,
        }
      },
    }),
    /public jobs catalog/i,
  )
})
