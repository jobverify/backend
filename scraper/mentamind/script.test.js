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
      <meta charset="UTF-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      <title>Mentamind - AI Mental Health Support</title>
      <script type="module" crossorigin src="/assets/index-a6d19623.js"></script>
    </head>
    <body>
      <div id="root"></div>
    </body>
  </html>
`

const privacyPageHtml = `
  <!doctype html>
  <html lang="en">
    <head>
      <title>Mentamind - AI Mental Health Support</title>
      <script type="module" crossorigin src="/assets/index-a6d19623.js"></script>
    </head>
    <body>
      <div id="root"></div>
    </body>
  </html>
`

const termsPageHtml = `
  <!doctype html>
  <html lang="en">
    <head>
      <title>Mentamind - AI Mental Health Support</title>
      <script type="module" crossorigin src="/assets/index-a6d19623.js"></script>
    </head>
    <body>
      <div id="root"></div>
    </body>
  </html>
`

const bundleText = `
  const brand = "Mentamind Technologies Private Limited";
  const contact = "support@mentamind.in";
  const legalRoutes = ["/privacy-policy", "/terms-of-service"];
  const nav = ["Home", "Features", "Support"];
  console.log(brand, contact, legalRoutes, nav);
`

test('Mentamind validates the official shell, bundle identity, legal routes, and same-shell careers fallbacks', async () => {
  const mentamind = await loadModule()
  assert.ok(mentamind, 'Mentamind scraper module should load')

  assert.equal(mentamind.SOURCE, 'mentamind')
  assert.equal(mentamind.COMPANY, 'Mentamind')
  assert.equal(mentamind.HOMEPAGE_URL, 'https://mentamind.in/')
  assert.deepEqual(mentamind.LEGAL_ROUTE_URLS, [
    'https://mentamind.in/privacy-policy',
    'https://mentamind.in/terms-of-service',
  ])
  assert.deepEqual(mentamind.NO_PUBLIC_CAREERS_ROUTE_URLS, [
    'https://mentamind.in/careers',
    'https://mentamind.in/career',
    'https://mentamind.in/jobs',
    'https://mentamind.in/job-openings',
  ])
  assert.equal(mentamind.hasOfficialHomepageSignal(homepageHtml), true)
  assert.equal(mentamind.extractMainBundleAssetPath(homepageHtml), '/assets/index-a6d19623.js')
  assert.equal(mentamind.hasVerifiedBundleIdentity(bundleText), true)
  assert.equal(mentamind.hasBundleJobsSignal(bundleText), false)
  assert.equal(
    mentamind.isVerifiedLegalRoutePage({
      status: 200,
      url: mentamind.LEGAL_ROUTE_URLS[0],
      html: privacyPageHtml,
    }, '/assets/index-a6d19623.js'),
    true,
  )
  assert.equal(
    mentamind.isVerifiedLegalRoutePage({
      status: 200,
      url: mentamind.LEGAL_ROUTE_URLS[1],
      html: termsPageHtml,
    }, '/assets/index-a6d19623.js'),
    true,
  )
  assert.equal(
    mentamind.isVerifiedRouteFallbackShell({
      status: 200,
      url: mentamind.NO_PUBLIC_CAREERS_ROUTE_URLS[0],
      html: homepageHtml,
    }, homepageHtml, '/assets/index-a6d19623.js'),
    true,
  )
})

test('Mentamind returns no jobs only while the verified SPA shell and bundle contract remains intact', async () => {
  const mentamind = await loadModule()
  assert.ok(mentamind, 'Mentamind scraper module should load')

  const requestedUrls = []
  const jobs = await mentamind.createMentamindScraper().run({
    fetchPage: async (url) => {
      requestedUrls.push(url)
      if (url === mentamind.HOMEPAGE_URL) return { status: 200, url, html: homepageHtml }
      if (url === mentamind.LEGAL_ROUTE_URLS[0]) return { status: 200, url, html: privacyPageHtml }
      if (url === mentamind.LEGAL_ROUTE_URLS[1]) return { status: 200, url, html: termsPageHtml }
      if (mentamind.NO_PUBLIC_CAREERS_ROUTE_URLS.includes(url)) {
        return { status: 200, url, html: homepageHtml }
      }
      throw new Error(`Unexpected fixture page URL: ${url}`)
    },
    fetchText: async (url) => {
      requestedUrls.push(url)
      if (url === 'https://mentamind.in/assets/index-a6d19623.js') return bundleText
      throw new Error(`Unexpected fixture text URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [
    mentamind.HOMEPAGE_URL,
    'https://mentamind.in/assets/index-a6d19623.js',
    ...mentamind.LEGAL_ROUTE_URLS,
    ...mentamind.NO_PUBLIC_CAREERS_ROUTE_URLS,
  ])
  assert.deepEqual(jobs, [])
})

test('Mentamind fails closed when the homepage, bundle, legal routes, or careers shell contract changes', async () => {
  const mentamind = await loadModule()
  assert.ok(mentamind, 'Mentamind scraper module should load')

  await assert.rejects(
    mentamind.createMentamindScraper().run({
      fetchPage: async (url) => {
        if (url === mentamind.HOMEPAGE_URL) {
          return { status: 200, url, html: '<html><body><h1>Unexpected shell</h1></body></html>' }
        }
        return { status: 200, url, html: homepageHtml }
      },
      fetchText: async () => bundleText,
    }),
    /verified official homepage/i,
  )

  await assert.rejects(
    mentamind.createMentamindScraper().run({
      fetchPage: async (url) => {
        if (url === mentamind.HOMEPAGE_URL) return { status: 200, url, html: homepageHtml }
        return { status: 200, url, html: homepageHtml }
      },
      fetchText: async () => 'Mentamind Technologies Private Limited support@mentamind.in /careers',
    }),
    /client bundle changed materially or now exposes a public jobs surface/i,
  )

  await assert.rejects(
    mentamind.createMentamindScraper().run({
      fetchPage: async (url) => {
        if (url === mentamind.HOMEPAGE_URL) return { status: 200, url, html: homepageHtml }
        if (url === mentamind.LEGAL_ROUTE_URLS[0]) {
          return { status: 404, url, html: '<html><body>Missing privacy page</body></html>' }
        }
        if (url === mentamind.LEGAL_ROUTE_URLS[1]) return { status: 200, url, html: termsPageHtml }
        return { status: 200, url, html: homepageHtml }
      },
      fetchText: async () => bundleText,
    }),
    /legal routes changed materially/i,
  )

  await assert.rejects(
    mentamind.createMentamindScraper().run({
      fetchPage: async (url) => {
        if (url === mentamind.HOMEPAGE_URL) return { status: 200, url, html: homepageHtml }
        if (mentamind.LEGAL_ROUTE_URLS.includes(url)) return { status: 200, url, html: privacyPageHtml }
        return {
          status: 200,
          url,
          html: '<html><body><h1>Current openings</h1><a href="/apply">Apply now</a></body></html>',
        }
      },
      fetchText: async () => bundleText,
    }),
    /checked first-party routes changed materially or now expose public jobs/i,
  )
})
