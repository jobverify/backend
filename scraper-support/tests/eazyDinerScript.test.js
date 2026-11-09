import assert from 'node:assert/strict'
import test from 'node:test'

const homepageHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Find the Best Restaurants with Great Deals | Eazydiner</title>
    <link rel="canonical" href="https://www.eazydiner.com/">
  </head>
  <body>
    <a href="https://www.eazydiner.com/contact-us">Contact Us</a>
    <a href="https://www.eazydiner.com/food-trends">Blogs</a>
    <a href="https://www.eazydiner.com/career">Career</a>
  </body>
</html>
`

const careerPageHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Explore Career Opportunities at EazyDiner | Apply Now</title>
    <link rel="canonical" href="https://www.eazydiner.com/career">
    <meta
      name="description"
      content="Looking for a job? Learn about career opportunities at EazyDiner in tech and engineering, product, design, sales, brand, and marketing. Apply for jobs."
    >
  </head>
  <body>
    <div>Career | EazyDiner</div>
    <div>Want to join the dining ride? write us at:</div>
    <a href="mailto:career@eazydiner.com">career@eazydiner.com</a>
  </body>
</html>
`

const homepageHtmlWithTitleAttributes = `
<!doctype html>
<html lang="en">
  <head>
    <title data-next-head="">Find the Best Restaurants with Great Deals | Eazydiner</title>
    <link rel="canonical" href="https://www.eazydiner.com/">
  </head>
  <body>
    <a href="https://www.eazydiner.com/contact-us">Contact Us</a>
    <a href="https://www.eazydiner.com/food-trends">Blogs</a>
    <a href="https://www.eazydiner.com/career">Career</a>
  </body>
</html>
`

const careerPageHtmlWithTitleAttributes = `
<!doctype html>
<html lang="en">
  <head>
    <title data-next-head="">Explore Career Opportunities at EazyDiner | Apply Now</title>
    <link rel="canonical" href="https://www.eazydiner.com/career">
  </head>
  <body>
    <div>Career | EazyDiner</div>
    <div>Want to join the dining ride? write us at:</div>
    <a href="mailto:career@eazydiner.com">career@eazydiner.com</a>
  </body>
</html>
`

const robotsTxt = `
User-agent: *
Allow: /
Disallow:/*checkout?
Sitemap: https://www.eazydiner.com/sitemap.xml
`

const sitemapXml = `
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <sitemap>
    <loc>https://www.eazydiner.com/sitemap/index-locations.xml</loc>
  </sitemap>
  <sitemap>
    <loc>https://www.eazydiner.com/sitemap/others.xml</loc>
  </sitemap>
  <sitemap>
    <loc>https://www.eazydiner.com/sitemap/city-delhi-ncr.xml</loc>
  </sitemap>
</sitemapindex>
`

const otherRoutesSitemapXml = `
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>https://www.eazydiner.com/career</loc>
  </url>
  <url>
    <loc>https://www.eazydiner.com/about-us</loc>
  </url>
  <url>
    <loc>https://www.eazydiner.com/contact-us</loc>
  </url>
</urlset>
`

const publicJobsHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>EazyDiner Jobs</title>
    <script type="application/ld+json">
      {"@context":"https://schema.org","@type":"JobPosting","title":"Backend Engineer"}
    </script>
  </head>
  <body>
    <h1>Current Openings</h1>
    <a href="https://jobs.lever.co/eazydiner/apply">Apply now</a>
  </body>
</html>
`

const loadModule = async () => {
  try {
    return await import('../../scraper/eazydiner/script.js')
  } catch {
    assert.fail('Expected EazyDiner scraper module at ../../scraper/eazydiner/script.js')
  }
}

test('EazyDiner pins the verified homepage, career page, robots contract, and sitemap surface', async () => {
  const eazyDiner = await loadModule()

  assert.equal(eazyDiner.SOURCE, 'eazydiner')
  assert.equal(eazyDiner.COMPANY, 'EazyDiner')
  assert.equal(eazyDiner.ROOT_URL, 'https://www.eazydiner.com/')
  assert.equal(eazyDiner.CAREERS_URL, 'https://www.eazydiner.com/career')
  assert.equal(eazyDiner.ROBOTS_URL, 'https://www.eazydiner.com/robots.txt')
  assert.equal(eazyDiner.SITEMAP_URL, 'https://www.eazydiner.com/sitemap.xml')
  assert.equal(eazyDiner.OTHER_ROUTES_SITEMAP_URL, 'https://www.eazydiner.com/sitemap/others.xml')
  assert.deepEqual(eazyDiner.MISSING_JOB_ROUTE_URLS, [
    'https://www.eazydiner.com/careers',
    'https://www.eazydiner.com/jobs',
    'https://www.eazydiner.com/join-us',
    'https://www.eazydiner.com/work-with-us',
  ])
  assert.equal(eazyDiner.hasOfficialHomepageSignal(homepageHtml), true)
  assert.equal(eazyDiner.hasResumeDropCareersSignal(careerPageHtml), true)
  assert.equal(eazyDiner.hasOfficialHomepageSignal(homepageHtmlWithTitleAttributes), true)
  assert.equal(eazyDiner.hasResumeDropCareersSignal(careerPageHtmlWithTitleAttributes), true)
  assert.equal(eazyDiner.hasPublicJobListingSignal(careerPageHtml), false)
  assert.equal(eazyDiner.hasPublicJobListingSignal(publicJobsHtml), true)
  assert.equal(
    eazyDiner.extractSitemapUrlFromRobots(robotsTxt),
    'https://www.eazydiner.com/sitemap.xml',
  )
  assert.equal(eazyDiner.hasVerifiedSitemapIndexSignal(sitemapXml), true)
  assert.deepEqual(eazyDiner.extractCareerLikeUrlsFromSitemap(otherRoutesSitemapXml), [
    'https://www.eazydiner.com/career',
  ])
  assert.equal(
    eazyDiner.isKnownMissingJobRoute(
      { status: 404, url: 'https://www.eazydiner.com/jobs', html: '<html><body>404</body></html>' },
      'https://www.eazydiner.com/jobs',
    ),
    true,
  )
})

test('EazyDiner returns no jobs only while the verified career page remains a resume-drop surface', async () => {
  const eazyDiner = await loadModule()
  const requestedUrls = []

  const jobs = await eazyDiner.createEazyDinerScraper().run({
    fetchPage: async (url) => {
      requestedUrls.push(url)

      if (url === eazyDiner.ROOT_URL) {
        return { status: 200, url, html: homepageHtml }
      }

      if (url === eazyDiner.CAREERS_URL) {
        return { status: 200, url, html: careerPageHtml }
      }

      if (url === eazyDiner.ROBOTS_URL) {
        return { status: 200, url, html: robotsTxt }
      }

      if (url === eazyDiner.SITEMAP_URL) {
        return { status: 200, url, html: sitemapXml }
      }

      if (url === eazyDiner.OTHER_ROUTES_SITEMAP_URL) {
        return { status: 200, url, html: otherRoutesSitemapXml }
      }

      if (eazyDiner.MISSING_JOB_ROUTE_URLS.includes(url)) {
        return { status: 404, url, html: '<html><body>404</body></html>' }
      }

      throw new Error(`Unexpected URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [
    eazyDiner.ROOT_URL,
    eazyDiner.CAREERS_URL,
    eazyDiner.ROBOTS_URL,
    eazyDiner.SITEMAP_URL,
    eazyDiner.OTHER_ROUTES_SITEMAP_URL,
    ...eazyDiner.MISSING_JOB_ROUTE_URLS,
  ])
  assert.deepEqual(jobs, [])
})

test('EazyDiner fails closed when the homepage, careers page, sitemap, or missing-route contract drifts', async () => {
  const eazyDiner = await loadModule()

  await assert.rejects(
    eazyDiner.createEazyDinerScraper().run({
      fetchPage: async (url) => {
        if (url === eazyDiner.ROOT_URL) {
          return { status: 200, url, html: '<html><body>No career link</body></html>' }
        }

        throw new Error(`Unexpected URL: ${url}`)
      },
    }),
    /verified homepage/i,
  )

  await assert.rejects(
    eazyDiner.createEazyDinerScraper().run({
      fetchPage: async (url) => {
        if (url === eazyDiner.ROOT_URL) {
          return { status: 200, url, html: homepageHtml }
        }

        if (url === eazyDiner.CAREERS_URL) {
          return { status: 200, url, html: publicJobsHtml }
        }

        throw new Error(`Unexpected URL: ${url}`)
      },
    }),
    /career page now appears to expose a public jobs board/i,
  )

  await assert.rejects(
    eazyDiner.createEazyDinerScraper().run({
      fetchPage: async (url) => {
        if (url === eazyDiner.ROOT_URL) {
          return { status: 200, url, html: homepageHtml }
        }

        if (url === eazyDiner.CAREERS_URL) {
          return { status: 200, url, html: careerPageHtml }
        }

        if (url === eazyDiner.ROBOTS_URL) {
          return { status: 200, url, html: 'User-agent: *\nAllow: /\n' }
        }

        throw new Error(`Unexpected URL: ${url}`)
      },
    }),
    /verified robots\.txt/i,
  )

  await assert.rejects(
    eazyDiner.createEazyDinerScraper().run({
      fetchPage: async (url) => {
        if (url === eazyDiner.ROOT_URL) {
          return { status: 200, url, html: homepageHtml }
        }

        if (url === eazyDiner.CAREERS_URL) {
          return { status: 200, url, html: careerPageHtml }
        }

        if (url === eazyDiner.ROBOTS_URL) {
          return { status: 200, url, html: robotsTxt }
        }

        if (url === eazyDiner.SITEMAP_URL) {
          return { status: 200, url, html: sitemapXml }
        }

        if (url === eazyDiner.OTHER_ROUTES_SITEMAP_URL) {
          return {
            status: 200,
            url,
            html: `
              <urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
                <url><loc>https://www.eazydiner.com/career</loc></url>
                <url><loc>https://www.eazydiner.com/jobs</loc></url>
              </urlset>
            `,
          }
        }

        throw new Error(`Unexpected URL: ${url}`)
      },
    }),
    /verified other-routes sitemap/i,
  )

  await assert.rejects(
    eazyDiner.createEazyDinerScraper().run({
      fetchPage: async (url) => {
        if (url === eazyDiner.ROOT_URL) {
          return { status: 200, url, html: homepageHtml }
        }

        if (url === eazyDiner.CAREERS_URL) {
          return { status: 200, url, html: careerPageHtml }
        }

        if (url === eazyDiner.ROBOTS_URL) {
          return { status: 200, url, html: robotsTxt }
        }

        if (url === eazyDiner.SITEMAP_URL) {
          return { status: 200, url, html: sitemapXml }
        }

        if (url === eazyDiner.OTHER_ROUTES_SITEMAP_URL) {
          return { status: 200, url, html: otherRoutesSitemapXml }
        }

        if (url === eazyDiner.MISSING_JOB_ROUTE_URLS[0]) {
          return { status: 200, url, html: '<html><body>Unexpected jobs page</body></html>' }
        }

        if (eazyDiner.MISSING_JOB_ROUTE_URLS.slice(1).includes(url)) {
          return { status: 404, url, html: '<html><body>404</body></html>' }
        }

        throw new Error(`Unexpected URL: ${url}`)
      },
    }),
    /verified no-public-job route changed/i,
  )
})
