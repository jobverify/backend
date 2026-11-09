import assert from 'node:assert/strict'
import test from 'node:test'

const loadModule = async () => {
  try {
    return await import('./script.js')
  } catch {
    assert.fail('Expected SmartHMS & Solutions Pvt Ltd scraper module at ./script.js')
  }
}

const homepageHtml = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <link rel="canonical" href="https://www.smarthms.in">
  <meta
    name="description"
    content="SmartHMS is a leading provider of Smart Hospital Management System (HMIS), Lab Information Management System (LIMS), Hospital Information System (HIS), and Laboratory Information System (LIS)."
  >
  <meta name="author" content="SmartHMS">
  <title>SmartHMS: Best Hospital Management System | HMIS | HIS | EMR | LIS | LIMS</title>
  <meta property="og:site_name" content="SmartHMS">
  <meta name="reply-to" content="info@smarthms.in">
</head>
<body>
  <nav>
    <a href="#about">About us</a>
    <a href="#contact">contact us</a>
  </nav>
  <main>
    <h1>Smart Hospital Management System</h1>
    <p>Lab Information Management System</p>
  </main>
</body>
</html>
`

const currentHomepageHtml = `
<!DOCTYPE html>
<html lang="en">
<head>
  <title>SmartHMS: Best Hospital Management System | HMIS | HIS | EMR | LIS | LIMS</title>
</head>
<body>
  <section>
    <h2>Get in touch</h2>
    <p>Office Address: Smart HMS # 29, Deck Office, Sushma Infinium, Chandigarh - Delhi NH - 22, Zirakpur, Punjab India - 140603</p>
    <p>Phone: +91 9988276278</p>
    <p>Email: info@smarthms.in</p>
  </section>
  <nav>
    <a href="/">Home</a>
    <a href="/services">Services</a>
    <a href="/features">Offer Features</a>
    <a href="/modules">Modules</a>
    <a href="/contact">Contact</a>
  </nav>
  <main>
    <h1>About us</h1>
    <p>Smart HMS is a fully-integrated, Hospital Information System Solution.</p>
    <p>Smart Hospital Management System (HMS) or Lab information system (LIS) or Hospital Information System (HIS).</p>
  </main>
</body>
</html>
`

const sitemapXml = `
<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>https://smarthms.in/</loc>
  </url>
  <url>
    <loc>https://smarthms.in/index.html</loc>
  </url>
</urlset>
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
  <hr>
  <address>Apache/2.4.63 (Ubuntu) Server at smarthms.in Port 443</address>
</body>
</html>
`

test('SmartHMS & Solutions Pvt Ltd sentinel recognizes the verified first-party homepage, sitemap, and missing careers routes', async () => {
  const smartHms = await loadModule()

  assert.equal(smartHms.SOURCE, 'smarthmssolutionspvtltd')
  assert.equal(smartHms.COMPANY, 'SmartHMS & Solutions Pvt Ltd')
  assert.equal(smartHms.HOMEPAGE_URL, 'https://smarthms.in/')
  assert.equal(smartHms.SITEMAP_URL, 'https://smarthms.in/sitemap.xml')
  assert.deepEqual(smartHms.CAREERS_ROUTE_URLS, [
    'https://smarthms.in/careers',
    'https://smarthms.in/career',
    'https://smarthms.in/jobs',
    'https://smarthms.in/job-openings',
    'https://smarthms.in/work-with-us',
    'https://smarthms.in/join-us',
  ])
  assert.equal(smartHms.hasOfficialHomepageSignal(homepageHtml), true)
  assert.equal(smartHms.hasFirstPartyCareerLikeLink(homepageHtml), false)
  assert.equal(smartHms.hasPublicJobsSignal(homepageHtml), false)
  assert.deepEqual(smartHms.extractCareerLikeUrlsFromSitemap(sitemapXml), [])
  assert.equal(
    smartHms.isVerifiedMissingCareersRoute({
      status: 404,
      url: 'https://smarthms.in/careers',
      html: missingRouteHtml,
    }),
    true,
  )
})

test('SmartHMS & Solutions Pvt Ltd accepts the current informational homepage shell', async () => {
  const smartHms = await loadModule()

  assert.equal(smartHms.hasOfficialHomepageSignal(currentHomepageHtml), true)
})

test('SmartHMS & Solutions Pvt Ltd sentinel returns no jobs only while the verified first-party no-careers surface remains unchanged', async () => {
  const smartHms = await loadModule()
  const requestedUrls = []

  const jobs = await smartHms.createSmartHmsSolutionsScraper().run({
    fetchPage: async (url) => {
      requestedUrls.push(url)

      if (url === smartHms.HOMEPAGE_URL) {
        return { status: 200, url, html: homepageHtml }
      }

      if (url === smartHms.SITEMAP_URL) {
        return { status: 200, url, html: sitemapXml }
      }

      if (smartHms.CAREERS_ROUTE_URLS.includes(url)) {
        return { status: 404, url, html: missingRouteHtml }
      }

      throw new Error(`Unexpected URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [
    smartHms.HOMEPAGE_URL,
    smartHms.SITEMAP_URL,
    ...smartHms.CAREERS_ROUTE_URLS,
  ])
  assert.deepEqual(jobs, [])
})

test('SmartHMS & Solutions Pvt Ltd sentinel fails closed when the verified public surface drifts toward careers content', async () => {
  const smartHms = await loadModule()

  await assert.rejects(
    smartHms.createSmartHmsSolutionsScraper().run({
      fetchPage: async (url) => {
        if (url === smartHms.HOMEPAGE_URL) {
          return { status: 200, url, html: '<html><body><h1>Placeholder</h1></body></html>' }
        }

        throw new Error(`Unexpected URL: ${url}`)
      },
    }),
    /official homepage/i,
  )

  await assert.rejects(
    smartHms.createSmartHmsSolutionsScraper().run({
      fetchPage: async (url) => {
        if (url === smartHms.HOMEPAGE_URL) {
          return {
            status: 200,
            url,
            html: `${homepageHtml}<a href="/careers">Careers</a>`,
          }
        }

        if (url === smartHms.SITEMAP_URL) {
          return { status: 200, url, html: sitemapXml }
        }

        if (smartHms.CAREERS_ROUTE_URLS.includes(url)) {
          return { status: 404, url, html: missingRouteHtml }
        }

        throw new Error(`Unexpected URL: ${url}`)
      },
    }),
    /careers or jobs link/i,
  )

  await assert.rejects(
    smartHms.createSmartHmsSolutionsScraper().run({
      fetchPage: async (url) => {
        if (url === smartHms.HOMEPAGE_URL) {
          return { status: 200, url, html: homepageHtml }
        }

        if (url === smartHms.SITEMAP_URL) {
          return {
            status: 200,
            url,
            html: sitemapXml.replace(
              '</urlset>',
              '<url><loc>https://smarthms.in/careers</loc></url></urlset>',
            ),
          }
        }

        if (smartHms.CAREERS_ROUTE_URLS.includes(url)) {
          return { status: 404, url, html: missingRouteHtml }
        }

        throw new Error(`Unexpected URL: ${url}`)
      },
    }),
    /sitemap now advertises career-like urls/i,
  )

  await assert.rejects(
    smartHms.createSmartHmsSolutionsScraper().run({
      fetchPage: async (url) => {
        if (url === smartHms.HOMEPAGE_URL) {
          return { status: 200, url, html: homepageHtml }
        }

        if (url === smartHms.SITEMAP_URL) {
          return { status: 200, url, html: sitemapXml }
        }

        if (url === smartHms.CAREERS_ROUTE_URLS[0]) {
          return {
            status: 200,
            url,
            html: '<html><body><h1>Current Openings</h1><a href="/jobs/backend-engineer">Apply now</a></body></html>',
          }
        }

        if (smartHms.CAREERS_ROUTE_URLS.slice(1).includes(url)) {
          return { status: 404, url, html: missingRouteHtml }
        }

        throw new Error(`Unexpected URL: ${url}`)
      },
    }),
    /careers routes changed materially|public jobs/i,
  )
})
