import assert from 'node:assert/strict'
import test from 'node:test'

const homepageHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Top Finance Company in Mumbai, India | Best in Investment &amp; Advisory Services - Edelweiss Finance</title>
  </head>
  <body>
    <nav>
      <a href="/edelweisscareers">Careers</a>
    </nav>
    <main>
      <h1>Top Finance Company in Mumbai, India</h1>
    </main>
  </body>
</html>
`

const informationalCareersHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Careers At Edelweiss</title>
  </head>
  <body>
    <nav>
      <a href="https://www.edelweissfin.com/">Home</a>
      <a href="https://www.edelweissfin.com/edelweisscareers">Careers</a>
    </nav>
    <main>
      <h1>CAREERS AT EDELWEISS</h1>
      <p>
        A professional environment that nurtures your personal and professional aspirations with
        equanimity.
      </p>
      <h2>LIFE AT EDELWEISS</h2>
      <p>Want to join the Edelweiss family? Send your CV to GroupTalent.Acquisition@edelweissfin.com</p>
    </main>
  </body>
</html>
`

const robotsNotFoundHtml = `
<!doctype html>
<html>
  <head><title>404 Not Found</title></head>
  <body><h1>404 Not Found</h1></body>
</html>
`

const sitemapIndexXml = `
<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <sitemap>
    <loc>https://www.edelweissfin.com/post-sitemap.xml</loc>
  </sitemap>
  <sitemap>
    <loc>https://www.edelweissfin.com/page-sitemap.xml</loc>
  </sitemap>
</sitemapindex>
`

const joinUsLandingHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Join us for a Session for EdelweissPartners App Demo Session Part II on 21st Nov, 2020 at 4.30pm - EdelweissFin</title>
  </head>
  <body>
    <main>
      <h1>Join us for a Session</h1>
      <p>Edelweiss event update.</p>
    </main>
  </body>
</html>
`

const publicJobsHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Edelweiss Jobs</title>
    <script type="application/ld+json">
      {"@context":"https://schema.org","@type":"JobPosting","title":"Finance Analyst"}
    </script>
  </head>
  <body>
    <main>
      <h1>Current Openings</h1>
      <a href="https://jobs.lever.co/edelweiss/finance-analyst">Apply now</a>
    </main>
  </body>
</html>
`

const loadModule = async () => {
  try {
    return await import('../../scraper/edelweiss/script.js')
  } catch {
    assert.fail('Expected Edelweiss scraper module at ../../scraper/edelweiss/script.js')
  }
}

test('Edelweiss pins the verified readable homepage, informational careers page, and no-public-job route contract from August 2, 2026', async () => {
  const edelweiss = await loadModule()

  assert.equal(edelweiss.SOURCE, 'edelweiss')
  assert.equal(edelweiss.COMPANY, 'Edelweiss')
  assert.equal(edelweiss.OFFICIAL_BRAND_NAME, 'Edelweiss')
  assert.equal(edelweiss.VERIFIED_AT, '2026-08-02')
  assert.equal(edelweiss.ROOT_URL, 'https://www.edelweissfin.com/')
  assert.equal(edelweiss.CAREERS_URL, 'https://www.edelweissfin.com/edelweisscareers')
  assert.equal(edelweiss.ROBOTS_URL, 'https://www.edelweissfin.com/robots.txt')
  assert.equal(edelweiss.SITEMAP_URL, 'https://www.edelweissfin.com/sitemap.xml')
  assert.equal(edelweiss.SITEMAP_INDEX_URL, 'https://www.edelweissfin.com/sitemap_index.xml')
  assert.equal(edelweiss.APPLICATION_EMAIL, 'GroupTalent.Acquisition@edelweissfin.com')
  assert.equal(
    edelweiss.APPLICATION_URL,
    'mailto:GroupTalent.Acquisition@edelweissfin.com',
  )
  assert.deepEqual(edelweiss.VERIFIED_ROUTE_URLS, [
    'https://www.edelweissfin.com/',
    'https://www.edelweissfin.com/edelweisscareers',
    'https://www.edelweissfin.com/robots.txt',
    'https://www.edelweissfin.com/sitemap.xml',
    'https://www.edelweissfin.com/careers',
    'https://www.edelweissfin.com/career',
    'https://www.edelweissfin.com/jobs',
    'https://www.edelweissfin.com/join-us',
    'https://www.edelweissfin.com/work-with-us',
  ])
  assert.equal(edelweiss.hasOfficialHomepageSignal(homepageHtml), true)
  assert.equal(edelweiss.hasVerifiedInformationalCareersSignal(informationalCareersHtml), true)
  assert.equal(edelweiss.hasPublicJobListingSignal(informationalCareersHtml), false)
  assert.equal(edelweiss.hasMissingRobotsSignal({ status: 404, html: robotsNotFoundHtml }), true)
  assert.equal(
    edelweiss.hasVerifiedSitemapSignal({
      status: 200,
      url: edelweiss.SITEMAP_INDEX_URL,
      html: sitemapIndexXml,
    }),
    true,
  )
  assert.equal(
    edelweiss.isKnownLegacyNoPublicJobRoute({
      status: 200,
      url: edelweiss.ROOT_URL,
      html: homepageHtml,
    }),
    true,
  )
  assert.equal(
    edelweiss.isKnownLegacyNoPublicJobRoute({
      status: 200,
      url: 'https://www.edelweissfin.com/join-us-for-a-session-for-edelweisspartners-app-demo-session-part-ii-on-21st-nov-2020-at-4-30pm/',
      html: joinUsLandingHtml,
    }),
    true,
  )
  assert.equal(edelweiss.hasPublicJobListingSignal(publicJobsHtml), true)
})

test('Edelweiss returns no jobs only while the verified readable no-public-jobs surface remains stable', async () => {
  const edelweiss = await loadModule()
  const requestedUrls = []

  const jobs = await edelweiss.createEdelweissScraper().run({
    fetchPage: async (url) => {
      requestedUrls.push(url)

      if (url === edelweiss.ROOT_URL) {
        return { status: 200, url, html: homepageHtml }
      }

      if (url === edelweiss.CAREERS_URL) {
        return { status: 200, url, html: informationalCareersHtml }
      }

      if (url === edelweiss.ROBOTS_URL) {
        return { status: 404, url, html: robotsNotFoundHtml }
      }

      if (url === edelweiss.SITEMAP_URL) {
        return { status: 200, url: edelweiss.SITEMAP_INDEX_URL, html: sitemapIndexXml }
      }

      if (url === 'https://www.edelweissfin.com/join-us') {
        return {
          status: 200,
          url: 'https://www.edelweissfin.com/join-us-for-a-session-for-edelweisspartners-app-demo-session-part-ii-on-21st-nov-2020-at-4-30pm/',
          html: joinUsLandingHtml,
        }
      }

      if (edelweiss.VERIFIED_ROUTE_URLS.slice(4).includes(url)) {
        return { status: 200, url: edelweiss.ROOT_URL, html: homepageHtml }
      }

      throw new Error(`Unexpected URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, edelweiss.VERIFIED_ROUTE_URLS)
  assert.deepEqual(jobs, [])
})

test('Edelweiss fails closed when the homepage, careers page, sitemap, or legacy no-public-job routes drift', async () => {
  const edelweiss = await loadModule()

  await assert.rejects(
    edelweiss.createEdelweissScraper().run({
      fetchPage: async (url) => {
        if (url === edelweiss.ROOT_URL) {
          return { status: 200, url, html: '<html><body>Unexpected homepage</body></html>' }
        }

        throw new Error(`Unexpected URL: ${url}`)
      },
    }),
    /verified homepage/i,
  )

  await assert.rejects(
    edelweiss.createEdelweissScraper().run({
      fetchPage: async (url) => {
        if (url === edelweiss.ROOT_URL) {
          return { status: 200, url, html: homepageHtml }
        }

        if (url === edelweiss.CAREERS_URL) {
          return { status: 200, url, html: publicJobsHtml }
        }

        throw new Error(`Unexpected URL: ${url}`)
      },
    }),
    /informational careers page|public jobs/i,
  )

  await assert.rejects(
    edelweiss.createEdelweissScraper().run({
      fetchPage: async (url) => {
        if (url === edelweiss.ROOT_URL) return { status: 200, url, html: homepageHtml }
        if (url === edelweiss.CAREERS_URL) return { status: 200, url, html: informationalCareersHtml }
        if (url === edelweiss.ROBOTS_URL) return { status: 404, url, html: robotsNotFoundHtml }
        if (url === edelweiss.SITEMAP_URL) return { status: 200, url, html: '<xml></xml>' }
        throw new Error(`Unexpected URL: ${url}`)
      },
    }),
    /verified sitemap route/i,
  )

  await assert.rejects(
    edelweiss.createEdelweissScraper().run({
      fetchPage: async (url) => {
        if (url === edelweiss.ROOT_URL) return { status: 200, url, html: homepageHtml }
        if (url === edelweiss.CAREERS_URL) return { status: 200, url, html: informationalCareersHtml }
        if (url === edelweiss.ROBOTS_URL) return { status: 404, url, html: robotsNotFoundHtml }
        if (url === edelweiss.SITEMAP_URL) {
          return { status: 200, url: edelweiss.SITEMAP_INDEX_URL, html: sitemapIndexXml }
        }
        if (url === edelweiss.VERIFIED_ROUTE_URLS[4]) {
          return { status: 200, url, html: publicJobsHtml }
        }
        if (edelweiss.VERIFIED_ROUTE_URLS.slice(5).includes(url)) {
          return { status: 200, url: edelweiss.ROOT_URL, html: homepageHtml }
        }
        throw new Error(`Unexpected URL: ${url}`)
      },
    }),
    /legacy career-like route changed materially/i,
  )
})
