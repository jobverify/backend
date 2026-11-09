import assert from 'node:assert/strict'
import test from 'node:test'

const HOMEPAGE_HTML = `
<!doctype html>
<html lang="en">
  <head>
    <title>Digital Asset Management Software | Scaleflex</title>
  </head>
  <body>
    <main>
      <h1>One place for every visual. Days back in your week.</h1>
      <p>Turn visuals into high-converting digital experiences at scale.</p>
      <p>Dynamic Media Optimization</p>
      <p>Trusted by enterprises.</p>
    </main>
    <footer>
      <a href="https://portals.scaleflex.com/s/GNQy1BKc/en/home">Media Kit</a>
      <a href="https://portals.scaleflex.com/s/xJfYX5yl/en/home">We are Hiring</a>
    </footer>
  </body>
</html>
`

const CURRENT_HOMEPAGE_HTML = `
<!doctype html>
<html lang="en">
  <head>
    <title>Digital Asset Management Software | Scaleflex</title>
  </head>
  <body>
    <main>
      <h1>One place for every visual. Days back in your week.</h1>
      <p>Turns visuals into high-converting digital experiences for modern teams.</p>
      <p>Trusted by 1,300+ brands worldwide.</p>
    </main>
    <footer>
      <a href="https://portals.scaleflex.com/s/GNQy1BKc/en/home">Media Kit</a>
      <a href="https://portals.scaleflex.com/s/xJfYX5yl/en/home">We are Hiring</a>
    </footer>
  </body>
</html>
`

const LEGACY_HOMEPAGE_HTML = `
<!doctype html>
<html lang="en">
  <head>
    <title>Cloud-based Visual Asset Management for Enterprise</title>
  </head>
  <body>
    <nav>
      <a href="/about">About us</a>
      <a href="https://portals.scaleflex.com/s/xJfYX5yl/en/home">Careers</a>
    </nav>
    <main>
      <h1>Cloud-based Visual Asset Management for Enterprise</h1>
      <p>VXP Platform</p>
      <p>1300+ brands trust us with their visual content</p>
      <p>Visual Asset Management</p>
      <p>Dynamic Media Optimization</p>
    </main>
  </body>
</html>
`

const PORTAL_LOADING_HTML = `
<!doctype html>
<html lang="en">
  <head>
    <title>Scaleflex Career Page</title>
  </head>
  <body>
    <div>Loading...</div>
    <div>Loading...</div>
    <div>Loading...</div>
  </body>
</html>
`

const FIRST_PARTY_404_HTML = `
<!doctype html>
<html lang="en">
  <body>
    <h1>404</h1>
    <p>Page not found.</p>
  </body>
</html>
`

const loadModule = async () => {
  try {
    return await import('../../scraper/scaleflex/script.js')
  } catch {
    assert.fail('Expected Scaleflex scraper module at ../../scraper/scaleflex/script.js')
  }
}

test('Scaleflex sentinel recognizes the verified homepage, official careers handoff, loading portal shell, and missing careers routes', async () => {
  const scaleflex = await loadModule()

  assert.equal(scaleflex.SOURCE, 'scaleflex')
  assert.equal(scaleflex.COMPANY_NAME, 'Scaleflex')
  assert.equal(scaleflex.HOMEPAGE_URL, 'https://www.scaleflex.com/')
  assert.equal(scaleflex.CAREERS_HANDOFF_URL, 'https://portals.scaleflex.com/s/xJfYX5yl/en/home')
  assert.deepEqual(scaleflex.CAREERS_ROUTE_URLS, [
    'https://www.scaleflex.com/careers',
    'https://www.scaleflex.com/jobs',
  ])
  assert.equal(scaleflex.hasOfficialHomepageSignal(HOMEPAGE_HTML), true)
  assert.equal(scaleflex.hasOfficialHomepageSignal(LEGACY_HOMEPAGE_HTML), true)
  assert.equal(
    scaleflex.extractOfficialCareersHandoffUrl(HOMEPAGE_HTML),
    'https://portals.scaleflex.com/s/xJfYX5yl/en/home',
  )
  assert.equal(scaleflex.hasVerifiedPortalLoadingSignal(PORTAL_LOADING_HTML), true)
  assert.equal(scaleflex.hasPublicJobsSignal(HOMEPAGE_HTML), true)
  assert.equal(scaleflex.hasPublicJobsSignal(PORTAL_LOADING_HTML), false)
  assert.equal(
    scaleflex.isVerifiedNoPublicJobsRoute({
      status: 404,
      url: 'https://www.scaleflex.com/careers',
      html: FIRST_PARTY_404_HTML,
    }),
    true,
  )
})

test('Scaleflex accepts the Monday, August 17, 2026 homepage copy refresh while preserving the official hiring handoff', async () => {
  const scaleflex = await loadModule()

  assert.equal(scaleflex.hasOfficialHomepageSignal(CURRENT_HOMEPAGE_HTML), true)
  assert.equal(
    scaleflex.extractOfficialCareersHandoffUrl(CURRENT_HOMEPAGE_HTML),
    'https://portals.scaleflex.com/s/xJfYX5yl/en/home',
  )
})

test('Scaleflex returns [] only while the verified homepage, loading careers portal, and missing route state remain unchanged', async () => {
  const scaleflex = await loadModule()
  const requestedUrls = []

  const jobs = await scaleflex.createScaleflexScraper().run({
    fetchPage: async (url) => {
      requestedUrls.push(url)

      if (url === scaleflex.HOMEPAGE_URL) {
        return { status: 200, url, html: HOMEPAGE_HTML }
      }

      if (url === scaleflex.CAREERS_HANDOFF_URL) {
        return { status: 200, url, html: PORTAL_LOADING_HTML }
      }

      if (scaleflex.CAREERS_ROUTE_URLS.includes(url)) {
        return { status: 404, url, html: FIRST_PARTY_404_HTML }
      }

      throw new Error(`Unexpected Scaleflex URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [
    scaleflex.HOMEPAGE_URL,
    scaleflex.CAREERS_HANDOFF_URL,
    ...scaleflex.CAREERS_ROUTE_URLS,
  ])
  assert.deepEqual(jobs, [])
})

test('Scaleflex fails closed when the verified homepage, linked portal, or first-party careers routes drift into a jobs surface', async () => {
  const scaleflex = await loadModule()

  await assert.rejects(
    scaleflex.createScaleflexScraper().run({
      fetchPage: async (url) => {
        if (url === scaleflex.HOMEPAGE_URL) {
          return { status: 200, url, html: '<html><body><h1>Unexpected</h1></body></html>' }
        }

        if (url === scaleflex.CAREERS_HANDOFF_URL) {
          return { status: 200, url, html: PORTAL_LOADING_HTML }
        }

        return { status: 404, url, html: FIRST_PARTY_404_HTML }
      },
    }),
    /verified Scaleflex homepage/i,
  )

  await assert.rejects(
    scaleflex.createScaleflexScraper().run({
      fetchPage: async (url) => {
        if (url === scaleflex.HOMEPAGE_URL) {
          return { status: 200, url, html: HOMEPAGE_HTML }
        }

        if (url === scaleflex.CAREERS_HANDOFF_URL) {
          return {
            status: 200,
            url,
            html: '<html><body><h1>Careers</h1><a href="/jobs/backend-engineer">Apply now</a></body></html>',
          }
        }

        return { status: 404, url, html: FIRST_PARTY_404_HTML }
      },
    }),
    /linked Scaleflex careers portal/i,
  )

  await assert.rejects(
    scaleflex.createScaleflexScraper().run({
      fetchPage: async (url) => {
        if (url === scaleflex.HOMEPAGE_URL) {
          return { status: 200, url, html: HOMEPAGE_HTML }
        }

        if (url === scaleflex.CAREERS_HANDOFF_URL) {
          return { status: 200, url, html: PORTAL_LOADING_HTML }
        }

        if (url === scaleflex.CAREERS_ROUTE_URLS[0]) {
          return {
            status: 200,
            url,
            html: '<html><body><h1>Open Positions</h1><a href="/jobs/frontend-engineer">Apply now</a></body></html>',
          }
        }

        return { status: 404, url, html: FIRST_PARTY_404_HTML }
      },
    }),
    /Scaleflex careers routes changed materially or now expose public jobs/i,
  )
})
