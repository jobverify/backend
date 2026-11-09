import assert from 'node:assert/strict'
import test from 'node:test'

const VERIFIED_HOMEPAGE_HTML = `
<!doctype html>
<html lang="en">
  <head>
    <title>Morphle Labs Inc. | Robotic Microtome | Whole Slide Image Scanner & More...</title>
  </head>
  <body>
    <nav>
      <a href="/">Home</a>
      <a href="/about-us">About Us</a>
      <a href="/demo">Schedule Demo</a>
    </nav>
    <main>
      <h1>Morphle Labs</h1>
      <p>Solving bottlenecks in Cancer Diagnostics</p>
      <p>World's first, High Throughput Robotic Microtome</p>
      <p>Digital Pathology</p>
    </main>
  </body>
</html>
`

const VERIFIED_ABOUT_HTML = `
<!doctype html>
<html lang="en">
  <head>
    <title>About Us | Morphle Labs</title>
  </head>
  <body>
    <main>
      <h1>Meet the team</h1>
      <p>Backed by Great Investors</p>
      <p>Our biggest advantage.. 100+ misfits, led by</p>
      <p>We are looking for people to join us on R&amp;D and Growth teams.</p>
      <p>Reach out at - <em>hr@morphlelabs.com</em></p>
    </main>
  </body>
</html>
`

const VERIFIED_SITEMAP_XML = `
<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url><loc>https://morphlelabs.com/</loc></url>
  <url><loc>https://morphlelabs.com/about-us</loc></url>
  <url><loc>https://morphlelabs.com/mech-online-test</loc></url>
</urlset>
`

const VERIFIED_STALE_EVALUATION_HTML = `
<!doctype html>
<html lang="en">
  <head>
    <title>Mech Online Test</title>
  </head>
  <body>
    <div>Welcome to Online evaluation for Mechanical Design Engineering role @ Morphle Labs</div>
    <div>The test has 1 hour window from 2pm-3pm Sunday, 7th Nov, 2021</div>
    <div>The test has 3 questions. Answer as many questions as you can.. good luck!</div>
  </body>
</html>
`

const VERIFIED_404_HTML = `
<!doctype html>
<html lang="en">
  <head>
    <title>404 Not Found</title>
  </head>
  <body>Not Found</body>
</html>
`

const loadMorphleLabsModule = async () => {
  try {
    return await import('../../scraper/morphlelabs/script.js')
  } catch {
    assert.fail('Expected Morphle Labs scraper module at ../../scraper/morphlelabs/script.js')
  }
}

test('Morphle Labs recognizes the verified homepage, about-page hiring surface, sitemap, and stale evaluation page', async () => {
  const morphleLabs = await loadMorphleLabsModule()

  assert.equal(morphleLabs.SOURCE, 'morphlelabs')
  assert.equal(morphleLabs.COMPANY, 'Morphle Labs')
  assert.equal(morphleLabs.HOMEPAGE_URL, 'https://morphlelabs.com/')
  assert.equal(morphleLabs.ABOUT_URL, 'https://morphlelabs.com/about-us')
  assert.equal(morphleLabs.SITEMAP_URL, 'https://morphlelabs.com/sitemap.xml')
  assert.equal(morphleLabs.LEGACY_EVALUATION_URL, 'https://morphlelabs.com/mech-online-test')
  assert.deepEqual(morphleLabs.PUBLIC_JOB_ROUTE_URLS, [
    'https://morphlelabs.com/careers',
    'https://morphlelabs.com/careers/',
    'https://morphlelabs.com/career',
    'https://morphlelabs.com/career/',
    'https://morphlelabs.com/jobs',
    'https://morphlelabs.com/jobs/',
    'https://morphlelabs.com/join-us',
    'https://morphlelabs.com/join-us/',
    'https://morphlelabs.com/work-with-us',
    'https://morphlelabs.com/work-with-us/',
    'https://morphlelabs.com/openings',
    'https://morphlelabs.com/openings/',
  ])
  assert.equal(morphleLabs.hasOfficialHomepageSignal(VERIFIED_HOMEPAGE_HTML), true)
  assert.equal(morphleLabs.hasOfficialAboutHiringSignal(VERIFIED_ABOUT_HTML), true)
  assert.equal(morphleLabs.sitemapHasUnexpectedCareerLikeUrl(VERIFIED_SITEMAP_XML), false)
  assert.equal(morphleLabs.hasStaleLegacyEvaluationSignal(VERIFIED_STALE_EVALUATION_HTML), true)
  assert.equal(morphleLabs.hasPublicJobsSignal(VERIFIED_ABOUT_HTML), false)
})

test('Morphle Labs returns no jobs while the verified first-party zero-job surfaces remain unchanged', async () => {
  const morphleLabs = await loadMorphleLabsModule()
  const requestedUrls = []

  const jobs = await morphleLabs.createMorphleLabsScraper().run({
    fetchPage: async (url) => {
      requestedUrls.push(url)

      if (url === morphleLabs.HOMEPAGE_URL) {
        return { status: 200, url, html: VERIFIED_HOMEPAGE_HTML }
      }

      if (url === morphleLabs.ABOUT_URL) {
        return { status: 200, url, html: VERIFIED_ABOUT_HTML }
      }

      if (url === morphleLabs.SITEMAP_URL) {
        return { status: 200, url, html: VERIFIED_SITEMAP_XML }
      }

      if (url === morphleLabs.LEGACY_EVALUATION_URL) {
        return { status: 200, url, html: VERIFIED_STALE_EVALUATION_HTML }
      }

      if (morphleLabs.PUBLIC_JOB_ROUTE_URLS.includes(url)) {
        return { status: 404, url, html: VERIFIED_404_HTML }
      }

      throw new Error(`Unexpected URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [
    morphleLabs.HOMEPAGE_URL,
    morphleLabs.ABOUT_URL,
    morphleLabs.SITEMAP_URL,
    morphleLabs.LEGACY_EVALUATION_URL,
    ...morphleLabs.PUBLIC_JOB_ROUTE_URLS,
  ])
  assert.deepEqual(jobs, [])
})

test('Morphle Labs fails closed when the trusted public surface changes materially', async () => {
  const morphleLabs = await loadMorphleLabsModule()

  await assert.rejects(
    morphleLabs.createMorphleLabsScraper().run({
      fetchPage: async (url) => {
        if (url === morphleLabs.HOMEPAGE_URL) {
          return { status: 200, url, html: '<html><body>Unexpected homepage</body></html>' }
        }

        if (url === morphleLabs.ABOUT_URL) {
          return { status: 200, url, html: VERIFIED_ABOUT_HTML }
        }

        if (url === morphleLabs.SITEMAP_URL) {
          return { status: 200, url, html: VERIFIED_SITEMAP_XML }
        }

        if (url === morphleLabs.LEGACY_EVALUATION_URL) {
          return { status: 200, url, html: VERIFIED_STALE_EVALUATION_HTML }
        }

        return { status: 404, url, html: VERIFIED_404_HTML }
      },
    }),
    /verified official homepage/i,
  )

  await assert.rejects(
    morphleLabs.createMorphleLabsScraper().run({
      fetchPage: async (url) => {
        if (url === morphleLabs.HOMEPAGE_URL) {
          return { status: 200, url, html: VERIFIED_HOMEPAGE_HTML }
        }

        if (url === morphleLabs.ABOUT_URL) {
          return { status: 200, url, html: '<html><body><p>No hiring contact remains.</p></body></html>' }
        }

        if (url === morphleLabs.SITEMAP_URL) {
          return { status: 200, url, html: VERIFIED_SITEMAP_XML }
        }

        if (url === morphleLabs.LEGACY_EVALUATION_URL) {
          return { status: 200, url, html: VERIFIED_STALE_EVALUATION_HTML }
        }

        return { status: 404, url, html: VERIFIED_404_HTML }
      },
    }),
    /verified about page hiring contact/i,
  )

  await assert.rejects(
    morphleLabs.createMorphleLabsScraper().run({
      fetchPage: async (url) => {
        if (url === morphleLabs.HOMEPAGE_URL) {
          return { status: 200, url, html: VERIFIED_HOMEPAGE_HTML }
        }

        if (url === morphleLabs.ABOUT_URL) {
          return { status: 200, url, html: VERIFIED_ABOUT_HTML }
        }

        if (url === morphleLabs.SITEMAP_URL) {
          return {
            status: 200,
            url,
            html: VERIFIED_SITEMAP_XML.replace(
              '</urlset>',
              '<url><loc>https://morphlelabs.com/careers</loc></url></urlset>',
            ),
          }
        }

        if (url === morphleLabs.LEGACY_EVALUATION_URL) {
          return { status: 200, url, html: VERIFIED_STALE_EVALUATION_HTML }
        }

        return { status: 404, url, html: VERIFIED_404_HTML }
      },
    }),
    /verified sitemap/i,
  )

  await assert.rejects(
    morphleLabs.createMorphleLabsScraper().run({
      fetchPage: async (url) => {
        if (url === morphleLabs.HOMEPAGE_URL) {
          return { status: 200, url, html: VERIFIED_HOMEPAGE_HTML }
        }

        if (url === morphleLabs.ABOUT_URL) {
          return { status: 200, url, html: VERIFIED_ABOUT_HTML }
        }

        if (url === morphleLabs.SITEMAP_URL) {
          return { status: 200, url, html: VERIFIED_SITEMAP_XML }
        }

        if (url === morphleLabs.LEGACY_EVALUATION_URL) {
          return {
            status: 200,
            url,
            html: '<html><body><h1>Current Openings</h1><a href="/jobs/mechanical-design-engineer">Apply now</a></body></html>',
          }
        }

        return { status: 404, url, html: VERIFIED_404_HTML }
      },
    }),
    /legacy evaluation route|public jobs/i,
  )

  await assert.rejects(
    morphleLabs.createMorphleLabsScraper().run({
      fetchPage: async (url) => {
        if (url === morphleLabs.HOMEPAGE_URL) {
          return { status: 200, url, html: VERIFIED_HOMEPAGE_HTML }
        }

        if (url === morphleLabs.ABOUT_URL) {
          return { status: 200, url, html: VERIFIED_ABOUT_HTML }
        }

        if (url === morphleLabs.SITEMAP_URL) {
          return { status: 200, url, html: VERIFIED_SITEMAP_XML }
        }

        if (url === morphleLabs.LEGACY_EVALUATION_URL) {
          return { status: 200, url, html: VERIFIED_STALE_EVALUATION_HTML }
        }

        if (url === morphleLabs.PUBLIC_JOB_ROUTE_URLS[0]) {
          return { status: 200, url, html: '<html><body><h1>Careers</h1><a href="/apply">Apply now</a></body></html>' }
        }

        return { status: 404, url, html: VERIFIED_404_HTML }
      },
    }),
    /missing-public-jobs route|public jobs/i,
  )
})
