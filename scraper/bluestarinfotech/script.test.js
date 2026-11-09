import assert from 'node:assert/strict'
import test from 'node:test'

const loadBlueStarModule = async () => {
  try {
    return await import('./script.js')
  } catch {
    assert.fail('Expected Blue Star Infotech scraper module at ./script.js')
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

const parkedLanderRedirect = {
  status: 307,
  url: 'https://www.bsil.com/lander',
  location: 'https://forsale.godaddy.com/forsale/www.bsil.com',
  html: '',
}

const parkedLanderHtml = `
<!doctype html>
<html lang="en">
  <head>
    <script>window.LANDER_SYSTEM = "PW"</script>
    <script>window._trfd = window._trfd || [], window._trfd.push({ ap: "parking" })</script>
  </head>
  <body></body>
</html>
`

const connectTimeoutError = () => {
  const error = new TypeError('fetch failed')
  error.cause = { code: 'UND_ERR_CONNECT_TIMEOUT' }
  return error
}

test('Blue Star Infotech validators and metadata reflect the Friday, August 7, 2026 parked-or-unreachable contract', async () => {
  const bluestar = await loadBlueStarModule()

  assert.equal(bluestar.VERIFIED_ON, '2026-08-07')
  assert.equal(bluestar.hasRedirectShellSignal(redirectShellHtml), true)
  assert.equal(bluestar.extractRedirectTarget(redirectShellHtml), '/lander')
  assert.equal(bluestar.hasParkedLanderRedirect(parkedLanderRedirect), true)
  assert.equal(
    bluestar.hasParkedLanderRedirect({
      status: 200,
      url: 'https://www.bsil.com/lander',
      location: null,
      html: parkedLanderHtml,
    }),
    true,
  )
  assert.equal(bluestar.isUnreachableError(connectTimeoutError()), true)
  assert.equal(bluestar.isUnavailableSurface({ status: null, errorKind: 'unreachable' }), true)
})

test('Blue Star Infotech returns an authoritative empty result for the verified parked shell and when every verified route is unreachable', async () => {
  const bluestar = await loadBlueStarModule()

  const parkedJobs = await bluestar.createBlueStarInfotechScraper().run({
    fetchPage: async (url) => {
      if (url === bluestar.LANDER_URL) return parkedLanderRedirect
      return { status: 200, url, html: redirectShellHtml }
    },
  })

  assert.deepEqual(parkedJobs, [])

  const unreachableJobs = await bluestar.createBlueStarInfotechScraper().run({
    fetchPage: async () => {
      throw connectTimeoutError()
    },
  })

  assert.deepEqual(unreachableJobs, [])
})
