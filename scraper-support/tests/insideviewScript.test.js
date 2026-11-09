import assert from 'node:assert/strict'
import test from 'node:test'

const redirectedDemandbaseHomepageHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>ABM Platform for B2B Sales &amp; Marketing Success | Demandbase</title>
  </head>
  <body>
    <nav>
      <a href="/pricing/">Pricing</a>
      <a href="/company/">Company</a>
      <a href="/company/careers/">Careers</a>
    </nav>
    <h1>Turn your go-to-market into a pipeline engine</h1>
    <p>The pipeline engine for AI GTM that aligns teams to turn goals into revenue.</p>
  </body>
</html>
`

const legacyLoginHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>InsideView: Set Password</title>
  </head>
  <body>
    <header>
      <a href="https://www.insideview.com/">InsideView</a>
      <a href="https://www.insideview.com/">Careers</a>
      <a href="https://support.demandbase.com/hc/en-us">Support</a>
    </header>
    <main>
      <h1>Forgot your Password?</h1>
      <p>Submit your Email ID below to set a new password.</p>
      <button type="submit">Submit</button>
    </main>
  </body>
</html>
`

const retiredRootHtml = '<title>It works! Apache httpd</title><p>It works!</p>'

const publicJobsHtml = `
<!doctype html>
<html lang="en">
  <body>
    <h1>Current Open Positions</h1>
    <a href="https://job-boards.greenhouse.io/example/jobs/123">Apply now</a>
  </body>
</html>
`

const loadInsideViewModule = async () => {
  try {
    return await import('../../scraper/insideview/script.js')
  } catch {
    assert.fail('Expected InsideView scraper module at ../../scraper/insideview/script.js')
  }
}

test('InsideView scraper constants stay pinned to the verified Demandbase redirect and legacy exact-name login surface', async () => {
  const insideview = await loadInsideViewModule()

  assert.equal(insideview.SOURCE, 'insideview')
  assert.equal(insideview.COMPANY, 'InsideView')
  assert.equal(insideview.VERIFIED_ON, '2026-08-02')
  assert.equal(insideview.ROOT_URL, 'https://www.insideview.com/')
  assert.equal(insideview.REDIRECTED_HOMEPAGE_URL, 'https://www.demandbase.com/')
  assert.equal(insideview.LEGACY_LOGIN_URL, 'https://my.insideview.com/iv/login/forgot_password.jsp')
  assert.equal(insideview.hasRedirectedDemandbaseHomepageSignal(redirectedDemandbaseHomepageHtml), true)
  assert.equal(insideview.hasRetiredInsideViewRootSignal({ status: 403, url: insideview.ROOT_URL, html: retiredRootHtml }), true)
  assert.equal(insideview.hasLegacyInsideViewLoginSignal(legacyLoginHtml), true)
  assert.equal(insideview.hasPublicJobsSignal(redirectedDemandbaseHomepageHtml), false)
  assert.equal(insideview.hasPublicJobsSignal(legacyLoginHtml), false)
  assert.equal(insideview.hasPublicJobsSignal(publicJobsHtml), true)
})

test('InsideView returns [] only while the exact-name root redirects to Demandbase and the legacy login surface stays non-listing', async () => {
  const insideview = await loadInsideViewModule()
  const requestedUrls = []

  const jobs = await insideview.createInsideViewScraper().run({
    fetchPage: async (url) => {
      requestedUrls.push(url)

      if (url === insideview.ROOT_URL) {
        return {
          status: 200,
          url: insideview.REDIRECTED_HOMEPAGE_URL,
          html: redirectedDemandbaseHomepageHtml,
        }
      }

      if (url === insideview.LEGACY_LOGIN_URL) {
        return {
          status: 200,
          url,
          html: legacyLoginHtml,
        }
      }

      throw new Error(`Unexpected InsideView URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [
    insideview.ROOT_URL,
    insideview.LEGACY_LOGIN_URL,
  ])
  assert.deepEqual(jobs, [])
})

test('InsideView accepts the current retired root only while the legacy exact-name login remains live', async () => {
  const insideview = await loadInsideViewModule()
  const jobs = await insideview.createInsideViewScraper().run({ fetchPage: async (url) => url === insideview.ROOT_URL
    ? { status: 403, url, html: retiredRootHtml }
    : { status: 200, url, html: legacyLoginHtml } })
  assert.deepEqual(jobs, [])
})

test('InsideView fails closed when the verified redirect or legacy login surface drifts into a public jobs surface', async () => {
  const insideview = await loadInsideViewModule()

  await assert.rejects(
    insideview.createInsideViewScraper().run({
      fetchPage: async (url) => {
        if (url === insideview.ROOT_URL) {
          return {
            status: 200,
            url: insideview.ROOT_URL,
            html: redirectedDemandbaseHomepageHtml,
          }
        }

        if (url === insideview.LEGACY_LOGIN_URL) {
          return { status: 200, url, html: legacyLoginHtml }
        }

        throw new Error(`Unexpected InsideView URL: ${url}`)
      },
    }),
    /verified legacy root redirect/i,
  )

  await assert.rejects(
    insideview.createInsideViewScraper().run({
      fetchPage: async (url) => {
        if (url === insideview.ROOT_URL) {
          return {
            status: 200,
            url: insideview.REDIRECTED_HOMEPAGE_URL,
            html: redirectedDemandbaseHomepageHtml,
          }
        }

        if (url === insideview.LEGACY_LOGIN_URL) {
          return { status: 200, url, html: '<html><body>Unexpected</body></html>' }
        }

        throw new Error(`Unexpected InsideView URL: ${url}`)
      },
    }),
    /verified legacy login surface/i,
  )

  await assert.rejects(
    insideview.createInsideViewScraper().run({
      fetchPage: async (url) => {
        if (url === insideview.ROOT_URL) {
          return {
            status: 200,
            url: insideview.REDIRECTED_HOMEPAGE_URL,
            html: redirectedDemandbaseHomepageHtml,
          }
        }

        if (url === insideview.LEGACY_LOGIN_URL) {
          return { status: 200, url, html: publicJobsHtml }
        }

        throw new Error(`Unexpected InsideView URL: ${url}`)
      },
    }),
    /legacy login surface now appears to expose public jobs/i,
  )
})
