import assert from 'node:assert/strict'
import test from 'node:test'

import { readInventoryEvidence } from '../../scraper-support/utils/inventoryEvidence.js'

const loadTerraEagleModule = async () => {
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
    <title>Home - Terraeagle</title>
  </head>
  <body>
    <header>
      <a href="https://terraeagle.com/">Home</a>
      <a href="https://terraeagle.com/about-terraeagle/">About</a>
      <a href="https://terraeagle.com/careers/">Careers</a>
    </header>
    <main>
      <h1>Terraeagle</h1>
      <p>Zero Trust Network Access</p>
      <p>OT Security</p>
    </main>
  </body>
</html>
`

const aboutHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>About Terraeagle - Terraeagle</title>
  </head>
  <body>
    <main>
      <h1>About Terraeagle</h1>
      <p>Zero Trust Network Access</p>
      <p>Cyber Risk and Insurance</p>
    </main>
  </body>
</html>
`

const careersHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Careers - Terraeagle</title>
  </head>
  <body>
    <main>
      <h1>Careers</h1>
      <p>Zero Trust Network Access</p>
      <p>OT Security</p>
    </main>
  </body>
</html>
`

const brokenJobsRoute = {
  status: 200,
  url: 'https://terraeagle.com/404-error/',
  html: '<html><head><title>404 - Terraeagle</title></head><body><h1>404</h1><p>Page not found</p></body></html>',
}

const compromisedHomepageHtml = homepageHtml.replace(
  '<title>Home - Terraeagle</title>',
  '<title>Home - hacked by trenggalek6etar</title>',
)

const publicJobsCareersHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Careers - Terraeagle</title>
  </head>
  <body>
    <main>
      <h1>Current Openings</h1>
      <div class="awsm-job-listings">
        <a href="/job/drone-engineer">Apply now</a>
      </div>
    </main>
  </body>
</html>
`

test('Terraeagle sentinel recognizes the verified homepage, about page, careers shell, and broken jobs route', async () => {
  const terraeagle = await loadTerraEagleModule()
  assert.ok(terraeagle, 'Expected scraper module at ./script.js')

  assert.equal(terraeagle.SOURCE, 'terraeagle')
  assert.equal(terraeagle.COMPANY, 'Terraeagle')
  assert.equal(terraeagle.HOMEPAGE_URL, 'https://terraeagle.com/')
  assert.equal(terraeagle.ABOUT_URL, 'https://terraeagle.com/about-terraeagle/')
  assert.equal(terraeagle.CAREERS_URL, 'https://terraeagle.com/careers/')
  assert.equal(terraeagle.BROKEN_JOBS_URL, 'https://terraeagle.com/jobs/')
  assert.equal(terraeagle.hasOfficialHomepageSignal(homepageHtml), true)
  assert.equal(terraeagle.hasOfficialAboutSignal(aboutHtml), true)
  assert.equal(terraeagle.hasVerifiedCareersShellSignal(careersHtml), true)
  assert.equal(terraeagle.hasPublicJobsSignal(publicJobsCareersHtml), true)
  assert.equal(terraeagle.isVerifiedBrokenJobsRoute(brokenJobsRoute), true)
})

test('Terraeagle marks the compromised official homepage as discovery-only evidence', async () => {
  const terraeagle = await loadTerraEagleModule()
  assert.ok(terraeagle, 'Expected scraper module at ./script.js')

  const jobs = await terraeagle.createTerraEagleScraper({
    now: () => '2026-09-14T00:00:00.000Z',
  }).run({
      fetchPage: async (url) => {
        if (url === terraeagle.HOMEPAGE_URL) {
          return { status: 200, url, html: compromisedHomepageHtml }
        }

        throw new Error(`Unexpected URL: ${url}`)
      },
    })

  assert.deepEqual(jobs, [])
  const evidence = readInventoryEvidence(jobs)
  assert.equal(evidence?.status, 'discovery-only')
  assert.equal(evidence?.surface, terraeagle.HOMEPAGE_URL)
  assert.match(evidence?.reason || '', /compromised|unavailable/i)
})

test('Terraeagle sentinel returns no jobs only while the verified official surface exposes no public careers board', async () => {
  const terraeagle = await loadTerraEagleModule()
  assert.ok(terraeagle, 'Expected scraper module at ./script.js')

  const requestedUrls = []
  const jobs = await terraeagle.createTerraEagleScraper().run({
    fetchPage: async (url) => {
      requestedUrls.push(url)
      if (url === terraeagle.HOMEPAGE_URL) return { status: 200, url, html: homepageHtml }
      if (url === terraeagle.ABOUT_URL) return { status: 200, url, html: aboutHtml }
      if (url === terraeagle.CAREERS_URL) return { status: 200, url, html: careersHtml }
      if (url === terraeagle.BROKEN_JOBS_URL) return brokenJobsRoute
      throw new Error(`Unexpected URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [
    terraeagle.HOMEPAGE_URL,
    terraeagle.ABOUT_URL,
    terraeagle.CAREERS_URL,
    terraeagle.BROKEN_JOBS_URL,
  ])
  assert.deepEqual(jobs, [])
})

test('Terraeagle sentinel fails closed when the careers shell starts exposing public jobs or the jobs route stops being broken', async () => {
  const terraeagle = await loadTerraEagleModule()
  assert.ok(terraeagle, 'Expected scraper module at ./script.js')

  await assert.rejects(
    terraeagle.createTerraEagleScraper().run({
      fetchPage: async (url) => {
        if (url === terraeagle.HOMEPAGE_URL) return { status: 200, url, html: homepageHtml }
        if (url === terraeagle.ABOUT_URL) return { status: 200, url, html: aboutHtml }
        if (url === terraeagle.CAREERS_URL) return { status: 200, url, html: publicJobsCareersHtml }
        throw new Error(`Unexpected URL: ${url}`)
      },
    }),
    /verified careers shell|public jobs/i,
  )

  await assert.rejects(
    terraeagle.createTerraEagleScraper().run({
      fetchPage: async (url) => {
        if (url === terraeagle.HOMEPAGE_URL) return { status: 200, url, html: homepageHtml }
        if (url === terraeagle.ABOUT_URL) return { status: 200, url, html: aboutHtml }
        if (url === terraeagle.CAREERS_URL) return { status: 200, url, html: careersHtml }
        if (url === terraeagle.BROKEN_JOBS_URL) {
          return { status: 200, url, html: '<html><body><h1>Jobs</h1></body></html>' }
        }
        throw new Error(`Unexpected URL: ${url}`)
      },
    }),
    /broken jobs route/i,
  )
})


test('Terraeagle HTTP challenge and service errors preserve their access or outage cause', async () => {
  const source = await import('./script.js')
  for (const status of [403,503]) await assert.rejects(source.run({fetchPage:async url => ({status,url,html:'<title>Just a moment...</title>Enable JavaScript and cookies to continue'})}), new RegExp('HTTP '+status))
})
