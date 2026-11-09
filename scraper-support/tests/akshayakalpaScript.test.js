import assert from 'node:assert/strict'
import test from 'node:test'

const homepageHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Pure, untouched, organic milk from cows raised with care</title>
  </head>
  <body>
    <p>Trusted by 180,000 families for over 16 years, our promise of bringing you pure, organic and nutritious food is renewed every morning.</p>
    <p>At the heart of our organization is our community of rural farmers. Our farmer entrepreneurship initiatives ensure that every bit of harvest from our farms are true to the land and to you.</p>
    <a href="mailto:support@akshayakalpa.org">support@akshayakalpa.org</a>
    <p>bandarqq</p>
    <p>Powered by WordPress</p>
  </body>
</html>
`

const careers404Html = `
<!doctype html>
<html lang="en">
  <head>
    <title>Page not found - Akshayakalpa Organic Milk</title>
  </head>
  <body>
    <h1>Page not found</h1>
    <a href="mailto:support@akshayakalpa.org">support@akshayakalpa.org</a>
  </body>
</html>
`

const robotsTxt = `
User-agent: *
Crawl-Delay: 20
`

const sitemapXml = `
<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <sitemap>
    <loc>https://akshayakalpa.org/post-sitemap.xml</loc>
  </sitemap>
  <sitemap>
    <loc>https://akshayakalpa.org/page-sitemap.xml</loc>
  </sitemap>
  <sitemap>
    <loc>https://akshayakalpa.org/testimonials-sitemap.xml</loc>
  </sitemap>
</sitemapindex>
`

const pageSitemapXml = `
<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>https://akshayakalpa.org/</loc>
  </url>
  <url>
    <loc>https://akshayakalpa.org/products/</loc>
  </url>
  <url>
    <loc>https://akshayakalpa.org/resources/</loc>
  </url>
  <url>
    <loc>https://akshayakalpa.org/about-us/</loc>
  </url>
</urlset>
`

const publicJobsHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Akshayakalpa Careers</title>
  </head>
  <body>
    <h1>Current Openings</h1>
    <a href="https://akshayakalpa.org/apply">Apply now</a>
  </body>
</html>
`

const loadAkshayakalpaModule = async () => {
  try {
    return await import('../../scraper/akshayakalpa/script.js')
  } catch {
    assert.fail('Expected Akshayakalpa scraper module at ../../scraper/akshayakalpa/script.js')
  }
}

test('Akshayakalpa scraper constants stay pinned to the verified first-party no-public-careers surface from July 15, 2026', async () => {
  const akshayakalpa = await loadAkshayakalpaModule()

  assert.equal(akshayakalpa.SOURCE, 'akshayakalpa')
  assert.equal(akshayakalpa.COMPANY, 'Akshayakalpa')
  assert.equal(akshayakalpa.OFFICIAL_BRAND_NAME, 'Akshayakalpa Organic')
  assert.equal(akshayakalpa.VERIFIED_ON, '2026-07-15')
  assert.equal(akshayakalpa.HOMEPAGE_URL, 'https://akshayakalpa.org/')
  assert.deepEqual(akshayakalpa.CAREERS_ROUTE_URLS, [
    'https://akshayakalpa.org/careers',
    'https://akshayakalpa.org/careers/',
    'https://akshayakalpa.org/career',
    'https://akshayakalpa.org/jobs',
    'https://akshayakalpa.org/join-us',
    'https://akshayakalpa.org/work-with-us',
    'https://akshayakalpa.org/openings',
  ])
  assert.deepEqual(akshayakalpa.CRAWL_SURFACE_URLS, [
    'https://akshayakalpa.org/robots.txt',
    'https://akshayakalpa.org/sitemap.xml',
    'https://akshayakalpa.org/page-sitemap.xml',
  ])
  assert.match(akshayakalpa.VERIFIED_SURFACE_SUMMARY, /no trustworthy public jobs surface/i)
  assert.equal(akshayakalpa.hasOfficialHomepageSignal(homepageHtml), true)
  assert.equal(akshayakalpa.hasPublicJobsSignal(homepageHtml), false)
  assert.equal(akshayakalpa.hasFirstPartyCareerLikeLink(homepageHtml), false)
  assert.equal(akshayakalpa.hasOfficialRobotsTxtSignal(robotsTxt), true)
  assert.equal(akshayakalpa.hasOfficialSitemapSignal(sitemapXml), true)
  assert.equal(akshayakalpa.hasOfficialPageSitemapSignal(pageSitemapXml), true)
  assert.equal(akshayakalpa.hasCareerRouteInSitemap(sitemapXml), false)
  assert.equal(akshayakalpa.hasCareerRouteInSitemap(pageSitemapXml), false)
  assert.equal(akshayakalpa.hasPublicJobsSignal(publicJobsHtml), true)
  assert.equal(
    akshayakalpa.hasFirstPartyCareerLikeLink('<a href="https://akshayakalpa.org/careers">Careers</a>'),
    true,
  )
  assert.equal(
    akshayakalpa.isMissingCareerRoute({
      status: 404,
      url: akshayakalpa.CAREERS_ROUTE_URLS[0],
      html: careers404Html,
    }),
    true,
  )
})

test('Akshayakalpa returns [] only while the verified first-party surface exposes no public jobs board', async () => {
  const akshayakalpa = await loadAkshayakalpaModule()
  const requestedUrls = []

  const jobs = await akshayakalpa.createAkshayakalpaScraper().run({
    fetchPage: async (url) => {
      requestedUrls.push(url)

      if (url === akshayakalpa.HOMEPAGE_URL) {
        return { status: 200, url, html: homepageHtml }
      }

      if (url === 'https://akshayakalpa.org/robots.txt') {
        return { status: 200, url, html: robotsTxt }
      }

      if (url === 'https://akshayakalpa.org/sitemap.xml') {
        return { status: 200, url, html: sitemapXml }
      }

      if (url === 'https://akshayakalpa.org/page-sitemap.xml') {
        return { status: 200, url, html: pageSitemapXml }
      }

      if (akshayakalpa.CAREERS_ROUTE_URLS.includes(url)) {
        return { status: 404, url, html: careers404Html }
      }

      throw new Error(`Unexpected Akshayakalpa URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [
    akshayakalpa.HOMEPAGE_URL,
    ...akshayakalpa.CRAWL_SURFACE_URLS,
    ...akshayakalpa.CAREERS_ROUTE_URLS,
  ])
  assert.deepEqual(jobs, [])
})

test('Akshayakalpa fails closed when the verified homepage, crawl surfaces, or missing careers routes drift into a public jobs surface', async () => {
  const akshayakalpa = await loadAkshayakalpaModule()

  await assert.rejects(
    akshayakalpa.createAkshayakalpaScraper().run({
      fetchPage: async (url) => {
        if (url === akshayakalpa.HOMEPAGE_URL) {
          return { status: 200, url, html: '<html><title>Unexpected</title></html>' }
        }

        throw new Error(`Unexpected Akshayakalpa URL: ${url}`)
      },
    }),
    /verified official homepage/i,
  )

  await assert.rejects(
    akshayakalpa.createAkshayakalpaScraper().run({
      fetchPage: async (url) => {
        if (url === akshayakalpa.HOMEPAGE_URL) {
          return {
            status: 200,
            url,
            html: `${homepageHtml}<a href="https://akshayakalpa.org/careers">Careers</a>`,
          }
        }

        throw new Error(`Unexpected Akshayakalpa URL: ${url}`)
      },
    }),
    /homepage now exposes a first-party careers or jobs link/i,
  )

  await assert.rejects(
    akshayakalpa.createAkshayakalpaScraper().run({
      fetchPage: async (url) => {
        if (url === akshayakalpa.HOMEPAGE_URL) {
          return { status: 200, url, html: homepageHtml }
        }

        if (url === 'https://akshayakalpa.org/robots.txt') {
          return { status: 200, url, html: robotsTxt }
        }

        if (url === 'https://akshayakalpa.org/sitemap.xml') {
          return {
            status: 200,
            url,
            html: `${sitemapXml}<sitemap><loc>https://akshayakalpa.org/careers</loc></sitemap>`,
          }
        }

        throw new Error(`Unexpected Akshayakalpa URL: ${url}`)
      },
    }),
    /sitemap now advertises a careers or jobs route/i,
  )

  await assert.rejects(
    akshayakalpa.createAkshayakalpaScraper().run({
      fetchPage: async (url) => {
        if (url === akshayakalpa.HOMEPAGE_URL) {
          return { status: 200, url, html: homepageHtml }
        }

        if (url === 'https://akshayakalpa.org/robots.txt') {
          return { status: 200, url, html: robotsTxt }
        }

        if (url === 'https://akshayakalpa.org/sitemap.xml') {
          return { status: 200, url, html: sitemapXml }
        }

        if (url === 'https://akshayakalpa.org/page-sitemap.xml') {
          return { status: 200, url, html: pageSitemapXml }
        }

        if (url === akshayakalpa.CAREERS_ROUTE_URLS[0]) {
          return { status: 200, url, html: publicJobsHtml }
        }

        return { status: 404, url, html: careers404Html }
      },
    }),
    /verified no-public-careers route changed/i,
  )
})
