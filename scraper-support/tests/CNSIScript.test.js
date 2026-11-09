import assert from 'node:assert/strict'
import test from 'node:test'

const loadModule = async () => {
  try {
    return await import('../../scraper/cnsi/script.js')
  } catch {
    assert.fail('Expected CNSI scraper module at ../../scraper/cnsi/script.js')
  }
}

test('CNSI helpers stay pinned to the verified no-public-surface sentinel contract', async () => {
  const cnsi = await loadModule()

  assert.equal(cnsi.SOURCE, 'cnsi')
  assert.equal(cnsi.COMPANY, 'CNSI')
  assert.equal(cnsi.HOMEPAGE_URL, 'https://www.cnsi.com/')
  assert.equal(cnsi.LEGACY_HOMEPAGE_URL, 'http://www.cns-inc.com/')
  assert.equal(cnsi.VERIFIED_ON, '2026-07-17')
  assert.equal(
    cnsi.isUnavailableProbeResult({
      ok: false,
      url: 'https://www.cnsi.com/',
      error: 'fetch failed',
    }),
    true,
  )
  assert.equal(
    cnsi.isUnavailableProbeResult({
      ok: true,
      url: 'https://www.cnsi.com/',
      status: 200,
      text: '<html><body>Welcome</body></html>',
    }),
    false,
  )
})

test('CNSI returns no jobs only while both verified official domains still fail to expose a trustworthy public surface', async () => {
  const cnsi = await loadModule()
  const probedUrls = []

  const jobs = await cnsi.createCNSIScraper().run({
    probe: async (url) => {
      probedUrls.push(url)
      return {
        ok: false,
        url,
        error: 'fetch failed',
      }
    },
  })

  assert.deepEqual(probedUrls, [
    cnsi.HOMEPAGE_URL,
    cnsi.LEGACY_HOMEPAGE_URL,
  ])
  assert.deepEqual(jobs, [])
})

test('CNSI fails closed when an official domain starts returning a real page and the sentinel needs re-verification', async () => {
  const cnsi = await loadModule()

  await assert.rejects(
    cnsi.createCNSIScraper().run({
      probe: async (url) => {
        if (url === cnsi.HOMEPAGE_URL) {
          return {
            ok: true,
            status: 200,
            url,
            text: '<html><body><h1>CNSI</h1><a href="/careers">Careers</a></body></html>',
          }
        }

        return {
          ok: false,
          url,
          error: 'fetch failed',
        }
      },
    }),
    /verified CNSI sentinel is stale/i,
  )
})
