import assert from 'node:assert/strict'
import test from 'node:test'

const homepageHtml = `
<!DOCTYPE html>
<html lang="en">
  <head>
    <title>Eruditus Executive Education</title>
    <meta
      name="description"
      content="Eruditus Executive Education offers the best executive education programmes from world's top Business Schools."
    />
    <link rel="canonical" href="https://eruditus.com" />
  </head>
  <body>
    <p>Learn. From the world’s best.</p>
    <p>Eruditus was founded in 2010 to make world-class executive education accessible globally.</p>
    <footer>
      <h4>Eruditus</h4>
      <a href="https://eruditus.com/about-us/">About Us</a>
      <a href="https://eruditus.com/universities/">Universities</a>
      <a href="https://enterprise.eruditus.com/">Enterprise</a>
      <a href="https://emeritus.org/in/">Indian Institutions</a>
      <a href="https://eruditus.com/newsroom/">Newsroom</a>
      <a href="https://eruditus.com/policies/">Policies</a>
      <a href="https://eruditus.com/privacy-policy/">Privacy Policy</a>
      <a href="https://eruditus.com/cookie-policy/">Cookie Policy</a>
      <a href="https://eruditus.com/contact/">Contact Us</a>
      <a href="https://www.linkedin.com/company/eruditus-education" target="_blank">LinkedIn</a>
    </footer>
  </body>
</html>
`

const robotsTxt = `
# START YOAST BLOCK
User-agent: *
Disallow:

Sitemap: https://eruditus.com/sitemap_index.xml
# END YOAST BLOCK
`

const pageSitemapXml = `
<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url><loc>https://eruditus.com/</loc></url>
  <url><loc>https://eruditus.com/newsroom/</loc></url>
  <url><loc>https://eruditus.com/cookie-policy/</loc></url>
  <url><loc>https://eruditus.com/universities/</loc></url>
  <url><loc>https://eruditus.com/about-us/</loc></url>
  <url><loc>https://eruditus.com/contact-us/</loc></url>
</urlset>
`

const notFoundHtml = `
<!DOCTYPE html>
<html lang="en-US" class="no-js">
  <head>
    <meta charset="UTF-8" />
    <meta name="robots" content="noindex, follow" />
    <title>Page not found - Eruditus Executive Education</title>
    <meta property="og:site_name" content="Eruditus Executive Education" />
  </head>
  <body>
    <footer>
      <h4 class="article-title">Eruditus</h4>
      <a href="https://eruditus.com/about-us/">About Us</a>
      <a href="https://eruditus.com/universities/">Universities</a>
      <a href="https://enterprise.eruditus.com/">Enterprise</a>
      <a href="https://eruditus.com/newsroom/">Newsroom</a>
      <a href="https://eruditus.com/contact-us/">Contact Us</a>
      <p>2022 © Eruditus All Rights Reserved.</p>
    </footer>
  </body>
</html>
`

const publicJobsHtml = `
<!DOCTYPE html>
<html lang="en">
  <head>
    <title>Careers | Eruditus</title>
    <script type="application/ld+json">
      {"@context":"https://schema.org","@type":"JobPosting","title":"Program Manager"}
    </script>
  </head>
  <body>
    <main>
      <h1>Current Openings</h1>
      <a href="https://jobs.lever.co/eruditus/program-manager">Apply now</a>
    </main>
  </body>
</html>
`

const loadEruditusModule = async () => {
  try {
    return await import('../../scraper/eruditus/script.js')
  } catch {
    assert.fail('Expected Eruditus scraper module at ../../scraper/eruditus/script.js')
  }
}

test('Eruditus helpers stay pinned to the verified homepage, crawl surfaces, and 404 careers routes', async () => {
  const eruditus = await loadEruditusModule()

  assert.equal(eruditus.SOURCE, 'eruditus')
  assert.equal(eruditus.COMPANY, 'Eruditus')
  assert.equal(eruditus.OFFICIAL_BRAND_NAME, 'Eruditus Executive Education')
  assert.equal(eruditus.VERIFIED_ON, '2026-07-15')
  assert.equal(eruditus.HOMEPAGE_URL, 'https://eruditus.com/')
  assert.equal(eruditus.CAREER_PAGE_URL, 'https://eruditus.com/careers')
  assert.equal(eruditus.ABOUT_US_URL, 'https://eruditus.com/about-us/')
  assert.equal(eruditus.ROBOTS_TXT_URL, 'https://eruditus.com/robots.txt')
  assert.equal(eruditus.SITEMAP_URL, 'https://eruditus.com/sitemap.xml')
  assert.equal(eruditus.SITEMAP_INDEX_URL, 'https://eruditus.com/sitemap_index.xml')
  assert.equal(eruditus.PAGE_SITEMAP_URL, 'https://eruditus.com/page-sitemap.xml')
  assert.deepEqual(eruditus.CHECKED_404_ROUTE_URLS, [
    'https://eruditus.com/careers',
    'https://eruditus.com/career',
    'https://eruditus.com/jobs',
    'https://eruditus.com/join-us',
    'https://eruditus.com/work-with-us',
  ])
  assert.equal(eruditus.hasHomepageSignal(homepageHtml), true)
  assert.equal(eruditus.hasPublicAtsOrCareersLink(homepageHtml), false)
  assert.equal(eruditus.robotsPublishSitemapIndex(robotsTxt), true)
  assert.equal(eruditus.pageSitemapHasAboutUsRoute(pageSitemapXml), true)
  assert.equal(eruditus.pageSitemapListsCareersRoute(pageSitemapXml), false)
  assert.equal(
    eruditus.hasExpectedNotFoundSurface({ status: 404, html: notFoundHtml }),
    true,
  )
  assert.equal(eruditus.hasPublicAtsOrCareersLink(publicJobsHtml), true)
})

test('Eruditus returns [] only while the verified homepage and crawl surfaces expose no public careers board', async () => {
  const eruditus = await loadEruditusModule()
  const requestedUrls = []

  const jobs = await eruditus.createEruditusScraper().run({
    fetchPage: async (url) => {
      requestedUrls.push(url)

      if (url === eruditus.HOMEPAGE_URL) {
        return { status: 200, url, html: homepageHtml }
      }

      if (url === eruditus.ROBOTS_TXT_URL) {
        return { status: 200, url, html: robotsTxt }
      }

      if (url === eruditus.PAGE_SITEMAP_URL) {
        return { status: 200, url, html: pageSitemapXml }
      }

      if (eruditus.CHECKED_404_ROUTE_URLS.includes(url)) {
        return { status: 404, url, html: notFoundHtml }
      }

      throw new Error(`Unexpected Eruditus URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [
    eruditus.HOMEPAGE_URL,
    eruditus.ROBOTS_TXT_URL,
    eruditus.PAGE_SITEMAP_URL,
    ...eruditus.CHECKED_404_ROUTE_URLS,
  ])
  assert.deepEqual(jobs, [])
})

test('Eruditus fails closed when the verified homepage, sitemap, or 404 careers routes drift', async () => {
  const eruditus = await loadEruditusModule()

  await assert.rejects(
    eruditus.createEruditusScraper().run({
      fetchPage: async (url) => {
        if (url === eruditus.HOMEPAGE_URL) {
          return { status: 200, url, html: '<html><head><title>Unexpected</title></head><body></body></html>' }
        }

        throw new Error(`Unexpected Eruditus URL: ${url}`)
      },
    }),
    /homepage no longer matches/i,
  )

  await assert.rejects(
    eruditus.createEruditusScraper().run({
      fetchPage: async (url) => {
        if (url === eruditus.HOMEPAGE_URL) {
          return { status: 200, url, html: homepageHtml.replace(
            '</footer>',
            '<a href="https://jobs.lever.co/eruditus/program-manager">Careers</a></footer>',
          ) }
        }

        throw new Error(`Unexpected Eruditus URL: ${url}`)
      },
    }),
    /homepage no longer matches/i,
  )

  await assert.rejects(
    eruditus.createEruditusScraper().run({
      fetchPage: async (url) => {
        if (url === eruditus.HOMEPAGE_URL) {
          return { status: 200, url, html: homepageHtml }
        }

        if (url === eruditus.ROBOTS_TXT_URL) {
          return { status: 200, url, html: robotsTxt }
        }

        if (url === eruditus.PAGE_SITEMAP_URL) {
          return {
            status: 200,
            url,
            html: pageSitemapXml.replace(
              '</urlset>',
              '<url><loc>https://eruditus.com/careers/</loc></url></urlset>',
            ),
          }
        }

        throw new Error(`Unexpected Eruditus URL: ${url}`)
      },
    }),
    /page sitemap changed/i,
  )

  await assert.rejects(
    eruditus.createEruditusScraper().run({
      fetchPage: async (url) => {
        if (url === eruditus.HOMEPAGE_URL) {
          return { status: 200, url, html: homepageHtml }
        }

        if (url === eruditus.ROBOTS_TXT_URL) {
          return { status: 200, url, html: robotsTxt }
        }

        if (url === eruditus.PAGE_SITEMAP_URL) {
          return { status: 200, url, html: pageSitemapXml }
        }

        if (url === eruditus.CHECKED_404_ROUTE_URLS[0]) {
          return { status: 200, url, html: publicJobsHtml }
        }

        if (eruditus.CHECKED_404_ROUTE_URLS.slice(1).includes(url)) {
          return { status: 404, url, html: notFoundHtml }
        }

        throw new Error(`Unexpected Eruditus URL: ${url}`)
      },
    }),
    /404 careers route changed/i,
  )
})
