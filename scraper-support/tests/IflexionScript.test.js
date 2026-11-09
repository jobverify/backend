import assert from 'node:assert/strict'
import test from 'node:test'

const loadIflexionModule = async () => {
  try {
    return await import('../../scraper/iflexion/script.js')
  } catch {
    assert.fail('Expected Iflexion scraper module at ../../scraper/iflexion/script.js')
  }
}

const homepageHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Custom Software Development | Iflexion</title>
  </head>
  <body>
    <header>
      <a href="/">Iflexion</a>
      <a href="/portfolio">Portfolio</a>
      <a href="/how-we-work">How We Work</a>
      <a href="/contact-us">Contact Us</a>
    </header>
    <main>
      <h1>Custom software development services</h1>
    </main>
  </body>
</html>
`

const sitemapXml = `
<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url><loc>https://www.iflexion.com/</loc></url>
  <url><loc>https://www.iflexion.com/portfolio</loc></url>
  <url><loc>https://www.iflexion.com/services/custom-software-development</loc></url>
  <url><loc>https://www.iflexion.com/blog/jobs-ai-can-not-replace</loc></url>
</urlset>
`

const driftedSitemapXml = `
<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url><loc>https://www.iflexion.com/</loc></url>
  <url><loc>https://www.iflexion.com/careers</loc></url>
</urlset>
`

const notFoundHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Page not found</title>
  </head>
  <body>
    <a href="/">Iflexion</a>
    <h1>404</h1>
    <p>Page not found</p>
  </body>
</html>
`

const publicJobsHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Iflexion Careers</title>
  </head>
  <body>
    <section>
      <h1>Current Openings</h1>
      <a href="https://www.iflexion.com/careers/software-engineer">Apply now</a>
    </section>
  </body>
</html>
`

test('Iflexion sentinel pins the verified official homepage, sitemap, and common missing job routes', async () => {
  const iflexion = await loadIflexionModule()

  assert.equal(iflexion.SOURCE, 'iflexion')
  assert.equal(iflexion.COMPANY, 'Iflexion')
  assert.equal(iflexion.VERIFIED_ON, '2026-07-16')
  assert.equal(iflexion.HOMEPAGE_URL, 'https://www.iflexion.com/')
  assert.equal(iflexion.SITEMAP_URL, 'https://www.iflexion.com/sitemap.xml')
  assert.deepEqual(iflexion.NO_PUBLIC_JOB_ROUTE_URLS, [
    'https://www.iflexion.com/careers',
    'https://www.iflexion.com/careers/',
    'https://www.iflexion.com/jobs',
    'https://www.iflexion.com/jobs/',
    'https://www.iflexion.com/careers-and-jobs',
  ])

  assert.equal(iflexion.hasOfficialHomepageSignal(homepageHtml), true)
  assert.equal(iflexion.hasPublicJobBoardSignal(homepageHtml), false)
  assert.equal(iflexion.hasPublicJobBoardSignal(publicJobsHtml), true)
  assert.equal(iflexion.hasExpectedSitemap(sitemapXml), true)
  assert.equal(iflexion.hasExpectedSitemap(driftedSitemapXml), false)
  assert.equal(
    iflexion.isVerifiedNoPublicJobRoute({
      status: 404,
      url: iflexion.NO_PUBLIC_JOB_ROUTE_URLS[0],
      html: notFoundHtml,
    }),
    true,
  )
  assert.equal(
    iflexion.isVerifiedNoPublicJobRoute({
      status: 200,
      url: iflexion.NO_PUBLIC_JOB_ROUTE_URLS[0],
      html: publicJobsHtml,
    }),
    false,
  )
})

test('Iflexion sentinel returns [] only while the official marketing site stays without public careers routes', async () => {
  const iflexion = await loadIflexionModule()
  const requestedUrls = []

  const jobs = await iflexion.createIflexionScraper().run({
    fetchPage: async (url) => {
      requestedUrls.push(url)

      if (url === iflexion.HOMEPAGE_URL) {
        return { status: 200, url, html: homepageHtml }
      }

      if (url === iflexion.SITEMAP_URL) {
        return { status: 200, url, html: sitemapXml }
      }

      if (iflexion.NO_PUBLIC_JOB_ROUTE_URLS.includes(url)) {
        return { status: 404, url, html: notFoundHtml }
      }

      throw new Error(`Unexpected URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [
    iflexion.HOMEPAGE_URL,
    iflexion.SITEMAP_URL,
    ...iflexion.NO_PUBLIC_JOB_ROUTE_URLS,
  ])
  assert.deepEqual(jobs, [])
})

test('Iflexion sentinel fails closed when the homepage, sitemap, or common job routes drift into a public jobs surface', async () => {
  const iflexion = await loadIflexionModule()

  await assert.rejects(
    iflexion.createIflexionScraper().run({
      fetchPage: async (url) => {
        if (url === iflexion.HOMEPAGE_URL) {
          return { status: 200, url, html: '<html><body>Unexpected</body></html>' }
        }

        throw new Error(`Unexpected URL: ${url}`)
      },
    }),
    /official homepage/i,
  )

  await assert.rejects(
    iflexion.createIflexionScraper().run({
      fetchPage: async (url) => {
        if (url === iflexion.HOMEPAGE_URL) {
          return { status: 200, url, html: homepageHtml }
        }

        if (url === iflexion.SITEMAP_URL) {
          return { status: 200, url, html: driftedSitemapXml }
        }

        throw new Error(`Unexpected URL: ${url}`)
      },
    }),
    /sitemap/i,
  )

  await assert.rejects(
    iflexion.createIflexionScraper().run({
      fetchPage: async (url) => {
        if (url === iflexion.HOMEPAGE_URL) {
          return { status: 200, url, html: homepageHtml }
        }

        if (url === iflexion.SITEMAP_URL) {
          return { status: 200, url, html: sitemapXml }
        }

        if (url === iflexion.NO_PUBLIC_JOB_ROUTE_URLS[0]) {
          return { status: 200, url, html: publicJobsHtml }
        }

        if (iflexion.NO_PUBLIC_JOB_ROUTE_URLS.slice(1).includes(url)) {
          return { status: 404, url, html: notFoundHtml }
        }

        throw new Error(`Unexpected URL: ${url}`)
      },
    }),
    /common job route changed materially or now exposes public jobs/i,
  )
})
