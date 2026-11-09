import assert from 'node:assert/strict'
import test from 'node:test'

const loadModule = async () => import('./script.js')

const homepageHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>unloxacademy.com</title>
    <meta name="author" content="Unlox Academy" />
    <meta property="og:site_name" content="Unlox Academy" />
  </head>
  <body>
    <h1>Launching soon</h1>
    <a href="/contact-us/">Contact Us</a>
    <footer>Copyright © 2025 Unlox Academy - All Rights Reserved. Powered by Example</footer>
  </body>
</html>
`

const sitemapIndexXml = `
<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex>
  <sitemap>
    <loc>http://unloxacademy.com/sitemap.website.xml</loc>
  </sitemap>
</sitemapindex>
`

const homepageSitemapXml = `
<?xml version="1.0" encoding="UTF-8"?>
<urlset>
  <url>
    <loc>http://unloxacademy.com/</loc>
  </url>
</urlset>
`

const notFoundHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>unloxacademy.com</title>
  </head>
  <body>
    <h1>Page Not Found</h1>
    <p>We can’t seem to find the page you’re looking for.</p>
    <a href="/">Go To Home Page</a>
    <footer>Copyright © 2025 Unlox Academy - All Rights Reserved. Powered by Example</footer>
  </body>
</html>
`

const createUnavailableError = () => {
  const error = new Error('fetch failed')
  error.cause = {
    code: 'UND_ERR_CONNECT_TIMEOUT',
    message: 'Connect Timeout Error (attempted addresses: 76.223.105.230:443, 13.248.243.5:443, timeout: 10000ms)',
  }
  return error
}

test('Unlox Academy recognizes the current branded missing-route template with smart apostrophes', async () => {
  const unlox = await loadModule()

  assert.equal(unlox.hasOfficialHomepageSignal(homepageHtml), true)
  assert.equal(unlox.hasVerifiedSitemapIndexSignal(sitemapIndexXml), true)
  assert.equal(unlox.hasVerifiedHomepageSitemapSignal(homepageSitemapXml), true)
  assert.equal(
    unlox.isVerifiedMissingCareerRoute({
      status: 404,
      url: 'https://unloxacademy.com/careers',
      html: notFoundHtml,
    }),
    true,
  )
})

test('Unlox Academy returns no jobs while its verified career-like routes remain branded 404s', async () => {
  const unlox = await loadModule()

  const jobs = await unlox.createUnloxAcademyScraper().run({
    fetchPage: async (url) => {
      if (url === unlox.HOMEPAGE_URL) {
        return { status: 200, url, html: homepageHtml }
      }

      if (url === unlox.SITEMAP_INDEX_URL) {
        return { status: 200, url, html: sitemapIndexXml }
      }

      if (url === unlox.SITEMAP_URL) {
        return { status: 200, url, html: homepageSitemapXml }
      }

      if (unlox.NO_PUBLIC_CAREERS_ROUTE_URLS.includes(url)) {
        return { status: 404, url, html: notFoundHtml }
      }

      throw new Error(`Unexpected URL: ${url}`)
    },
  })

  assert.deepEqual(jobs, [])
})

test('Unlox Academy returns [] when every verified no-public-jobs surface is temporarily unreachable from this runtime', async () => {
  const unlox = await loadModule()

  assert.equal(unlox.isVerifiedUnloxAcademyUnavailableError(createUnavailableError()), true)

  const jobs = await unlox.createUnloxAcademyScraper().run({
    fetchPage: async () => {
      throw createUnavailableError()
    },
  })

  assert.deepEqual(jobs, [])
})

test('Unlox Academy returns [] when a verified no-public-careers route intermittently falls through to a first-party 429 response', async () => {
  const unlox = await loadModule()

  const jobs = await unlox.createUnloxAcademyScraper().run({
    fetchPage: async (url) => {
      if (url === unlox.HOMEPAGE_URL) {
        throw createUnavailableError()
      }

      if (url === unlox.SITEMAP_INDEX_URL) {
        return { status: 200, url, html: sitemapIndexXml }
      }

      if (url === unlox.SITEMAP_URL) {
        return { status: 200, url, html: homepageSitemapXml }
      }

      if (url === 'https://unloxacademy.com/join-us/') {
        return { status: 429, url, html: '' }
      }

      if (unlox.NO_PUBLIC_CAREERS_ROUTE_URLS.includes(url)) {
        return { status: 404, url, html: notFoundHtml }
      }

      throw new Error(`Unexpected URL: ${url}`)
    },
  })

  assert.deepEqual(jobs, [])
})
