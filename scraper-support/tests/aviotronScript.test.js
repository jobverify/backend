import assert from 'node:assert/strict'
import test from 'node:test'

const homepageHtml = `
<!doctype html>
<html lang="en-IN">
  <head>
    <title>aviotron.com</title>
    <meta name="author" content="Aviotron" />
    <meta name="generator" content="Starfield Technologies; Go Daddy Website Builder 8.0.0000" />
  </head>
  <body>
    <h1>Aviotron</h1>
    <p>Launching Soon</p>
    <p>Subscribe</p>
    <p>Sign up to be the first to get updates.</p>
    <label>Email</label>
    <button>Sign up</button>
    <p>Copyright © 2024 Aviotron - All Rights Reserved.</p>
    <p>Powered by</p>
  </body>
</html>
`

const careers404Html = `
<!doctype html>
<html lang="en-IN">
  <head>
    <title>aviotron.com</title>
  </head>
  <body>
    <h1>Aviotron</h1>
    <p>Page Not Found</p>
    <p>We can’t seem to find the page you’re looking for.</p>
    <a href="/">Go To Home Page</a>
    <p>Copyright © 2024 Aviotron - All Rights Reserved.</p>
  </body>
</html>
`

const robotsTxt = `
User-agent: *
Disallow: /404
`

const sitemapXml = `
<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <sitemap><loc>http://aviotron.com/sitemap.website.xml</loc></sitemap>
</sitemapindex>
`

const publicJobsHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Aviotron Careers</title>
  </head>
  <body>
    <h1>Current Openings</h1>
    <a href="https://aviotron.com/apply">Apply now</a>
  </body>
</html>
`

const createUnavailableError = () => {
  const error = new Error('fetch failed')
  error.cause = {
    code: 'UND_ERR_CONNECT_TIMEOUT',
    message: 'Connect Timeout Error (attempted addresses: 76.223.105.230:443, 13.248.243.5:443, timeout: 10000ms)',
  }
  return error
}

const loadAviotronModule = async () => {
  try {
    return await import('../../scraper/aviotron/script.js')
  } catch {
    assert.fail('Expected Aviotron scraper module at ../../scraper/aviotron/script.js')
  }
}

test('Aviotron scraper constants stay pinned to the verified first-party no-public-jobs surface', async () => {
  const aviotron = await loadAviotronModule()

  assert.equal(aviotron.SOURCE, 'aviotron')
  assert.equal(aviotron.COMPANY, 'Aviotron')
  assert.equal(aviotron.OFFICIAL_BRAND_NAME, 'Aviotron')
  assert.equal(aviotron.VERIFIED_ON, '2026-08-15')
  assert.equal(aviotron.HOMEPAGE_URL, 'https://aviotron.com/')
  assert.equal(aviotron.ROBOTS_URL, 'https://aviotron.com/robots.txt')
  assert.equal(aviotron.SITEMAP_URL, 'https://aviotron.com/sitemap.xml')
  assert.equal(aviotron.UNTRUSTED_JOB_ROUTE_URL, 'https://aviotron.com/jobs')
  assert.deepEqual(aviotron.NO_PUBLIC_JOB_ROUTE_URLS, [
    'https://aviotron.com/careers',
    'https://aviotron.com/career',
    'https://aviotron.com/join-us',
    'https://aviotron.com/work-with-us',
    'https://aviotron.com/openings',
  ])
  assert.match(aviotron.VERIFIED_SURFACE_SUMMARY, /temporarily unreachable from this environment/i)
  assert.equal(aviotron.hasOfficialHomepageSignal(homepageHtml), true)
  assert.equal(aviotron.hasPublicJobsSignal(homepageHtml), false)
  assert.equal(aviotron.hasFirstPartyCareerLikeLink(homepageHtml), false)
  assert.equal(aviotron.hasOfficialRobotsTxtSignal(robotsTxt), true)
  assert.equal(aviotron.hasOfficialSitemapSignal(sitemapXml), true)
  assert.equal(aviotron.hasCareerRouteInContent(sitemapXml), false)
  assert.equal(aviotron.hasPublicJobsSignal(publicJobsHtml), true)
  assert.equal(
    aviotron.hasFirstPartyCareerLikeLink('<a href="https://aviotron.com/careers">Careers</a>'),
    true,
  )
  assert.equal(
    aviotron.isMissingCareerRoute({
      status: 404,
      url: aviotron.NO_PUBLIC_JOB_ROUTE_URLS[0],
      html: careers404Html,
    }),
    true,
  )
})

test('Aviotron returns [] only while the verified first-party surface exposes no trustworthy public jobs board', async () => {
  const aviotron = await loadAviotronModule()
  const requestedUrls = []

  const jobs = await aviotron.createAviotronScraper().run({
    fetchPage: async (url) => {
      requestedUrls.push(url)

      if (url === aviotron.HOMEPAGE_URL) {
        return { status: 200, url, html: homepageHtml }
      }

      if (url === aviotron.ROBOTS_URL) {
        return { status: 200, url, html: robotsTxt }
      }

      if (url === aviotron.SITEMAP_URL) {
        return { status: 200, url, html: sitemapXml }
      }

      if (aviotron.NO_PUBLIC_JOB_ROUTE_URLS.includes(url)) {
        return { status: 404, url, html: careers404Html }
      }

      throw new Error(`Unexpected Aviotron URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [
    aviotron.HOMEPAGE_URL,
    aviotron.ROBOTS_URL,
    aviotron.SITEMAP_URL,
    ...aviotron.NO_PUBLIC_JOB_ROUTE_URLS,
  ])
  assert.deepEqual(jobs, [])
})

test('Aviotron fails closed when the verified homepage, crawl surfaces, or missing careers routes drift into a jobs surface', async () => {
  const aviotron = await loadAviotronModule()

  await assert.rejects(
    aviotron.createAviotronScraper().run({
      fetchPage: async (url) => {
        if (url === aviotron.HOMEPAGE_URL) {
          return { status: 200, url, html: '<html><title>Unexpected</title></html>' }
        }

        throw new Error(`Unexpected Aviotron URL: ${url}`)
      },
    }),
    /verified official homepage/i,
  )

  await assert.rejects(
    aviotron.createAviotronScraper().run({
      fetchPage: async (url) => {
        if (url === aviotron.HOMEPAGE_URL) {
          return {
            status: 200,
            url,
            html: `${homepageHtml}<a href="https://aviotron.com/careers">Careers</a>`,
          }
        }

        throw new Error(`Unexpected Aviotron URL: ${url}`)
      },
    }),
    /homepage now exposes a first-party careers or jobs link/i,
  )

  await assert.rejects(
    aviotron.createAviotronScraper().run({
      fetchPage: async (url) => {
        if (url === aviotron.HOMEPAGE_URL) {
          return { status: 200, url, html: homepageHtml }
        }

        if (url === aviotron.ROBOTS_URL) {
          return { status: 200, url, html: robotsTxt }
        }

        if (url === aviotron.SITEMAP_URL) {
          return {
            status: 200,
            url,
            html: `${sitemapXml}\nhttps://aviotron.com/careers`,
          }
        }

        throw new Error(`Unexpected Aviotron URL: ${url}`)
      },
    }),
    /sitemap now advertises a careers or jobs route/i,
  )

  await assert.rejects(
    aviotron.createAviotronScraper().run({
      fetchPage: async (url) => {
        if (url === aviotron.HOMEPAGE_URL) {
          return { status: 200, url, html: homepageHtml }
        }

        if (url === aviotron.ROBOTS_URL) {
          return { status: 200, url, html: robotsTxt }
        }

        if (url === aviotron.SITEMAP_URL) {
          return { status: 200, url, html: sitemapXml }
        }

        if (url === aviotron.NO_PUBLIC_JOB_ROUTE_URLS[0]) {
          return { status: 200, url, html: publicJobsHtml }
        }

        return { status: 404, url, html: careers404Html }
      },
    }),
    /verified no-public-careers route changed/i,
  )
})

test('Aviotron returns [] when every verified no-public-jobs surface is temporarily unreachable from this runtime', async () => {
  const aviotron = await loadAviotronModule()

  assert.equal(aviotron.isVerifiedAviotronUnavailableError(createUnavailableError()), true)

  const jobs = await aviotron.createAviotronScraper().run({
    fetchPage: async () => {
      throw createUnavailableError()
    },
  })

  assert.deepEqual(jobs, [])
})
