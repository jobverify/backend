import assert from 'node:assert/strict'
import test from 'node:test'

const loadModule = async () => {
  try {
    return await import('../../scraper/srinsofttechnologies/script.js')
  } catch {
    assert.fail('Expected SrinSoft Technologies scraper module at ../../scraper/srinsofttechnologies/script.js')
  }
}

test('SrinSoft Technologies reports a typed blocked failure when the careers route serves HTTP 307', async () => {
  const srinsoft = await loadModule()
  const redirectChallenge = Object.assign(
    new Error(`HTTP 307 for ${srinsoft.CAREERS_URL}`),
    { status: 307 },
  )
  const requestedUrls = []

  await assert.rejects(
    srinsoft.createSrinSoftTechnologiesScraper().run({
      fetchText: async (url) => {
        requestedUrls.push(url)
        throw redirectChallenge
      },
    }),
    (error) => {
      assert.match(error.message, /SrinSoft Technologies careers route is currently blocked/i)
      assert.equal(error.cause, redirectChallenge)
      assert.equal(error.failureKind, 'blocked_or_access_denied')
      assert.equal(error.softFailure, true)
      assert.equal(error.upstreamOutage, true)
      assert.equal(error.abortRetries, true)
      return true
    },
  )

  assert.deepEqual(requestedUrls, [srinsoft.CAREERS_URL])
})
