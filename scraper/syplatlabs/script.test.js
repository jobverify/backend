import assert from 'node:assert/strict'
import test from 'node:test'

const loadModule = async () => {
  try {
    return await import('./script.js')
  } catch {
    assert.fail('Expected SYplat Labs scraper module at ./script.js')
  }
}

const homepageShellHtml = `
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>SYplat Labs - The autonomous trust fabric for AI-driven enterprises</title>
    <meta
      name="description"
      content="SY Platform: a semantic security fabric that governs people and AI actors on a single, AI-native knowledge graph. SAP Build Partner. Microsoft AI Cloud Partner."
    />
    <meta name="author" content="SYplat Labs" />
    <script type="module" crossorigin src="/assets/index-aS5FxsGL.js"></script>
  </head>
  <body>
    <a href="#main-content">Skip to main content</a>
    <div id="root"></div>
  </body>
</html>
`

const bundleText = `
path:"/"
path:"/platform"
path:"/sy-integration"
path:"/ecosystem"
path:"/engagement"
path:"/roadmap"
path:"/about"
path:"/contact"
path:"/synexira"
path:"/resources"
path:"/legal/privacy"
path:"/legal/accessibility"
path:"/legal/cookies"
path:"/legal/terms"
path:"/legal/imprint"
`

const homepagePage = {
  status: 200,
  url: 'https://www.syplat.com/',
  text: homepageShellHtml,
}

const careersShellPage = {
  status: 200,
  url: 'https://www.syplat.com/careers',
  text: homepageShellHtml,
}

const jobsShellPage = {
  status: 200,
  url: 'https://www.syplat.com/jobs',
  text: homepageShellHtml,
}

const publicJobsPage = {
  status: 200,
  url: 'https://www.syplat.com/careers',
  text: `
    <html>
      <head>
        <title>Careers - SYplat Labs</title>
      </head>
      <body>
        <main>
          <h1>Current Openings</h1>
          <article>
            <h2>Security Engineer</h2>
            <a href="/careers/security-engineer">Apply now</a>
          </article>
        </main>
      </body>
    </html>
  `,
}

test('SYplat Labs sentinel pins the verified first-party homepage shell, bundle route map, and checked public routes', async () => {
  const syplat = await loadModule()

  assert.equal(syplat.SOURCE, 'syplatlabs')
  assert.equal(syplat.COMPANY, 'SYplat Labs')
  assert.equal(syplat.HOMEPAGE_URL, 'https://www.syplat.com/')
  assert.equal(syplat.REDIRECTED_HOMEPAGE_URL, 'https://www.syplat.com/')
  assert.deepEqual(syplat.CAREERS_ROUTE_URLS, [
    'https://www.syplat.com/careers',
    'https://www.syplat.com/jobs',
  ])
  assert.deepEqual(syplat.EXPECTED_BUNDLE_ROUTES, [
    '/',
    '/about',
    '/contact',
    '/ecosystem',
    '/engagement',
    '/legal/accessibility',
    '/legal/cookies',
    '/legal/imprint',
    '/legal/privacy',
    '/legal/terms',
    '/platform',
    '/resources',
    '/roadmap',
    '/sy-integration',
    '/synexira',
  ])
  assert.equal(syplat.hasOfficialHomepageShellSignal(homepageShellHtml), true)
  assert.equal(
    syplat.extractBundleUrl(homepageShellHtml, syplat.REDIRECTED_HOMEPAGE_URL),
    'https://www.syplat.com/assets/index-aS5FxsGL.js',
  )
  assert.deepEqual(syplat.extractBundleRoutes(bundleText), syplat.EXPECTED_BUNDLE_ROUTES)
  assert.equal(syplat.hasVerifiedBundleRouteSignal(bundleText), true)
  assert.equal(syplat.hasExplicitCareersSignal(bundleText), false)
  assert.equal(syplat.isVerifiedNoPublicJobsRoute(careersShellPage), true)
  assert.equal(syplat.isVerifiedNoPublicJobsRoute(jobsShellPage), true)
  assert.equal(syplat.isVerifiedNoPublicJobsRoute(publicJobsPage), false)
})

test('SYplat Labs sentinel returns an empty list only while the verified first-party no-careers contract holds', async () => {
  const syplat = await loadModule()
  const requestedUrls = []

  const jobs = await syplat.createSyplatLabsScraper().run({
    fetchPage: async (url) => {
      requestedUrls.push(url)

      if (url === syplat.HOMEPAGE_URL) {
        return homepagePage
      }

      if (url === 'https://www.syplat.com/assets/index-aS5FxsGL.js') {
        return {
          status: 200,
          url,
          text: bundleText,
        }
      }

      if (url === syplat.CAREERS_ROUTE_URLS[0]) {
        return careersShellPage
      }

      if (url === syplat.CAREERS_ROUTE_URLS[1]) {
        return jobsShellPage
      }

      throw new Error(`Unexpected URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [
    syplat.HOMEPAGE_URL,
    'https://www.syplat.com/assets/index-aS5FxsGL.js',
    ...syplat.CAREERS_ROUTE_URLS,
  ])
  assert.deepEqual(jobs, [])
})

test('SYplat Labs sentinel fails closed when the verified homepage, bundle route map, or checked public routes drift', async () => {
  const syplat = await loadModule()

  await assert.rejects(
    syplat.createSyplatLabsScraper().run({
      fetchPage: async (url) => {
        if (url === syplat.HOMEPAGE_URL) {
          return {
            status: 200,
            url: 'https://syplat-labs.com/',
            text: homepageShellHtml,
          }
        }

        throw new Error(`Unexpected URL: ${url}`)
      },
    }),
    /verified homepage redirect or shell/i,
  )

  await assert.rejects(
    syplat.createSyplatLabsScraper().run({
      fetchPage: async (url) => {
        if (url === syplat.HOMEPAGE_URL) {
          return homepagePage
        }

        if (url === 'https://www.syplat.com/assets/index-aS5FxsGL.js') {
          return {
            status: 200,
            url,
            text: `${bundleText}\npath:"/careers"`,
          }
        }

        throw new Error(`Unexpected URL: ${url}`)
      },
    }),
    /verified bundle route map/i,
  )

  await assert.rejects(
    syplat.createSyplatLabsScraper().run({
      fetchPage: async (url) => {
        if (url === syplat.HOMEPAGE_URL) {
          return homepagePage
        }

        if (url === 'https://www.syplat.com/assets/index-aS5FxsGL.js') {
          return {
            status: 200,
            url,
            text: bundleText,
          }
        }

        if (url === syplat.CAREERS_ROUTE_URLS[0]) {
          return publicJobsPage
        }

        if (url === syplat.CAREERS_ROUTE_URLS[1]) {
          return jobsShellPage
        }

        throw new Error(`Unexpected URL: ${url}`)
      },
    }),
    /verified \/careers route changed materially or now exposes public jobs/i,
  )
})
