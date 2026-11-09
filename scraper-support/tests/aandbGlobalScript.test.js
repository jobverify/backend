import assert from 'node:assert/strict'
import test from 'node:test'

const loadAandbGlobalModule = async () => {
  try {
    return await import('../../scraper/aandbglobal/script.js')
  } catch {
    assert.fail('Expected A&B Global scraper module at ../../scraper/aandbglobal/script.js')
  }
}

const homepageHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>A&amp;B GLOBAL LTD | One Step Away From Excellence</title>
  </head>
  <body>
    <nav>
      <a href="#about">About</a>
      <a href="#workwithus">Work With Us</a>
    </nav>
    <main>
      <h1>A&amp;B Global Education</h1>
      <section>
        <h2>Welcome to A&amp;B Global</h2>
        <p>Welcome to A&amp;B Global, a beacon of guidance and support for individuals embarking on the transformative journey of education and career advancement.</p>
      </section>
      <section id="workwithus" class="popup">
        <h1 class="cta-block__heading">Join with Us as A Partner</h1>
        <h3 class="cta-block__text">Contact our admission counseller and get a free consultation</h3>
        <form>
          <label>Name</label>
          <label>Business Name</label>
          <label>Ask us anything...</label>
        </form>
      </section>
      <footer>
        <a href="mailto:admin@aandbglobal.com">admin@aandbglobal.com</a>
      </footer>
    </main>
  </body>
</html>
`

const sitemapXml = `
<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>https://aandbglobal.com/</loc>
    <lastmod>2024-08-15T03:22:18+00:00</lastmod>
  </url>
</urlset>
`

const publicJobsHomepageHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>A&amp;B GLOBAL LTD | One Step Away From Excellence</title>
  </head>
  <body>
    <nav>
      <a href="#workwithus">Work With Us</a>
    </nav>
    <main>
      <h1>A&amp;B Global Education</h1>
      <section>
        <h2>Welcome to A&amp;B Global</h2>
        <p>Welcome to A&amp;B Global, a beacon of guidance and support for individuals embarking on the transformative journey of education and career advancement.</p>
      </section>
      <section id="workwithus" class="popup">
        <h1 class="cta-block__heading">Join with Us as A Partner</h1>
        <h3 class="cta-block__text">Contact our admission counseller and get a free consultation</h3>
        <form>
          <label>Business Name</label>
          <label>Ask us anything...</label>
        </form>
      </section>
      <section>
        <h2>Current Openings</h2>
        <article>
          <h3>Student Counsellor</h3>
          <a href="/careers/student-counsellor">Apply now</a>
        </article>
      </section>
      <footer>
        <a href="mailto:admin@aandbglobal.com">admin@aandbglobal.com</a>
      </footer>
    </main>
  </body>
</html>
`

const missingRouteHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>404 Not Found | A&amp;B GLOBAL LTD</title>
  </head>
  <body>
    <h1>No Results Found</h1>
  </body>
</html>
`

const driftedSitemapXml = `
<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>https://aandbglobal.com/</loc>
  </url>
  <url>
    <loc>https://aandbglobal.com/careers/</loc>
  </url>
</urlset>
`

const unavailableHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Site Currently Unavailable</title>
  </head>
  <body>
    <h1>Site Currently Unavailable</h1>
    <p>Please check back later.</p>
  </body>
</html>
`

test('A&B Global sentinel pins the verified official homepage, partner popup, sitemap, and adjacent first-party routes', async () => {
  const aandb = await loadAandbGlobalModule()

  assert.equal(aandb.SOURCE, 'aandbglobal')
  assert.equal(aandb.COMPANY, 'A&B Global')
  assert.equal(aandb.VERIFIED_AT, '2026-07-14')
  assert.equal(aandb.HOMEPAGE_URL, 'https://aandbglobal.com/')
  assert.equal(aandb.WORK_WITH_US_ANCHOR_URL, 'https://aandbglobal.com/#workwithus')
  assert.equal(aandb.SITEMAP_URL, 'https://aandbglobal.com/wp-sitemap-posts-page-1.xml')
  assert.deepEqual(aandb.NO_PUBLIC_JOB_ROUTE_URLS, [
    'https://aandbglobal.com/career/',
    'https://aandbglobal.com/careers/',
    'https://aandbglobal.com/jobs/',
    'https://aandbglobal.com/job-openings/',
    'https://aandbglobal.com/work-with-us/',
    'https://aandbglobal.com/workwithus/',
    'https://aandbglobal.com/join-us/',
  ])

  assert.equal(aandb.hasOfficialHomepageSignal(homepageHtml), true)
  assert.equal(aandb.hasWorkWithUsPartnerSignal(homepageHtml), true)
  assert.equal(aandb.hasPublicJobBoardSignal(homepageHtml), false)
  assert.equal(aandb.hasPublicJobBoardSignal(publicJobsHomepageHtml), true)
  assert.equal(aandb.hasSingleHomepageSitemap(sitemapXml), true)
  assert.equal(aandb.hasSingleHomepageSitemap(driftedSitemapXml), false)
  assert.equal(aandb.isVerifiedMissingPublicJobRoute({ status: 404, html: missingRouteHtml }), true)
  assert.equal(aandb.isVerifiedMissingPublicJobRoute({ status: 200, html: publicJobsHomepageHtml }), false)
  assert.equal(
    aandb.isTemporarilyUnavailableFirstPartyResponse({ status: 503, url: aandb.HOMEPAGE_URL, html: unavailableHtml }),
    true,
  )
})

test('A&B Global sentinel returns [] only while the verified homepage-only no-jobs surface remains unchanged', async () => {
  const aandb = await loadAandbGlobalModule()
  const requestedUrls = []

  const jobs = await aandb.createAandbGlobalScraper().run({
    fetchPage: async (url) => {
      requestedUrls.push(url)

      if (url === aandb.HOMEPAGE_URL) {
        return { status: 200, url, html: homepageHtml }
      }

      if (url === aandb.SITEMAP_URL) {
        return { status: 200, url, html: sitemapXml }
      }

      if (aandb.NO_PUBLIC_JOB_ROUTE_URLS.includes(url)) {
        return { status: 404, url, html: missingRouteHtml }
      }

      throw new Error(`Unexpected URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [
    aandb.HOMEPAGE_URL,
    aandb.SITEMAP_URL,
    ...aandb.NO_PUBLIC_JOB_ROUTE_URLS,
  ])
  assert.deepEqual(jobs, [])
})

test('A&B Global sentinel fails closed when the homepage, popup, sitemap, or common job routes drift into a public jobs surface', async () => {
  const aandb = await loadAandbGlobalModule()

  await assert.rejects(
    aandb.createAandbGlobalScraper().run({
      fetchPage: async (url) => {
        if (url === aandb.HOMEPAGE_URL) {
          return { status: 200, url, html: '<html><body><h1>A&B Global</h1></body></html>' }
        }

        throw new Error(`Unexpected URL: ${url}`)
      },
    }),
    /official homepage/i,
  )

  await assert.rejects(
    aandb.createAandbGlobalScraper().run({
      fetchPage: async (url) => {
        if (url === aandb.HOMEPAGE_URL) {
          return { status: 200, url, html: publicJobsHomepageHtml }
        }

        if (url === aandb.SITEMAP_URL) {
          return { status: 200, url, html: sitemapXml }
        }

        throw new Error(`Unexpected URL: ${url}`)
      },
    }),
    /homepage now exposes a public jobs surface/i,
  )

  await assert.rejects(
    aandb.createAandbGlobalScraper().run({
      fetchPage: async (url) => {
        if (url === aandb.HOMEPAGE_URL) {
          return { status: 200, url, html: homepageHtml }
        }

        if (url === aandb.SITEMAP_URL) {
          return { status: 200, url, html: driftedSitemapXml }
        }

        throw new Error(`Unexpected URL: ${url}`)
      },
    }),
    /sitemap/i,
  )

  await assert.rejects(
    aandb.createAandbGlobalScraper().run({
      fetchPage: async (url) => {
        if (url === aandb.HOMEPAGE_URL) {
          return { status: 200, url, html: homepageHtml }
        }

        if (url === aandb.SITEMAP_URL) {
          return { status: 200, url, html: sitemapXml }
        }

        if (url === aandb.NO_PUBLIC_JOB_ROUTE_URLS[0]) {
          return { status: 200, url, html: publicJobsHomepageHtml }
        }

        if (aandb.NO_PUBLIC_JOB_ROUTE_URLS.slice(1).includes(url)) {
          return { status: 404, url, html: missingRouteHtml }
        }

        throw new Error(`Unexpected URL: ${url}`)
      },
    }),
    /common job route changed materially or now exposes public jobs/i,
  )
})

test('A&B Global sentinel returns [] when every verified no-public-jobs surface is temporarily unavailable from this runtime', async () => {
  const aandb = await loadAandbGlobalModule()
  const requestedUrls = []

  const jobs = await aandb.createAandbGlobalScraper().run({
    fetchPage: async (url) => {
      requestedUrls.push(url)
      return { status: 503, url, html: unavailableHtml }
    },
  })

  assert.deepEqual(requestedUrls, [
    aandb.HOMEPAGE_URL,
    aandb.SITEMAP_URL,
    ...aandb.NO_PUBLIC_JOB_ROUTE_URLS,
  ])
  assert.deepEqual(jobs, [])
})
