import assert from 'node:assert/strict'
import test from 'node:test'

const loadMindgraphTechnologiesModule = async () => {
  try {
    return await import('./script.js')
  } catch {
    assert.fail('Expected Mindgraph Technologies scraper module at ./script.js')
  }
}

const verifiedHomepageHtml = `
  <!DOCTYPE html>
  <html lang="en">
    <head>
      <title>Mind Graph</title>
      <meta property="og:title" content="AI Enterprises Company | Innovate with Mind Graph">
      <meta property="og:description" content="Empower your business with a top AI enterprises company. Mind Graph delivers cutting-edge IT solutions.">
      <script type="module" crossorigin src="/assets/index-CAQIcZmv.js"></script>
    </head>
    <body>
      <div id="root"></div>
    </body>
  </html>
`

const verifiedBundleJs = `
  const routes = [
    { path: "", element: "home" },
    { path: "/aboutUs", element: "about" },
    { path: "/contactUs", element: "contact" },
    { path: "/blog", element: "blog" },
    { path: "/blog/:slug", element: "blog-detail" },
    { path: "terms", element: "terms" },
    { path: "privacy", element: "privacy" }
  ];
`

const appShellHtml = `
  <!DOCTYPE html>
  <html lang="en">
    <head>
      <title>Mind Graph</title>
      <meta property="og:title" content="AI Enterprises Company | Innovate with Mind Graph">
      <script type="module" crossorigin src="/assets/index-CAQIcZmv.js"></script>
    </head>
    <body>
      <div id="root"></div>
    </body>
  </html>
`

const suspendedAccountHtml = `
  <!DOCTYPE html>
  <html>
    <head>
      <title>Account Suspended</title>
    </head>
    <body>
      <h1>Account Suspended</h1>
      <p>This Account has been suspended.</p>
      <p>Contact your hosting provider for more information.</p>
    </body>
  </html>
`

test('Mindgraph Technologies constants stay pinned to the verified first-party brochure site', async () => {
  const mindgraphTechnologies = await loadMindgraphTechnologiesModule()

  assert.equal(mindgraphTechnologies.SOURCE, 'mindgraphtechnologies')
  assert.equal(mindgraphTechnologies.COMPANY, 'Mindgraph Technologies')
  assert.equal(mindgraphTechnologies.HOMEPAGE_URL, 'https://mind-graph.com/')
  assert.deepEqual(mindgraphTechnologies.PUBLIC_JOB_ROUTE_URLS, [
    'https://mind-graph.com/careers',
    'https://mind-graph.com/careers/',
    'https://mind-graph.com/jobs',
    'https://mind-graph.com/jobs/',
    'https://mind-graph.com/join-us',
    'https://mind-graph.com/join-us/',
  ])
  assert.equal(mindgraphTechnologies.hasOfficialHomepageSignal(verifiedHomepageHtml), true)
  assert.equal(mindgraphTechnologies.extractBundleUrl(verifiedHomepageHtml), 'https://mind-graph.com/assets/index-CAQIcZmv.js')
  assert.equal(mindgraphTechnologies.hasPublicJobsSignal(verifiedHomepageHtml), false)
  assert.equal(mindgraphTechnologies.hasVerifiedRouteTableSignal(verifiedBundleJs), true)
  assert.equal(mindgraphTechnologies.hasSuspendedAccountSignal(suspendedAccountHtml), true)
})

test('Mindgraph Technologies returns no jobs only while the verified brochure site and route table stay unchanged', async () => {
  const mindgraphTechnologies = await loadMindgraphTechnologiesModule()
  const requestedUrls = []

  const jobs = await mindgraphTechnologies.createMindgraphTechnologiesScraper().run({
    fetchPage: async (url) => {
      requestedUrls.push(url)

      if (url === mindgraphTechnologies.HOMEPAGE_URL) {
        return {
          status: 200,
          url,
          html: verifiedHomepageHtml,
        }
      }

      if (url === 'https://mind-graph.com/assets/index-CAQIcZmv.js') {
        return {
          status: 200,
          url,
          html: verifiedBundleJs,
        }
      }

      if (mindgraphTechnologies.PUBLIC_JOB_ROUTE_URLS.includes(url)) {
        return {
          status: 200,
          url,
          html: appShellHtml,
        }
      }

      throw new Error(`Unexpected URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [
    mindgraphTechnologies.HOMEPAGE_URL,
    'https://mind-graph.com/assets/index-CAQIcZmv.js',
    ...mindgraphTechnologies.PUBLIC_JOB_ROUTE_URLS,
  ])
  assert.deepEqual(jobs, [])
})

test('Mindgraph Technologies returns no jobs when every checked route is the current suspended account page', async () => {
  const mindgraphTechnologies = await loadMindgraphTechnologiesModule()
  const requestedUrls = []

  const jobs = await mindgraphTechnologies.createMindgraphTechnologiesScraper().run({
    fetchPage: async (url) => {
      requestedUrls.push(url)

      if (url === mindgraphTechnologies.HOMEPAGE_URL || mindgraphTechnologies.PUBLIC_JOB_ROUTE_URLS.includes(url)) {
        return {
          status: 200,
          url: 'https://mind-graph.com/cgi-sys/suspendedpage.cgi',
          html: suspendedAccountHtml,
        }
      }

      throw new Error(`Unexpected URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [
    mindgraphTechnologies.HOMEPAGE_URL,
    ...mindgraphTechnologies.PUBLIC_JOB_ROUTE_URLS,
  ])
  assert.deepEqual(jobs, [])
})

test('Mindgraph Technologies fails closed when the brochure site starts exposing a jobs surface or the route table drifts', async () => {
  const mindgraphTechnologies = await loadMindgraphTechnologiesModule()

  await assert.rejects(
    mindgraphTechnologies.createMindgraphTechnologiesScraper().run({
      fetchPage: async (url) => {
        if (url === mindgraphTechnologies.HOMEPAGE_URL) {
          return {
            status: 200,
            url,
            html: `${verifiedHomepageHtml}<a href="/careers">Careers</a><p>Apply now</p>`,
          }
        }

        return {
          status: 200,
          url,
          html: verifiedBundleJs,
        }
      },
    }),
    /homepage now appears to expose public openings/i,
  )

  await assert.rejects(
    mindgraphTechnologies.createMindgraphTechnologiesScraper().run({
      fetchPage: async (url) => {
        if (url === mindgraphTechnologies.HOMEPAGE_URL) {
          return {
            status: 200,
            url,
            html: verifiedHomepageHtml,
          }
        }

        if (url === 'https://mind-graph.com/assets/index-CAQIcZmv.js') {
          return {
            status: 200,
            url,
            html: 'const routes = [{ path: "/careers", element: "careers" }];',
          }
        }

        return {
          status: 200,
          url,
          html: appShellHtml,
        }
      },
    }),
    /verified route table no longer matches the trusted zero-job state/i,
  )
})
