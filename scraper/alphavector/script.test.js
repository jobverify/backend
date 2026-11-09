import assert from 'node:assert/strict'
import test from 'node:test'

const loadAlphavectorModule = async () => {
  try {
    return await import('./script.js')
  } catch {
    assert.fail('Expected Alphavector scraper module at ./script.js')
  }
}

const parkedShellHtml = `
<!doctype html>
<html>
  <head>
    <script>
      window.onload = function () { window.location.href = "/lander" }
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
  <url><loc>https://alphavector.co/lander</loc></url>
</urlset>
`

const connectTimeoutError = () => {
  const error = new TypeError('fetch failed')
  error.cause = { code: 'UND_ERR_CONNECT_TIMEOUT' }
  return error
}

test('Alphavector validators and metadata reflect the Friday, August 7, 2026 parked-or-unreachable contract', async () => {
  const alphavector = await loadAlphavectorModule()

  assert.equal(alphavector.VERIFIED_ON, '2026-08-07')
  assert.equal(alphavector.hasParkedHomepageSignal(parkedShellHtml), true)
  assert.equal(alphavector.hasExpectedRobotsTxtSignal(robotsTxt), true)
  assert.equal(alphavector.hasExpectedSitemapSignal(sitemapXml), true)
  assert.equal(alphavector.isUnreachableError(connectTimeoutError()), true)
  assert.equal(alphavector.isUnavailableSurface({ status: null, errorKind: 'unreachable' }), true)
})

test('Alphavector returns an authoritative empty result for the verified parked surface and when every verified route is unreachable', async () => {
  const alphavector = await loadAlphavectorModule()

  const parkedJobs = await alphavector.createAlphavectorScraper().run({
    fetchPage: async (url) => {
      if (url === alphavector.ROBOTS_TXT_URL) return { status: 200, url, html: robotsTxt }
      if (url === alphavector.SITEMAP_URL) return { status: 200, url, html: sitemapXml }
      return { status: 200, url, html: parkedShellHtml }
    },
  })

  assert.deepEqual(parkedJobs, [])

  const unreachableJobs = await alphavector.createAlphavectorScraper().run({
    fetchPage: async () => {
      throw connectTimeoutError()
    },
  })

  assert.deepEqual(unreachableJobs, [])
})
