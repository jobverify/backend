import assert from 'node:assert/strict'
import test from 'node:test'

const loadCatalog = async () => {
  try {
    return await import('../../scraper/nxtgendatacentercloudtechnologies/catalog.js')
  } catch {
    assert.fail('Expected Nxtgen Datacenter Cloud Technologies catalog module at ../../scraper/nxtgendatacentercloudtechnologies/catalog.js')
  }
}

const loadScript = async () => {
  try {
    return await import('../../scraper/nxtgendatacentercloudtechnologies/script.js')
  } catch {
    assert.fail('Expected Nxtgen Datacenter Cloud Technologies scraper module at ../../scraper/nxtgendatacentercloudtechnologies/script.js')
  }
}

test('Nxtgen catalog records the timed-out first-party careers host while preserving the last known featured-jobs contract', async () => {
  const { NXTGEN_DATACENTER_CLOUD_TECHNOLOGIES_CATALOG } = await loadCatalog()

  assert.equal(NXTGEN_DATACENTER_CLOUD_TECHNOLOGIES_CATALOG.source, 'nxtgendatacentercloudtechnologies')
  assert.equal(NXTGEN_DATACENTER_CLOUD_TECHNOLOGIES_CATALOG.companyCareerPage, 'https://nxtgen.co.in/careers')
  assert.equal(NXTGEN_DATACENTER_CLOUD_TECHNOLOGIES_CATALOG.verifiedOn, '2026-08-04')
  assert.match(NXTGEN_DATACENTER_CLOUD_TECHNOLOGIES_CATALOG.verifiedSurfaceSummary, /timed out/i)
  assert.match(NXTGEN_DATACENTER_CLOUD_TECHNOLOGIES_CATALOG.verifiedSurfaceSummary, /Featured Jobs/i)
})

test('Nxtgen returns an empty sentinel result when the verified first-party careers host times out', async () => {
  const nxtgen = await loadScript()

  assert.equal(
    nxtgen.isTrustedUnavailableFailure(
      new Error('fetch failed | Connect Timeout Error (attempted address: nxtgen.co.in:443, timeout: 10000ms)'),
    ),
    true,
  )

  const jobs = await nxtgen.createNxtgenDatacenterCloudTechnologiesScraper().run({
    fetchText: async () => {
      throw new Error('fetch failed | Connect Timeout Error (attempted address: nxtgen.co.in:443, timeout: 10000ms)')
    },
  })

  assert.deepEqual(jobs, [])

  await assert.rejects(
    nxtgen.createNxtgenDatacenterCloudTechnologiesScraper().run({
      fetchText: async () => '<html><body><h1>Unexpected</h1></body></html>',
    }),
    /verified nxtgen datacenter cloud technologies careers page/i,
  )
})
