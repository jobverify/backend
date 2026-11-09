import assert from 'node:assert/strict'
import { EventEmitter } from 'node:events'
import https from 'node:https'
import test from 'node:test'

const homepageHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>ARTHOS Financial Planning: Login Arthos for Best Financial Advisory, AY India | ArthaYantra</title>
    <meta name="description" content="ArthaYantra's proprietary model, ARTHOS provides customized financial planning to help you reach your financial goals. Currently we are serving 80,000+ customers across the world. SignUp on ARTHOS now!">
  </head>
  <body>
    <a href="https://www.arthayantra.com/" target="_blank"><img src="Images/arthayantra_logo.png"></a>
    <h5>Welcome Back To ARTHOS</h5>
    <a href="https://arthos.arthayantra.com/signup-now.html">SignUp</a>
    <a href="https://arthos.arthayantra.com/corporate-signup.html">Corporate SignUp</a>
    <a href="https://www.linkedin.com/company/artha-yantra">LinkedIn</a>
    <p>Arthayantra Corporation Pvt. Ltd is registered with AMFI as a mutual fund distributor having ARN54840.</p>
    <p>&copy; 2020 Arthayantra Corp. Pvt. Ltd.All rights reserved.Unauthorized access is prohibited. Usage will be monitored.</p>
  </body>
</html>
`

const sitemapXml = `
<?xml version="1.0" encoding="UTF-8"?>
<urlset
      xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
      xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
      xsi:schemaLocation="http://www.sitemaps.org/schemas/sitemap/0.9
            http://www.sitemaps.org/schemas/sitemap/0.9/sitemap.xsd">
<!-- created with Free Online Sitemap Generator www.xml-sitemaps.com -->
<url>
  <loc>https://www.arthayantra.com/</loc>
  <lastmod>2017-07-14T09:13:16+00:00</lastmod>
</url>
<url>
  <loc>https://www.arthayantra.com/about-financial-planning/</loc>
  <lastmod>2017-07-14T08:29:23+00:00</lastmod>
</url>
<url>
  <loc>https://www.arthayantra.com/financial-consultant-careers/</loc>
  <lastmod>2017-07-14T08:35:30+00:00</lastmod>
</url>
<url>
  <loc>https://www.arthayantra.com/contact-us-investment-planning/</loc>
  <lastmod>2017-07-14T09:43:57+00:00</lastmod>
</url>
<url>
  <loc>https://www.arthayantra.com/career-fa/</loc>
  <lastmod>2017-07-14T09:44:11+00:00</lastmod>
</url>
<url>
  <loc>https://www.arthayantra.com/career-fp/</loc>
  <lastmod>2017-07-14T09:44:11+00:00</lastmod>
</url>
<url>
  <loc>https://www.arthayantra.com/blogs/</loc>
  <lastmod>2017-07-14T09:45:00+00:00</lastmod>
</url>
</urlset>
`

const criticalErrorHtml = `
<!doctype html>
<html lang="en-US">
  <head>
    <meta http-equiv="Content-Type" content="text/html; charset=UTF-8" />
    <meta name="viewport" content="width=device-width">
    <meta name="robots" content="max-image-preview:large, noindex, follow" />
    <title>WordPress &rsaquo; Error</title>
  </head>
  <body id="error-page">
    <div class="wp-die-message">
      <p>There has been a critical error on this website.</p>
      <p><a href="https://wordpress.org/support/article/faq-troubleshooting/">Learn more about troubleshooting WordPress.</a></p>
    </div>
  </body>
</html>
`

const publicJobsHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>ArthaYantra Careers</title>
  </head>
  <body>
    <h1>Current Openings</h1>
    <a href="https://www.arthayantra.com/careers/financial-planner">Apply now</a>
  </body>
</html>
`

const driftedSitemapXml = `
<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>https://www.arthayantra.com/</loc>
  </url>
  <url>
    <loc>https://jobs.lever.co/arthayantra</loc>
  </url>
</urlset>
`

const loadArthaYantraModule = async () => {
  try {
    return await import('../../scraper/arthayantra/script.js')
  } catch {
    assert.fail('Expected ArthaYantra scraper module at ../../scraper/arthayantra/script.js')
  }
}

test('ArthaYantra scraper constants stay pinned to the verified broken first-party no-public-jobs surface', async () => {
  const arthaYantra = await loadArthaYantraModule()

  assert.equal(arthaYantra.SOURCE, 'arthayantra')
  assert.equal(arthaYantra.COMPANY, 'ArthaYantra')
  assert.equal(arthaYantra.OFFICIAL_BRAND_NAME, 'ARTHOS Financial Planning')
  assert.equal(arthaYantra.LEGAL_ENTITY_NAME, 'Arthayantra Corp. Pvt. Ltd.')
  assert.equal(arthaYantra.VERIFIED_ON, '2026-07-15')
  assert.equal(arthaYantra.HOMEPAGE_URL, 'https://www.arthayantra.com/')
  assert.equal(arthaYantra.LIVE_LOGIN_URL, 'https://arthos.arthayantra.com/login.html')
  assert.equal(arthaYantra.ROBOTS_URL, 'https://arthayantra.com/robots.txt')
  assert.equal(arthaYantra.SITEMAP_URL, 'https://arthayantra.com/sitemap.xml')
  assert.deepEqual(arthaYantra.BROKEN_CAREER_ROUTE_URLS, [
    'https://arthayantra.com/careers',
    'https://arthayantra.com/career',
    'https://arthayantra.com/jobs',
    'https://arthayantra.com/join-us',
    'https://arthayantra.com/work-with-us',
    'https://arthayantra.com/openings',
    'https://www.arthayantra.com/financial-consultant-careers/',
    'https://www.arthayantra.com/career-fa/',
    'https://www.arthayantra.com/career-fp/',
  ])
  assert.match(arthaYantra.VERIFIED_SURFACE_SUMMARY, /no trustworthy public jobs surface/i)
  assert.equal(arthaYantra.hasOfficialHomepageSignal(homepageHtml), true)
  assert.equal(arthaYantra.hasPublicJobsSignal(homepageHtml), false)
  assert.equal(arthaYantra.hasCareerLikeLink(homepageHtml), false)
  assert.equal(arthaYantra.hasOfficialSitemapSignal(sitemapXml), true)
  assert.equal(arthaYantra.hasOfficialSitemapSignal(driftedSitemapXml), false)
  assert.equal(arthaYantra.hasPublicJobsSignal(publicJobsHtml), true)
  assert.equal(
    arthaYantra.hasCareerLikeLink('<a href="https://www.arthayantra.com/careers/">Careers</a>'),
    true,
  )
  assert.equal(
    arthaYantra.isVerifiedBrokenWordPressRoute({
      status: 500,
      url: arthaYantra.BROKEN_CAREER_ROUTE_URLS[0],
      html: criticalErrorHtml,
    }),
    true,
  )
})

test('ArthaYantra returns [] only while the verified broken first-party surface remains unchanged', async () => {
  const arthaYantra = await loadArthaYantraModule()
  const requestedUrls = []

  const jobs = await arthaYantra.createArthaYantraScraper().run({
    fetchPage: async (url) => {
      requestedUrls.push(url)

      if (url === arthaYantra.HOMEPAGE_URL) {
        return { status: 200, url: arthaYantra.LIVE_LOGIN_URL, html: homepageHtml }
      }

      if (url === arthaYantra.ROBOTS_URL) {
        return { status: 500, url, html: criticalErrorHtml }
      }

      if (url === arthaYantra.SITEMAP_URL) {
        return { status: 200, url, html: sitemapXml }
      }

      if (arthaYantra.BROKEN_CAREER_ROUTE_URLS.includes(url)) {
        return { status: 500, url, html: criticalErrorHtml }
      }

      throw new Error(`Unexpected ArthaYantra URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [
    arthaYantra.HOMEPAGE_URL,
    arthaYantra.ROBOTS_URL,
    arthaYantra.SITEMAP_URL,
    ...arthaYantra.BROKEN_CAREER_ROUTE_URLS,
  ])
  assert.deepEqual(jobs, [])
})

test('ArthaYantra default fetch tolerates the verified expired certificate while validating official pages', async () => {
  const arthaYantra = await loadArthaYantraModule()
  const originalRequest = https.request
  const observedRequests = []

  https.request = (targetUrl, options, callback) => {
    const url = targetUrl.toString()
    observedRequests.push({ url, options })

    const response = new EventEmitter()
    response.headers = {}

    if (url === arthaYantra.HOMEPAGE_URL) {
      response.statusCode = 301
      response.headers.location = arthaYantra.LIVE_LOGIN_URL
    } else if (url === arthaYantra.LIVE_LOGIN_URL) {
      response.statusCode = 200
    } else if (url === arthaYantra.SITEMAP_URL) {
      response.statusCode = 200
    } else {
      response.statusCode = 500
    }

    queueMicrotask(() => {
      callback(response)
      if (url === arthaYantra.LIVE_LOGIN_URL) {
        response.emit('data', Buffer.from(homepageHtml))
      } else if (url === arthaYantra.SITEMAP_URL) {
        response.emit('data', Buffer.from(sitemapXml))
      } else if (response.statusCode === 500) {
        response.emit('data', Buffer.from(criticalErrorHtml))
      }
      response.emit('end')
    })

    return {
      on: () => {},
      end: () => {},
    }
  }

  try {
    const jobs = await arthaYantra.createArthaYantraScraper().run()

    assert.deepEqual(jobs, [])
    assert.ok(observedRequests.length > 0)
    assert.deepEqual(
      [...new Set(observedRequests.map((request) => request.options.rejectUnauthorized))],
      [false],
    )
  } finally {
    https.request = originalRequest
  }
})

test('ArthaYantra fails closed when the homepage, sitemap, robots, or broken career routes drift into a public jobs surface', async () => {
  const arthaYantra = await loadArthaYantraModule()

  await assert.rejects(
    arthaYantra.createArthaYantraScraper().run({
      fetchPage: async (url) => {
        if (url === arthaYantra.HOMEPAGE_URL) {
          return { status: 200, url, html: '<html><title>Unexpected</title></html>' }
        }

        throw new Error(`Unexpected ArthaYantra URL: ${url}`)
      },
    }),
    /official homepage/i,
  )

  await assert.rejects(
    arthaYantra.createArthaYantraScraper().run({
      fetchPage: async (url) => {
        if (url === arthaYantra.HOMEPAGE_URL) {
          return {
            status: 200,
            url: arthaYantra.LIVE_LOGIN_URL,
            html: `${homepageHtml}<a href="https://www.arthayantra.com/careers/">Careers</a>`,
          }
        }

        throw new Error(`Unexpected ArthaYantra URL: ${url}`)
      },
    }),
    /homepage now exposes a first-party careers or jobs link/i,
  )

  await assert.rejects(
    arthaYantra.createArthaYantraScraper().run({
      fetchPage: async (url) => {
        if (url === arthaYantra.HOMEPAGE_URL) {
          return { status: 200, url: arthaYantra.LIVE_LOGIN_URL, html: homepageHtml }
        }

        if (url === arthaYantra.ROBOTS_URL) {
          return { status: 200, url, html: 'User-agent: *\nAllow: /\n' }
        }

        throw new Error(`Unexpected ArthaYantra URL: ${url}`)
      },
    }),
    /robots\.txt/i,
  )

  await assert.rejects(
    arthaYantra.createArthaYantraScraper().run({
      fetchPage: async (url) => {
        if (url === arthaYantra.HOMEPAGE_URL) {
          return { status: 200, url: arthaYantra.LIVE_LOGIN_URL, html: homepageHtml }
        }

        if (url === arthaYantra.ROBOTS_URL) {
          return { status: 500, url, html: criticalErrorHtml }
        }

        if (url === arthaYantra.SITEMAP_URL) {
          return { status: 200, url, html: driftedSitemapXml }
        }

        throw new Error(`Unexpected ArthaYantra URL: ${url}`)
      },
    }),
    /sitemap/i,
  )

  await assert.rejects(
    arthaYantra.createArthaYantraScraper().run({
      fetchPage: async (url) => {
        if (url === arthaYantra.HOMEPAGE_URL) {
          return { status: 200, url: arthaYantra.LIVE_LOGIN_URL, html: homepageHtml }
        }

        if (url === arthaYantra.ROBOTS_URL) {
          return { status: 500, url, html: criticalErrorHtml }
        }

        if (url === arthaYantra.SITEMAP_URL) {
          return { status: 200, url, html: sitemapXml }
        }

        if (url === arthaYantra.BROKEN_CAREER_ROUTE_URLS[0]) {
          return { status: 200, url, html: publicJobsHtml }
        }

        if (arthaYantra.BROKEN_CAREER_ROUTE_URLS.slice(1).includes(url)) {
          return { status: 500, url, html: criticalErrorHtml }
        }

        throw new Error(`Unexpected ArthaYantra URL: ${url}`)
      },
    }),
    /broken career route changed materially or now exposes public jobs/i,
  )
})
