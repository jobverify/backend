import assert from 'node:assert/strict'
import test from 'node:test'

const loadBizmaticsModule = async () => {
  try {
    return await import('./script.js')
  } catch {
    assert.fail('Expected Bizmatics India scraper module at ./script.js')
  }
}

const redirectShellHtml = `
<!doctype html>
<html>
  <head>
    <script>window.onload=function(){window.location.href="/lander"}</script>
  </head>
  <body></body>
</html>
`

const soldDomainHtml = `
<!doctype html>
<html>
  <body>
    <h1>bizmatics.com is for sale</h1>
    <p>Powered by GoDaddy</p>
    <a href="https://forsale.godaddy.com/">forsale.godaddy.com</a>
  </body>
</html>
`

const connectTimeoutError = () => {
  const error = new TypeError('fetch failed')
  error.cause = { code: 'UND_ERR_CONNECT_TIMEOUT' }
  return error
}

test('Bizmatics India validators and metadata reflect the Friday, August 7, 2026 sold-domain-or-unreachable contract', async () => {
  const bizmatics = await loadBizmaticsModule()

  assert.equal(bizmatics.VERIFIED_ON, '2026-08-07')
  assert.equal(bizmatics.hasRedirectShellSignal(redirectShellHtml), true)
  assert.equal(bizmatics.extractRedirectTarget(redirectShellHtml), '/lander')
  assert.equal(bizmatics.hasForSaleLanderSignal(soldDomainHtml), true)
  assert.equal(bizmatics.isUnreachableError(connectTimeoutError()), true)
  assert.equal(bizmatics.isUnavailableSurface({ status: null, errorKind: 'unreachable' }), true)
})

test('Bizmatics India returns an authoritative empty result for the verified sold-domain shell and when every verified route is unreachable', async () => {
  const bizmatics = await loadBizmaticsModule()

  const soldDomainJobs = await bizmatics.createBizmaticsIndiaScraper().run({
    fetchPage: async (url) => {
      if (url === bizmatics.SOLD_DOMAIN_URL) return { status: 200, url, html: soldDomainHtml }
      return { status: 200, url, html: redirectShellHtml }
    },
  })

  assert.deepEqual(soldDomainJobs, [])

  const unreachableJobs = await bizmatics.createBizmaticsIndiaScraper().run({
    fetchPage: async () => {
      throw connectTimeoutError()
    },
  })

  assert.deepEqual(unreachableJobs, [])
})
