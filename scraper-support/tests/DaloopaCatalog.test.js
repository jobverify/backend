import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { hydrateProviderCatalogEntry } from '../providers/index.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const modulePath = path.resolve(currentDir, '../../scraper/daloopa/script.js')

const loadCatalogModule = async () => {
  try {
    return await import('../../scraper/daloopa/catalog.js')
  } catch {
    assert.fail('Expected Daloopa catalog module at ../../scraper/daloopa/catalog.js')
  }
}

test('Daloopa local catalog captures the verified no-public-open-roles sentinel surface', async () => {
  const { DALOOPA_CATALOG, default: defaultCatalog } = await loadCatalogModule()
  const provider = hydrateProviderCatalogEntry(DALOOPA_CATALOG)

  assert.equal(defaultCatalog, DALOOPA_CATALOG)
  assert.equal(provider.source, 'daloopa')
  assert.equal(provider.companyName, 'Daloopa')
  assert.equal(provider.officialBrandName, 'Daloopa')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyCareerPage, 'https://daloopa.com/careers')
  assert.equal(provider.officialCareersPageUrl, 'https://daloopa.com/careers')
  assert.equal(provider.companyDomain, 'daloopa.com')
  assert.equal(provider.atsPlatform, 'official-company-careers-no-public-open-roles')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(
    provider.paginationStrategy,
    'verified-single-first-party-careers-page-without-public-role-cards',
  )
  assert.equal(
    provider.extractionStrategy,
    'verified-first-party-careers-landing-page-without-public-open-roles',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.verifiedOn, '2026-07-17')
  assert.equal(provider.modulePath, modulePath)
  assert.match(provider.dryRunFile, /daloopa[\\/]jobs\.json$/i)
  assert.match(provider.verifiedSurfaceSummary, /Friday, July 17, 2026/i)
  assert.match(provider.verifiedSurfaceSummary, /Request a Demo/i)
  assert.match(provider.verifiedSurfaceSummary, /Create Free Account/i)
  assert.match(provider.verifiedSurfaceSummary, /no public open role cards/i)
})

test('Daloopa exact backlog row resolves from the local catalog entry', async () => {
  const { DALOOPA_CATALOG } = await loadCatalogModule()
  const report = generateCompanyCoverageReport({
    csvText: 'Daloopa\n',
    catalog: [hydrateProviderCatalogEntry(DALOOPA_CATALOG)],
    aliasMap: {},
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Daloopa', 'daloopa', 'Daloopa']],
  )
})
