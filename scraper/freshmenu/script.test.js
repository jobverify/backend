import assert from 'node:assert/strict'
import test from 'node:test'

import {
  ABOUT_URL,
  HOMEPAGE_URL,
  MISSING_JOB_ROUTE_URLS,
  createFreshMenuScraper,
  hasOfficialAboutPageSignal,
  hasOfficialHomepageSignal,
  hasPublicJobListingSignal,
  isKnownMissingJobRoute,
} from './script.js'

const homepageHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Order food online. Get fresh food delivery from FreshMenu.</title>
  </head>
  <body>
    <main>
      <a href="/menu">Menu</a>
      <a href="/corporate">Corporate</a>
      <a href="/about">About</a>
      <a href="/blogs">Blogs</a>
      <p>FreshMenu cares</p>
      <p>FreshPass</p>
      <p>Open the link in Mobile Browser for Better Experience</p>
      <p>To avail corporate discount, address needs to be updated.</p>
      <p>Add to Cart</p>
    </main>
  </body>
</html>
`

const genericAppShellHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Fresh food online. Order Tasty food from FreshMenu.</title>
  </head>
  <body>
    <main>
      <a href="/menu">Menu</a>
      <a href="/blogs">Blogs</a>
      <a href="/about">About Us</a>
      <a href="/corporate">Corporate Ordering</a>
      <p>Add to Cart</p>
      <p>To avail corporate discount, address needs to be updated.</p>
    </main>
  </body>
</html>
`

const publicJobsHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>FreshMenu Careers</title>
    <script type="application/ld+json">
      {"@context":"https://schema.org","@type":"JobPosting","title":"Kitchen Operations Manager"}
    </script>
  </head>
  <body>
    <main>
      <h1>Current Openings</h1>
      <a href="https://jobs.lever.co/freshmenu/kitchen-operations-manager">Apply now</a>
    </main>
  </body>
</html>
`

test('FreshMenu keeps the verified no-public-jobs apex-domain contract pinned to the current app shells', async () => {
  assert.equal(hasOfficialHomepageSignal(homepageHtml), true)
  assert.equal(hasOfficialAboutPageSignal(genericAppShellHtml), true)
  assert.equal(hasPublicJobListingSignal(homepageHtml), false)
  assert.equal(hasPublicJobListingSignal(genericAppShellHtml), false)
  assert.equal(hasPublicJobListingSignal(publicJobsHtml), true)
  assert.equal(
    isKnownMissingJobRoute(
      { status: 200, url: MISSING_JOB_ROUTE_URLS[0], html: genericAppShellHtml },
      MISSING_JOB_ROUTE_URLS[0],
    ),
    true,
  )
})

test('FreshMenu returns no jobs only while the verified homepage, about page, and missing-route shells stay stable', async () => {
  const requestedUrls = []

  const jobs = await createFreshMenuScraper().run({
    fetchPage: async (url) => {
      requestedUrls.push(url)

      if (url === HOMEPAGE_URL) {
        return { status: 200, url, html: homepageHtml }
      }

      if (url === ABOUT_URL || MISSING_JOB_ROUTE_URLS.includes(url)) {
        return { status: 200, url, html: genericAppShellHtml }
      }

      throw new Error(`Unexpected URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [
    HOMEPAGE_URL,
    ABOUT_URL,
    ...MISSING_JOB_ROUTE_URLS,
  ])
  assert.deepEqual(jobs, [])
})
