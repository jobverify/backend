import assert from 'node:assert/strict'
import test from 'node:test'

const loadElmachModule = async () => {
  try {
    return await import('./script.js')
  } catch {
    assert.fail('Expected Elmach scraper module at ./script.js')
  }
}

const officialHomepageHtml = `
<!doctype html>
<html class="no-js" lang="en">
  <head>
    <title>ELMACH Packages India pvt. ltd.</title>
  </head>
  <body>
    <header>
      <nav>
        <a href="/">Home</a>
        <a href="/about">About ELMACH</a>
        <a href="/products">Products</a>
        <a href="/news">News &amp; Events</a>
        <a href="/service">Service Support</a>
        <a href="/catalog">Request a Catalog</a>
        <a href="/contact">Contact Us</a>
      </nav>
    </header>
    <main>
      <h1>Welcome to Elmach Packages India Pvt. Ltd.</h1>
      <h2>
        Manufacturers of Blister Packing, Cartoning, Blister Feeders, Bottle Fillers, Custom Packaging Automation
      </h2>
      <p>
        Starting operations with blister pack machines in 1988, at Mumbai, ELMACH holds a market
        share of more than 4800 blister pack machines installed in over 106 countries worldwide.
      </p>
      <p>Sales &amp; Service: Baddi Bangalore Chennai Delhi Hyderabad Roorkee Sikkim</p>
    </main>
    <footer>
      <a href="/products">Products</a>
      <a href="/news">News &amp; Events</a>
      <a href="/service">Service Support</a>
      <a href="/catalog">Request a Catalog</a>
      <a href="/contact">Contact Us</a>
    </footer>
  </body>
</html>
`

const missingRouteHtml = `
<!DOCTYPE HTML PUBLIC "-//W3C//DTD HTML 4.01//EN" "http://www.w3.org/TR/html4/strict.dtd">
<html>
  <head>
    <title>404 Not Found</title>
  </head>
  <body>
    <h1>Not Found</h1>
    <p>The requested URL was not found on this server.</p>
  </body>
</html>
`

const missingPhpRouteText = 'File not found.'

const publicJobsHtml = `
<!DOCTYPE html>
<html lang="en">
  <head>
    <title>ELMACH Careers</title>
  </head>
  <body>
    <main>
      <h1>Current Openings</h1>
      <a href="https://elmach.com/careers/apply/process-engineer">Apply now</a>
      <a href="https://jobs.lever.co/elmach/process-engineer">External apply</a>
    </main>
  </body>
</html>
`

test('Elmach sentinel pins the verified homepage and missing-route contract', async () => {
  const elmach = await loadElmachModule()

  assert.equal(elmach.SOURCE, 'elmach')
  assert.equal(elmach.COMPANY, 'ELMACH Packages India Pvt. Ltd.')
  assert.equal(elmach.HOMEPAGE_URL, 'https://elmach.com/')
  assert.equal(elmach.ROBOTS_URL, 'https://elmach.com/robots.txt')
  assert.equal(elmach.SITEMAP_URL, 'https://elmach.com/sitemap.xml')
  assert.deepEqual(elmach.NO_PUBLIC_CAREERS_ROUTE_URLS, [
    'https://elmach.com/careers',
    'https://elmach.com/careers/',
    'https://elmach.com/career',
    'https://elmach.com/career/',
    'https://elmach.com/jobs',
    'https://elmach.com/jobs/',
    'https://elmach.com/careers.php',
    'https://elmach.com/career.php',
    'https://elmach.com/jobs.php',
  ])
  assert.deepEqual(elmach.VERIFIED_MISSING_ROUTE_URLS, [
    elmach.ROBOTS_URL,
    elmach.SITEMAP_URL,
    ...elmach.NO_PUBLIC_CAREERS_ROUTE_URLS,
  ])
  assert.equal(elmach.hasOfficialHomepageSignal(officialHomepageHtml), true)
  assert.equal(elmach.hasFirstPartyCareerLikeLink(officialHomepageHtml), false)
  assert.equal(elmach.hasPublicJobsSignal(officialHomepageHtml), false)
  assert.equal(elmach.hasPublicJobsSignal(publicJobsHtml), true)
  assert.equal(
    elmach.isVerifiedMissingRoute({
      status: 404,
      url: elmach.NO_PUBLIC_CAREERS_ROUTE_URLS[0],
      html: missingRouteHtml,
    }),
    true,
  )
  assert.equal(
    elmach.isVerifiedMissingRoute({
      status: 404,
      url: elmach.NO_PUBLIC_CAREERS_ROUTE_URLS.at(-1),
      html: missingPhpRouteText,
    }),
    true,
  )
})

test('Elmach sentinel returns no jobs only while the verified first-party surface stays empty', async () => {
  const elmach = await loadElmachModule()
  const requestedUrls = []

  const jobs = await elmach.createElmachScraper().run({
    fetchPage: async (url) => {
      requestedUrls.push(url)

      if (url === elmach.HOMEPAGE_URL) {
        return { status: 200, url, html: officialHomepageHtml }
      }

      if (url.endsWith('.php')) {
        return { status: 404, url, html: missingPhpRouteText }
      }

      if (elmach.VERIFIED_MISSING_ROUTE_URLS.includes(url)) {
        return { status: 404, url, html: missingRouteHtml }
      }

      throw new Error(`Unexpected URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [
    elmach.HOMEPAGE_URL,
    ...elmach.VERIFIED_MISSING_ROUTE_URLS,
  ])
  assert.deepEqual(jobs, [])
})

test('Elmach sentinel fails closed when the homepage or any checked route changes materially', async () => {
  const elmach = await loadElmachModule()

  await assert.rejects(
    elmach.createElmachScraper().run({
      fetchPage: async (url) => {
        if (url === elmach.HOMEPAGE_URL) {
          return { status: 200, url, html: '<html><body><h1>Unexpected</h1></body></html>' }
        }

        return { status: 404, url, html: missingRouteHtml }
      },
    }),
    /verified official homepage/i,
  )

  await assert.rejects(
    elmach.createElmachScraper().run({
      fetchPage: async (url) => {
        if (url === elmach.HOMEPAGE_URL) {
          return {
            status: 200,
            url,
            html: `${officialHomepageHtml}<a href="/careers">Careers</a>${publicJobsHtml}`,
          }
        }

        return { status: 404, url, html: missingRouteHtml }
      },
    }),
    /homepage now appears to expose a public jobs surface|homepage now exposes a first-party careers path/i,
  )

  await assert.rejects(
    elmach.createElmachScraper().run({
      fetchPage: async (url) => {
        if (url === elmach.HOMEPAGE_URL) {
          return { status: 200, url, html: officialHomepageHtml }
        }

        if (url === elmach.ROBOTS_URL) {
          return { status: 200, url, html: 'User-agent: *\nAllow: /' }
        }

        return { status: 404, url, html: missingRouteHtml }
      },
    }),
    /missing robots\.txt or sitemap surface changed/i,
  )

  await assert.rejects(
    elmach.createElmachScraper().run({
      fetchPage: async (url) => {
        if (url === elmach.HOMEPAGE_URL) {
          return { status: 200, url, html: officialHomepageHtml }
        }

        if (url === elmach.NO_PUBLIC_CAREERS_ROUTE_URLS[0]) {
          return { status: 200, url, html: publicJobsHtml }
        }

        if (url.endsWith('.php')) {
          return { status: 404, url, html: missingPhpRouteText }
        }

        return { status: 404, url, html: missingRouteHtml }
      },
    }),
    /verified no-public-careers route changed/i,
  )
})
