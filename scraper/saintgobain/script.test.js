import assert from 'node:assert/strict'
import test from 'node:test'

import {
  APPLY_PORTAL_URL,
  CAREERS_URL,
  createSaintGobainScraper,
  hasBrowserVerificationBlockSignal,
  hasFirstPartyJobsSignal,
  hasLoginOnlyPortalSignal,
  hasOfficialCareersSignal,
  hasPublicPortalJobsSignal,
  hasVerifiedPortalHandoff,
} from './script.js'

const officialCareersHtml = `
  <!doctype html>
  <html lang="en">
    <head>
      <title>Explore Career Opportunities at Saint-Gobain Glass | Saint-Gobain Glass</title>
    </head>
    <body>
      <main>
        <a href="https://apply.in.saint-gobain-glass.com/">View Jobs</a>
        <h1>Careers at Saint-Gobain</h1>
        <p>Saint-Gobain is the worldwide leader in light and sustainable construction, improving daily life through high-performance solutions.</p>
        <section>
          <h2>Why Saint-Gobain?</h2>
          <p>At Saint-Gobain, we are here for a bigger purpose.</p>
        </section>
      </main>
    </body>
  </html>
`

const browserVerificationBlockHtml = `
  <!doctype html>
  <html lang="en">
    <head>
      <title>Just a moment...</title>
    </head>
    <body>
      <main>
        <h1>Just a moment...</h1>
        <p>We're checking your browser before allowing access.</p>
        <p>Ray ID: abc123</p>
      </main>
      <script src="/cdn-cgi/challenge-platform/h/g/orchestrate/chl_page/v1"></script>
    </body>
  </html>
`

const loginOnlyPortalHtml = `
  <!doctype html>
  <html lang="en">
    <head>
      <title>Login</title>
    </head>
    <body class="login">
      <form class="login-form">
        <h3>SG Careers</h3>
        <label>User Id.</label>
        <label>Password</label>
        <a href="javascript:;" id="forget-password">Forgot your password ?</a>
        <button type="submit">Login</button>
        <span>Click here to <a id="register-btn" href="javascript:;">Registration</a></span>
      </form>
    </body>
  </html>
`

const firstPartyJobsHtml = `
  <!doctype html>
  <html lang="en">
    <head>
      <title>Explore Career Opportunities at Saint-Gobain Glass | Saint-Gobain Glass</title>
    </head>
    <body>
      <main>
        <a href="https://apply.in.saint-gobain-glass.com/">View Jobs</a>
        <h1>Careers at Saint-Gobain</h1>
        <p>Saint-Gobain is the worldwide leader in light and sustainable construction, improving daily life through high-performance solutions.</p>
        <section>
          <h2>Why Saint-Gobain?</h2>
        </section>
        <h2>Current Openings</h2>
        <article>
          <a href="/job/process-engineer">Process Engineer</a>
          <p>Published : 08/04/2026</p>
        </article>
      </main>
    </body>
  </html>
`

const publicPortalJobsHtml = `
  <!doctype html>
  <html lang="en">
    <head>
      <title>Jobs</title>
    </head>
    <body>
      <main>
        <h1>Current Openings</h1>
        <article>
          <h2>Process Engineer</h2>
          <a href="/job/123">Apply now</a>
        </article>
      </main>
    </body>
  </html>
`

test('Saint-Gobain verifier recognizes the official India careers page, Cloudflare gate, and login-only portal separately', () => {
  assert.equal(hasOfficialCareersSignal(officialCareersHtml), true)
  assert.equal(hasVerifiedPortalHandoff(officialCareersHtml), true)
  assert.equal(hasFirstPartyJobsSignal(officialCareersHtml), false)

  assert.equal(hasBrowserVerificationBlockSignal(browserVerificationBlockHtml), true)
  assert.equal(hasLoginOnlyPortalSignal(loginOnlyPortalHtml), true)
  assert.equal(hasPublicPortalJobsSignal(loginOnlyPortalHtml), false)
  assert.equal(hasPublicPortalJobsSignal(publicPortalJobsHtml), true)
})

test('Saint-Gobain returns an empty set when the official India careers page still hands off to the login-only portal', async () => {
  const scraper = createSaintGobainScraper()
  const requestedUrls = []

  const jobs = await scraper.run({
    fetchText: async (url) => {
      requestedUrls.push(url)
      if (url === CAREERS_URL) return officialCareersHtml
      if (url === APPLY_PORTAL_URL) return loginOnlyPortalHtml
      throw new Error(`Unexpected URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [CAREERS_URL, APPLY_PORTAL_URL])
  assert.deepEqual(jobs, [])
})

test('Saint-Gobain returns an empty set when the official India careers page is temporarily gated but the portal remains login-only', async () => {
  const scraper = createSaintGobainScraper()

  const jobs = await scraper.run({
    fetchPage: async (url) => {
      if (url === CAREERS_URL) {
        return {
          status: 403,
          url,
          html: browserVerificationBlockHtml,
        }
      }

      if (url === APPLY_PORTAL_URL) {
        return {
          status: 200,
          url,
          html: loginOnlyPortalHtml,
        }
      }

      throw new Error(`Unexpected URL: ${url}`)
    },
  })

  assert.deepEqual(jobs, [])
})

test('Saint-Gobain fails closed when the official handoff changes or the portal turns into a public jobs board', async () => {
  const scraper = createSaintGobainScraper()

  await assert.rejects(
    scraper.run({
      fetchPage: async (url) => {
        if (url === CAREERS_URL) {
          return {
            status: 200,
            url,
            html: officialCareersHtml.replaceAll(APPLY_PORTAL_URL, 'https://example.com/jobs'),
          }
        }

        return {
          status: 200,
          url,
          html: loginOnlyPortalHtml,
        }
      },
    }),
    /careers handoff changed/i,
  )

  await assert.rejects(
    scraper.run({
      fetchPage: async (url) => ({
        status: 200,
        url,
        html: url === CAREERS_URL ? firstPartyJobsHtml : loginOnlyPortalHtml,
      }),
    }),
    /first-party public jobs surface/i,
  )

  await assert.rejects(
    scraper.run({
      fetchPage: async (url) => ({
        status: 200,
        url,
        html: url === APPLY_PORTAL_URL ? publicPortalJobsHtml : officialCareersHtml,
      }),
    }),
    /public guest-visible jobs/i,
  )
})
