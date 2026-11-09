import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import { buildScrapers, getScraperCatalog, hydrateProviderCatalogEntry } from '../providers/index.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const modulePath = path.resolve(currentDir, '../../scraper/sureprep/script.js')

const loadCatalogModule = async () => {
  try {
    return await import('../../scraper/sureprep/catalog.js')
  } catch {
    assert.fail('Expected SurePrep catalog module at ../../scraper/sureprep/catalog.js')
  }
}

test('SurePrep local catalog captures the verified no-public-jobs exact-name surface', async () => {
  const { default: catalog } = await loadCatalogModule()
  const provider = hydrateProviderCatalogEntry(catalog)

  assert.equal(provider.source, 'sureprep')
  assert.equal(provider.companyName, 'SurePrep')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyCareerPage, 'https://sureprep.com/')
  assert.equal(provider.companyDomain, 'sureprep.com')
  assert.equal(provider.homepageUrl, 'https://tax.thomsonreuters.com/en/sureprep')
  assert.equal(provider.loginUrl, 'https://production.sureprep.com/')
  assert.equal(provider.parentCareersUrl, 'https://www.thomsonreuters.com/en/careers')
  assert.equal(provider.atsPlatform, 'no-public-jobs-surface')
  assert.equal(provider.paginationStrategy, 'fail-closed-sentinel')
  assert.equal(
    provider.extractionStrategy,
    'verified-sureprep-root-redirect-to-thomson-reuters-product-page+verified-production-login+generic-parent-careers-link-without-sureprep-jobs',
  )
  assert.equal(provider.verifiedOn, '2026-08-05')
  assert.equal(provider.modulePath, modulePath)
  assert.match(provider.verifiedSurfaceSummary, /Wednesday, August 5, 2026/i)
  assert.match(provider.verifiedSurfaceSummary, /production\.sureprep\.com/i)
  assert.match(provider.verifiedSurfaceSummary, /tax\.thomsonreuters\.com\/en\/sureprep/i)
})

test('SurePrep is registered consistently in the provider catalog and scraper registry', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'sureprep')

  assert.ok(provider, 'Expected SurePrep provider to be present in customProviders.json')
  assert.equal(provider.companyCareerPage, 'https://sureprep.com/')
  assert.equal(provider.homepageUrl, 'https://tax.thomsonreuters.com/en/sureprep')
  assert.equal(provider.loginUrl, 'https://production.sureprep.com/')
  assert.equal(provider.parentCareersUrl, 'https://www.thomsonreuters.com/en/careers')
  assert.equal(provider.companyDomain, 'sureprep.com')

  const scraper = buildScrapers().find((item) => item.name === 'sureprep')
  assert.ok(scraper, 'Expected buildScrapers() to return the SurePrep scraper')
  assert.equal(scraper.provider.source, 'sureprep')
  assert.match(scraper.dryRunFile, /sureprep[\\/]jobs\.json$/i)
})
