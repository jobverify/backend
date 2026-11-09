import assert from 'node:assert/strict'
import test from 'node:test'

const loadIonicModule = async () => {
  try {
    return await import('./script.js')
  } catch {
    assert.fail('Expected Ionic Trading scraper module at ./script.js')
  }
}

const homepageHtml = `
<!doctype html>
<html lang="en">
  <head><title>Ionic - Trading Solutions API</title></head>
  <body>
    <h1>Solana Trading Infrastructure</h1>
    <p>Real-time Trading Data for Solana</p>
    <p>Access live market data, historical charts, holder analytics, and trader insights</p>
    <a href="https://dev.api.ionic.trade/docs">View Documentation</a>
  </body>
</html>
`

const aboutHtml = `
<!doctype html>
<html lang="en">
  <head><title>About - Ionic</title></head>
  <body>
    <p>Solana Trading API</p>
    <p>Real-time market data, wallet analytics, and trading infrastructure.</p>
  </body>
</html>
`

const blankShellHtml = `
<!doctype html>
<html lang="en">
  <head><title>Ionic</title></head>
  <body></body>
</html>
`

const timeoutSurface = (url) => ({
  url,
  finalUrl: url,
  status: null,
  html: null,
  errorKind: 'timeout',
})

test('Ionic Trading validators and metadata reflect the Friday, August 7, 2026 non-jobs-or-unreachable contract', async () => {
  const ionic = await loadIonicModule()

  assert.equal(ionic.VERIFIED_AT, '2026-08-07')
  assert.equal(ionic.hasOfficialHomepageSignal(homepageHtml), true)
  assert.equal(ionic.hasLinkedPublicJobsSurface(homepageHtml), false)
  assert.equal(ionic.isExpectedUnavailableSurface(timeoutSurface(ionic.HOMEPAGE_URL)), true)
})

test('Ionic Trading returns an authoritative empty result for the verified non-jobs surfaces and when all verified routes are unreachable', async () => {
  const ionic = await loadIonicModule()

  const reachableJobs = await ionic.createIonicTradingScraper().run({
    probeUrl: async (url) => {
      if (url === ionic.HOMEPAGE_URL) return { url, finalUrl: url, status: 200, html: homepageHtml, errorKind: null }
      if (/\/about$/i.test(url)) return { url, finalUrl: url, status: 200, html: aboutHtml, errorKind: null }
      return { url, finalUrl: url, status: 200, html: blankShellHtml, errorKind: null }
    },
  })

  assert.deepEqual(reachableJobs, [])

  const unreachableJobs = await ionic.createIonicTradingScraper().run({
    probeUrl: async (url) => timeoutSurface(url),
  })

  assert.deepEqual(unreachableJobs, [])
})
