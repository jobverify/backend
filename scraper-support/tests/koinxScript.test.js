import assert from 'node:assert/strict'
import test from 'node:test'

const EMPTY_WELLFOUND_HTML = `
<!doctype html>
<html>
  <body>
    <h1>Jobs at KoinX</h1>
    <span>View 0 jobs</span>
    <p>KoinX hasn't added any jobs yet</p>
  </body>
</html>
`

const HOMEPAGE_HTML = `
<!doctype html>
<html>
  <head>
    <title>Unleash Your Potential | Exciting Career Opportunities At KoinX | Join Our Team</title>
  </head>
  <body>
    <h1>Careers At KoinX</h1>
    <p>The Core of KoinX</p>
    <p>Committed To Your Success</p>
    <a href="https://angel.co/company/koinx">Job Openings</a>
  </body>
</html>
`

const PUBLIC_WELLFOUND_HTML = `
<!doctype html>
<html>
  <body>
    <h1>Jobs at KoinX</h1>
    <span>View 1 job</span>
    <article class="job-card"><h2>Backend Engineer</h2></article>
  </body>
</html>
`

const BLOCKED_WELLFOUND_HTML = `
<!doctype html>
<html lang="en">
  <head>
    <title>Just a moment...</title>
  </head>
  <body>
    <p>Checking if the site connection is secure</p>
    <p>Enable JavaScript and cookies to continue</p>
    <p>Cloudflare Ray ID: abc123def456</p>
  </body>
</html>
`

const SECURITY_CHECK_WELLFOUND_HTML = `
<!doctype html>
<html lang="en">
  <head>
    <title>Security Check | Wellfound</title>
  </head>
  <body>
    <h1>403 / Security check</h1>
    <p>Before you continue, please verify your request.</p>
    <p>We need to confirm that this request is coming from a real browser before we send you to Wellfound.</p>
    <p>Enable JavaScript and cookies to continue</p>
    <p>Cloudflare Ray ID: a2b2f14a8917f56a</p>
    <a href="/">Back to Wellfound</a>
    <a href="/contact">Contact Support</a>
  </body>
</html>
`

const loadModule = async () => {
  try {
    return await import('../../scraper/koinx/script.js')
  } catch {
    assert.fail('Expected KoinX scraper module at ../../scraper/koinx/script.js')
  }
}

test('KoinX sentinel pins the Friday, August 14, 2026 first-party handoff and blocked-or-empty Wellfound surface', async () => {
  const koinx = await loadModule()

  assert.equal(koinx.SOURCE, 'koinx')
  assert.equal(koinx.COMPANY, 'KoinX')
  assert.equal(koinx.VERIFIED_ON, '2026-08-14')
  assert.equal(koinx.HOMEPAGE_URL, 'https://www.koinx.com/careers')
  assert.equal(koinx.CAREERS_URL, 'https://wellfound.com/company/koinx/jobs')
  assert.equal(koinx.hasVerifiedHomepageSignal(HOMEPAGE_HTML), true)
  assert.equal(koinx.hasEmptyJobsSurfaceSignal(EMPTY_WELLFOUND_HTML), true)
  assert.equal(koinx.hasExpectedBlockedWellfoundSurface(BLOCKED_WELLFOUND_HTML), true)
  assert.equal(koinx.hasExpectedBlockedWellfoundSurface(SECURITY_CHECK_WELLFOUND_HTML), true)
  assert.equal(koinx.hasEmptyJobsSurfaceSignal(PUBLIC_WELLFOUND_HTML), false)
})

test('KoinX sentinel returns [] only while the verified public jobs surface is empty', async () => {
  const koinx = await loadModule()
  const requestedUrls = []

  const jobs = await koinx.createKoinXScraper().run({
    fetchPage: async (url) => {
      requestedUrls.push(url)
      if (url === koinx.HOMEPAGE_URL) {
        return { status: 200, url, html: HOMEPAGE_HTML }
      }
      return { status: 200, url, html: EMPTY_WELLFOUND_HTML }
    },
  })

  assert.deepEqual(requestedUrls, [koinx.HOMEPAGE_URL, koinx.CAREERS_URL])
  assert.deepEqual(jobs, [])
})

test('KoinX sentinel fails closed when the verified public jobs surface changes', async () => {
  const koinx = await loadModule()

  await assert.rejects(
    koinx.createKoinXScraper().run({
      fetchPage: async (url) => {
        if (url === koinx.HOMEPAGE_URL) {
          return { status: 200, url, html: HOMEPAGE_HTML }
        }
        return { status: 200, url, html: PUBLIC_WELLFOUND_HTML }
      },
    }),
    /verified jobs surface/i,
  )
})

test('KoinX sentinel can verify the empty state with a browser fallback after direct access is blocked', async () => {
  const koinx = await loadModule()
  const browserUrls = []

  const jobs = await koinx.createKoinXScraper().run({
    fetchPage: async (url) => {
      if (url === koinx.HOMEPAGE_URL) {
        return { status: 200, url, html: HOMEPAGE_HTML }
      }
      throw new Error('HTTP 403 for https://wellfound.com/company/koinx/jobs')
    },
    fetchBrowserPage: async (url) => {
      browserUrls.push(url)
      return { status: 403, url, html: BLOCKED_WELLFOUND_HTML }
    },
  })

  assert.deepEqual(browserUrls, [koinx.CAREERS_URL])
  assert.deepEqual(jobs, [])
})

test('KoinX sentinel returns [] when Wellfound serves the current security-check interstitial directly', async () => {
  const koinx = await loadModule()
  const requestedUrls = []

  const jobs = await koinx.createKoinXScraper().run({
    fetchPage: async (url) => {
      requestedUrls.push(url)
      if (url === koinx.HOMEPAGE_URL) {
        return { status: 200, url, html: HOMEPAGE_HTML }
      }
      return { status: 403, url, html: SECURITY_CHECK_WELLFOUND_HTML }
    },
  })

  assert.deepEqual(requestedUrls, [koinx.HOMEPAGE_URL, koinx.CAREERS_URL])
  assert.deepEqual(jobs, [])
})

test('KoinX homepage verification accepts the live iframe-based AngelList handoff', async () => {
  const koinx = await loadModule()

  const liveHomepageHtml = `
  <!doctype html>
  <html>
    <head>
      <title>Unleash Your Potential | Exciting Career Opportunities At KoinX | Join Our Team</title>
    </head>
    <body>
      <h1>Careers At KoinX</h1>
      <p>The Core of KoinX</p>
      <p>Committed To Your Success</p>
      <p>Job Openings</p>
      <iframe src="https://angel.co/company/koinx/jobs"></iframe>
    </body>
  </html>
  `

  assert.equal(koinx.hasVerifiedHomepageSignal(liveHomepageHtml), true)
})
