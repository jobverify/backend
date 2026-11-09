import assert from 'node:assert/strict'
import test from 'node:test'

const brokenHomepageHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>ConnectYourDomain Error | Wix.com</title>
  </head>
  <body>
    <main>
      <h1>Looks Like This Domain Isn't Connected To A Website Yet</h1>
      <p>If this domain recently pointed to Wix, it should appear soon.</p>
      <a href="https://www.wix.com/">Wix.com</a>
    </main>
  </body>
</html>
`

const brokenRouteHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>404 Error: Page Not Found | Wix.com</title>
  </head>
  <body>
    <main>
      <h1>404</h1>
      <p>The page could not be found.</p>
      <a href="https://www.wix.com/">Wix.com</a>
    </main>
  </body>
</html>
`

const publicJobsHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Koo Careers</title>
  </head>
  <body>
    <section>
      <h1>Current Openings</h1>
      <a href="https://www.kooapp.com/careers/software-engineer">Apply now</a>
    </section>
  </body>
</html>
`

const loadKooModule = async () => {
  try {
    return await import('../../scraper/koo/script.js')
  } catch {
    assert.fail('Expected Koo scraper module at ../../scraper/koo/script.js')
  }
}

test('Koo sentinel pins the verified broken first-party domain and route constants', async () => {
  const koo = await loadKooModule()

  assert.equal(koo.SOURCE, 'koo')
  assert.equal(koo.COMPANY_NAME, 'Koo')
  assert.equal(koo.VERIFIED_ON, '2026-07-16')
  assert.equal(koo.HOMEPAGE_URL, 'https://www.kooapp.com/')
  assert.equal(koo.ALTERNATE_HOMEPAGE_URL, 'https://kooapp.com/')
  assert.deepEqual(koo.VERIFIED_BROKEN_ROUTE_URLS, [
    'https://www.kooapp.com/careers',
    'https://www.kooapp.com/jobs',
    'https://www.kooapp.com/about-us',
    'https://www.kooapp.com/contact-us',
    'https://www.kooapp.com/robots.txt',
    'https://www.kooapp.com/sitemap.xml',
  ])

  assert.equal(koo.hasVerifiedBrokenWixSignal(brokenHomepageHtml), true)
  assert.equal(koo.hasVerifiedBrokenWixSignal(brokenRouteHtml), true)
  assert.equal(koo.hasPublicJobBoardSignal(brokenHomepageHtml), false)
  assert.equal(koo.hasPublicJobBoardSignal(publicJobsHtml), true)
  assert.equal(
    koo.isVerifiedBrokenPage({
      status: 404,
      url: koo.HOMEPAGE_URL,
      html: brokenHomepageHtml,
    }),
    true,
  )
  assert.equal(
    koo.isVerifiedBrokenPage({
      status: 404,
      url: koo.VERIFIED_BROKEN_ROUTE_URLS[0],
      html: brokenRouteHtml,
    }),
    true,
  )
  assert.equal(
    koo.isVerifiedBrokenPage({
      status: 200,
      url: koo.VERIFIED_BROKEN_ROUTE_URLS[0],
      html: publicJobsHtml,
    }),
    false,
  )
})

test('Koo sentinel returns [] only while the official domain stays in the verified broken Wix state', async () => {
  const koo = await loadKooModule()
  const requestedUrls = []

  const jobs = await koo.createKooScraper().run({
    fetchPage: async (url) => {
      requestedUrls.push(url)

      if (url === koo.HOMEPAGE_URL || url === koo.ALTERNATE_HOMEPAGE_URL) {
        return { status: 404, url, html: brokenHomepageHtml }
      }

      if (koo.VERIFIED_BROKEN_ROUTE_URLS.includes(url)) {
        return { status: 404, url, html: brokenRouteHtml }
      }

      throw new Error(`Unexpected URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [
    koo.HOMEPAGE_URL,
    koo.ALTERNATE_HOMEPAGE_URL,
    ...koo.VERIFIED_BROKEN_ROUTE_URLS,
  ])
  assert.deepEqual(jobs, [])
})

test('Koo sentinel fails closed when the official domain starts serving a live page or public jobs', async () => {
  const koo = await loadKooModule()

  await assert.rejects(
    koo.createKooScraper().run({
      fetchPage: async (url) => {
        if (url === koo.HOMEPAGE_URL) {
          return { status: 200, url, html: '<html><body>Unexpected recovery</body></html>' }
        }

        throw new Error(`Unexpected URL: ${url}`)
      },
    }),
    /verified broken first-party domain/i,
  )

  await assert.rejects(
    koo.createKooScraper().run({
      fetchPage: async (url) => {
        if (url === koo.HOMEPAGE_URL || url === koo.ALTERNATE_HOMEPAGE_URL) {
          return { status: 404, url, html: brokenHomepageHtml }
        }

        if (url === koo.VERIFIED_BROKEN_ROUTE_URLS[0]) {
          return { status: 200, url, html: publicJobsHtml }
        }

        if (koo.VERIFIED_BROKEN_ROUTE_URLS.slice(1).includes(url)) {
          return { status: 404, url, html: brokenRouteHtml }
        }

        throw new Error(`Unexpected URL: ${url}`)
      },
    }),
    /changed materially or now exposes public jobs/i,
  )
})
