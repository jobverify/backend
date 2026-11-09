import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { hydrateProviderCatalogEntry } from '../providers/index.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const modulePath = path.resolve(currentDir, '../../scraper/spsoftware/script.js')

const loadCatalogModule = async () => {
  try {
    return await import('../../scraper/spsoftware/catalog.js')
  } catch {
    assert.fail('Expected SP Software catalog module at ../../scraper/spsoftware/catalog.js')
  }
}

test('SP Software local catalog captures the verified first-party SPA shell and careers bundle contract', async () => {
  const { SP_SOFTWARE_CATALOG, default: defaultCatalog } = await loadCatalogModule()
  const provider = hydrateProviderCatalogEntry(SP_SOFTWARE_CATALOG)

  assert.equal(defaultCatalog, SP_SOFTWARE_CATALOG)
  assert.equal(provider.source, 'spsoftware')
  assert.equal(provider.companyName, 'SP Software')
  assert.equal(provider.homepageUrl, 'https://www.spsoftglobal.com/')
  assert.equal(provider.companyCareerPage, 'https://www.spsoftglobal.com/career')
  assert.equal(provider.careersBundleUrl, 'https://www.spsoftglobal.com/app-career-career-module.js')
  assert.equal(provider.atsPlatform, 'first-party-angular-careers-bundle')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'single-first-party-angular-bundle')
  assert.equal(
    provider.extractionStrategy,
    'verified-first-party-careers-route+compiled-angular-careers-bundle',
  )
  assert.equal(provider.verifiedOn, '2026-08-04')
  assert.equal(provider.companyDomain, 'spsoftglobal.com')
  assert.equal(provider.modulePath, modulePath)
  assert.match(provider.verifiedSurfaceSummary, /Tuesday, August 4, 2026/i)
  assert.match(provider.verifiedSurfaceSummary, /runtime\.js/i)
  assert.match(provider.verifiedSurfaceSummary, /main\.js/i)
  assert.match(provider.verifiedSurfaceSummary, /Java Developer/i)
  assert.match(provider.verifiedSurfaceSummary, /\.NET Developer/i)
})

test('SP Software exact backlog row resolves from the local catalog object', async () => {
  const { SP_SOFTWARE_CATALOG } = await loadCatalogModule()
  const report = generateCompanyCoverageReport({
    csvText: 'SP Software\n',
    catalog: [hydrateProviderCatalogEntry(SP_SOFTWARE_CATALOG)],
    aliasMap: {},
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
})
