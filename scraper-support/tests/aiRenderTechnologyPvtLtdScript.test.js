import assert from 'node:assert/strict'
import test from 'node:test'

const verifiedHomepageHtml = `
  <!doctype html>
  <html lang="en">
    <head>
      <meta charset="utf-8">
      <title>aiRender</title>
      <script defer src="/static/js/main.bcd18984.js"></script>
    </head>
    <body>
      <noscript>You need to enable JavaScript to run this app.</noscript>
      <div id="root"></div>
    </body>
  </html>
`

const verifiedBundleJs = `
  account_name:"Airender Technology Private Limited",
  company_address:"H-005, Vijetha Elysium, Hagadur Road, Whitefield, Bangalore, Karnataka, India. PIN 560066",
  children:"Contact Us",
  children:"Join us"
`

const verified404Html = `
  <!doctype html>
  <html>
    <head><title>404 Not Found</title></head>
    <body>404 Not Found nginx/1.24.0 (Ubuntu)</body>
  </html>
`

const loadModule = async () => {
  try {
    return await import('../../scraper/airendertechnologypvtltd/script.js')
  } catch {
    assert.fail('Expected aiRender Technology Pvt Ltd scraper module at ../../scraper/airendertechnologypvtltd/script.js')
  }
}

test('aiRender Technology Pvt Ltd validates the verified homepage, client bundle identity, and missing careers routes', async () => {
  const airender = await loadModule()

  assert.equal(airender.SOURCE, 'airendertechnologypvtltd')
  assert.equal(airender.COMPANY, 'aiRender Technology Pvt Ltd')
  assert.equal(airender.HOMEPAGE_URL, 'https://airender.co.in/')
  assert.deepEqual(airender.CAREERS_ROUTE_URLS, [
    'https://airender.co.in/careers/',
    'https://airender.co.in/career/',
    'https://airender.co.in/jobs/',
    'https://airender.co.in/join-us/',
    'https://airender.co.in/current-openings/',
    'https://airender.co.in/openings/',
    'https://airender.co.in/work-with-us/',
  ])
  assert.equal(airender.extractBundlePath(verifiedHomepageHtml), '/static/js/main.bcd18984.js')
  assert.equal(airender.hasOfficialHomepageSignal(verifiedHomepageHtml), true)
  assert.equal(airender.hasVerifiedClientBundleSignal(verifiedBundleJs), true)
  assert.equal(airender.hasPublicJobsSignal(verifiedHomepageHtml), false)
  assert.equal(airender.hasPublicJobsSignal(verifiedBundleJs), false)
  assert.equal(
    airender.isVerifiedMissingCareerRoute({
      status: 404,
      url: airender.CAREERS_ROUTE_URLS[0],
      html: verified404Html,
    }),
    true,
  )
})

test('aiRender Technology Pvt Ltd returns no jobs only while the verified homepage, bundle, and missing careers routes remain unchanged', async () => {
  const airender = await loadModule()
  const requestedUrls = []

  const jobs = await airender.createAiRenderTechnologyPvtLtdScraper().run({
    fetchPage: async (url) => {
      requestedUrls.push(url)

      if (url === airender.HOMEPAGE_URL) {
        return {
          status: 200,
          url,
          html: verifiedHomepageHtml,
        }
      }

      if (url === new URL('/static/js/main.bcd18984.js', airender.HOMEPAGE_URL).toString()) {
        return {
          status: 200,
          url,
          html: verifiedBundleJs,
        }
      }

      if (airender.CAREERS_ROUTE_URLS.includes(url)) {
        return {
          status: 404,
          url,
          html: verified404Html,
        }
      }

      throw new Error(`Unexpected page URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [
    airender.HOMEPAGE_URL,
    new URL('/static/js/main.bcd18984.js', airender.HOMEPAGE_URL).toString(),
    ...airender.CAREERS_ROUTE_URLS,
  ])
  assert.deepEqual(jobs, [])
})

test('aiRender accepts career-like URLs only when they serve the identical verified SPA shell', async () => {
  const airender = await loadModule()
  const jobs = await airender.createAiRenderTechnologyPvtLtdScraper().run({
    fetchPage: async (url) => {
      if (url === airender.HOMEPAGE_URL || airender.CAREERS_ROUTE_URLS.includes(url)) {
        return { status: 200, url, html: verifiedHomepageHtml }
      }
      if (url === new URL('/static/js/main.bcd18984.js', airender.HOMEPAGE_URL).toString()) {
        return { status: 200, url, html: verifiedBundleJs }
      }
      throw new Error(`Unexpected URL: ${url}`)
    },
  })
  assert.deepEqual(jobs, [])

  await assert.rejects(
    airender.createAiRenderTechnologyPvtLtdScraper().run({
      fetchPage: async (url) => {
        if (url === airender.HOMEPAGE_URL) return { status: 200, url, html: verifiedHomepageHtml }
        if (url.endsWith('.js')) return { status: 200, url, html: verifiedBundleJs }
        return { status: 200, url, html: `${verifiedHomepageHtml}<p>Current Openings</p>` }
      },
    }),
    /verified no-public-careers route changed/i,
  )
})

test('aiRender Technology Pvt Ltd fails closed when the homepage, client bundle, or missing-route contract changes', async () => {
  const airender = await loadModule()

  await assert.rejects(
    airender.createAiRenderTechnologyPvtLtdScraper().run({
      fetchPage: async (url) => {
        if (url === airender.HOMEPAGE_URL) {
          return { status: 200, url, html: '<html><body><h1>Unexpected homepage</h1></body></html>' }
        }

        return { status: 404, url, html: verified404Html }
      },
    }),
    /verified official homepage/i,
  )

  await assert.rejects(
    airender.createAiRenderTechnologyPvtLtdScraper().run({
      fetchPage: async (url) => {
        if (url === airender.HOMEPAGE_URL) {
          return { status: 200, url, html: verifiedHomepageHtml }
        }

        if (url === new URL('/static/js/main.bcd18984.js', airender.HOMEPAGE_URL).toString()) {
          return {
            status: 200,
            url,
            html: `${verifiedBundleJs}\nCurrent Openings\nApply now`,
          }
        }

        return { status: 404, url, html: verified404Html }
      },
    }),
    /client bundle now appears to expose public jobs/i,
  )

  await assert.rejects(
    airender.createAiRenderTechnologyPvtLtdScraper().run({
      fetchPage: async (url) => {
        if (url === airender.HOMEPAGE_URL) {
          return { status: 200, url, html: verifiedHomepageHtml }
        }

        if (url === new URL('/static/js/main.bcd18984.js', airender.HOMEPAGE_URL).toString()) {
          return { status: 200, url, html: verifiedBundleJs }
        }

        return {
          status: url === airender.CAREERS_ROUTE_URLS[0] ? 200 : 404,
          url,
          html: verified404Html,
        }
      },
    }),
    /verified no-public-careers route changed/i,
  )
})
