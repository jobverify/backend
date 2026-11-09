import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { hydrateProviderCatalogEntry } from '../providers/index.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const modulePath = path.resolve(currentDir, '../../scraper/swipewiretechnologies/script.js')

const loadCatalogModule = async () => {
  try {
    return await import('../../scraper/swipewiretechnologies/catalog.js')
  } catch {
    assert.fail('Expected Swipewire Technologies catalog module at ../../scraper/swipewiretechnologies/catalog.js')
  }
}

const buildCatalogReadyProvider = (catalogEntry) => hydrateProviderCatalogEntry({
  ...catalogEntry,
  modulePath,
})

test('Swipewire Technologies local catalog captures the verified resume-only first-party page', async () => {
  const { SWIPEWIRE_TECHNOLOGIES_CATALOG, default: defaultCatalog } = await loadCatalogModule()
  const provider = buildCatalogReadyProvider(SWIPEWIRE_TECHNOLOGIES_CATALOG)

  assert.equal(defaultCatalog, SWIPEWIRE_TECHNOLOGIES_CATALOG)
  assert.equal(provider.source, 'swipewiretechnologies')
  assert.equal(provider.companyName, 'Swipewire Technologies')
  assert.equal(provider.officialBrandName, 'Swipe Wire')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyCareerPage, 'https://swipe-wire.com/career.html')
  assert.equal(provider.contactEmail, 'info@swipe-wire.com')
  assert.equal(provider.atsPlatform, 'first-party-careers-page-no-structured-openings')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'single-public-page')
  assert.equal(provider.extractionStrategy, 'verified-first-party-careers-page+future-projects-email-only-return-empty')
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.companyDomain, 'swipe-wire.com')
  assert.equal(provider.verifiedOn, '2026-07-17')
  assert.match(provider.verifiedSurfaceSummary, /Friday, July 17, 2026/i)
  assert.match(provider.verifiedSurfaceSummary, /info@swipe-wire\.com/i)
  assert.match(provider.verifiedSurfaceSummary, /future projects/i)
  assert.equal(provider.modulePath, modulePath)
  assert.match(provider.dryRunFile, /swipewiretechnologies[\\/]jobs\.json$/i)
})

test('Swipewire Technologies exact backlog row resolves from the local provider contract', async () => {
  const { SWIPEWIRE_TECHNOLOGIES_CATALOG } = await loadCatalogModule()
  const report = generateCompanyCoverageReport({
    csvText: 'Swipewire Technologies\n',
    catalog: [buildCatalogReadyProvider(SWIPEWIRE_TECHNOLOGIES_CATALOG)],
    aliasMap: {},
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Swipewire Technologies', 'swipewiretechnologies', 'Swipewire Technologies']],
  )
})
