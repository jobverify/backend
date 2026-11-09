import assert from 'node:assert/strict'
import test from 'node:test'

import {
  HOMEPAGE_URL,
  WELLFOUND_JOBS_URL,
  defaultFetchPage,
  hasAccessibleWellfoundJobsSignal,
  isVerifiedWellfoundChallenge,
} from './script.js'

test('IQnext Synconext default fetch is bounded by a timeout signal', async () => {
  let capturedInit = null

  const page = await defaultFetchPage(HOMEPAGE_URL, {
    timeoutMs: 25,
    fetchImpl: async (url, init) => {
      capturedInit = init
      return {
        status: 200,
        url,
        headers: { get: () => null },
        text: async () => '<html><head><title>Home - Synconext</title></head></html>',
      }
    },
  })

  assert.equal(page.status, 200)
  assert.equal(page.url, HOMEPAGE_URL)
  assert.equal(capturedInit.signal instanceof AbortSignal, true)
})

test('IQnext Synconext accepts the current verified Wellfound Cloudflare challenge', () => {
  const html = `<!DOCTYPE html>
  <html lang="en-US">
  <head>
    <title>Just a moment...</title>
    <meta name="robots" content="noindex,nofollow">
  </head>
  <body>
    <script>window._cf_chl_opt = { cZone: "wellfound.com" };</script>
    <div id="challenge-platform"></div>
    <div>Enable JavaScript and cookies to continue</div>
    <div>Ray ID: 1234567890abcdef</div>
  </body>
  </html>`

  assert.equal(isVerifiedWellfoundChallenge({
    status: 403,
    url: WELLFOUND_JOBS_URL,
    headers: {
      server: 'cloudflare',
      'cf-mitigated': 'challenge',
    },
    html,
  }), true)
})

test('IQnext Synconext still accepts the legacy Wellfound anti-bot challenge', () => {
  const html = `<!DOCTYPE html>
  <html>
  <head><title>Access denied</title></head>
  <body>
    <script src="https://captcha-delivery.com/c.js"></script>
    <div>Please enable JS and disable any ad blocker</div>
  </body>
  </html>`

  assert.equal(isVerifiedWellfoundChallenge({
    status: 403,
    url: WELLFOUND_JOBS_URL,
    html,
  }), true)
})

test('IQnext Synconext rejects unrelated 403 pages', () => {
  assert.equal(isVerifiedWellfoundChallenge({
    status: 403,
    url: WELLFOUND_JOBS_URL,
    html: '<html><head><title>Forbidden</title></head><body>Access denied</body></html>',
  }), false)
})

test('IQnext Synconext recognizes the readable public Wellfound board', () => {
  const page = {
    status: 200,
    url: WELLFOUND_JOBS_URL,
    html: `
      <html>
        <head><title>Jobs at IQnext: Explore current Opportunities</title></head>
        <body>
          <p>View 1 job</p>
          <h1>Jobs at IQnext</h1>
          <a href="https://wellfound.com/jobs/4438235-enterprise-sales-manager-b2b-saas">
            Enterprise Sales Manager (B2B, SaaS)
          </a>
          <p>Sales</p>
          <p>In office • Bangalore Urban</p>
          <p>Full Time</p>
          <p>
            Identify potential customer targets from enterprise/corporate segments.
          </p>
        </body>
      </html>
    `,
  }

  assert.equal(hasAccessibleWellfoundJobsSignal(page), true)
})
