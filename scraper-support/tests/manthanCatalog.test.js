import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import companyAliases from '../providers/companyAliases.json' with { type: 'json' }
import { hydrateProviderCatalogEntry } from '../providers/index.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const manthanModulePath = path.resolve(currentDir, '../../scraper/manthan/script.js')

const loadCatalogModule = async () => {
  try {
    return await import('../../scraper/manthan/catalog.js')
  } catch {
    assert.fail('Expected Manthan catalog module at ../../scraper/manthan/catalog.js')
  }
}

test('Manthan local catalog captures the verified first-party careers page metadata', async () => {
  const {
    MANTHAN_CATALOG,
    default: defaultCatalog,
  } = await loadCatalogModule()
  const provider = hydrateProviderCatalogEntry(MANTHAN_CATALOG)

  assert.equal(defaultCatalog, MANTHAN_CATALOG)
  assert.equal(provider.source, 'manthan')
  assert.equal(provider.companyName, 'Manthan')
  assert.equal(provider.officialBrandName, 'Manthan')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyCareerPage, 'https://manthan.com/careers/')
  assert.equal(provider.companyDomain, 'manthan.com')
  assert.equal(provider.officialHomepageUrl, 'https://manthan.com/')
  assert.equal(provider.atsPlatform, 'official-company-careers')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(
    provider.paginationStrategy,
    'single-first-party-careers-page-with-inline-opening-blocks',
  )
  assert.equal(
    provider.extractionStrategy,
    'verified-first-party-careers-page+inline-opening-blocks+linkedin-apply-links',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.verifiedOn, '2026-07-16')
  assert.match(provider.verifiedSurfaceSummary, /Thursday, July 16, 2026/i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/manthan\.com\/careers\//i)
  assert.match(provider.verifiedSurfaceSummary, /two concrete public openings/i)
  assert.match(provider.verifiedSurfaceSummary, /LinkedIn apply links/i)
  assert.equal(provider.modulePath, manthanModulePath)
  assert.match(provider.dryRunFile, /manthan[\\/]jobs\.json$/i)
  assert.equal(Object.prototype.hasOwnProperty.call(companyAliases, 'Manthan'), false)
})

test('Manthan backlog row matches directly from the local catalog metadata', async () => {
  const { MANTHAN_CATALOG } = await loadCatalogModule()
  const report = generateCompanyCoverageReport({
    csvText: 'Manthan\n',
    catalog: [MANTHAN_CATALOG],
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Manthan', 'manthan', 'Manthan']],
  )
})
