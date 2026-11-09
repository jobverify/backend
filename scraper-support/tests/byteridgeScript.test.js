import assert from 'node:assert/strict'
import test from 'node:test'

const loadByteridgeModule = async () => {
  try {
    return await import('../../scraper/byteridge/script.js')
  } catch {
    return null
  }
}

const careersHtml = `
<!doctype html>
<html>
  <body>
    <section class="careers">
      <h1>Join Our Team</h1>
      <p>Upload your profile for the job areas you're interested in. You'll be notified when an opportunity becomes available.</p>
      <a href="mailto:team-hiring@staging.byteridge.com">Submit Your CV</a>
    </section>
  </body>
</html>
`

test('extractOpenings returns an empty job list when Byteridge only exposes a talent-pool CTA', async () => {
  const byteridge = await loadByteridgeModule()
  assert.ok(byteridge)

  const jobs = byteridge.extractOpenings(careersHtml)

  assert.deepEqual(jobs, [])
})

test('a talent pool alone cannot certify an empty Byteridge inventory', async () => {
  const byteridge = await loadByteridgeModule()
  assert.ok(byteridge)

  const requestedUrls = []
  const scraper = byteridge.createByteridgeScraper()

  await assert.rejects(scraper.run({
    fetchText: async (url) => {
      requestedUrls.push(url)
      if (url === byteridge.CAREER_PAGE_URL) return careersHtml
      throw new Error(`Unexpected URL: ${url}`)
    },
  }), error => error.code === 'BYTERIDGE_NATIVE_CONTRACT')

  assert.deepEqual(requestedUrls, [byteridge.CAREER_PAGE_URL])
})

test('run reports Byteridge transport timeouts as soft upstream failures', async () => {
  const byteridge = await loadByteridgeModule()
  assert.ok(byteridge)

  await assert.rejects(
    byteridge.createByteridgeScraper().run({
      fetchText: async () => {
        const error = new Error('connect ETIMEDOUT 82.112.233.102:443')
        error.code = 'ETIMEDOUT'
        throw error
      },
    }),
    (error) => {
      assert.match(error.message, /ETIMEDOUT/i)
      assert.equal(error.softFailure, true)
      assert.equal(error.upstreamOutage, true)
      assert.equal(error.abortRetries, true)
      assert.equal(error.failureKind, 'network_or_timeout')
      return true
    },
  )
})
