import assert from 'node:assert/strict'
import test from 'node:test'

const loadCeletteModule = async () => {
  try {
    return await import('../../scraper/celette/script.js')
  } catch {
    return null
  }
}

const buildVerifiedChallengePage = (url) => ({
  status: 403,
  url,
  finalUrl: url,
  errorKind: null,
  headers: {
    server: 'cloudflare',
    'cf-mitigated': 'challenge',
  },
  html: `
    <!doctype html>
    <html lang="en-US">
      <head>
        <title>Just a moment...</title>
        <meta charset="utf-8" />
      </head>
      <body>
        <span id="challenge-error-text">Enable JavaScript and cookies to continue</span>
        <script>
          window._cf_chl_opt = {
            cZone: 'celette.com',
            cUPMDTk: '${url}',
          }
        </script>
        <script src="https://challenges.cloudflare.com/turnstile/v0/api.js"></script>
      </body>
    </html>
  `,
})

test('Celette stays pinned to the verified blocked first-party Cloudflare challenge routes', async () => {
  const celette = await loadCeletteModule()
  assert.ok(celette)

  assert.equal(celette.SOURCE, 'celette')
  assert.equal(celette.COMPANY, 'Celette')
  assert.equal(celette.COMPANY_DOMAIN, 'celette.com')
  assert.equal(celette.VERIFIED_AT, '2026-08-15')
  assert.equal(celette.HOMEPAGE_URL, 'https://www.celette.com/')
  assert.equal(celette.CONTACT_US_URL, 'https://www.celette.com/contact-us/')
  assert.equal(celette.CAREERS_URL, 'https://www.celette.com/careers/')
  assert.equal(celette.JOBS_URL, 'https://www.celette.com/jobs/')
  assert.deepEqual(celette.VERIFIED_ROUTE_URLS, [
    'https://www.celette.com/',
    'https://www.celette.com/contact-us/',
    'https://www.celette.com/careers/',
    'https://www.celette.com/jobs/',
  ])
  assert.equal(celette.hasVerifiedCloudflareChallengeSignal(buildVerifiedChallengePage(celette.HOMEPAGE_URL)), true)
  assert.equal(celette.exposesStructuredPublicJobs(buildVerifiedChallengePage(celette.HOMEPAGE_URL).html), false)
})

test('Celette returns an honest zero-openings result while the verified first-party routes remain challenge-gated', async () => {
  const celette = await loadCeletteModule()
  assert.ok(celette)

  const requestedUrls = []
  const jobs = await celette.createCeletteScraper().run({
    fetchPage: async (url) => {
      requestedUrls.push(url)
      return buildVerifiedChallengePage(url)
    },
  })

  assert.deepEqual(requestedUrls, celette.VERIFIED_ROUTE_URLS)
  assert.deepEqual(jobs, [])
})

test('Celette accepts the current accessible homepage, contact page, and branded careers 404s', async () => {
  const celette = await loadCeletteModule()
  assert.ok(celette)

  const pageFor = (url) => ({
    status: url === celette.HOMEPAGE_URL || url === celette.CONTACT_US_URL ? 200 : 404,
    url,
    finalUrl: url,
    errorKind: null,
    headers: { server: 'cloudflare' },
    html: url === celette.HOMEPAGE_URL
      ? '<title>Global Collision Repair Equipment Supplier | USA &amp; Worldwide</title><p>Collision repair equipment</p>'
      : url === celette.CONTACT_US_URL
        ? '<title>Contact Us - Celette | A Leader in Collision Repair Equipment</title><p>Contact Celette</p>'
        : '<title>Page Not Found - Celette | A Leader in Collision Repair Equipment</title><p>Celette</p>',
  })

  const jobs = await celette.createCeletteScraper().run({ fetchPage: async (url) => pageFor(url) })
  assert.deepEqual(jobs, [])
})

test('Celette preserves the zero-openings sentinel when the verified first-party routes are temporarily timeout-blocked', async () => {
  const celette = await loadCeletteModule()
  assert.ok(celette)

  const requestedUrls = []
  const jobs = await celette.createCeletteScraper().run({
    fetchPage: async (url) => {
      requestedUrls.push(url)
      return {
        status: null,
        url,
        finalUrl: url,
        html: null,
        headers: {},
        errorKind: 'timeout',
      }
    },
  })

  assert.deepEqual(requestedUrls, celette.VERIFIED_ROUTE_URLS)
  assert.deepEqual(jobs, [])
})

test('Celette fails closed when the verified blocked routes drift or begin exposing public jobs', async () => {
  const celette = await loadCeletteModule()
  assert.ok(celette)

  await assert.rejects(
    celette.createCeletteScraper().run({
      fetchPage: async (url) => ({
        status: 403,
        url,
        finalUrl: url,
        html: '<html><body><h1>Unexpected</h1></body></html>',
        headers: {
          server: 'cloudflare',
          'cf-mitigated': 'challenge',
        },
        errorKind: null,
      }),
    }),
    /verified celette first-party blocked surfaces changed materially/i,
  )

  await assert.rejects(
    celette.createCeletteScraper().run({
      fetchPage: async (url) => ({
        ...buildVerifiedChallengePage(url),
        html: url === celette.CAREERS_URL
          ? `${buildVerifiedChallengePage(url).html}<article class="job-card"><a href="/careers/applications-engineer">Apply now</a></article>`
          : buildVerifiedChallengePage(url).html,
      }),
    }),
    /scraper-visible public jobs/i,
  )
})
