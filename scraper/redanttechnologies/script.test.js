import assert from 'node:assert/strict'
import test from 'node:test'

const loadRedAntTechnologiesModule = async () => {
  try {
    return await import('./script.js')
  } catch {
    assert.fail('Expected RedAnt Technologies scraper module at ./script.js')
  }
}

const homepageHtml = `
  <!DOCTYPE html>
  <html lang="en">
    <head>
      <meta charset="UTF-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      <title>RedAnt Technologies Ltd | Software, Cloud, AI & Digital Solutions</title>
      <meta
        name="description"
        content="RedAnt Technologies Ltd builds scalable software, mobile, cloud, data, AI and geospatial solutions that help businesses innovate, operate and grow."
      />
      <meta name="author" content="RedAnt Technologies Ltd" />
      <meta property="og:title" content="RedAnt Technologies Ltd | Software, Cloud, AI & Digital Solutions" />
      <meta
        property="og:description"
        content="RedAnt Technologies Ltd builds scalable software, mobile, cloud, data, AI and geospatial solutions that help businesses innovate, operate and grow."
      />
      <meta property="og:type" content="website" />
      <meta property="og:image" content="favicon.ico" />
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:site" content="@RedAntTech" />
      <meta name="twitter:image" content="favicon.ico" />
      <script type="module" crossorigin src="/assets/index-BdFdV-mz.js"></script>
      <link rel="stylesheet" crossorigin href="/assets/index-C6o_RYSD.css">
    </head>
    <body>
      <div id="root"></div>
    </body>
  </html>
`

const missingRouteHtml = `
  <!DOCTYPE html>
  <html style="height:100%">
    <head>
      <meta name="viewport" content="width=device-width, initial-scale=1, shrink-to-fit=no" />
      <title> 404 Not Found </title>
    </head>
    <body style="color: #444; margin:0; font: normal 14px/20px Arial, Helvetica, sans-serif; height:100%; background-color: #fff;">
      <div style="height:auto; min-height:100%;">
        <div style="text-align: center; width:800px; margin-left: -400px; position:absolute; top: 30%; left:50%;">
          <h1 style="margin:0; font-size:150px; line-height:150px; font-weight:bold;">404</h1>
          <h2 style="margin-top:20px;font-size: 30px;">Not Found</h2>
          <p>The resource requested could not be found on this server!</p>
        </div>
      </div>
    </body>
  </html>
`

test('RedAnt Technologies helpers recognize the verified homepage shell and missing careers routes', async () => {
  const redAntTechnologies = await loadRedAntTechnologiesModule()

  assert.equal(redAntTechnologies.SOURCE, 'redanttechnologies')
  assert.equal(redAntTechnologies.COMPANY, 'RedAnt Technologies')
  assert.equal(redAntTechnologies.HOMEPAGE_URL, 'https://www.redanttech.com/')
  assert.deepEqual(redAntTechnologies.MISSING_ROUTE_URLS, [
    'https://www.redanttech.com/careers',
    'https://www.redanttech.com/jobs',
    'https://www.redanttech.com/join-us',
    'https://www.redanttech.com/current-openings',
  ])
  assert.equal(redAntTechnologies.hasOfficialHomepageSignal(homepageHtml), true)
  assert.equal(redAntTechnologies.hasCareerLikeLink(homepageHtml), false)
  assert.equal(redAntTechnologies.hasPublicJobsSignal(homepageHtml), false)
  assert.equal(
    redAntTechnologies.isVerifiedMissingRoute({
      status: 404,
      html: missingRouteHtml,
    }),
    true,
  )
})

test('RedAnt Technologies sentinel returns no jobs while the verified first-party no-jobs surface remains unchanged', async () => {
  const redAntTechnologies = await loadRedAntTechnologiesModule()
  const requestedUrls = []

  const jobs = await redAntTechnologies.createRedAntTechnologiesScraper().run({
    fetchPage: async (url) => {
      requestedUrls.push(url)

      if (url === redAntTechnologies.HOMEPAGE_URL) {
        return { status: 200, url, html: homepageHtml }
      }

      if (redAntTechnologies.MISSING_ROUTE_URLS.includes(url)) {
        return { status: 404, url, html: missingRouteHtml }
      }

      throw new Error(`Unexpected URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [
    redAntTechnologies.HOMEPAGE_URL,
    ...redAntTechnologies.MISSING_ROUTE_URLS,
  ])
  assert.deepEqual(jobs, [])
})

test('RedAnt Technologies returns no jobs when the verified homepage is temporarily unavailable', async () => {
  const redAntTechnologies = await loadRedAntTechnologiesModule()

  const jobs = await redAntTechnologies.createRedAntTechnologiesScraper().run({
    fetchPage: async (url) => {
      if (url === redAntTechnologies.HOMEPAGE_URL) {
        const error = new Error('fetch failed')
        error.cause = {
          code: 'EAI_AGAIN',
          hostname: 'www.redanttech.com',
          message: 'getaddrinfo EAI_AGAIN www.redanttech.com',
        }
        throw error
      }

      throw new Error(`Unexpected URL: ${url}`)
    },
  })

  assert.deepEqual(jobs, [])
})

test('RedAnt Technologies sentinel fails closed when the homepage or missing-route surface drifts', async () => {
  const redAntTechnologies = await loadRedAntTechnologiesModule()

  await assert.rejects(
    redAntTechnologies.createRedAntTechnologiesScraper().run({
      fetchPage: async (url) => {
        if (url === redAntTechnologies.HOMEPAGE_URL) {
          return {
            status: 200,
            url,
            html: '<html><head><title>Unexpected</title></head><body></body></html>',
          }
        }

        return { status: 404, url, html: missingRouteHtml }
      },
    }),
    /official homepage/i,
  )

  await assert.rejects(
    redAntTechnologies.createRedAntTechnologiesScraper().run({
      fetchPage: async (url) => {
        if (url === redAntTechnologies.HOMEPAGE_URL) {
          return {
            status: 200,
            url,
            html: homepageHtml.replace(
              '<div id="root"></div>',
              '<div id="root"></div><a href="/careers">Careers</a>',
            ),
          }
        }

        return { status: 404, url, html: missingRouteHtml }
      },
    }),
    /homepage now exposes a first-party careers|homepage now exposes a public jobs/i,
  )

  await assert.rejects(
    redAntTechnologies.createRedAntTechnologiesScraper().run({
      fetchPage: async (url) => {
        if (url === redAntTechnologies.HOMEPAGE_URL) {
          return { status: 200, url, html: homepageHtml }
        }

        if (url === redAntTechnologies.MISSING_ROUTE_URLS[0]) {
          return {
            status: 200,
            url,
            html: '<html><body><h1>Careers</h1><a href="/apply">Apply now</a></body></html>',
          }
        }

        return { status: 404, url, html: missingRouteHtml }
      },
    }),
    /careers routes changed materially|public jobs/i,
  )
})
