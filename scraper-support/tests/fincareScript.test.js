import assert from 'node:assert/strict'
import test from 'node:test'

import {
  CAREERS_URL,
  CHECKED_REDIRECT_ROUTE_URLS,
  COMPANY,
  HOMEPAGE_URL,
  LEGACY_MERGER_INFO_URL,
  LEGACY_WWW_HOMEPAGE_URL,
  MERGED_PARENT_HOMEPAGE_URL,
  OFFICIAL_BRAND_NAME,
  SOURCE,
  VERIFIED_ON,
  VERIFIED_SURFACE_SUMMARY,
  createFincareScraper,
  hasCloudflareChallengePageSignal,
  hasMergedParentHomepageSignal,
  isVerifiedLegacyRedirect,
  isVerifiedMergedParentHomepage,
} from '../../scraper/fincare/script.js'

const auHomepageHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Personal, Business, Corporate, and NRI Banking | AU Small Finance Bank</title>
    <link rel="canonical" href="https://www.au.bank.in/" />
  </head>
  <body>
    <nav>
      <a href="/about-us">About us</a>
      <a href="https://ib.au.bank.in">Fincare NetBanking</a>
      <a href="https://corporate.au.bank.in">Fincare Corporate NetBanking</a>
    </nav>
    <main>
      <h1>AU Small Finance Bank</h1>
      <p>Personal, Business, Corporate, and NRI Banking</p>
    </main>
  </body>
</html>
`

const forbiddenRedirectHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>403 Forbidden</title>
  </head>
  <body>
    <h1>403 Forbidden</h1>
  </body>
</html>
`

const cloudflareChallengeHtml = `
<!doctype html>
<html lang="en-US">
  <head>
    <title>Just a moment...</title>
    <meta name="robots" content="noindex,nofollow">
  </head>
  <body>
    <p>Enable JavaScript and cookies to continue before proceeding to au.bank.in.</p>
    <script src="https://challenges.cloudflare.com/turnstile/v0/api.js" defer></script>
    <h1>Please wait while we verify your browser</h1>
  </body>
</html>
`

const publicJobsHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Fincare Careers</title>
  </head>
  <body>
    <main>
      <h1>Current Openings</h1>
      <a href="/apply/senior-engineer">Apply now</a>
    </main>
  </body>
</html>
`

test('Fincare helper exports stay pinned to the verified redirect-only contract', () => {
  assert.equal(SOURCE, 'fincare')
  assert.equal(COMPANY, 'Fincare')
  assert.equal(OFFICIAL_BRAND_NAME, 'Fincare')
  assert.equal(VERIFIED_ON, '2026-08-14')
  assert.equal(HOMEPAGE_URL, 'https://fincarebank.in/')
  assert.equal(CAREERS_URL, 'https://fincarebank.in/careers')
  assert.equal(LEGACY_WWW_HOMEPAGE_URL, 'https://www.fincarebank.com/')
  assert.equal(MERGED_PARENT_HOMEPAGE_URL, 'https://www.au.bank.in/')
  assert.equal(
    LEGACY_MERGER_INFO_URL,
    'https://www.au.bank.in/au-small-finance-bank-and-fincare-small-finance-bank-merger',
  )
  assert.deepEqual(CHECKED_REDIRECT_ROUTE_URLS, [
    'https://fincarebank.in/',
    'https://fincarebank.in/careers',
    'https://fincarebank.in/jobs',
    'https://fincarebank.in/about-us/careers',
  ])
  assert.match(VERIFIED_SURFACE_SUMMARY, /no trustworthy public jobs surface/i)

  assert.equal(hasMergedParentHomepageSignal(auHomepageHtml), true)
  assert.equal(hasCloudflareChallengePageSignal(cloudflareChallengeHtml), true)
  assert.equal(
    isVerifiedMergedParentHomepage({
      status: 200,
      url: MERGED_PARENT_HOMEPAGE_URL,
      html: auHomepageHtml,
    }),
    true,
  )
  assert.equal(
    isVerifiedMergedParentHomepage({
      status: 403,
      url: MERGED_PARENT_HOMEPAGE_URL,
      html: cloudflareChallengeHtml,
    }),
    true,
  )
  assert.equal(
    isVerifiedLegacyRedirect({
      status: 403,
      url: MERGED_PARENT_HOMEPAGE_URL,
      html: cloudflareChallengeHtml,
    }),
    true,
  )
  assert.equal(
    isVerifiedLegacyRedirect({
      status: 200,
      url: MERGED_PARENT_HOMEPAGE_URL,
      html: auHomepageHtml,
    }),
    true,
  )
})

test('Fincare returns [] only while the exact-name routes still hand off to AU instead of publishing jobs', async () => {
  const requestedUrls = []

  const jobs = await createFincareScraper().run({
    fetchPage: async (url) => {
      requestedUrls.push(url)

      if (url === MERGED_PARENT_HOMEPAGE_URL) {
        return {
          status: 200,
          url,
          html: auHomepageHtml,
        }
      }

      if (CHECKED_REDIRECT_ROUTE_URLS.includes(url)) {
        return {
          status: 403,
          url: MERGED_PARENT_HOMEPAGE_URL,
          html: cloudflareChallengeHtml,
        }
      }

      throw new Error(`Unexpected Fincare URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [
    MERGED_PARENT_HOMEPAGE_URL,
    ...CHECKED_REDIRECT_ROUTE_URLS,
  ])
  assert.deepEqual(jobs, [])
})

test('Fincare returns [] when the verified AU handoff still holds but exact-name legacy routes are locally unresolvable', async () => {
  const requestedUrls = []

  const jobs = await createFincareScraper().run({
    fetchPage: async (url) => {
      requestedUrls.push(url)

      if (url === MERGED_PARENT_HOMEPAGE_URL) {
        return {
          status: 403,
          url,
          html: cloudflareChallengeHtml,
        }
      }

      if (CHECKED_REDIRECT_ROUTE_URLS.includes(url)) {
        const error = new TypeError('fetch failed')
        error.cause = {
          code: 'ENOTFOUND',
          hostname: 'fincarebank.in',
        }
        throw error
      }

      throw new Error(`Unexpected Fincare URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [
    MERGED_PARENT_HOMEPAGE_URL,
    ...CHECKED_REDIRECT_ROUTE_URLS,
  ])
  assert.deepEqual(jobs, [])
})

test('Fincare fails closed when the AU handoff homepage or any exact-name route drifts', async () => {
  await assert.rejects(
    createFincareScraper().run({
      fetchPage: async (url) => {
        if (url === MERGED_PARENT_HOMEPAGE_URL) {
          return {
            status: 200,
            url,
            html: '<html><head><title>Placeholder</title></head><body>AU Bank</body></html>',
          }
        }

        throw new Error(`Unexpected Fincare URL: ${url}`)
      },
    }),
    /verified merged AU homepage/i,
  )

  await assert.rejects(
    createFincareScraper().run({
      fetchPage: async (url) => {
        if (url === MERGED_PARENT_HOMEPAGE_URL) {
          return {
            status: 200,
            url,
            html: auHomepageHtml,
          }
        }

        if (url === CHECKED_REDIRECT_ROUTE_URLS[0]) {
          return {
            status: 200,
            url,
            html: publicJobsHtml,
          }
        }

        throw new Error(`Unexpected Fincare URL: ${url}`)
      },
    }),
    /verified exact-name route changed/i,
  )
})
