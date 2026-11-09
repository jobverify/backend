import assert from 'node:assert/strict'
import test from 'node:test'

import {
  ABOUT_URL,
  CAREERS_ROUTE_URLS,
  COMPANY,
  HOMEPAGE_URL,
  LEGACY_HOME_URL,
  SITEMAP_URL,
  SOURCE,
  createSmartHealthGlobalTechnologiesScraper,
  extractCareerLikeUrlsFromSitemap,
  hasLegacyBridgeSignal,
  hasOfficialAboutSignal,
  hasOfficialHomepageSignal,
  hasPublicJobSignal,
  isMissingCareerRoute,
} from './script.js'

const legacyHtml = `
  <html>
    <head>
      <title>Smart Health Global</title>
    </head>
    <body>
      <h1>404</h1>
      <p>OOPS! The page could not be found.</p>
      <a href="https://shgtechnologies.com">Back to SHG Technologies</a>
    </body>
  </html>
`

const homepageHtml = `
  <html>
    <head>
      <title>SHG Technologies - Home</title>
    </head>
    <body>
      <nav>
        <a href="https://shgtechnologies.com/about-us">About Us</a>
        <a href="https://shgtechnologies.com/products/smart-vision-glasses">Smart Vision Glasses</a>
        <a href="https://shgtechnologies.com/partners">Partner with us</a>
      </nav>
      <h1>SHG Technologies</h1>
      <p>Innovative mobility solutions for the visually impaired community.</p>
    </body>
  </html>
`

const aboutHtml = `
  <html>
    <head>
      <title>SHG Technologies -</title>
    </head>
    <body>
      <h1>About Us</h1>
      <h2>Why We Started</h2>
      <p>
        At SHG Technologies, we believe that vision should never be a barrier to independence.
      </p>
      <p>Support: support@shgtechnologies.com</p>
      <p>
        Address: SHG Technologies Pvt. Ltd. Unit No. 507, Brigade Rubix, Plot No. 20,
        HMT Main Road, Bangalore - 560 013
      </p>
    </body>
  </html>
`

const sitemapXml = `
  <?xml version="1.0" encoding="UTF-8"?>
  <urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
    <url><loc>https://shgtechnologies.com/</loc></url>
    <url><loc>https://shgtechnologies.com/about-us</loc></url>
    <url><loc>https://shgtechnologies.com/products/smart-vision-glasses</loc></url>
    <url><loc>https://shgtechnologies.com/partners</loc></url>
  </urlset>
`

const notFoundHtml = `
  <html>
    <head>
      <title>Not Found</title>
    </head>
    <body>
      <h1>404 Not Found</h1>
    </body>
  </html>
`

const splitNotFoundHtml = `
  <html>
    <head>
      <title>Not Found</title>
    </head>
    <body>
      <div>404</div>
      <div>Not Found</div>
    </body>
  </html>
`

test('Smart Health Global Technologies sentinel recognizes the verified first-party bridge and no-public-careers surface', () => {
  assert.equal(SOURCE, 'smarthealthglobaltechnologies')
  assert.equal(COMPANY, 'Smart Health Global Technologies')
  assert.equal(LEGACY_HOME_URL, 'https://smarthealthglobal.in/')
  assert.equal(HOMEPAGE_URL, 'https://shgtechnologies.com/')
  assert.equal(ABOUT_URL, 'https://shgtechnologies.com/about-us')
  assert.equal(SITEMAP_URL, 'https://shgtechnologies.com/sitemap.xml')
  assert.deepEqual(CAREERS_ROUTE_URLS, [
    'https://shgtechnologies.com/careers',
    'https://shgtechnologies.com/career',
    'https://shgtechnologies.com/jobs',
    'https://shgtechnologies.com/job-openings',
  ])
  assert.equal(hasLegacyBridgeSignal(legacyHtml), true)
  assert.equal(hasOfficialHomepageSignal(homepageHtml), true)
  assert.equal(hasOfficialAboutSignal(aboutHtml), true)
  assert.deepEqual(extractCareerLikeUrlsFromSitemap(sitemapXml), [])
  assert.equal(isMissingCareerRoute(notFoundHtml), true)
  assert.equal(isMissingCareerRoute(splitNotFoundHtml), true)
  assert.equal(hasPublicJobSignal(homepageHtml), false)
  assert.equal(hasPublicJobSignal(aboutHtml), false)
})

test('Smart Health Global Technologies sentinel returns no jobs while the verified first-party surface stays unchanged', async () => {
  const requestedUrls = []

  const jobs = await createSmartHealthGlobalTechnologiesScraper().run({
    fetchText: async (url) => {
      requestedUrls.push(url)

      if (url === LEGACY_HOME_URL) return legacyHtml
      if (url === HOMEPAGE_URL) return homepageHtml
      if (url === ABOUT_URL) return aboutHtml
      if (url === SITEMAP_URL) return sitemapXml
      if (CAREERS_ROUTE_URLS.includes(url)) return notFoundHtml

      throw new Error(`Unexpected URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [
    LEGACY_HOME_URL,
    HOMEPAGE_URL,
    ABOUT_URL,
    SITEMAP_URL,
    ...CAREERS_ROUTE_URLS,
  ])
  assert.deepEqual(jobs, [])
})

test('Smart Health Global Technologies default fetch path accepts the verified 404 career routes', async () => {
  const originalFetch = globalThis.fetch

  globalThis.fetch = async (url) => {
    if (url === LEGACY_HOME_URL) {
      return new Response(legacyHtml, { status: 200, headers: { 'content-type': 'text/html' } })
    }

    if (url === HOMEPAGE_URL) {
      return new Response(homepageHtml, { status: 200, headers: { 'content-type': 'text/html' } })
    }

    if (url === ABOUT_URL) {
      return new Response(aboutHtml, { status: 200, headers: { 'content-type': 'text/html' } })
    }

    if (url === SITEMAP_URL) {
      return new Response(sitemapXml, { status: 200, headers: { 'content-type': 'application/xml' } })
    }

    if (CAREERS_ROUTE_URLS.includes(url)) {
      return new Response(notFoundHtml, { status: 404, headers: { 'content-type': 'text/html' } })
    }

    throw new Error(`Unexpected URL: ${url}`)
  }

  try {
    const jobs = await createSmartHealthGlobalTechnologiesScraper().run()
    assert.deepEqual(jobs, [])
  } finally {
    globalThis.fetch = originalFetch
  }
})

test('Smart Health Global Technologies sentinel fails closed when the verified public surface changes', async () => {
  await assert.rejects(
    createSmartHealthGlobalTechnologiesScraper().run({
      fetchText: async (url) => {
        if (url === LEGACY_HOME_URL) return legacyHtml.replace('Back to SHG Technologies', 'Back to Home')
        if (url === HOMEPAGE_URL) return homepageHtml
        if (url === ABOUT_URL) return aboutHtml
        if (url === SITEMAP_URL) return sitemapXml
        if (CAREERS_ROUTE_URLS.includes(url)) return notFoundHtml
        throw new Error(`Unexpected URL: ${url}`)
      },
    }),
    /legacy smart health global bridge/i,
  )

  await assert.rejects(
    createSmartHealthGlobalTechnologiesScraper().run({
      fetchText: async (url) => {
        if (url === LEGACY_HOME_URL) return legacyHtml
        if (url === HOMEPAGE_URL) return homepageHtml
        if (url === ABOUT_URL) return aboutHtml
        if (url === SITEMAP_URL) {
          return sitemapXml.replace(
            '</urlset>',
            '<url><loc>https://shgtechnologies.com/careers</loc></url></urlset>',
          )
        }
        if (CAREERS_ROUTE_URLS.includes(url)) return notFoundHtml
        throw new Error(`Unexpected URL: ${url}`)
      },
    }),
    /sitemap now advertises career-like urls/i,
  )

  await assert.rejects(
    createSmartHealthGlobalTechnologiesScraper().run({
      fetchText: async (url) => {
        if (url === LEGACY_HOME_URL) return legacyHtml
        if (url === HOMEPAGE_URL) return homepageHtml
        if (url === ABOUT_URL) return aboutHtml
        if (url === SITEMAP_URL) return sitemapXml
        if (url === 'https://shgtechnologies.com/careers') {
          return `
            <html>
              <head><title>Careers</title></head>
              <body>
                <h1>Current Openings</h1>
                <a href="/careers/backend-engineer">Backend Engineer</a>
              </body>
            </html>
          `
        }
        if (CAREERS_ROUTE_URLS.includes(url)) return notFoundHtml
        throw new Error(`Unexpected URL: ${url}`)
      },
    }),
    /public careers route changed/i,
  )
})
