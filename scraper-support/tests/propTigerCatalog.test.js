import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const propTigerModulePath = path.resolve(currentDir, '../../scraper/proptiger/script.js')

const loadCatalogModule = async () => {
  try {
    return await import('../../scraper/proptiger/catalog.js')
  } catch {
    assert.fail('Expected PropTiger catalog module at ../../scraper/proptiger/catalog.js')
  }
}

test('PropTiger catalog captures the verified first-party empty careers board surface', async () => {
  const {
    PROPTIGER_CATALOG,
    default: defaultCatalog,
  } = await loadCatalogModule()

  assert.equal(defaultCatalog, PROPTIGER_CATALOG)
  assert.equal(PROPTIGER_CATALOG.source, 'proptiger')
  assert.equal(PROPTIGER_CATALOG.companyName, 'PropTiger')
  assert.equal(PROPTIGER_CATALOG.officialBrandName, 'PropTiger')
  assert.equal(PROPTIGER_CATALOG.adapter, 'script')
  assert.equal(PROPTIGER_CATALOG.homepageUrl, 'https://www.proptiger.com/')
  assert.equal(PROPTIGER_CATALOG.companyCareerPage, 'https://www.proptiger.com/careers')
  assert.equal(PROPTIGER_CATALOG.aboutPageUrl, 'https://www.proptiger.com/aboutus')
  assert.equal(PROPTIGER_CATALOG.companyDomain, 'proptiger.com')
  assert.equal(PROPTIGER_CATALOG.atsPlatform, 'official-company-careers-empty-board')
  assert.equal(PROPTIGER_CATALOG.countryFilter, 'India')
  assert.equal(
    PROPTIGER_CATALOG.paginationStrategy,
    'official-careers-page-empty-state-validation',
  )
  assert.equal(
    PROPTIGER_CATALOG.extractionStrategy,
    'verified-first-party-careers-page+verified-empty-open-roles-state+return-empty',
  )
  assert.equal(PROPTIGER_CATALOG.parser, 'custom-script')
  assert.equal(PROPTIGER_CATALOG.normalizationProfile, 'engineering-default')
  assert.equal(
    PROPTIGER_CATALOG.officialReachOutFormAction,
    'https://www.proptiger.com/responsive/jhr/careers/right-opportunity',
  )
  assert.equal(PROPTIGER_CATALOG.verifiedOn, '2026-07-17')
  assert.match(PROPTIGER_CATALOG.verifiedSurfaceSummary, /Friday, July 17, 2026/i)
  assert.match(PROPTIGER_CATALOG.verifiedSurfaceSummary, /Build your Career at PropTiger/i)
  assert.match(PROPTIGER_CATALOG.verifiedSurfaceSummary, /There are currently no jobs available/i)
  assert.match(
    PROPTIGER_CATALOG.verifiedSurfaceSummary,
    /responsive\/jhr\/careers\/right-opportunity/i,
  )
  assert.equal(PROPTIGER_CATALOG.modulePath, propTigerModulePath)
  assert.match(PROPTIGER_CATALOG.dryRunFile, /proptiger[\\/]jobs\.json$/i)
})
