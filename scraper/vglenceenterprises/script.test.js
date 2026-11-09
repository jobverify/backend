import assert from 'node:assert/strict'
import test from 'node:test'

const loadModule = async () => {
  try {
    return await import('./script.js')
  } catch {
    return null
  }
}

const shellHtml = `
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <link rel="icon" type="image/svg+xml" href="/logo-white.png" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>VGLENCE | sales booster</title>
    <link rel="stylesheet" href="/montserrat.css" />
    <script type="module" crossorigin src="/assets/index-CXKv6uBB.js"></script>
    <link rel="modulepreload" crossorigin href="/assets/vendor-react-D1u0J6rM.js">
    <link rel="modulepreload" crossorigin href="/assets/vendor-query-DArEN8uz.js">
    <link rel="modulepreload" crossorigin href="/assets/vendor-ui-BctUoQFA.js">
    <link rel="modulepreload" crossorigin href="/assets/vendor-redux-C4UxkRid.js">
    <link rel="stylesheet" crossorigin href="/assets/index-DI4W16j2.css">
  </head>
  <body>
    <div id="root"></div>
  </body>
</html>
`

const bundleJs = `
  o.jsx(oa,{path:"/",element:o.jsx(Bn,{children:o.jsx(pS,{})})})
  o.jsx(oa,{path:"/what",element:o.jsx(Bn,{children:o.jsx(iT,{})})})
  o.jsx(oa,{path:"/who",element:o.jsx(Bn,{children:o.jsx(xS,{})})})
  o.jsx(oa,{path:"/how-much",element:o.jsx(Bn,{children:o.jsx(bS,{})})})
  o.jsx(oa,{path:"/contribute",element:o.jsx(Bn,{children:o.jsx(oj,{})})})
  o.jsx(oa,{path:"/where",element:o.jsx(Bn,{children:o.jsx(ij,{})})})
  o.jsx(oa,{path:"/add-up",element:o.jsx(Bn,{children:o.jsx(cj,{})})})
  o.jsx(oa,{path:"/vglencers",element:o.jsx(Bn,{children:o.jsx(UC,{})})})
  o.jsx(oa,{path:"/book-a-demo",element:o.jsx(Bn,{children:o.jsx(_A,{})})})
  o.jsx(oa,{path:"/deal-driver",element:o.jsx(qs,{children:o.jsx(wO,{})})})
  o.jsx(oa,{path:"/troubleshooter",element:o.jsx(qs,{children:o.jsx(MO,{})})})
  o.jsx(oa,{path:"/code-commander",element:o.jsx(qs,{children:o.jsx(LO,{})})})
  o.jsx(oa,{path:"/apex",element:o.jsx(qs,{children:o.jsx(bw,{})})})
  o.jsx(oa,{path:"/coach",element:o.jsx(qs,{children:o.jsx(xw,{})})})
  o.jsx(oa,{path:"/lineup/:role",element:o.jsx(qs,{children:o.jsx(c5,{})})})
  o.jsx(oa,{path:"/dashboard/:role",element:o.jsx(qs,{children:o.jsx(C5,{})})})
  o.jsx(oa,{path:"/login",element:o.jsx(Bn,{children:o.jsx(yA,{})})})
  o.jsx(oa,{path:"/lo/dashboard",element:o.jsx(qs,{children:o.jsx(t5,{})})})
`

test('VGLENCE ENTERPRISES sentinel pins the verified official SPA shell, bundle, and checked careers-like routes', async () => {
  const scraper = await loadModule()
  assert.ok(scraper, 'VGLENCE ENTERPRISES scraper module should load')

  assert.equal(scraper.SOURCE, 'vglenceenterprises')
  assert.equal(scraper.COMPANY, 'VGLENCE ENTERPRISES')
  assert.equal(scraper.HOMEPAGE_URL, 'https://vglence.com/')
  assert.equal(scraper.CANONICAL_HOMEPAGE_URL, 'https://www.vglence.com/')
  assert.equal(scraper.BUNDLE_URL, 'https://www.vglence.com/assets/index-CXKv6uBB.js')
  assert.deepEqual(scraper.CAREERS_ROUTE_URLS, [
    'https://www.vglence.com/careers/',
    'https://www.vglence.com/career/',
    'https://www.vglence.com/jobs/',
  ])
  assert.equal(scraper.hasVerifiedShell(shellHtml), true)
  assert.equal(scraper.extractBundleUrl(shellHtml), scraper.BUNDLE_URL)
  assert.equal(scraper.hasVerifiedBundle(bundleJs), true)
  assert.equal(scraper.hasPublicJobSignals(shellHtml), false)
  assert.equal(scraper.hasPublicJobSignals(bundleJs), false)
})

test('VGLENCE ENTERPRISES sentinel returns no jobs only while the verified official shell and bundle stay unchanged', async () => {
  const scraper = await loadModule()
  assert.ok(scraper, 'VGLENCE ENTERPRISES scraper module should load')

  const requestedUrls = []
  const jobs = await scraper.createVglenceEnterprisesScraper().run({
    fetchPage: async (url) => {
      requestedUrls.push(url)

      if (url === scraper.HOMEPAGE_URL) {
        return {
          status: 200,
          url: scraper.CANONICAL_HOMEPAGE_URL,
          html: shellHtml,
        }
      }

      return {
        status: 200,
        url,
        html: shellHtml,
      }
    },
    fetchBundle: async (url) => {
      requestedUrls.push(url)
      assert.equal(url, scraper.BUNDLE_URL)
      return bundleJs
    },
  })

  assert.deepEqual(requestedUrls, [
    scraper.HOMEPAGE_URL,
    scraper.BUNDLE_URL,
    ...scraper.CAREERS_ROUTE_URLS,
  ])
  assert.deepEqual(jobs, [])
})

test('VGLENCE ENTERPRISES sentinel fails closed when the official shell, bundle, or checked routes drift into a jobs surface', async () => {
  const scraper = await loadModule()
  assert.ok(scraper, 'VGLENCE ENTERPRISES scraper module should load')

  await assert.rejects(
    scraper.createVglenceEnterprisesScraper().run({
      fetchPage: async () => ({
        status: 200,
        url: scraper.CANONICAL_HOMEPAGE_URL,
        html: '<html><body><h1>Unexpected page</h1></body></html>',
      }),
      fetchBundle: async () => bundleJs,
    }),
    /official homepage/i,
  )

  await assert.rejects(
    scraper.createVglenceEnterprisesScraper().run({
      fetchPage: async (url) => ({
        status: 200,
        url: url === scraper.HOMEPAGE_URL ? scraper.CANONICAL_HOMEPAGE_URL : url,
        html: shellHtml,
      }),
      fetchBundle: async () => 'o.jsx(oa,{path:"/careers",element:o.jsx("div",{children:"Apply now"})})',
    }),
    /bundle/i,
  )

  await assert.rejects(
    scraper.createVglenceEnterprisesScraper().run({
      fetchPage: async (url) => ({
        status: 200,
        url: url === scraper.HOMEPAGE_URL ? scraper.CANONICAL_HOMEPAGE_URL : url,
        html: url.endsWith('/jobs/')
          ? shellHtml.replace('</body>', '<a href="https://boards.greenhouse.io/vglence">Open roles</a></body>')
          : shellHtml,
      }),
      fetchBundle: async () => bundleJs,
    }),
    /public jobs/i,
  )
})
