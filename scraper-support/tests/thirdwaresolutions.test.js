import assert from 'node:assert/strict'
import test from 'node:test'

const loadCatalog = async () => {
  try {
    return await import('../../scraper/thirdwaresolutions/catalog.js')
  } catch {
    assert.fail('Expected Thirdware Solutions catalog module at ../../scraper/thirdwaresolutions/catalog.js')
  }
}

const loadScript = async () => {
  try {
    return await import('../../scraper/thirdwaresolutions/script.js')
  } catch {
    assert.fail('Expected Thirdware Solutions scraper module at ../../scraper/thirdwaresolutions/script.js')
  }
}

test('Thirdware catalog records the first-party certificate-mismatch sentinel state', async () => {
  const { THIRDWARE_SOLUTIONS_CATALOG } = await loadCatalog()

  assert.equal(THIRDWARE_SOLUTIONS_CATALOG.source, 'thirdwaresolutions')
  assert.equal(THIRDWARE_SOLUTIONS_CATALOG.companyName, 'Thirdware Solutions')
  assert.equal(THIRDWARE_SOLUTIONS_CATALOG.companyCareerPage, 'https://www.thirdware.com/')
  assert.equal(THIRDWARE_SOLUTIONS_CATALOG.atsPlatform, 'official-site-certificate-mismatch-no-public-jobs')
  assert.equal(THIRDWARE_SOLUTIONS_CATALOG.verifiedOn, '2026-08-05')
  assert.match(THIRDWARE_SOLUTIONS_CATALOG.verifiedSurfaceSummary, /certificate alt-name mismatch/i)
})

test('Thirdware sentinel returns [] only while the first-party routes remain unreachable or untrustworthy from this environment', async () => {
  const thirdware = await loadScript()

  assert.equal(thirdware.isTrustedOfflineFailure(new Error('The operation has timed out.')), true)
  assert.equal(thirdware.isTrustedOfflineFailure(new Error('Connect Timeout Error for https://www.thirdware.com/')), true)
  assert.equal(
    thirdware.isTrustedOfflineFailure(
      new Error("fetch failed | Hostname/IP does not match certificate's altnames"),
    ),
    true,
  )

  const jobs = await thirdware.run({
    fetchText: async () => {
      throw new Error("fetch failed | Hostname/IP does not match certificate's altnames")
    },
  })

  assert.deepEqual(jobs, [])

  await assert.rejects(
    thirdware.run({
      fetchText: async () => '<html><body><h1>Careers</h1><a href="/jobs/data-engineer">Data Engineer</a></body></html>',
    }),
    /public jobs surface/i,
  )
})
