import assert from 'node:assert/strict'
import test from 'node:test'

const loadPingSafeModule = async () => {
  try {
    return await import('../../scraper/pingsafe/script.js')
  } catch {
    assert.fail('Expected Ping Safe scraper module at ../../scraper/pingsafe/script.js')
  }
}

const redirectedProductPage = `
<!doctype html>
<html lang="en">
  <head>
    <title>Singularity Cloud Native Security | SentinelOne</title>
  </head>
  <body>
    <main>
      <h1>Singularity Cloud Native Security</h1>
      <p>Leverage a unique offensive engine with Verified Exploit Paths.</p>
      <a href="/about/careers/">Careers</a>
    </main>
  </body>
</html>
`

test('Ping Safe pins the verified official domain redirect to SentinelOne cloud native security', async () => {
  const pingsafe = await loadPingSafeModule()

  assert.equal(pingsafe.HOMEPAGE_URL, 'https://www.pingsafe.com/')
  assert.equal(
    pingsafe.EXPECTED_DESTINATION_URL,
    'https://www.sentinelone.com/platform/singularity-cloud-native-security/',
  )
  assert.equal(pingsafe.hasVerifiedDestinationSignal(redirectedProductPage), true)
  assert.equal(
    pingsafe.isExpectedDestinationUrl(pingsafe.EXPECTED_DESTINATION_URL),
    true,
  )
})

test('Ping Safe returns no jobs when the official domain only redirects to the acquirer product page', async () => {
  const pingsafe = await loadPingSafeModule()
  const requestedUrls = []

  const jobs = await pingsafe.createPingSafeScraper().run({
    fetchPage: async (url) => {
      requestedUrls.push(url)
      return {
        finalUrl: pingsafe.EXPECTED_DESTINATION_URL,
        html: redirectedProductPage,
      }
    },
  })

  assert.deepEqual(requestedUrls, [pingsafe.HOMEPAGE_URL])
  assert.deepEqual(jobs, [])
})

test('Ping Safe fails closed when the official domain stops matching the verified redirect surface', async () => {
  const pingsafe = await loadPingSafeModule()

  await assert.rejects(
    pingsafe.createPingSafeScraper().run({
      fetchPage: async () => ({
        finalUrl: 'https://www.pingsafe.com/careers',
        html: '<html><body>Unexpected page</body></html>',
      }),
    }),
    /verified official public surface/i,
  )
})
