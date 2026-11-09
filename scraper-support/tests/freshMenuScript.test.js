import assert from 'node:assert/strict'
import test from 'node:test'

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
      <a href="/signin">Sign In</a>
      <p>FreshMenu cares</p>
      <p>FreshPass</p>
      <p>Open the link in Mobile Browser for Better Experience</p>
      <p>To avail corporate discount, address needs to be updated.</p>
      <p>Add to Cart</p>
    </main>
  </body>
</html>
`

const aboutPageHtml = `
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

const currentAppShellHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>FreshMenu \u2014 Made fresh. Served fresh.</title>
    <meta name="description" content="Chef-made world cuisine, ranked by what people actually order. Browse the FreshMenu board and plan bulk orders for your team or party.">
    <meta property="og:site_name" content="FreshMenu">
    <script type="module" crossorigin src="/assets/index-DzWmoqGd.js"></script>
  </head>
  <body><div id="root"></div></body>
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

const missingRouteHtml = aboutPageHtml

const loadModule = async () => {
  try {
    return await import('../../scraper/freshmenu/script.js')
  } catch {
    assert.fail('Expected FreshMenu scraper module at ../../scraper/freshmenu/script.js')
  }
}

test('FreshMenu helpers stay pinned to the verified no-public-jobs apex-domain contract', async () => {
  const freshMenu = await loadModule()

  assert.equal(freshMenu.COMPANY, 'FreshMenu')
  assert.equal(freshMenu.SOURCE, 'freshmenu')
  assert.equal(freshMenu.HOMEPAGE_URL, 'https://freshmenu.com/')
  assert.equal(freshMenu.ABOUT_URL, 'https://freshmenu.com/about')
  assert.deepEqual(freshMenu.MISSING_JOB_ROUTE_URLS, [
    'https://freshmenu.com/careers',
    'https://freshmenu.com/jobs',
  ])
  assert.equal(freshMenu.VERIFIED_ON, '2026-09-03')
  assert.match(freshMenu.VERIFIED_SURFACE_SUMMARY, /no trustworthy public jobs surface/i)
  assert.equal(freshMenu.hasOfficialHomepageSignal(homepageHtml), true)
  assert.equal(freshMenu.hasOfficialAboutPageSignal(aboutPageHtml), true)
  assert.equal(freshMenu.hasOfficialHomepageSignal(currentAppShellHtml), true)
  assert.equal(freshMenu.hasOfficialAboutPageSignal(currentAppShellHtml), true)
  assert.equal(freshMenu.hasPublicJobListingSignal(homepageHtml), false)
  assert.equal(freshMenu.hasPublicJobListingSignal(aboutPageHtml), false)
  assert.equal(freshMenu.hasPublicJobListingSignal(publicJobsHtml), true)
  assert.equal(
    freshMenu.isKnownMissingJobRoute(
      { status: 200, url: 'https://freshmenu.com/jobs', html: missingRouteHtml },
      'https://freshmenu.com/jobs',
    ),
    true,
  )
})

test('FreshMenu returns no jobs only while the verified apex no-public-jobs contract holds', async () => {
  const freshMenu = await loadModule()
  const requestedUrls = []

  const jobs = await freshMenu.run({
    fetchPage: async (url) => {
      requestedUrls.push(url)

      if (url === freshMenu.HOMEPAGE_URL) {
        return { status: 200, url, html: homepageHtml }
      }

      if (url === freshMenu.ABOUT_URL) {
        return { status: 200, url, html: aboutPageHtml }
      }

      if (freshMenu.MISSING_JOB_ROUTE_URLS.includes(url)) {
        return { status: 200, url, html: missingRouteHtml }
      }

      throw new Error(`Unexpected URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [
    freshMenu.HOMEPAGE_URL,
    freshMenu.ABOUT_URL,
    ...freshMenu.MISSING_JOB_ROUTE_URLS,
  ])
  assert.deepEqual(jobs, [])
})

test('FreshMenu fails closed when homepage/about markers drift or a public jobs surface appears', async () => {
  const freshMenu = await loadModule()

  await assert.rejects(
    freshMenu.run({
      fetchPage: async (url) => {
        if (url === freshMenu.HOMEPAGE_URL) {
          return { status: 200, url, html: '<html><body><a href="/careers">Careers</a></body></html>' }
        }

        throw new Error(`Unexpected URL: ${url}`)
      },
    }),
    /homepage no longer matches|verified homepage/i,
  )

  await assert.rejects(
    freshMenu.run({
      fetchPage: async (url) => {
        if (url === freshMenu.HOMEPAGE_URL) {
          return { status: 200, url, html: homepageHtml }
        }

        if (url === freshMenu.ABOUT_URL) {
          return { status: 200, url, html: publicJobsHtml }
        }

        throw new Error(`Unexpected URL: ${url}`)
      },
    }),
    /about page changed materially|public jobs surface/i,
  )

  await assert.rejects(
    freshMenu.run({
      fetchPage: async (url) => {
        if (url === freshMenu.HOMEPAGE_URL) {
          return { status: 200, url, html: homepageHtml }
        }

        if (url === freshMenu.ABOUT_URL) {
          return { status: 200, url, html: aboutPageHtml }
        }

        if (url === freshMenu.MISSING_JOB_ROUTE_URLS[0]) {
          return { status: 200, url, html: publicJobsHtml }
        }

        if (url === freshMenu.MISSING_JOB_ROUTE_URLS[1]) {
          return { status: 200, url, html: missingRouteHtml }
        }

        throw new Error(`Unexpected URL: ${url}`)
      },
    }),
    /verified no-public-job route changed/i,
  )
})
