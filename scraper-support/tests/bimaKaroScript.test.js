import assert from 'node:assert/strict'
import test from 'node:test'

const loadBimaKaroModule = async () => {
  try {
    return await import('../../scraper/bimakaro/script.js')
  } catch {
    assert.fail('Expected BimaKaro scraper module at ../../scraper/bimakaro/script.js')
  }
}

const wrappedTimeout = () => {
  const cause = new Error('Connect Timeout Error (attempted address: www.bimakaro.in:80, timeout: 10000ms)')
  cause.name = 'ConnectTimeoutError'
  cause.code = 'UND_ERR_CONNECT_TIMEOUT'
  const error = new TypeError('fetch failed')
  error.cause = cause
  return error
}

test('BimaKaro recognizes the verified official host timeout state', async () => {
  const bimakaro = await loadBimaKaroModule()

  assert.equal(bimakaro.HOMEPAGE_URL, 'http://www.bimakaro.in/')
  assert.equal(bimakaro.CAREERS_URL, 'http://www.bimakaro.in/careers')
  assert.equal(bimakaro.hasBrokenOfficialSurfaceError(new Error('connect ETIMEDOUT')), true)
  assert.equal(bimakaro.hasBrokenOfficialSurfaceError(new Error('network timeout while fetching')), true)
  assert.equal(bimakaro.hasBrokenOfficialSurfaceError(wrappedTimeout()), true)
  assert.equal(bimakaro.hasBrokenOfficialSurfaceError(new Error('HTTP 200')), false)
})

test('BimaKaro returns no jobs only while both official routes still time out', async () => {
  const bimakaro = await loadBimaKaroModule()
  const requested = []

  const jobs = await bimakaro.createBimaKaroScraper().run({
    fetchText: async (url, options) => {
      requested.push({ url, options })
      throw new Error('connect ETIMEDOUT')
    },
  })

  assert.deepEqual(
    requested,
    [
      { url: bimakaro.HOMEPAGE_URL, options: { attempts: 1 } },
      { url: bimakaro.CAREERS_URL, options: { attempts: 1 } },
    ],
  )
  assert.deepEqual(jobs, [])
})

test('BimaKaro fails closed when either official route stops matching the verified timeout state', async () => {
  const bimakaro = await loadBimaKaroModule()

  await assert.rejects(
    bimakaro.createBimaKaroScraper().run({
      fetchText: async (url) => {
        if (url === bimakaro.HOMEPAGE_URL) return '<html><title>Recovered</title></html>'
        throw new Error('connect ETIMEDOUT')
      },
    }),
    /official host no longer matches the verified broken public surface/i,
  )

  await assert.rejects(
    bimakaro.createBimaKaroScraper().run({
      fetchText: async (url) => {
        if (url === bimakaro.HOMEPAGE_URL) throw new Error('connect ETIMEDOUT')
        throw new Error('ECONNRESET')
      },
    }),
    /careers route no longer matches the verified broken public surface/i,
  )
})
