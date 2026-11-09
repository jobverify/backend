import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import { hydrateProviderCatalogEntry } from '../providers/index.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const modulePath = path.resolve(currentDir, '../../scraper/epicorsoftwarecorporation/script.js')

const loadCatalogModule = async () => {
  try {
    return await import('../../scraper/epicorsoftwarecorporation/catalog.js')
  } catch {
    assert.fail('Expected Epicor Software Corporation catalog module at ../../scraper/epicorsoftwarecorporation/catalog.js')
  }
}

test('Epicor Software Corporation local catalog captures the verified first-party jobs shell and public Workday board', async () => {
  const { EPICOR_SOFTWARE_CORPORATION_CATALOG, default: defaultCatalog } = await loadCatalogModule()
  const provider = hydrateProviderCatalogEntry(EPICOR_SOFTWARE_CORPORATION_CATALOG)

  assert.equal(defaultCatalog, EPICOR_SOFTWARE_CORPORATION_CATALOG)
  assert.equal(provider.source, 'epicorsoftwarecorporation')
  assert.equal(provider.companyName, 'Epicor Software Corporation')
  assert.equal(provider.officialBrandName, 'Epicor')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyCareerPage, 'https://www.epicor.com/en/jobs/')
  assert.equal(provider.officialWorkdayBoardUrl, 'https://epicorsoftware.wd5.myworkdayjobs.com/epicorjobs')
  assert.equal(
    provider.jobsApiUrl,
    'https://epicorsoftware.wd5.myworkdayjobs.com/wday/cxs/epicorsoftware/epicorjobs/jobs',
  )
  assert.deepEqual(provider.verifiedIndiaLocationDescriptors, [
    'India',
    'Bangalore',
    'Hyderabad',
    'Remote',
  ])
  assert.equal(provider.companyDomain, 'epicor.com')
  assert.equal(provider.atsPlatform, 'workday-jobs-api')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'first-party-workday-jobs-api')
  assert.equal(
    provider.extractionStrategy,
    'verified-first-party-jobs-shell+public-workday-board+india-job-filter+jobs-api',
  )
  assert.equal(provider.verifiedOn, '2026-07-18')
  assert.match(provider.verifiedSurfaceSummary, /Saturday, July 18, 2026/i)
  assert.match(provider.verifiedSurfaceSummary, /www\.epicor\.com\/en\/jobs/i)
  assert.match(provider.verifiedSurfaceSummary, /epicorsoftware\.wd5\.myworkdayjobs\.com\/epicorjobs/i)
  assert.equal(provider.modulePath, modulePath)
  assert.match(provider.dryRunFile, /epicorsoftwarecorporation[\\/]jobs\.json$/i)
})
