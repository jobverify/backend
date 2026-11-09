import assert from 'node:assert/strict'
import test from 'node:test'

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
      <meta charset="UTF-8"/>
      <meta name="viewport" content="width=device-width,initial-scale=1"/>
      <title>SkipperX - Built for Innovators, Entrepreneur & Hustlers</title>
      <meta name="description" content="Your dream skill is, not days, not hours but minutes away."/>
      <meta name="author" content="SkipperX Team"/>
      <meta property="og:url" content="https://skipperx.io"/>
      <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Poppins:wght@300;400;600;700&display=swap">
      <link rel="stylesheet" href="/static/css/main.67f2fd46.css">
    </head>
    <body>
      <div id="root"></div>
      <script src="/static/js/main.c506c188.js"></script>
    </body>
  </html>
`

const careersHtml = `
  <!doctype html>
  <html lang="en">
    <head>
      <meta charset="UTF-8"/>
      <meta name="viewport" content="width=device-width,initial-scale=1"/>
      <title>SkipperX - Built for Innovators, Entrepreneur & Hustlers</title>
      <meta name="description" content="Your dream skill is, not days, not hours but minutes away."/>
      <meta name="author" content="SkipperX Team"/>
      <meta property="og:url" content="https://skipperx.io"/>
      <link rel="stylesheet" href="/static/css/main.67f2fd46.css">
    </head>
    <body>
      <div id="root"></div>
      <script src="/static/js/main.c506c188.js"></script>
    </body>
  </html>
`

const jobsHtml = `
  <!doctype html>
  <html lang="en">
    <head>
      <meta charset="UTF-8"/>
      <meta name="viewport" content="width=device-width,initial-scale=1"/>
      <title>SkipperX - Built for Innovators, Entrepreneur & Hustlers</title>
      <meta name="description" content="Your dream skill is, not days, not hours but minutes away."/>
      <meta name="author" content="SkipperX Team"/>
      <meta property="og:url" content="https://skipperx.io"/>
      <link rel="stylesheet" href="/static/css/main.67f2fd46.css">
    </head>
    <body>
      <div id="root"></div>
      <script src="/static/js/main.c506c188.js"></script>
    </body>
  </html>
`

const bundleJs = `
  (0,Ba.jsxs)("h1",{children:["Your dream skill is, not days, not hours but ",(0,Ba.jsx)("span",{className:"highlight-red",children:"minutes "})," away"]})
  (0,Ba.jsx)("p",{children:"Built for Innovators, Entrepreneurs & Hustlers"})
  (0,Ba.jsx)("button",{children:"Careers"})
  (0,Ba.jsx)("span",{children:"About Us"})
  (0,Ba.jsx)("span",{children:"Contact Us"})
  (0,Ba.jsx)("a",{href:"#",children:"support@skipperx.io"})
`

test('SkipperX sentinel pins the verified official app shell and no-public-careers bundle signals', async () => {
  const skipperx = await loadModule()
  assert.ok(skipperx, 'SkipperX scraper module should load')

  assert.equal(skipperx.SOURCE, 'skipperx')
  assert.equal(skipperx.COMPANY, 'SkipperX')
  assert.equal(skipperx.HOMEPAGE_URL, 'https://www.skipperx.io/')
  assert.equal(skipperx.CAREERS_URL, 'https://www.skipperx.io/careers')
  assert.equal(skipperx.JOBS_URL, 'https://www.skipperx.io/jobs')
  assert.equal(skipperx.hasOfficialHomepageShell(homepageHtml), true)
  assert.equal(skipperx.hasOfficialRouteShell(careersHtml), true)
  assert.equal(skipperx.hasOfficialRouteShell(jobsHtml), true)
  assert.equal(skipperx.extractMainScriptUrl(homepageHtml, skipperx.HOMEPAGE_URL), 'https://www.skipperx.io/static/js/main.c506c188.js')
  assert.equal(skipperx.hasOfficialBundleSignals(bundleJs), true)
  assert.equal(skipperx.hasPublicJobBoardSignal(bundleJs), false)
  assert.equal(skipperx.definesPublicCareerRoute(bundleJs), false)
})

test('SkipperX run returns no jobs when the verified official homepage shell and placeholder careers bundle remain unchanged', async () => {
  const skipperx = await loadModule()
  assert.ok(skipperx, 'SkipperX scraper module should load')

  const requestedUrls = []
  const jobs = await skipperx.createSkipperXScraper().run({
    fetchText: async (url) => {
      requestedUrls.push(url)

      if (url === skipperx.HOMEPAGE_URL) return homepageHtml
      if (url === skipperx.CAREERS_URL) return careersHtml
      if (url === skipperx.JOBS_URL) return jobsHtml
      if (url === 'https://www.skipperx.io/static/js/main.c506c188.js') return bundleJs

      throw new Error(`Unexpected SkipperX URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [
    'https://www.skipperx.io/',
    'https://www.skipperx.io/careers',
    'https://www.skipperx.io/jobs',
    'https://www.skipperx.io/static/js/main.c506c188.js',
  ])
  assert.deepEqual(jobs, [])
})

test('SkipperX fails closed when the homepage shell or bundle drifts into a public careers surface', async () => {
  const skipperx = await loadModule()
  assert.ok(skipperx, 'SkipperX scraper module should load')

  await assert.rejects(
    skipperx.createSkipperXScraper().run({
      fetchText: async (url) => {
        if (url === skipperx.HOMEPAGE_URL) {
          return '<html><head><title>Unexpected</title></head><body>Not SkipperX</body></html>'
        }
        if (url === skipperx.CAREERS_URL) return careersHtml
        if (url === skipperx.JOBS_URL) return jobsHtml
        return bundleJs
      },
    }),
    /verified official homepage shell/i,
  )

  await assert.rejects(
    skipperx.createSkipperXScraper().run({
      fetchText: async (url) => {
        if (url === skipperx.HOMEPAGE_URL) return homepageHtml
        if (url === skipperx.CAREERS_URL) return careersHtml
        if (url === skipperx.JOBS_URL) return jobsHtml
        return `${bundleJs} path:"/careers"`
      },
    }),
    /public careers route/i,
  )

  await assert.rejects(
    skipperx.createSkipperXScraper().run({
      fetchText: async (url) => {
        if (url === skipperx.HOMEPAGE_URL) return homepageHtml
        if (url === skipperx.CAREERS_URL) return careersHtml
        if (url === skipperx.JOBS_URL) return jobsHtml
        return `${bundleJs} boards.greenhouse.io/skipperx View openings`
      },
    }),
    /public jobs surface/i,
  )
})
