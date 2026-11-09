import assert from 'node:assert/strict'
import test from 'node:test'

const homepageHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>The Most Intuitive Learning Management System for Modern Teams</title>
  </head>
  <body>
    <nav>
      <a href="/about/">About</a>
      <a href="/contact/">Contact</a>
      <a href="/careers/">Careers</a>
    </nav>
    <main>
      <h1>The Most Intuitive Learning Management System for Modern Teams</h1>
      <p>An all-in-one LMS</p>
    </main>
  </body>
</html>
`

const careersHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Auzmor Hire - Powerfully Integrating Your ATS &amp; Careers Page</title>
    <link rel="canonical" href="https://auzmor.com/careers/" />
  </head>
  <body>
    <main>
      <h1>Help us shape the future</h1>
      <h2>Why join Auzmor</h2>
      <p>Join an innovative team</p>
      <a href="/careers/">We are hiring</a>
      <a href="/contact/">Contact us</a>
      <a href="/contact/">Free Trial</a>
    </main>
  </body>
</html>
`

const publicJobsCareersHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Auzmor Hire - Powerfully Integrating Your ATS &amp; Careers Page</title>
  </head>
  <body>
    <main>
      <h1>Help us shape the future</h1>
      <section>
        <h2>Open Positions</h2>
        <a href="https://boards.greenhouse.io/auzmor/jobs/12345">Apply now</a>
      </section>
    </main>
  </body>
</html>
`

const pageSitemapXml = `
<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url><loc>https://auzmor.com/</loc></url>
  <url><loc>https://auzmor.com/about/</loc></url>
  <url><loc>https://auzmor.com/contact/</loc></url>
  <url><loc>https://auzmor.com/careers/</loc></url>
</urlset>
`

const driftedPageSitemapXml = `
<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url><loc>https://auzmor.com/</loc></url>
  <url><loc>https://auzmor.com/careers/</loc></url>
  <url><loc>https://auzmor.com/careers/software-engineer/</loc></url>
</urlset>
`

const missingRouteHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Page Not Found - auzmor</title>
  </head>
  <body>
    <h1>Page Not Found</h1>
  </body>
</html>
`

const loadAuzmorModule = async () => {
  try {
    return await import('../../scraper/auzmor/script.js')
  } catch {
    assert.fail('Expected Auzmor scraper module at ../../scraper/auzmor/script.js')
  }
}

test('Auzmor constants stay pinned to the verified homepage, careers marketing page, sitemap, and adjacent routes', async () => {
  const auzmor = await loadAuzmorModule()

  assert.equal(auzmor.SOURCE, 'auzmor')
  assert.equal(auzmor.COMPANY, 'Auzmor')
  assert.equal(auzmor.OFFICIAL_BRAND_NAME, 'Auzmor')
  assert.equal(auzmor.VERIFIED_ON, '2026-11-02')
  assert.equal(auzmor.HOMEPAGE_URL, 'https://auzmor.com/')
  assert.equal(auzmor.CAREERS_PAGE_URL, 'https://auzmor.com/careers/')
  assert.equal(auzmor.PAGE_SITEMAP_URL, 'https://auzmor.com/page-sitemap.xml')
  assert.deepEqual(auzmor.SITEMAP_CAREER_ROUTE_URLS, ['https://auzmor.com/careers/'])
  assert.deepEqual(auzmor.CAREER_ALIAS_ROUTE_URLS, ['https://auzmor.com/career'])
  assert.deepEqual(auzmor.NO_PUBLIC_JOB_ROUTE_URLS, [
    'https://auzmor.com/jobs',
    'https://auzmor.com/join-us',
    'https://auzmor.com/work-with-us',
    'https://auzmor.com/openings',
    'https://auzmor.com/current-openings',
    'https://auzmor.com/company/careers',
    'https://auzmor.com/about/careers',
  ])
  assert.match(auzmor.VERIFIED_SURFACE_SUMMARY, /same-company Auzmor Hire widget/i)
  assert.equal(auzmor.hasOfficialHomepageSignal(homepageHtml), true)
  assert.equal(auzmor.hasOfficialCareersSignal(careersHtml), true)
  assert.equal(auzmor.hasExpectedCareerRouteSet(pageSitemapXml), true)
  assert.equal(auzmor.hasExpectedCareerRouteSet(driftedPageSitemapXml), false)
  assert.deepEqual(auzmor.extractPublicJobLinks(careersHtml), [])
  assert.deepEqual(auzmor.extractPublicJobLinks(publicJobsCareersHtml), [
    'https://boards.greenhouse.io/auzmor/jobs/12345',
  ])
  assert.equal(
    auzmor.isVerifiedCareerAliasPage({
      status: 200,
      url: auzmor.CAREERS_PAGE_URL,
      html: careersHtml,
    }),
    true,
  )
  assert.equal(
    auzmor.isVerifiedMissingPublicJobRoute({
      status: 404,
      url: auzmor.NO_PUBLIC_JOB_ROUTE_URLS[0],
      html: missingRouteHtml,
    }),
    true,
  )
})

test('Auzmor sentinel returns [] only while the verified careers marketing surface remains unchanged', async () => {
  const auzmor = await loadAuzmorModule()
  const requestedUrls = []

  const jobs = await auzmor.createAuzmorScraper().run({
    fetchPage: async (url) => {
      requestedUrls.push(url)

      if (url === auzmor.HOMEPAGE_URL) {
        return { status: 200, url, html: homepageHtml }
      }

      if (url === auzmor.CAREERS_PAGE_URL) {
        return { status: 200, url, html: careersHtml }
      }

      if (url === auzmor.PAGE_SITEMAP_URL) {
        return { status: 200, url, html: pageSitemapXml }
      }

      if (auzmor.CAREER_ALIAS_ROUTE_URLS.includes(url)) {
        return { status: 200, url: auzmor.CAREERS_PAGE_URL, html: careersHtml }
      }

      if (auzmor.NO_PUBLIC_JOB_ROUTE_URLS.includes(url)) {
        return { status: 404, url, html: missingRouteHtml }
      }

      throw new Error(`Unexpected URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [
    auzmor.HOMEPAGE_URL,
    auzmor.CAREERS_PAGE_URL,
    auzmor.PAGE_SITEMAP_URL,
    ...auzmor.CAREER_ALIAS_ROUTE_URLS,
    ...auzmor.NO_PUBLIC_JOB_ROUTE_URLS,
  ])
  assert.deepEqual(jobs, [])
})

test('Auzmor sentinel fails closed when the homepage, careers page, sitemap, alias route, or adjacent routes drift into public jobs', async () => {
  const auzmor = await loadAuzmorModule()

  await assert.rejects(
    auzmor.createAuzmorScraper().run({
      fetchPage: async (url) => {
        if (url === auzmor.HOMEPAGE_URL) {
          return { status: 200, url, html: '<html><body><h1>Unexpected homepage</h1></body></html>' }
        }

        throw new Error(`Unexpected URL: ${url}`)
      },
    }),
    /official homepage/i,
  )

  await assert.rejects(
    auzmor.createAuzmorScraper().run({
      fetchPage: async (url) => {
        if (url === auzmor.HOMEPAGE_URL) {
          return { status: 200, url, html: homepageHtml }
        }

        if (url === auzmor.CAREERS_PAGE_URL) {
          return { status: 200, url, html: publicJobsCareersHtml }
        }

        throw new Error(`Unexpected URL: ${url}`)
      },
    }),
    /careers marketing page/i,
  )

  await assert.rejects(
    auzmor.createAuzmorScraper().run({
      fetchPage: async (url) => {
        if (url === auzmor.HOMEPAGE_URL) {
          return { status: 200, url, html: homepageHtml }
        }

        if (url === auzmor.CAREERS_PAGE_URL) {
          return { status: 200, url, html: careersHtml }
        }

        if (url === auzmor.PAGE_SITEMAP_URL) {
          return { status: 200, url, html: driftedPageSitemapXml }
        }

        throw new Error(`Unexpected URL: ${url}`)
      },
    }),
    /page sitemap/i,
  )

  await assert.rejects(
    auzmor.createAuzmorScraper().run({
      fetchPage: async (url) => {
        if (url === auzmor.HOMEPAGE_URL) {
          return { status: 200, url, html: homepageHtml }
        }

        if (url === auzmor.CAREERS_PAGE_URL) {
          return { status: 200, url, html: careersHtml }
        }

        if (url === auzmor.PAGE_SITEMAP_URL) {
          return { status: 200, url, html: pageSitemapXml }
        }

        if (url === auzmor.CAREER_ALIAS_ROUTE_URLS[0]) {
          return { status: 200, url, html: publicJobsCareersHtml }
        }

        throw new Error(`Unexpected URL: ${url}`)
      },
    }),
    /career alias route changed materially or now exposes public jobs/i,
  )

  await assert.rejects(
    auzmor.createAuzmorScraper().run({
      fetchPage: async (url) => {
        if (url === auzmor.HOMEPAGE_URL) {
          return { status: 200, url, html: homepageHtml }
        }

        if (url === auzmor.CAREERS_PAGE_URL) {
          return { status: 200, url, html: careersHtml }
        }

        if (url === auzmor.PAGE_SITEMAP_URL) {
          return { status: 200, url, html: pageSitemapXml }
        }

        if (auzmor.CAREER_ALIAS_ROUTE_URLS.includes(url)) {
          return { status: 200, url: auzmor.CAREERS_PAGE_URL, html: careersHtml }
        }

        if (url === auzmor.NO_PUBLIC_JOB_ROUTE_URLS[0]) {
          return { status: 200, url, html: publicJobsCareersHtml }
        }

        if (auzmor.NO_PUBLIC_JOB_ROUTE_URLS.slice(1).includes(url)) {
          return { status: 404, url, html: missingRouteHtml }
        }

        throw new Error(`Unexpected URL: ${url}`)
      },
    }),
    /adjacent job route changed materially or now exposes public jobs/i,
  )
})
