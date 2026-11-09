import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { hydrateProviderCatalogEntry } from '../providers/index.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const modulePath = path.resolve(currentDir, '../../scraper/digitalnirvanainformationsystems/script.js')

const loadCatalogModule = async () => {
  try {
    return await import('../../scraper/digitalnirvanainformationsystems/catalog.js')
  } catch {
    assert.fail('Expected Digital Nirvana Information Systems catalog module at ../../scraper/digitalnirvanainformationsystems/catalog.js')
  }
}

const buildCatalogReadyProvider = (catalogEntry) => hydrateProviderCatalogEntry({
  ...catalogEntry,
  modulePath,
})

test('Digital Nirvana Information Systems local catalog captures the Sunday, August 2, 2026 careers-page extraction contract', async () => {
  const { DIGITAL_NIRVANA_INFORMATION_SYSTEMS_CATALOG, default: defaultCatalog } = await loadCatalogModule()
  const provider = buildCatalogReadyProvider(DIGITAL_NIRVANA_INFORMATION_SYSTEMS_CATALOG)

  assert.equal(defaultCatalog, DIGITAL_NIRVANA_INFORMATION_SYSTEMS_CATALOG)
  assert.equal(provider.source, 'digitalnirvanainformationsystems')
  assert.equal(provider.companyName, 'Digital Nirvana Information Systems')
  assert.equal(provider.officialBrandName, 'Digital Nirvana')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.homepageUrl, 'https://digital-nirvana.com/')
  assert.equal(provider.companyCareerPage, 'https://digital-nirvana.com/careers-at-digital-nirvana/')
  assert.equal(provider.atsPlatform, 'official-company-careers-page-mailto-apply')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(
    provider.paginationStrategy,
    'single-first-party-careers-page-with-location-tabs-and-deduped-mailto-roles',
  )
  assert.equal(
    provider.extractionStrategy,
    'verified-homepage-careers-link+verified-careers-page+india-tab-role-block-extraction',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.companyDomain, 'digital-nirvana.com')
  assert.equal(provider.verifiedOn, '2026-08-02')
  assert.match(provider.verifiedSurfaceSummary, /Sunday, August 2, 2026/i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/digital-nirvana\.com\//i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/digital-nirvana\.com\/careers-at-digital-nirvana\//i)
  assert.match(provider.verifiedSurfaceSummary, /California, USA/i)
  assert.match(provider.verifiedSurfaceSummary, /Hyderabad, India/i)
  assert.match(provider.verifiedSurfaceSummary, /Coimbatore, India/i)
  assert.match(provider.verifiedSurfaceSummary, /two unique India openings/i)
  assert.match(provider.verifiedSurfaceSummary, /Editor\/Senior Editor - Financial Content/i)
  assert.match(provider.verifiedSurfaceSummary, /Editor & Captioner/i)
  assert.equal(provider.modulePath, modulePath)
  assert.match(provider.dryRunFile, /digitalnirvanainformationsystems[\\/]jobs\.json$/i)
})

test('Digital Nirvana Information Systems exact backlog row resolves from the local provider contract without alias churn', async () => {
  const { DIGITAL_NIRVANA_INFORMATION_SYSTEMS_CATALOG } = await loadCatalogModule()
  const report = generateCompanyCoverageReport({
    csvText: 'Digital Nirvana Information Systems\n',
    catalog: [buildCatalogReadyProvider(DIGITAL_NIRVANA_INFORMATION_SYSTEMS_CATALOG)],
    aliasMap: {},
  })

  assert.equal(report.totalRows, 1)
  assert.equal(report.candidateRows, 1)
  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Digital Nirvana Information Systems', 'digitalnirvanainformationsystems', 'Digital Nirvana Information Systems']],
  )
})
