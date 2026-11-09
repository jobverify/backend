import assert from 'node:assert/strict'
import test from 'node:test'

const loadCatalog = async () => {
  try {
    return await import('../../scraper/qualsquadinfotech/catalog.js')
  } catch {
    assert.fail('Expected Qualsquad Infotech catalog module at ../../scraper/qualsquadinfotech/catalog.js')
  }
}

const loadScript = async () => {
  try {
    return await import('../../scraper/qualsquadinfotech/script.js')
  } catch {
    assert.fail('Expected Qualsquad Infotech scraper module at ../../scraper/qualsquadinfotech/script.js')
  }
}

test('Qualsquad catalog records the unresolved first-party domain sentinel state', async () => {
  const { QUALSQUAD_INFOTECH_CATALOG } = await loadCatalog()

  assert.equal(QUALSQUAD_INFOTECH_CATALOG.source, 'qualsquadinfotech')
  assert.equal(QUALSQUAD_INFOTECH_CATALOG.companyName, 'Qualsquad Infotech')
  assert.equal(QUALSQUAD_INFOTECH_CATALOG.companyCareerPage, 'https://www.qualsquad.com/')
  assert.equal(QUALSQUAD_INFOTECH_CATALOG.atsPlatform, 'official-site-unresolved-no-public-jobs')
  assert.equal(QUALSQUAD_INFOTECH_CATALOG.verifiedOn, '2026-08-04')
  assert.match(QUALSQUAD_INFOTECH_CATALOG.verifiedSurfaceSummary, /timed out/i)
  assert.match(QUALSQUAD_INFOTECH_CATALOG.verifiedSurfaceSummary, /failed to resolve/i)
})

test('Qualsquad sentinel returns [] only while the candidate first-party domains stay unresolved or absent', async () => {
  const qualsquad = await loadScript()
  const requested = []

  assert.equal(
    qualsquad.isTrustedUnavailableFailure(new Error("getaddrinfo ENOTFOUND www.qualsquadinfotech.com")),
    true,
  )
  assert.equal(
    qualsquad.isTrustedUnavailableFailure(
      new Error('fetch failed | Connect Timeout Error (attempted address: www.qualsquad.com:443, timeout: 10000ms)'),
    ),
    true,
  )
  assert.equal(
    qualsquad.isTrustedUnavailableFailure(
      new Error('net::ERR_CONNECTION_TIMED_OUT at https://www.qualsquad.com/'),
    ),
    true,
  )

  const jobs = await qualsquad.run({
    fetchText: async (url, options) => {
      requested.push({ url, options })
      throw new Error('fetch failed | Connect Timeout Error (attempted address: www.qualsquad.com:443, timeout: 10000ms)')
    },
    fetchBrowserText: async () => {
      assert.fail('browser fallback should not run for trusted timeout failures')
    },
  })

  assert.deepEqual(
    requested,
    qualsquad.CANDIDATE_ROUTE_URLS.map((url) => ({ url, options: { attempts: 1 } })),
  )
  assert.deepEqual(jobs, [])

  await assert.rejects(
    qualsquad.run({
      fetchText: async () => '<html><body><h1>Current Openings</h1><a href="/jobs/qa-engineer">QA Engineer</a></body></html>',
    }),
    /public jobs surface/i,
  )
})

test('Qualsquad can recover with browser-backed verification when direct requests fail generically', async () => {
  const qualsquad = await loadScript()
  const browserUrls = []

  const jobs = await qualsquad.run({
    fetchText: async () => {
      throw new TypeError('fetch failed')
    },
    fetchBrowserText: async (url) => {
      browserUrls.push(url)
      throw new Error('getaddrinfo ENOTFOUND www.qualsquadinfotech.com')
    },
  })

  assert.deepEqual(browserUrls, qualsquad.CANDIDATE_ROUTE_URLS)
  assert.deepEqual(jobs, [])
})
