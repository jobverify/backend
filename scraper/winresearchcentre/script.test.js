import assert from 'node:assert/strict'
import test from 'node:test'

const homepageHtml = `
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <title>High-Performance Mobile Applications | Win Research Centre | Win Research Centre, WRC</title>
    <meta name="generator" content="Hostinger Website Builder">
  </head>
  <body>
    <nav>
      <a href="/">Home</a>
      <a href="/projects">Projects</a>
      <a href="/careers">Careers</a>
      <a href="/contact-us">Contact us</a>
      <a href="/services">Services</a>
    </nav>
    <main>
      <h1>Powering Businesses with Automated APP's, Personalised Software and Data Bases for Companies.</h1>
      <p>You didn’t come this far to stop, start creating with us today..!</p>
      <p>WIN RESEARCH CENTRE -One stop solution for all your Business Needs</p>
      <p>Websites</p>
      <p>Mobile Apps</p>
      <p>Custom ERP for SME's</p>
      <p>Cloud Computing</p>
      <p>Big Data Analytics</p>
      <p>AI solutions</p>
      <p>Market Research Surveys &amp; Data Collection</p>
      <p>Services Offered:</p>
      <p>Phone: +91 8123784727</p>
      <p>ceo@winresearchcentre.in</p>
    </main>
  </body>
</html>
`

const careersHtml = `
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <title>Careers | Win Research Centre, WRC</title>
    <meta name="generator" content="Hostinger Website Builder">
    <link rel="canonical" href="https://www.winresearchcentre.in/careers">
  </head>
  <body>
    <nav>
      <a href="/">Home</a>
      <a href="/careers">Careers</a>
      <a href="/contact-us">Contact us</a>
    </nav>
    <main>
      <h1>Certificate courses offered</h1>
      <p>The Certificate Courses offered by WRC is your gateway to a world of knowledge and skill development.</p>
      <p>Earn a valuable certificate upon successful completion of each course, enhancing your resume and professional profile.</p>
      <h2>Data Science &amp; Prediction Modelling</h2>
      <p>Hands on experience, from Data Mining to Predictions using various tools and Strategies.</p>
      <h2>Machine Learning &amp; Artificial Intelligence</h2>
      <p>By the end of course each student will build an AI model from scratch.</p>
      <h2>Skill Development and Job Consultation</h2>
      <p>Discover Your Potential: Unleash Your Hidden Talents</p>
      <h2>Mobile App Development and Web Application Development</h2>
      <p>Unlock the World of Mobile App Development: Code Your Dreams into Reality</p>
      <h2>Bridge Course for students travelling abroad to pursue masters.</h2>
      <p>Bridging the Gap to Your Academic Success.</p>
      <p>ceo@winresearchcentre.in</p>
    </main>
  </body>
</html>
`

const contactHtml = `
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <title>Contact us | Win Research Centre, WRC</title>
  </head>
  <body>
    <main>
      <h1>Contact us</h1>
      <p>Feel free to contact us with any questions or concerns.</p>
      <p>You can use the form on our website or email us directly.</p>
      <p>Email ceo@winresearchcentre.in</p>
      <p>Phone +91 8123784727</p>
      <p>Address Mysore and Bangalore</p>
      <p>Get in touch</p>
    </main>
  </body>
</html>
`

const sitemapXml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url><loc>https://www.winresearchcentre.in</loc></url>
  <url><loc>https://www.winresearchcentre.in/projects</loc></url>
  <url><loc>https://www.winresearchcentre.in/careers</loc></url>
  <url><loc>https://www.winresearchcentre.in/contact-us</loc></url>
  <url><loc>https://www.winresearchcentre.in/services</loc></url>
</urlset>
`

const missingRouteHtml = `
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8">
    <title>Website Builder 404</title>
    <meta property="og:title" content="Website Builder 404" />
    <meta
      property="og:description"
      content="Oooops, looks like the page you requested could not be found. Please check the URL for proper spelling and capitalization."
    />
    <link rel="canonical" href="https://hostinger.com/">
  </head>
  <body>
    <main>
      <h1>Website Builder 404</h1>
      <p>Oooops, looks like the page you requested could not be found.</p>
      <p>Please check the URL for proper spelling and capitalization.</p>
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

test('Win Research Centre sentinel recognizes the verified homepage, careers, contact, sitemap, and missing-route surfaces', async () => {
  const scraper = await loadModule()
  assert.ok(scraper, 'Expected scraper module at ./script.js')

  assert.equal(scraper.SOURCE, 'winresearchcentre')
  assert.equal(scraper.COMPANY, 'Win Research Centre')
  assert.equal(scraper.HOMEPAGE_URL, 'https://www.winresearchcentre.in/')
  assert.equal(scraper.CAREERS_URL, 'https://www.winresearchcentre.in/careers')
  assert.equal(scraper.CONTACT_URL, 'https://www.winresearchcentre.in/contact-us')
  assert.equal(scraper.SITEMAP_URL, 'https://www.winresearchcentre.in/sitemap.xml')
  assert.deepEqual(scraper.NO_PUBLIC_JOB_ROUTE_URLS, [
    'https://www.winresearchcentre.in/career',
    'https://www.winresearchcentre.in/jobs',
    'https://www.winresearchcentre.in/join-us',
  ])

  assert.equal(scraper.hasOfficialHomepageSignal(homepageHtml), true)
  assert.equal(scraper.hasOfficialCareersSignal(careersHtml), true)
  assert.equal(scraper.hasOfficialContactSignal(contactHtml), true)
  assert.equal(scraper.hasPublicJobsSignal(homepageHtml), false)
  assert.equal(scraper.hasPublicJobsSignal(careersHtml), false)
  assert.equal(scraper.hasExpectedSitemapEntries(sitemapXml), true)
  assert.equal(
    scraper.isVerifiedMissingRoute({
      status: 404,
      url: 'https://www.winresearchcentre.in/jobs',
      html: missingRouteHtml,
    }),
    true,
  )
})

test('Win Research Centre sentinel returns [] only while the verified first-party non-listing surface remains unchanged', async () => {
  const scraper = await loadModule()
  assert.ok(scraper, 'Expected scraper module at ./script.js')

  const requestedUrls = []
  const jobs = await scraper.createWinResearchCentreScraper().run({
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
    scraper.SITEMAP_URL,
    ...scraper.NO_PUBLIC_JOB_ROUTE_URLS,
  ])
  assert.deepEqual(jobs, [])
})

test('Win Research Centre sentinel fails closed when the official careers-free surface drifts', async () => {
  const scraper = await loadModule()
  assert.ok(scraper, 'Expected scraper module at ./script.js')

  await assert.rejects(
    scraper.createWinResearchCentreScraper().run({
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
    scraper.createWinResearchCentreScraper().run({
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
              '<section><h2>Current Openings</h2><a href="https://jobs.lever.co/wrc">Apply now</a></section></main>',
            ),
          }
        }

        if (url === scraper.CONTACT_URL) {
          return { status: 200, url, html: contactHtml }
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
    /careers page now appears to expose a public jobs surface/i,
  )

  await assert.rejects(
    scraper.createWinResearchCentreScraper().run({
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

        if (url === scraper.SITEMAP_URL) {
          return {
            status: 200,
            url,
            html: `${sitemapXml}<url><loc>https://www.winresearchcentre.in/jobs/senior-engineer</loc></url>`,
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
    scraper.createWinResearchCentreScraper().run({
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

        if (url === scraper.SITEMAP_URL) {
          return { status: 200, url, html: sitemapXml }
        }

        if (url === scraper.NO_PUBLIC_JOB_ROUTE_URLS[0]) {
          return {
            status: 200,
            url,
            html: '<html><body><h1>Careers</h1><p>Current Openings</p><a href="/apply">Apply now</a></body></html>',
          }
        }

        if (scraper.NO_PUBLIC_JOB_ROUTE_URLS.slice(1).includes(url)) {
          return { status: 404, url, html: missingRouteHtml }
        }

        throw new Error(`Unexpected URL: ${url}`)
      },
    }),
    /missing first-party route changed or now exposes a public jobs surface/i,
  )
})
