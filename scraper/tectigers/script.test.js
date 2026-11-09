import assert from 'node:assert/strict'
import test from 'node:test'

const homepageHtml = `
<!DOCTYPE html>
<html lang="en-US">
  <head>
    <meta charset="UTF-8">
    <title>Managed IT Services Provider | Digital Transformation Solutions</title>
    <link rel="canonical" href="https://www.tectigers.com/">
  </head>
  <body>
    <nav>
      <a href="https://www.tectigers.com/">Home</a>
      <a href="https://www.tectigers.com/about/">About</a>
      <a href="https://www.tectigers.com/contact-us/">Contact Us</a>
    </nav>
    <main>
      <h1>Managed IT Services and Cybersecurity Solutions to Secure Your Business</h1>
      <h2>Proactive IT Support, Digital Transformation Experts</h2>
      <h2>Stay Secure and Operational 24/7 with Managed IT Services Provider</h2>
      <h2>Think IT, Think TecTigers</h2>
      <p>Building AI power Cybersecurity solutions today.</p>
      <p>Elevate your success with Gen AI and Managed IT services.</p>
    </main>
  </body>
</html>
`

const careersHtml = `
<!DOCTYPE html>
<html lang="en-US">
  <head>
    <meta charset="UTF-8">
    <title>Careers Archive - Tectigers | Managed IT Services Provider</title>
    <link rel="canonical" href="https://www.tectigers.com/careers/">
  </head>
  <body class="archive post-type-archive post-type-archive-neuros_vacancy elementor-default">
    <nav>
      <a href="https://www.tectigers.com/">Home</a>
      <a href="https://www.tectigers.com/careers/">Careers</a>
      <a href="https://www.tectigers.com/contact-us/">Contact Us</a>
    </nav>
    <main>
      <div class="archive-description">
        <p>Careers Archive</p>
      </div>
    </main>
  </body>
</html>
`

const contactHtml = `
<!DOCTYPE html>
<html lang="en-US">
  <head>
    <meta charset="UTF-8">
    <title>Contact TecTigers | Leading Managed IT Services Company</title>
    <link rel="canonical" href="https://www.tectigers.com/contact-us/">
  </head>
  <body>
    <main>
      <h1>Contact Us</h1>
      <h2>get in touch We are always ready to help you and answer your questions</h2>
      <p>Call Us 24/7</p>
      <p>Need a consultation?</p>
      <p>Drop us a line.</p>
    </main>
  </body>
</html>
`

const careersFeedXml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>Careers Archive - Tectigers | Managed IT Services Provider</title>
    <link>https://www.tectigers.com/careers/</link>
    <description></description>
    <lastBuildDate>Tue, 10 Feb 2026 08:26:18 +0000</lastBuildDate>
  </channel>
</rss>
`

const sitemapXml = `<?xml version="1.0" encoding="utf-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url><loc>https://www.tectigers.com/</loc></url>
  <url><loc>https://www.tectigers.com/about/</loc></url>
  <url><loc>https://www.tectigers.com/careers/</loc></url>
  <url><loc>https://www.tectigers.com/contact-us/</loc></url>
</urlset>
`

const missingRouteHtml = `
<!DOCTYPE html>
<html lang="en-US">
  <head>
    <meta charset="UTF-8">
    <title>Page not found - Tectigers | Managed IT Services Provider</title>
  </head>
  <body>
    <main>
      <h1>Navigate to a Smarter Experience</h1>
      <p>The page you requested could not be found.</p>
      <a href="https://www.tectigers.com/contact-us/">Contact Us</a>
    </main>
  </body>
</html>
`

const loadModule = async () => {
  try {
    return await import('./script.js')
  } catch {
    return null
  }
}

test('TecTigers sentinel recognizes the verified homepage, empty careers archive, contact page, feed, sitemap, and missing job routes', async () => {
  const scraper = await loadModule()
  assert.ok(scraper, 'Expected scraper module at ./script.js')

  assert.equal(scraper.SOURCE, 'tectigers')
  assert.equal(scraper.COMPANY, 'TecTigers')
  assert.equal(scraper.HOMEPAGE_URL, 'https://www.tectigers.com/')
  assert.equal(scraper.CAREERS_URL, 'https://www.tectigers.com/careers/')
  assert.equal(scraper.CONTACT_URL, 'https://www.tectigers.com/contact-us/')
  assert.equal(scraper.CAREERS_FEED_URL, 'https://www.tectigers.com/careers/feed/')
  assert.equal(scraper.SITEMAP_URL, 'https://www.tectigers.com/sitemap.xml')
  assert.deepEqual(scraper.NO_PUBLIC_JOB_ROUTE_URLS, [
    'https://www.tectigers.com/jobs',
    'https://www.tectigers.com/jobs/',
    'https://www.tectigers.com/join-us',
    'https://www.tectigers.com/join-us/',
  ])

  assert.equal(scraper.hasOfficialHomepageSignal(homepageHtml), true)
  assert.equal(scraper.hasOfficialCareersArchiveSignal(careersHtml), true)
  assert.equal(scraper.hasOfficialContactSignal(contactHtml), true)
  assert.equal(scraper.isEmptyCareersFeed(careersFeedXml), true)
  assert.equal(scraper.hasExpectedSitemapEntries(sitemapXml), true)
  assert.equal(scraper.hasPublicJobsSignal(homepageHtml), false)
  assert.equal(scraper.hasPublicJobsSignal(careersHtml), false)
  assert.equal(
    scraper.isVerifiedMissingJobRoute({
      status: 404,
      url: 'https://www.tectigers.com/jobs',
      html: missingRouteHtml,
    }),
    true,
  )
})

test('TecTigers sentinel returns [] only while the verified first-party empty careers surface remains unchanged', async () => {
  const scraper = await loadModule()
  assert.ok(scraper, 'Expected scraper module at ./script.js')

  const requestedUrls = []
  const jobs = await scraper.createTecTigersScraper().run({
    fetchPage: async (url) => {
      requestedUrls.push(url)

      if (url === scraper.HOMEPAGE_URL) {
        return { status: 200, url, html: homepageHtml }
      }

      if (url === scraper.CAREERS_URL) {
        return { status: 200, url, html: careersHtml }
      }

      if (url === scraper.CONTACT_URL) {
        return { status: 200, url, html: contactHtml }
      }

      if (url === scraper.CAREERS_FEED_URL) {
        return { status: 200, url, html: careersFeedXml }
      }

      if (url === scraper.SITEMAP_URL) {
        return { status: 200, url, html: sitemapXml }
      }

      if (scraper.NO_PUBLIC_JOB_ROUTE_URLS.includes(url)) {
        return { status: 404, url, html: missingRouteHtml }
      }

      throw new Error(`Unexpected URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [
    scraper.HOMEPAGE_URL,
    scraper.CAREERS_URL,
    scraper.CONTACT_URL,
    scraper.CAREERS_FEED_URL,
    scraper.SITEMAP_URL,
    ...scraper.NO_PUBLIC_JOB_ROUTE_URLS,
  ])
  assert.deepEqual(jobs, [])
})

test('TecTigers sentinel fails closed when the verified first-party careers surface drifts or starts exposing jobs', async () => {
  const scraper = await loadModule()
  assert.ok(scraper, 'Expected scraper module at ./script.js')

  await assert.rejects(
    scraper.createTecTigersScraper().run({
      fetchPage: async (url) => {
        if (url === scraper.HOMEPAGE_URL) {
          return { status: 200, url, html: '<html><body><h1>Unexpected</h1></body></html>' }
        }

        throw new Error(`Unexpected URL: ${url}`)
      },
    }),
    /official homepage/i,
  )

  await assert.rejects(
    scraper.createTecTigersScraper().run({
      fetchPage: async (url) => {
        if (url === scraper.HOMEPAGE_URL) {
          return { status: 200, url, html: homepageHtml }
        }

        if (url === scraper.CAREERS_URL) {
          return {
            status: 200,
            url,
            html: careersHtml.replace(
              '</main>',
              '<article><h2>Senior SOC Analyst</h2><a href="https://www.tectigers.com/careers/senior-soc-analyst/">Apply now</a></article></main>',
            ),
          }
        }

        if (url === scraper.CONTACT_URL) {
          return { status: 200, url, html: contactHtml }
        }

        if (url === scraper.CAREERS_FEED_URL) {
          return { status: 200, url, html: careersFeedXml }
        }

        if (url === scraper.SITEMAP_URL) {
          return { status: 200, url, html: sitemapXml }
        }

        if (scraper.NO_PUBLIC_JOB_ROUTE_URLS.includes(url)) {
          return { status: 404, url, html: missingRouteHtml }
        }

        throw new Error(`Unexpected URL: ${url}`)
      },
    }),
    /careers archive now appears to expose public jobs/i,
  )

  await assert.rejects(
    scraper.createTecTigersScraper().run({
      fetchPage: async (url) => {
        if (url === scraper.HOMEPAGE_URL) {
          return { status: 200, url, html: homepageHtml }
        }

        if (url === scraper.CAREERS_URL) {
          return { status: 200, url, html: careersHtml }
        }

        if (url === scraper.CONTACT_URL) {
          return { status: 200, url, html: contactHtml }
        }

        if (url === scraper.CAREERS_FEED_URL) {
          return {
            status: 200,
            url,
            html: careersFeedXml.replace(
              '</channel>',
              '<item><title>Senior SOC Analyst</title><link>https://www.tectigers.com/careers/senior-soc-analyst/</link></item></channel>',
            ),
          }
        }

        if (url === scraper.SITEMAP_URL) {
          return { status: 200, url, html: sitemapXml }
        }

        if (scraper.NO_PUBLIC_JOB_ROUTE_URLS.includes(url)) {
          return { status: 404, url, html: missingRouteHtml }
        }

        throw new Error(`Unexpected URL: ${url}`)
      },
    }),
    /careers feed/i,
  )

  await assert.rejects(
    scraper.createTecTigersScraper().run({
      fetchPage: async (url) => {
        if (url === scraper.HOMEPAGE_URL) {
          return { status: 200, url, html: homepageHtml }
        }

        if (url === scraper.CAREERS_URL) {
          return { status: 200, url, html: careersHtml }
        }

        if (url === scraper.CONTACT_URL) {
          return { status: 200, url, html: contactHtml }
        }

        if (url === scraper.CAREERS_FEED_URL) {
          return { status: 200, url, html: careersFeedXml }
        }

        if (url === scraper.SITEMAP_URL) {
          return {
            status: 200,
            url,
            html: `${sitemapXml}<url><loc>https://www.tectigers.com/careers/senior-soc-analyst/</loc></url>`,
          }
        }

        if (scraper.NO_PUBLIC_JOB_ROUTE_URLS.includes(url)) {
          return { status: 404, url, html: missingRouteHtml }
        }

        throw new Error(`Unexpected URL: ${url}`)
      },
    }),
    /sitemap/i,
  )

  await assert.rejects(
    scraper.createTecTigersScraper().run({
      fetchPage: async (url) => {
        if (url === scraper.HOMEPAGE_URL) {
          return { status: 200, url, html: homepageHtml }
        }

        if (url === scraper.CAREERS_URL) {
          return { status: 200, url, html: careersHtml }
        }

        if (url === scraper.CONTACT_URL) {
          return { status: 200, url, html: contactHtml }
        }

        if (url === scraper.CAREERS_FEED_URL) {
          return { status: 200, url, html: careersFeedXml }
        }

        if (url === scraper.SITEMAP_URL) {
          return { status: 200, url, html: sitemapXml }
        }

        if (url === scraper.NO_PUBLIC_JOB_ROUTE_URLS[0]) {
          return {
            status: 200,
            url,
            html: '<html><body><h1>Current Openings</h1><a href="/careers/soc-analyst/">Apply now</a></body></html>',
          }
        }

        if (scraper.NO_PUBLIC_JOB_ROUTE_URLS.slice(1).includes(url)) {
          return { status: 404, url, html: missingRouteHtml }
        }

        throw new Error(`Unexpected URL: ${url}`)
      },
    }),
    /missing job route changed or now exposes a public jobs surface/i,
  )
})
