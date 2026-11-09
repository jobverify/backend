import assert from 'node:assert/strict'
import test from 'node:test'

const loadAparTechnologiesModule = async () => {
  try {
    return await import('../../scraper/apartechnologies/script.js')
  } catch {
    assert.fail('Expected Apar Technologies scraper module at ../../scraper/apartechnologies/script.js')
  }
}

const homepageHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Apar Technologies &#8211; Accelerate Agility</title>
  </head>
  <body>
    <header>
      <nav>
        <a href="/">Home</a>
        <a href="/services/">Services</a>
        <a href="/careers/">Careers</a>
      </nav>
    </header>
    <main>
      <h1>Accelerate Agility</h1>
      <a class="btn" href="/careers/">Join Us</a>
    </main>
  </body>
</html>
`

const careersHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Careers &#8211; Apar Technologies</title>
  </head>
  <body>
    <main>
      <h1>Careers with Apar</h1>
      <p>Come, Innovate With Us!</p>
      <p>Join Our Community</p>
      <p>Join Our Team</p>
      <a href="https://www.apartechnologies.com/job-posting/">US Openings</a>
      <a href="https://www.apartechnologies.com/apac-2/">APAC Openings</a>
      <label>Upload your resume*</label>
      <p>Email us <a href="mailto:sales.apartech@apar.com">sales.apartech@apar.com</a></p>
    </main>
  </body>
</html>
`

const usOpeningsHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Job Posting &#8211; Apar Technologies</title>
  </head>
  <body>
    <main>
      <h1>Job Posting</h1>
      <h2>Job Listing</h2>
      <p>Email us <a href="mailto:sales.apartech@apar.com">sales.apartech@apar.com</a></p>
    </main>
  </body>
</html>
`

const apacOpeningsHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>APAC &#8211; Apar Technologies</title>
  </head>
  <body>
    <main>
      <h1>APAC</h1>
      <h2>APAC Job Listing</h2>
      <p>Email us <a href="mailto:sales.apartech@apar.com">sales.apartech@apar.com</a></p>
    </main>
  </body>
</html>
`

const robotsTxt = `
User-agent: *
Disallow: /wp-admin/
Disallow: /wp-includes/
Disallow: /wp-content/plugins/
Disallow: /wp-content/themes/
Disallow: /wp-login.php
Disallow: /wp-register.php
Disallow: /wp-signup.php

User-agent: Googlebot
Crawl-delay: 60
Allow: /

User-agent: *
Disallow: /
`

const sitemapIndexXml = `
<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <sitemap>
    <loc>https://www.apartechnologies.com/wp-sitemap-posts-post-1.xml</loc>
  </sitemap>
  <sitemap>
    <loc>https://www.apartechnologies.com/wp-sitemap-posts-page-1.xml</loc>
  </sitemap>
  <sitemap>
    <loc>https://www.apartechnologies.com/wp-sitemap-taxonomies-category-1.xml</loc>
  </sitemap>
</sitemapindex>
`

const pageSitemapXml = `
<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>https://www.apartechnologies.com/careers/</loc>
  </url>
  <url>
    <loc>https://www.apartechnologies.com/job-posting/</loc>
  </url>
  <url>
    <loc>https://www.apartechnologies.com/apac-2/</loc>
  </url>
</urlset>
`

const missingRouteHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Page not found &#8211; Apar Technologies</title>
  </head>
  <body>
    <main>
      <h1>Page not found</h1>
    </main>
  </body>
</html>
`

test('Apar Technologies sentinel helpers stay pinned to the verified first-party careers shell and placeholder subpages', async () => {
  const aparTechnologies = await loadAparTechnologiesModule()

  assert.equal(aparTechnologies.SOURCE, 'apartechnologies')
  assert.equal(aparTechnologies.COMPANY, 'Apar Technologies')
  assert.equal(aparTechnologies.VERIFIED_AT, null)
  assert.equal(aparTechnologies.HOMEPAGE_URL, 'https://www.apartechnologies.com/')
  assert.equal(aparTechnologies.CAREERS_URL, 'https://www.apartechnologies.com/careers/')
  assert.equal(
    aparTechnologies.US_OPENINGS_URL,
    'https://www.apartechnologies.com/job-posting/',
  )
  assert.equal(
    aparTechnologies.APAC_OPENINGS_URL,
    'https://www.apartechnologies.com/apac-2/',
  )
  assert.equal(
    aparTechnologies.PAGE_SITEMAP_URL,
    'https://www.apartechnologies.com/wp-sitemap-posts-page-1.xml',
  )
  assert.deepEqual(aparTechnologies.EXPECTED_CAREER_URLS_FROM_PAGE_SITEMAP, [
    'https://www.apartechnologies.com/careers/',
    'https://www.apartechnologies.com/job-posting/',
    'https://www.apartechnologies.com/apac-2/',
  ])
  assert.equal(aparTechnologies.hasOfficialHomepageSignal(homepageHtml), true)
  assert.equal(
    aparTechnologies.extractHomepageCareerUrl(homepageHtml),
    'https://www.apartechnologies.com/careers/',
  )
  assert.equal(aparTechnologies.hasOfficialCareersSignal(careersHtml), true)
  assert.deepEqual(aparTechnologies.extractRegionalOpeningsUrls(careersHtml), {
    usOpeningsUrl: 'https://www.apartechnologies.com/job-posting/',
    apacOpeningsUrl: 'https://www.apartechnologies.com/apac-2/',
  })
  assert.equal(
    aparTechnologies.hasUsOpeningsPlaceholderSignal({
      status: 200,
      url: aparTechnologies.US_OPENINGS_URL,
      html: usOpeningsHtml,
    }),
    true,
  )
  assert.equal(
    aparTechnologies.hasApacOpeningsPlaceholderSignal({
      status: 200,
      url: aparTechnologies.APAC_OPENINGS_URL,
      html: apacOpeningsHtml,
    }),
    true,
  )
  assert.equal(aparTechnologies.hasPublicJobListingSignal(usOpeningsHtml), false)
  assert.equal(aparTechnologies.hasExpectedRobotsSignal(robotsTxt), true)
  assert.equal(aparTechnologies.hasExpectedSitemapIndexSignal(sitemapIndexXml), true)
  assert.deepEqual(
    aparTechnologies.extractExpectedCareerUrlsFromPageSitemap(pageSitemapXml),
    aparTechnologies.EXPECTED_CAREER_URLS_FROM_PAGE_SITEMAP,
  )
  assert.equal(
    aparTechnologies.isKnownMissingJobRoute(
      {
        status: 404,
        url: 'https://www.apartechnologies.com/jobs',
        html: missingRouteHtml,
      },
      'https://www.apartechnologies.com/jobs',
    ),
    true,
  )
})

test('Apar Technologies accepts its current branded generic careers form only without job listings', async () => {
  const apar = await loadAparTechnologiesModule()
  const homepage = '<html><head><title>Enterprise Technology Services Partner | Apar Technologies</title></head><body><a href="https://www.apartechnologies.com/careers/">Careers</a></body></html>'
  const careers = '<html><head><title>Careers at Apar Technologies | IT &amp; Tech Jobs</title></head><body><h2>Join our team</h2><form><input type="file" name="resume"><button>Submit</button></form></body></html>'
  const fetchPage = async (url) => ({ status: 200, url, html: url === apar.HOMEPAGE_URL ? homepage : careers })

  assert.equal(apar.hasCurrentHomepageSignal(homepage), true)
  assert.equal(apar.hasCurrentCareersSignal(careers), true)
  assert.deepEqual(await apar.createAparTechnologiesScraper().run({ fetchPage }), [])

  await assert.rejects(apar.createAparTechnologiesScraper().run({
    fetchPage: async (url) => ({
      status: 200,
      url,
      html: url === apar.HOMEPAGE_URL ? homepage : careers.replace('Join our team', 'Current Openings'),
    }),
  }), /current careers form/i)
})

test('Apar Technologies returns no jobs only while the verified first-party careers shell remains placeholder-only', async () => {
  const aparTechnologies = await loadAparTechnologiesModule()
  const requestedUrls = []

  const jobs = await aparTechnologies.createAparTechnologiesScraper().run({
    fetchPage: async (url) => {
      requestedUrls.push(url)

      if (url === aparTechnologies.HOMEPAGE_URL) {
        return { status: 200, url, html: homepageHtml }
      }

      if (url === aparTechnologies.CAREERS_URL) {
        return { status: 200, url, html: careersHtml }
      }

      if (url === aparTechnologies.US_OPENINGS_URL) {
        return { status: 200, url, html: usOpeningsHtml }
      }

      if (url === aparTechnologies.APAC_OPENINGS_URL) {
        return { status: 200, url, html: apacOpeningsHtml }
      }

      if (url === aparTechnologies.ROBOTS_TXT_URL) {
        return { status: 200, url, html: robotsTxt }
      }

      if (url === aparTechnologies.SITEMAP_INDEX_URL) {
        return { status: 200, url, html: sitemapIndexXml }
      }

      if (url === aparTechnologies.PAGE_SITEMAP_URL) {
        return { status: 200, url, html: pageSitemapXml }
      }

      if (aparTechnologies.MISSING_JOB_ROUTE_URLS.includes(url)) {
        return { status: 404, url, html: missingRouteHtml }
      }

      throw new Error(`Unexpected URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [
    aparTechnologies.HOMEPAGE_URL,
    aparTechnologies.CAREERS_URL,
    aparTechnologies.US_OPENINGS_URL,
    aparTechnologies.APAC_OPENINGS_URL,
    aparTechnologies.ROBOTS_TXT_URL,
    aparTechnologies.SITEMAP_INDEX_URL,
    aparTechnologies.PAGE_SITEMAP_URL,
    ...aparTechnologies.MISSING_JOB_ROUTE_URLS,
  ])
  assert.deepEqual(jobs, [])
})

test('Apar Technologies fails closed when the verified careers navigation, placeholder pages, or sitemap drift', async () => {
  const aparTechnologies = await loadAparTechnologiesModule()

  await assert.rejects(
    aparTechnologies.createAparTechnologiesScraper().run({
      fetchPage: async (url) => {
        if (url === aparTechnologies.HOMEPAGE_URL) {
          return {
            status: 200,
            url,
            html: homepageHtml.replace('/careers/', 'https://jobs.lever.co/apartechnologies'),
          }
        }

        throw new Error(`Unexpected URL: ${url}`)
      },
    }),
    /verified homepage careers handoff/i,
  )

  await assert.rejects(
    aparTechnologies.createAparTechnologiesScraper().run({
      fetchPage: async (url) => {
        if (url === aparTechnologies.HOMEPAGE_URL) {
          return { status: 200, url, html: homepageHtml }
        }

        if (url === aparTechnologies.CAREERS_URL) {
          return { status: 200, url, html: careersHtml }
        }

        if (url === aparTechnologies.US_OPENINGS_URL) {
          return {
            status: 200,
            url,
            html: usOpeningsHtml.replace(
              '<h2>Job Listing</h2>',
              '<h2>Job Listing</h2><article><h3>Senior Engineer</h3><a href="/apply">Apply now</a><script type="application/ld+json">{ "@type": "JobPosting" }</script></article>',
            ),
          }
        }

        throw new Error(`Unexpected URL: ${url}`)
      },
    }),
    /public jobs board|placeholder surface/i,
  )

  await assert.rejects(
    aparTechnologies.createAparTechnologiesScraper().run({
      fetchPage: async (url) => {
        if (url === aparTechnologies.HOMEPAGE_URL) {
          return { status: 200, url, html: homepageHtml }
        }

        if (url === aparTechnologies.CAREERS_URL) {
          return { status: 200, url, html: careersHtml }
        }

        if (url === aparTechnologies.US_OPENINGS_URL) {
          return { status: 200, url, html: usOpeningsHtml }
        }

        if (url === aparTechnologies.APAC_OPENINGS_URL) {
          return { status: 200, url, html: apacOpeningsHtml }
        }

        if (url === aparTechnologies.ROBOTS_TXT_URL) {
          return { status: 200, url, html: robotsTxt }
        }

        if (url === aparTechnologies.SITEMAP_INDEX_URL) {
          return { status: 200, url, html: sitemapIndexXml }
        }

        if (url === aparTechnologies.PAGE_SITEMAP_URL) {
          return {
            status: 200,
            url,
            html: pageSitemapXml.replace(
              '<loc>https://www.apartechnologies.com/apac-2/</loc>',
              '<loc>https://www.apartechnologies.com/contact/</loc>',
            ),
          }
        }

        throw new Error(`Unexpected URL: ${url}`)
      },
    }),
    /page sitemap careers urls changed materially/i,
  )
})
