import assert from 'node:assert/strict'
import test from 'node:test'

const homepageHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Eko Bharat Ventures Private Limited | The Leading Fintech Company in India</title>
  </head>
  <body>
    <nav>
      <a href="/about-us">About Us</a>
      <a href="/blog">Blogs</a>
      <a href="/faq">FAQs</a>
      <a href="javascript:showChat()">Contact Us</a>
    </nav>
    <h1>Best way to send money and do Aadhaar based withdrawal</h1>
    <p>Checkout our new websites</p>
    <a href="https://about.eko.in">Corporate</a>
    <a href="https://eps.eko.in">EPS</a>
    <a href="https://ekoglobal.tech">Global</a>
    <p>Eko gives you an opportunity to turn your own shop into a Banking &amp; Financial institution.</p>
  </body>
</html>
`

const corporateHomepageHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Eko | Financial Infrastructure for Micro-Entrepreneurs</title>
    <meta
      name="description"
      content="Eko builds fintech infrastructure enabling micro-entrepreneurs, enterprises, and financial institutions to deliver digital financial services at scale."
    >
  </head>
  <body>
    <h1>Financial infrastructure for micro-entrepreneurs across the developing world</h1>
    <p>Eko builds fintech infrastructure enabling micro-entrepreneurs, enterprises, and financial institutions to deliver digital financial services at scale.</p>
  </body>
</html>
`

const robotsTxt = `
# www.robotstxt.org

User-agent: *
Disallow: /admin/
Disallow: /build.txt
Disallow: /404.html
Disallow: /*.pdf
Disallow: /other-documents/

Sitemap: https://eko.in/sitemap.xml
`

const sitemapXml = `
<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url><loc>https://eko.in/about-us/</loc></url>
  <url><loc>https://eko.in/retailer/</loc></url>
  <url><loc>https://eko.in/business-loans-from-eko/</loc></url>
  <url><loc>https://eko.in/developers/eps/</loc></url>
  <url><loc>https://eko.in/</loc></url>
</urlset>
`

const corporateRobotsTxt = `
User-agent: *
Disallow: /
`

const main404Html = `
<!doctype html>
<html lang="en">
  <head>
    <title>Eko Bharat Ventures Private Limited | The Leading Fintech Company in India</title>
  </head>
  <body>
    <h1>404</h1>
    <p>Page not found</p>
  </body>
</html>
`

const corporate404Html = `
<!doctype html>
<html lang="en">
  <body>
    <h1>404</h1>
    <p>Page not found</p>
  </body>
</html>
`

const publicJobsHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Eko Careers</title>
  </head>
  <body>
    <h1>Current Openings</h1>
    <a href="https://jobs.lever.co/eko">Apply now</a>
  </body>
</html>
`

const loadEkoModule = async () => {
  try {
    return await import('../../scraper/eko/script.js')
  } catch {
    assert.fail('Expected Eko scraper module at ../../scraper/eko/script.js')
  }
}

test('Eko scraper helpers stay pinned to the verified first-party homepage, corporate site, crawl surfaces, and no-public-careers routes', async () => {
  const eko = await loadEkoModule()

  assert.equal(eko.SOURCE, 'eko')
  assert.equal(eko.COMPANY, 'Eko')
  assert.equal(eko.OFFICIAL_BRAND_NAME, 'Eko Bharat Ventures Private Limited')
  assert.equal(eko.VERIFIED_ON, '2026-10-09')
  assert.equal(eko.HOMEPAGE_URL, 'https://eko.in/')
  assert.equal(eko.CORPORATE_HOMEPAGE_URL, 'https://about.eko.in/')
  assert.equal(eko.ROBOTS_TXT_URL, 'https://eko.in/robots.txt')
  assert.equal(eko.SITEMAP_URL, 'https://eko.in/sitemap.xml')
  assert.equal(eko.CORPORATE_ROBOTS_TXT_URL, 'https://about.eko.in/robots.txt')
  assert.equal(eko.CORPORATE_SITEMAP_URL, 'https://about.eko.in/sitemap.xml')
  assert.deepEqual(eko.CAREERS_ROUTE_URLS, [
    'https://eko.in/careers',
    'https://eko.in/career',
    'https://eko.in/jobs',
    'https://eko.in/join-us',
    'https://eko.in/work-with-us',
    'https://eko.in/openings',
  ])
  assert.deepEqual(eko.CORPORATE_CAREERS_ROUTE_URLS, [
    'https://about.eko.in/careers',
    'https://about.eko.in/career',
    'https://about.eko.in/jobs',
    'https://about.eko.in/join-us',
    'https://about.eko.in/work-with-us',
    'https://about.eko.in/openings',
  ])
  assert.equal(eko.hasOfficialHomepageSignal(homepageHtml), true)
  assert.equal(eko.hasOfficialCorporateHomepageSignal(corporateHomepageHtml), true)
  assert.equal(eko.hasPublicJobsSignal(homepageHtml), false)
  assert.equal(eko.hasPublicJobsSignal(publicJobsHtml), true)
  assert.equal(eko.hasFirstPartyCareerLikeLink(homepageHtml), false)
  assert.equal(eko.hasOfficialRobotsTxtSignal(robotsTxt), true)
  assert.equal(eko.hasOfficialSitemapSignal(sitemapXml), true)
  assert.equal(eko.hasOfficialCorporateRobotsTxtSignal(corporateRobotsTxt), true)
  assert.equal(eko.hasCareerRouteInSitemap(sitemapXml), false)
  assert.equal(
    eko.isMissingCareerRoute({
      status: 404,
      url: eko.CAREERS_ROUTE_URLS[0],
      html: main404Html,
    }),
    true,
  )
  assert.equal(
    eko.isMissingCareerRoute({
      status: 404,
      url: eko.CORPORATE_CAREERS_ROUTE_URLS[0],
      html: corporate404Html,
    }),
    true,
  )
  assert.equal(
    eko.isMissingCorporateSitemap({
      status: 404,
      url: eko.CORPORATE_SITEMAP_URL,
      html: corporate404Html,
    }),
    true,
  )
})

test('Eko preserves all current first-party route checks before returning incomplete discovery', async () => {
  const eko = await loadEkoModule()
  const requestedUrls = []

  const jobs = await eko.createEkoScraper().run({
    fetchPage: async (url) => {
      requestedUrls.push(url)

      if (url === eko.HOMEPAGE_URL) {
        return { status: 200, url, html: homepageHtml }
      }

      if (url === eko.CORPORATE_HOMEPAGE_URL) {
        return { status: 200, url, html: corporateHomepageHtml }
      }

      if (url === eko.ROBOTS_TXT_URL) {
        return { status: 200, url, html: robotsTxt }
      }

      if (url === eko.SITEMAP_URL) {
        return { status: 200, url, html: sitemapXml }
      }

      if (url === eko.CORPORATE_ROBOTS_TXT_URL) {
        return { status: 200, url, html: corporateRobotsTxt }
      }

      if (url === eko.CORPORATE_SITEMAP_URL) {
        return { status: 404, url, html: corporate404Html }
      }

      if (eko.CAREERS_ROUTE_URLS.includes(url)) {
        return { status: 404, url, html: main404Html }
      }

      if (eko.CORPORATE_CAREERS_ROUTE_URLS.includes(url)) {
        return { status: 404, url, html: corporate404Html }
      }

      throw new Error(`Unexpected Eko URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [
    eko.HOMEPAGE_URL,
    eko.CORPORATE_HOMEPAGE_URL,
    eko.ROBOTS_TXT_URL,
    eko.SITEMAP_URL,
    eko.CORPORATE_ROBOTS_TXT_URL,
    eko.CORPORATE_SITEMAP_URL,
    ...eko.CAREERS_ROUTE_URLS,
    ...eko.CORPORATE_CAREERS_ROUTE_URLS,
  ])
  assert.deepEqual(jobs, [])
})

test('Eko fails closed when the verified homepage, corporate homepage, sitemap, or missing careers routes drift into a public jobs surface', async () => {
  const eko = await loadEkoModule()

  await assert.rejects(
    eko.createEkoScraper().run({
      fetchPage: async (url) => {
        if (url === eko.HOMEPAGE_URL) {
          return { status: 200, url, html: '<html><title>Unexpected</title></html>' }
        }

        throw new Error(`Unexpected Eko URL: ${url}`)
      },
    }),
    /verified official homepage/i,
  )

  await assert.rejects(
    eko.createEkoScraper().run({
      fetchPage: async (url) => {
        if (url === eko.HOMEPAGE_URL) {
          return { status: 200, url, html: homepageHtml }
        }

        if (url === eko.CORPORATE_HOMEPAGE_URL) {
          return { status: 200, url, html: `${corporateHomepageHtml}<a href="https://about.eko.in/careers">Careers</a>` }
        }

        throw new Error(`Unexpected Eko URL: ${url}`)
      },
    }),
    /corporate homepage now exposes a first-party careers or jobs link/i,
  )

  await assert.rejects(
    eko.createEkoScraper().run({
      fetchPage: async (url) => {
        if (url === eko.HOMEPAGE_URL) {
          return { status: 200, url, html: homepageHtml }
        }

        if (url === eko.CORPORATE_HOMEPAGE_URL) {
          return { status: 200, url, html: corporateHomepageHtml }
        }

        if (url === eko.ROBOTS_TXT_URL) {
          return { status: 200, url, html: robotsTxt }
        }

        if (url === eko.SITEMAP_URL) {
          return { status: 200, url, html: `${sitemapXml}<url><loc>https://eko.in/careers</loc></url>` }
        }

        throw new Error(`Unexpected Eko URL: ${url}`)
      },
    }),
    /sitemap now advertises a careers or jobs route/i,
  )

  await assert.rejects(
    eko.createEkoScraper().run({
      fetchPage: async (url) => {
        if (url === eko.HOMEPAGE_URL) {
          return { status: 200, url, html: homepageHtml }
        }

        if (url === eko.CORPORATE_HOMEPAGE_URL) {
          return { status: 200, url, html: corporateHomepageHtml }
        }

        if (url === eko.ROBOTS_TXT_URL) {
          return { status: 200, url, html: robotsTxt }
        }

        if (url === eko.SITEMAP_URL) {
          return { status: 200, url, html: sitemapXml }
        }

        if (url === eko.CORPORATE_ROBOTS_TXT_URL) {
          return { status: 200, url, html: corporateRobotsTxt }
        }

        if (url === eko.CORPORATE_SITEMAP_URL) {
          return { status: 404, url, html: corporate404Html }
        }

        if (url === eko.CAREERS_ROUTE_URLS[0]) {
          return { status: 200, url, html: publicJobsHtml }
        }

        if (eko.CAREERS_ROUTE_URLS.includes(url)) {
          return { status: 404, url, html: main404Html }
        }

        if (eko.CORPORATE_CAREERS_ROUTE_URLS.includes(url)) {
          return { status: 404, url, html: corporate404Html }
        }

        throw new Error(`Unexpected Eko URL: ${url}`)
      },
    }),
    /verified no-public-careers route changed/i,
  )
})
