import assert from 'node:assert/strict'
import test from 'node:test'

const loadModule = async () => {
  try {
    return await import('./script.js')
  } catch {
    assert.fail('Expected Universal Automation Systems scraper module at ./script.js')
  }
}

const officialHomepageHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Universal Automation Systems Pvt. Ltd. - Industrial Automation &amp; Machinery Solutions</title>
  </head>
  <body>
    <header>
      <a href="index.html">Home</a>
      <a href="about_us_howweevolved.html">About</a>
      <a href="products.html">Products</a>
      <a href="services.html">Services</a>
      <a href="projects.html">Projects</a>
      <a href="#">Get A Quote</a>
      <a href="contact.html">Contact</a>
      <a href="sitemap.html">Sitemap</a>
    </header>
    <main>
      <h1>Universal Automation Systems Pvt. Ltd.</h1>
      <h2>Custom Machinery &amp; Assembly Solutions</h2>
      <p>Special-purpose machines, assembly lines, jigs &amp; fixtures, and refurbishment - concept to commissioning for automotive and industrial applications.</p>
      <a href="services.html">Our Services</a>
      <a href="#">Request a Quote</a>
      <h3>Machinery Solutions</h3>
      <h3>Assembly Lines &amp; Stand-Alone Machines</h3>
      <a href="mailto:info@universalautomation.co.in">info@universalautomation.co.in</a>
      <a href="tel:+919448350487">+91 94483 50487</a>
    </main>
  </body>
</html>
`

const officialContactHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Contact Us | Universal Automation Systems Pvt. Ltd.</title>
  </head>
  <body>
    <main>
      <h1>Contact Us</h1>
      <p>Universal Automation Systems Pvt. Ltd.</p>
      <p>Let us build your next automation success</p>
      <p>Visit our facilities, share your requirement, and our team will connect with you quickly with the right solution approach.</p>
      <a href="mailto:info@universalautomation.co.in">info@universalautomation.co.in</a>
      <form></form>
    </main>
  </body>
</html>
`

const officialSitemapHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Sitemap - Universal Automation</title>
  </head>
  <body>
    <main>
      <h1>Sitemap</h1>
      <a href="index.html">Home</a>
      <a href="about_us_howweevolved.html">How we evolved</a>
      <a href="about_mission_vision.html">Mission/Vision</a>
      <a href="vendors.html">Vendors</a>
      <a href="products.html">Products</a>
      <a href="services.html">Services</a>
      <a href="services.html">Turnkey solutions</a>
      <a href="products.html">Machinery Solutions</a>
      <a href="contact.html">Contact Us</a>
    </main>
  </body>
</html>
`

const missingRouteHtml = `
<!DOCTYPE HTML PUBLIC "-//IETF//DTD HTML 2.0//EN">
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

const publicJobsHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Careers | Universal Automation Systems Pvt. Ltd.</title>
  </head>
  <body>
    <main>
      <h1>Current Openings</h1>
      <a href="/careers/control-panel-engineer">Apply now</a>
    </main>
  </body>
</html>
`

test('Universal Automation Systems sentinel pins the verified first-party no-public-careers surface', async () => {
  const scraper = await loadModule()

  assert.equal(scraper.SOURCE, 'universalautomationsystems')
  assert.equal(scraper.COMPANY, 'Universal Automation Systems Pvt. Ltd.')
  assert.equal(scraper.HOMEPAGE_URL, 'https://www.universalautomation.co.in/')
  assert.equal(scraper.CONTACT_URL, 'https://www.universalautomation.co.in/contact.html')
  assert.equal(scraper.SITEMAP_PAGE_URL, 'https://www.universalautomation.co.in/sitemap.html')
  assert.deepEqual(scraper.NO_PUBLIC_CAREERS_ROUTE_URLS, [
    'https://www.universalautomation.co.in/careers',
    'https://www.universalautomation.co.in/careers/',
    'https://www.universalautomation.co.in/careers.html',
    'https://www.universalautomation.co.in/career',
    'https://www.universalautomation.co.in/career/',
    'https://www.universalautomation.co.in/career.html',
    'https://www.universalautomation.co.in/jobs',
    'https://www.universalautomation.co.in/jobs/',
    'https://www.universalautomation.co.in/jobs.html',
    'https://www.universalautomation.co.in/current-openings',
    'https://www.universalautomation.co.in/openings',
  ])
  assert.equal(scraper.hasOfficialHomepageSignal(officialHomepageHtml), true)
  assert.equal(scraper.hasOfficialContactSignal(officialContactHtml), true)
  assert.equal(scraper.hasOfficialSitemapSignal(officialSitemapHtml), true)
  assert.equal(scraper.hasFirstPartyCareerLikeLink(officialHomepageHtml), false)
  assert.equal(scraper.hasPublicJobsSignal(officialHomepageHtml), false)
  assert.equal(scraper.hasPublicJobsSignal(publicJobsHtml), true)
  assert.equal(
    scraper.isVerifiedMissingRoute({
      status: 404,
      url: scraper.NO_PUBLIC_CAREERS_ROUTE_URLS[0],
      html: missingRouteHtml,
    }),
    true,
  )
})

test('Universal Automation Systems sentinel returns no jobs only while the verified surface stays unchanged', async () => {
  const scraper = await loadModule()
  const requestedUrls = []

  const jobs = await scraper.createUniversalAutomationSystemsScraper().run({
    fetchPage: async (url) => {
      requestedUrls.push(url)

      if (url === scraper.HOMEPAGE_URL) {
        return { status: 200, url, html: officialHomepageHtml }
      }

      if (url === scraper.CONTACT_URL) {
        return { status: 200, url, html: officialContactHtml }
      }

      if (url === scraper.SITEMAP_PAGE_URL) {
        return { status: 200, url, html: officialSitemapHtml }
      }

      if (scraper.NO_PUBLIC_CAREERS_ROUTE_URLS.includes(url)) {
        return { status: 404, url, html: missingRouteHtml }
      }

      throw new Error(`Unexpected URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [
    scraper.HOMEPAGE_URL,
    scraper.CONTACT_URL,
    scraper.SITEMAP_PAGE_URL,
    ...scraper.NO_PUBLIC_CAREERS_ROUTE_URLS,
  ])
  assert.deepEqual(jobs, [])
})

test('Universal Automation Systems sentinel fails closed when the verified surface drifts', async () => {
  const scraper = await loadModule()

  await assert.rejects(
    scraper.createUniversalAutomationSystemsScraper().run({
      fetchPage: async (url) => {
        if (url === scraper.HOMEPAGE_URL) {
          return { status: 200, url, html: '<html><body>Unexpected homepage</body></html>' }
        }

        if (url === scraper.CONTACT_URL) {
          return { status: 200, url, html: officialContactHtml }
        }

        if (url === scraper.SITEMAP_PAGE_URL) {
          return { status: 200, url, html: officialSitemapHtml }
        }

        return { status: 404, url, html: missingRouteHtml }
      },
    }),
    /official homepage/i,
  )

  await assert.rejects(
    scraper.createUniversalAutomationSystemsScraper().run({
      fetchPage: async (url) => {
        if (url === scraper.HOMEPAGE_URL) {
          return {
            status: 200,
            url,
            html: `${officialHomepageHtml}<a href="/careers">Careers</a>${publicJobsHtml}`,
          }
        }

        if (url === scraper.CONTACT_URL) {
          return { status: 200, url, html: officialContactHtml }
        }

        if (url === scraper.SITEMAP_PAGE_URL) {
          return { status: 200, url, html: officialSitemapHtml }
        }

        return { status: 404, url, html: missingRouteHtml }
      },
    }),
    /public jobs surface|careers path/i,
  )

  await assert.rejects(
    scraper.createUniversalAutomationSystemsScraper().run({
      fetchPage: async (url) => {
        if (url === scraper.HOMEPAGE_URL) {
          return { status: 200, url, html: officialHomepageHtml }
        }

        if (url === scraper.CONTACT_URL) {
          return { status: 200, url, html: '<html><body>Generic form only</body></html>' }
        }

        if (url === scraper.SITEMAP_PAGE_URL) {
          return { status: 200, url, html: officialSitemapHtml }
        }

        return { status: 404, url, html: missingRouteHtml }
      },
    }),
    /contact page/i,
  )

  await assert.rejects(
    scraper.createUniversalAutomationSystemsScraper().run({
      fetchPage: async (url) => {
        if (url === scraper.HOMEPAGE_URL) {
          return { status: 200, url, html: officialHomepageHtml }
        }

        if (url === scraper.CONTACT_URL) {
          return { status: 200, url, html: officialContactHtml }
        }

        if (url === scraper.SITEMAP_PAGE_URL) {
          return { status: 200, url, html: `${officialSitemapHtml}<a href="/careers">Careers</a>` }
        }

        return { status: 404, url, html: missingRouteHtml }
      },
    }),
    /sitemap page/i,
  )

  await assert.rejects(
    scraper.createUniversalAutomationSystemsScraper().run({
      fetchPage: async (url) => {
        if (url === scraper.HOMEPAGE_URL) {
          return { status: 200, url, html: officialHomepageHtml }
        }

        if (url === scraper.CONTACT_URL) {
          return { status: 200, url, html: officialContactHtml }
        }

        if (url === scraper.SITEMAP_PAGE_URL) {
          return { status: 200, url, html: officialSitemapHtml }
        }

        if (url === scraper.NO_PUBLIC_CAREERS_ROUTE_URLS[0]) {
          return { status: 200, url, html: publicJobsHtml }
        }

        return { status: 404, url, html: missingRouteHtml }
      },
    }),
    /no-public-careers route changed/i,
  )
})
