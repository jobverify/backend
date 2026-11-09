import assert from 'node:assert/strict'
import test from 'node:test'

import { classifyScraperError } from '../../scraper-support/utils/failureClassification.js'

const loadModule = async () => {
  try {
    return await import('./script.js')
  } catch {
    return null
  }
}

const homepageHtml = `
  <!doctype html>
  <html lang="en">
    <head>
      <title>NxtSync - Courses &amp; Internships</title>
    </head>
    <body>
      <header>
        <nav>
          <a href="index.html">Home</a>
          <a href="courses/index.html">Courses</a>
          <a href="about/index.html">About</a>
          <a href="contact/index.html">Contact</a>
        </nav>
      </header>
      <main>
        <h1>NxtSync</h1>
        <p>Upskill with practical learning paths.</p>
        <a href="https://lms.nxtsync.in/">LMS</a>
        <a href="mailto:support@nxtsync.in">support@nxtsync.in</a>
        <a href="tel:+916302655033">+91 63026 55033</a>
        <a href="https://linkedin.com/company/nxtsync">LinkedIn</a>
      </main>
    </body>
  </html>
`

const homepageHtmlWithSplitPhone = homepageHtml.replace(
  '+91 63026 55033',
  '+91 <span>63026</span> 55033',
)
const homepageHtmlWithCompactPhone = homepageHtml.replace(
  '+91 63026 55033',
  '+916302655033',
)

const careers404Html = `
  <!doctype html>
  <html lang="en">
    <head>
      <title>404 Not Found</title>
    </head>
    <body>
      <h1>Not Found</h1>
      <p>The requested URL was not found on this server.</p>
    </body>
  </html>
`

const sucuriChallengeHtml = `
  <html>
    <title>You are being redirected...</title>
    <noscript>Javascript is required. Please enable javascript before you are allowed to see this page.</noscript>
    <script>
      var sucuri_cloudproxy_js = "";
      document.cookie = "sucuri_cloudproxy_uuid=verified";
    </script>
  </html>
`

test('Nxtsync sentinel validates the verified homepage and missing careers routes contract', async () => {
  const nxtsync = await loadModule()
  assert.ok(nxtsync, 'Nxtsync scraper module should load')

  assert.equal(nxtsync.SOURCE, 'nxtsyncpvtltd')
  assert.equal(nxtsync.COMPANY, 'Nxtsync Pvt Ltd')
  assert.equal(nxtsync.HOMEPAGE_URL, 'https://nxtsync.in/')
  assert.deepEqual(nxtsync.NO_PUBLIC_CAREERS_ROUTE_URLS, [
    'https://nxtsync.in/careers',
    'https://nxtsync.in/career',
    'https://nxtsync.in/jobs',
    'https://nxtsync.in/join-us',
  ])
  assert.equal(nxtsync.hasOfficialHomepageSignal(homepageHtml), true)
  assert.equal(nxtsync.hasOfficialHomepageSignal(homepageHtmlWithSplitPhone), true)
  assert.equal(nxtsync.hasOfficialHomepageSignal(homepageHtmlWithCompactPhone), true)
  assert.equal(nxtsync.hasFirstPartyCareerLikeLink(homepageHtml), false)
  assert.equal(nxtsync.hasPublicJobsSignal(homepageHtml), false)
  assert.equal(
    nxtsync.isVerifiedMissingCareersRoute({
      status: 404,
      url: nxtsync.NO_PUBLIC_CAREERS_ROUTE_URLS[0],
      html: careers404Html,
    }),
    true,
  )
})

test('Nxtsync sentinel returns no jobs only while the verified no-public-jobs contract remains intact', async () => {
  const nxtsync = await loadModule()
  assert.ok(nxtsync, 'Nxtsync scraper module should load')

  const requestedUrls = []
  const jobs = await nxtsync.createNxtsyncScraper().run({
    fetchPage: async (url) => {
      requestedUrls.push(url)

      if (url === nxtsync.HOMEPAGE_URL) {
        return { status: 200, url, html: homepageHtml }
      }

      if (nxtsync.NO_PUBLIC_CAREERS_ROUTE_URLS.includes(url)) {
        return { status: 404, url, html: careers404Html }
      }

      throw new Error(`Unexpected URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [
    nxtsync.HOMEPAGE_URL,
    ...nxtsync.NO_PUBLIC_CAREERS_ROUTE_URLS,
  ])
  assert.deepEqual(jobs, [])
})

test('Nxtsync reports the current Sucuri challenge as an upstream access block', async () => {
  const nxtsync = await loadModule()
  assert.ok(nxtsync, 'Nxtsync scraper module should load')

  await assert.rejects(
    nxtsync.createNxtsyncScraper().run({
      fetchPage: async (url) => ({
        status: 307,
        url,
        html: sucuriChallengeHtml,
      }),
    }),
    (error) => {
      const classification = classifyScraperError(error)

      assert.match(error.message, /Sucuri access challenge/i)
      assert.equal(classification.softFailure, true)
      assert.equal(classification.upstreamOutage, true)
      assert.equal(classification.failureKind, 'blocked_or_access_denied')
      return true
    },
  )
})

test('Nxtsync sentinel fails closed when the homepage or careers-route contract changes', async () => {
  const nxtsync = await loadModule()
  assert.ok(nxtsync, 'Nxtsync scraper module should load')

  await assert.rejects(
    nxtsync.createNxtsyncScraper().run({
      fetchPage: async (url) => {
        if (url === nxtsync.HOMEPAGE_URL) {
          return { status: 200, url, html: '<html><body><h1>Placeholder</h1></body></html>' }
        }

        return { status: 404, url, html: careers404Html }
      },
    }),
    /verified official homepage/i,
  )

  await assert.rejects(
    nxtsync.createNxtsyncScraper().run({
      fetchPage: async (url) => {
        if (url === nxtsync.HOMEPAGE_URL) {
          return {
            status: 200,
            url,
            html: homepageHtml.replace(
              '</nav>',
              '<a href="/careers">Careers</a></nav>',
            ),
          }
        }

        return { status: 404, url, html: careers404Html }
      },
    }),
    /first-party careers or jobs link/i,
  )

  await assert.rejects(
    nxtsync.createNxtsyncScraper().run({
      fetchPage: async (url) => {
        if (url === nxtsync.HOMEPAGE_URL) {
          return { status: 200, url, html: homepageHtml }
        }

        if (url === nxtsync.NO_PUBLIC_CAREERS_ROUTE_URLS[0]) {
          return {
            status: 200,
            url,
            html: '<html><body><h1>Current Openings</h1><a href="/apply">Apply now</a></body></html>',
          }
        }

        return { status: 404, url, html: careers404Html }
      },
    }),
    /careers routes changed materially or now expose public jobs/i,
  )
})
