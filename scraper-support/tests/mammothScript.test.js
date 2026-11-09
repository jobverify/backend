import assert from 'node:assert/strict'
import test from 'node:test'

const homepageHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Mammoth Analytics — Data Prep, Automation &amp; Dashboards</title>
  </head>
  <body>
    <h1>Your whole data journey. One platform.</h1>
    <p>Connect, prepare, automate, govern, share — every step in one place.</p>
    <p>No shuttling files between tools. No handoffs. No waiting on a ticket.</p>
    <p>No credit card to start</p>
    <a href="https://mammoth.io/about/">About</a>
    <a href="https://mammoth.io/book-demo/">Book a demo</a>
  </body>
</html>
`

const aboutHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>About · Mammoth</title>
  </head>
  <body>
    <p>Made in London since 2017. Mammoth builds data preparation and automation for business teams.</p>
    <p>Four opinions the product is built on.</p>
    <p>The handoffs are the problem.</p>
  </body>
</html>
`

const missingRouteHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Mammoth Analytics — Data Prep, Automation &amp; Dashboards</title>
  </head>
  <body>
    <h1>404</h1>
    <p>That page doesn&apos;t exist.</p>
    <p>Here&apos;s where most people are heading.</p>
  </body>
</html>
`

const loadMammothModule = async () => {
  try {
    return await import('../../scraper/mammoth/script.js')
  } catch {
    assert.fail('Expected Mammoth scraper module at ../../scraper/mammoth/script.js')
  }
}

test('Mammoth sentinel pins the verified first-party no-public-jobs surface from Thursday, July 16, 2026', async () => {
  const mammoth = await loadMammothModule()

  assert.equal(mammoth.SOURCE, 'mammoth')
  assert.equal(mammoth.COMPANY, 'Mammoth')
  assert.equal(mammoth.OFFICIAL_BRAND_NAME, 'Mammoth Analytics')
  assert.equal(mammoth.VERIFIED_ON, '2026-07-16')
  assert.equal(mammoth.HOMEPAGE_URL, 'https://mammoth.io/')
  assert.equal(mammoth.ABOUT_URL, 'https://mammoth.io/about-us/')
  assert.deepEqual(mammoth.CAREERS_ROUTE_URLS, [
    'https://mammoth.io/careers',
    'https://mammoth.io/jobs',
    'https://mammoth.io/join-us',
    'https://mammoth.io/team',
  ])
  assert.match(mammoth.VERIFIED_SURFACE_SUMMARY, /no trustworthy public jobs surface/i)

  assert.equal(mammoth.hasOfficialHomepageSignal(homepageHtml), true)
  assert.equal(mammoth.hasOfficialAboutSignal(aboutHtml), true)
  assert.equal(mammoth.hasFirstPartyCareerLikeLink(homepageHtml), false)
  assert.equal(mammoth.hasFirstPartyCareerLikeLink('<a href="https://mammoth.io/careers">Careers</a>'), true)
  assert.equal(mammoth.hasPublicJobsSignal(homepageHtml), false)
  assert.equal(
    mammoth.hasPublicJobsSignal('<html><body><h1>Current openings</h1><a href="https://jobs.lever.co/mammoth">Apply now</a></body></html>'),
    true,
  )
  assert.equal(
    mammoth.isVerifiedMissingFirstPartyRoute({
      status: 404,
      url: mammoth.CAREERS_ROUTE_URLS[0],
      html: missingRouteHtml,
    }),
    true,
  )
})

test('Mammoth accepts the current stable product identity without requiring campaign copy', async () => {
  const mammoth = await loadMammothModule()
  const currentHomepage = homepageHtml
    .replace('Mammoth Analytics — Data Prep, Automation &amp; Dashboards', 'Mammoth Analytics: Data Prep, Automation &amp; Dashboards')
    .replace('No credit card to start', 'The data platform that means business. Pipelines, Automations, and Dashboards.')

  assert.equal(mammoth.hasOfficialHomepageSignal(currentHomepage), true)
})

test('Mammoth sentinel returns [] only while the verified first-party surface exposes no public jobs board', async () => {
  const mammoth = await loadMammothModule()
  const requestedUrls = []

  const jobs = await mammoth.createMammothScraper().run({
    fetchPage: async (url) => {
      requestedUrls.push(url)

      if (url === mammoth.HOMEPAGE_URL) {
        return { status: 200, url, html: homepageHtml }
      }

      if (url === mammoth.ABOUT_URL) {
        return { status: 200, url, html: aboutHtml }
      }

      if (mammoth.CAREERS_ROUTE_URLS.includes(url)) {
        return { status: 404, url, html: missingRouteHtml }
      }

      throw new Error(`Unexpected Mammoth URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [
    mammoth.HOMEPAGE_URL,
    mammoth.ABOUT_URL,
    ...mammoth.CAREERS_ROUTE_URLS,
  ])
  assert.deepEqual(jobs, [])
})

test('Mammoth sentinel fails closed when the first-party surface drifts into public jobs', async () => {
  const mammoth = await loadMammothModule()

  await assert.rejects(
    mammoth.createMammothScraper().run({
      fetchPage: async (url) => {
        if (url === mammoth.HOMEPAGE_URL) {
          return {
            status: 200,
            url,
            html: `${homepageHtml}<a href="https://mammoth.io/careers">Careers</a>`,
          }
        }

        throw new Error(`Unexpected Mammoth URL: ${url}`)
      },
    }),
    /homepage now exposes a first-party careers or jobs link/i,
  )

  await assert.rejects(
    mammoth.createMammothScraper().run({
      fetchPage: async (url) => {
        if (url === mammoth.HOMEPAGE_URL) {
          return { status: 200, url, html: homepageHtml }
        }

        if (url === mammoth.ABOUT_URL) {
          return { status: 200, url, html: aboutHtml }
        }

        if (url === mammoth.CAREERS_ROUTE_URLS[0]) {
          return {
            status: 200,
            url,
            html: '<html><body><h1>Current openings</h1><a href="https://jobs.lever.co/mammoth">Apply now</a></body></html>',
          }
        }

        return { status: 404, url, html: missingRouteHtml }
      },
    }),
    /careers route changed materially or now exposes public jobs/i,
  )
})
