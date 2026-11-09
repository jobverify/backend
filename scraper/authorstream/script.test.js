import assert from 'node:assert/strict'
import test from 'node:test'

const loadAuthorStreamModule = async () => {
  try {
    return await import('./script.js')
  } catch {
    assert.fail('Expected AuthorStream scraper module at ./script.js')
  }
}

const redirectShellHtml = `
<!doctype html>
<html lang="en">
  <head>
    <script>
      window.onload = function () { window.location.href = "/lander"; }
    </script>
  </head>
  <body></body>
</html>
`

const robotsTxt = `
User-agent: *
Allow: /
LLM-Policy: /llms.txt
Sitemap: /sitemap.xml
`

const sitemapXml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url><loc>https://authorstream.com/lander</loc></url>
</urlset>
`

const parkedLanderRedirect = {
  status: 307,
  url: 'https://authorstream.com/lander',
  location: 'https://forsale.godaddy.com/forsale/authorstream.com',
  html: '',
}

const connectTimeoutError = () => {
  const error = new TypeError('fetch failed')
  error.cause = { code: 'UND_ERR_CONNECT_TIMEOUT' }
  return error
}

test('AuthorStream validators and metadata reflect the Friday, August 7, 2026 parked-or-unreachable contract', async () => {
  const authorstream = await loadAuthorStreamModule()

  assert.equal(authorstream.VERIFIED_AT, '2026-08-07')
  assert.equal(authorstream.hasRedirectShellSignal(redirectShellHtml), true)
  assert.equal(authorstream.extractRedirectTarget(redirectShellHtml), '/lander')
  assert.equal(authorstream.hasExpectedRobotsTxtSignal(robotsTxt), true)
  assert.equal(authorstream.hasExpectedSitemapSignal(sitemapXml), true)
  assert.equal(authorstream.hasParkedLanderRedirect(parkedLanderRedirect), true)
  assert.equal(authorstream.isUnreachableError(connectTimeoutError()), true)
  assert.equal(authorstream.isUnavailableSurface({ status: null, errorKind: 'unreachable' }), true)
})

test('AuthorStream returns an authoritative empty result for the verified parked surface and when every verified route is unreachable', async () => {
  const authorstream = await loadAuthorStreamModule()

  const parkedJobs = await authorstream.createAuthorStreamScraper().run({
    fetchPage: async (url) => {
      if (url === authorstream.ROBOTS_TXT_URL) return { status: 200, url, html: robotsTxt }
      if (url === authorstream.SITEMAP_URL) return { status: 200, url, html: sitemapXml }
      if (url === authorstream.LANDER_URL) return parkedLanderRedirect
      return { status: 200, url, html: redirectShellHtml }
    },
  })

  assert.deepEqual(parkedJobs, [])

  const unreachableJobs = await authorstream.createAuthorStreamScraper().run({
    fetchPage: async () => {
      throw connectTimeoutError()
    },
  })

  assert.deepEqual(unreachableJobs, [])
})
