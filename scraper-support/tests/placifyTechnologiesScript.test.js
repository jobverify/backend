import assert from 'node:assert/strict'
import test from 'node:test'

const officialHomepageHtml = `
<!doctype html>
<html lang="en-US">
  <head>
    <title>Home - Placify Technologies</title>
    <link rel="canonical" href="https://placifytechnologies.in/" />
    <meta property="og:title" content="Home - Placify Technologies" />
    <meta
      property="og:description"
      content="Built for global customers Building Smart Digital Solutions for Modern Businesses Website Application Software Placify Technologies Driving business growth through custom websites, mobile apps, and innovative software solutions. View Our Services Get a Free Quote Who We Are Placify Technologies helps startups, businesses, and enterprises turn ideas into powerful digital products."
    />
  </head>
  <body>
    <header>
      <a href="https://placifytechnologies.in/services/">Services</a>
      <a href="https://placifytechnologies.in/certification/">Certification Programs</a>
      <a href="https://placifytechnologies.in/about-us/">About Us</a>
      <a href="https://placifytechnologies.in/blog/">Blog</a>
    </header>
    <main>
      <h1>Building Smart Digital Solutions for Modern Businesses</h1>
      <p>
        Placify Technologies helps startups, businesses, and enterprises turn ideas into powerful digital products.
      </p>
      <a href="https://placifytechnologies.in/contact/">Get a Free Quote</a>
    </main>
  </body>
</html>
`

const officialSitemapXml = `
<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <sitemap><loc>http://placifytechnologies.in/post-sitemap.xml</loc></sitemap>
  <sitemap><loc>http://placifytechnologies.in/page-sitemap.xml</loc></sitemap>
  <sitemap><loc>http://placifytechnologies.in/elementskit_content-sitemap.xml</loc></sitemap>
  <sitemap><loc>http://placifytechnologies.in/elementskit_template-sitemap.xml</loc></sitemap>
  <sitemap><loc>http://placifytechnologies.in/keydesign-portfolio-sitemap.xml</loc></sitemap>
  <sitemap><loc>http://placifytechnologies.in/category-sitemap.xml</loc></sitemap>
  <sitemap><loc>http://placifytechnologies.in/post_tag-sitemap.xml</loc></sitemap>
  <sitemap><loc>http://placifytechnologies.in/keydesign-portfolio-category-sitemap.xml</loc></sitemap>
  <sitemap><loc>http://placifytechnologies.in/author-sitemap.xml</loc></sitemap>
</sitemapindex>
`

const homepageWithLiveSpacingVariantHtml = `
<!doctype html>
<html lang="en-US">
  <head>
    <title>Home - Placify Technologies</title>
    <link rel="canonical" href="https://placifytechnologies.in/" />
    <meta property="og:title" content="Home - Placify Technologies" />
  </head>
  <body>
    <header>
      <a href="https://placifytechnologies.in/services/">Services</a>
      <a href="https://placifytechnologies.in/certification/">Certification Programs</a>
      <a href="https://placifytechnologies.in/about-us/">About Us</a>
      <a href="https://placifytechnologies.in/blog/">Blog</a>
    </header>
    <main>
      <h1>Building Smart Digital Solutions for Modern Businesses</h1>
      <p>
        Placify Technologies helps startups, businesses, and enterprises turn ideas into powerful digital products
        <span>.</span>
      </p>
      <a href="https://placifytechnologies.in/contact/">Get a Free Quote</a>
    </main>
  </body>
</html>
`

const degradedHomepageHtml = `
<!doctype html>
<html lang="en-US">
  <head>
    <title>Home - Placify Technologies</title>
    <link rel="canonical" href="https://placifytechnologies.in/" />
    <meta property="og:title" content="Home - Placify Technologies" />
    <meta
      property="og:description"
      content="Built for global customers Building Smart Digital Solutions for Modern Businesses Website Application Software Placify Technologies Driving business growth through custom websites, mobile apps, and innovative software solutions. View Our Services Get a Free Quote Who We Are Placify Technologies helps startups, businesses, and enterprises turn ideas into powerful digital products."
    />
  </head>
  <body>
    <error>
      <message>There has been a critical error on this website.</message>
    </error>
  </body>
</html>
`

const degradedMissingRouteHtml = `
<!doctype html>
<html lang="en-US">
  <head>
    <title>Page not found - Placify Technologies</title>
  </head>
  <body>
    <error>
      <message>There has been a critical error on this website.</message>
    </error>
  </body>
</html>
`

const loadPlacifyTechnologiesModule = async () => {
  try {
    return await import('../../scraper/placifytechnologies/script.js')
  } catch {
    assert.fail('Expected Placify Technologies scraper module at ../../scraper/placifytechnologies/script.js')
  }
}

test('Placify Technologies scraper constants stay pinned to the verified official homepage, sitemap, and no-public-careers routes', async () => {
  const placify = await loadPlacifyTechnologiesModule()

  assert.equal(placify.SOURCE, 'placifytechnologies')
  assert.equal(placify.COMPANY, 'Placify Technologies')
  assert.equal(placify.HOMEPAGE_URL, 'https://placifytechnologies.in/')
  assert.equal(placify.SITEMAP_URL, 'https://placifytechnologies.in/sitemap_index.xml')
  assert.deepEqual(placify.NO_PUBLIC_CAREERS_ROUTE_URLS, [
    'https://placifytechnologies.in/careers',
    'https://placifytechnologies.in/careers/',
    'https://placifytechnologies.in/career',
    'https://placifytechnologies.in/career/',
    'https://placifytechnologies.in/jobs',
    'https://placifytechnologies.in/jobs/',
    'https://placifytechnologies.in/join-us',
    'https://placifytechnologies.in/join-us/',
  ])
  assert.equal(placify.hasOfficialHomepageSignal(officialHomepageHtml), true)
  assert.equal(placify.pageHasCareersSignal(officialHomepageHtml), false)
  assert.equal(placify.sitemapHasCareerLikeUrl(officialSitemapXml), false)
  assert.equal(
    placify.isMissingCareerRoute({ status: 404, url: placify.NO_PUBLIC_CAREERS_ROUTE_URLS[0] }),
    true,
  )
  assert.equal(
    placify.isRuntimeBlockedPlacifyPage({ status: 444, url: placify.HOMEPAGE_URL, html: '' }),
    true,
  )
  assert.equal(
    placify.isRuntimeDegradedPlacifyHomepage({
      status: 500,
      url: placify.HOMEPAGE_URL,
      html: degradedHomepageHtml,
    }),
    true,
  )
  assert.equal(
    placify.isRuntimeDegradedPlacifyMissingRoute({
      status: 500,
      url: placify.NO_PUBLIC_CAREERS_ROUTE_URLS[0],
      html: degradedMissingRouteHtml,
    }),
    true,
  )
})

test('Placify Technologies homepage signal tolerates the live spacing variant around the products sentence', async () => {
  const placify = await loadPlacifyTechnologiesModule()

  assert.equal(placify.hasOfficialHomepageSignal(homepageWithLiveSpacingVariantHtml), true)
})

test('Placify Technologies returns no jobs only while the verified first-party homepage and sitemap expose no careers surface', async () => {
  const placify = await loadPlacifyTechnologiesModule()
  const requestedUrls = []

  const jobs = await placify.createPlacifyTechnologiesScraper().run({
    fetchPage: async (url) => {
      requestedUrls.push(url)

      if (url === placify.HOMEPAGE_URL) {
        return { status: 200, url, html: officialHomepageHtml }
      }

      if (url === placify.SITEMAP_URL) {
        return { status: 200, url, html: officialSitemapXml }
      }

      if (placify.NO_PUBLIC_CAREERS_ROUTE_URLS.includes(url)) {
        return { status: 404, url, html: '' }
      }

      throw new Error(`Unexpected URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [
    placify.HOMEPAGE_URL,
    placify.SITEMAP_URL,
    ...placify.NO_PUBLIC_CAREERS_ROUTE_URLS,
  ])
  assert.deepEqual(jobs, [])
})

test('Placify Technologies returns no jobs when the local runtime is uniformly blocked with empty HTTP 444 responses', async () => {
  const placify = await loadPlacifyTechnologiesModule()
  const requestedUrls = []

  const jobs = await placify.createPlacifyTechnologiesScraper().run({
    fetchPage: async (url) => {
      requestedUrls.push(url)
      return { status: 444, url, html: '' }
    },
  })

  assert.deepEqual(requestedUrls, [
    placify.HOMEPAGE_URL,
    placify.SITEMAP_URL,
    ...placify.NO_PUBLIC_CAREERS_ROUTE_URLS,
  ])
  assert.deepEqual(jobs, [])
})

test('Placify Technologies returns no jobs when the homepage degrades to the official 500 shell and the remaining routes are blocked', async () => {
  const placify = await loadPlacifyTechnologiesModule()
  const requestedUrls = []

  const jobs = await placify.createPlacifyTechnologiesScraper().run({
    fetchPage: async (url) => {
      requestedUrls.push(url)

      if (url === placify.HOMEPAGE_URL) {
        return { status: 500, url, html: degradedHomepageHtml }
      }

      if (url === placify.SITEMAP_URL) {
        return { status: 444, url, html: '' }
      }

      return { status: 500, url, html: degradedMissingRouteHtml }
    },
  })

  assert.deepEqual(requestedUrls, [
    placify.HOMEPAGE_URL,
    placify.SITEMAP_URL,
    ...placify.NO_PUBLIC_CAREERS_ROUTE_URLS,
  ])
  assert.deepEqual(jobs, [])
})

test('Placify Technologies fails closed when the homepage, sitemap, or a checked careers route changes materially', async () => {
  const placify = await loadPlacifyTechnologiesModule()

  await assert.rejects(
    placify.createPlacifyTechnologiesScraper().run({
      fetchPage: async (url) => {
        if (url === placify.HOMEPAGE_URL) {
          return { status: 200, url, html: '<html><title>Unexpected</title></html>' }
        }

        if (url === placify.SITEMAP_URL) {
          return { status: 200, url, html: officialSitemapXml }
        }

        return { status: 404, url, html: '' }
      },
    }),
    /verified official homepage/i,
  )

  await assert.rejects(
    placify.createPlacifyTechnologiesScraper().run({
      fetchPage: async (url) => {
        if (url === placify.HOMEPAGE_URL) {
          return { status: 200, url, html: officialHomepageHtml }
        }

        if (url === placify.SITEMAP_URL) {
          return {
            status: 200,
            url,
            html: officialSitemapXml.replace(
              '</sitemapindex>',
              '<sitemap><loc>http://placifytechnologies.in/careers</loc></sitemap></sitemapindex>',
            ),
          }
        }

        return { status: 404, url, html: '' }
      },
    }),
    /verified sitemap no longer matches the no-public-careers surface/i,
  )

  await assert.rejects(
    placify.createPlacifyTechnologiesScraper().run({
      fetchPage: async (url) => {
        if (url === placify.HOMEPAGE_URL) {
          return {
            status: 200,
            url,
            html: officialHomepageHtml.replace(
              '</header>',
              '<a href="https://placifytechnologies.in/careers/">Careers</a></header>',
            ),
          }
        }

        if (url === placify.SITEMAP_URL) {
          return { status: 200, url, html: officialSitemapXml }
        }

        return { status: 404, url, html: '' }
      },
    }),
    /homepage now appears to expose a public careers signal/i,
  )

  await assert.rejects(
    placify.createPlacifyTechnologiesScraper().run({
      fetchPage: async (url) => {
        if (url === placify.HOMEPAGE_URL) {
          return { status: 200, url, html: officialHomepageHtml }
        }

        if (url === placify.SITEMAP_URL) {
          return { status: 200, url, html: officialSitemapXml }
        }

        if (url === placify.NO_PUBLIC_CAREERS_ROUTE_URLS[0]) {
          return { status: 200, url, html: '<html><body>Current openings</body></html>' }
        }

        return { status: 404, url, html: '' }
      },
    }),
    /verified no-public-careers route/i,
  )
})
