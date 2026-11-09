import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath, pathToFileURL } from 'node:url'

import companyAliases from '../providers/companyAliases.json' with { type: 'json' }
import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { hydrateProviderCatalogEntry } from '../providers/index.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const modulePath = path.resolve(currentDir, '../../scraper/shipdelight/script.js')

const loadCatalogModule = async () => {
  try {
    return await import('../../scraper/shipdelight/catalog.js')
  } catch {
    assert.fail('Expected Shipdelight catalog module at ../../scraper/shipdelight/catalog.js')
  }
}

const loadScraperModule = async () => {
  try {
    return await import('../../scraper/shipdelight/script.js')
  } catch {
    assert.fail('Expected Shipdelight scraper module at ../../scraper/shipdelight/script.js')
  }
}

test('Shipdelight local catalog captures the verified first-party empty careers state', async () => {
  const { SHIPDELIGHT_CATALOG, default: defaultCatalog } = await loadCatalogModule()
  const shipdelight = await loadScraperModule()
  const provider = hydrateProviderCatalogEntry(SHIPDELIGHT_CATALOG)

  assert.equal(defaultCatalog, SHIPDELIGHT_CATALOG)
  assert.equal(provider.source, 'shipdelight')
  assert.equal(provider.companyName, 'Shipdelight')
  assert.equal(provider.officialBrandName, 'Shipdelight Logistics Technologies Pvt Ltd.')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyCareerPage, 'https://shipdelight.com/career')
  assert.equal(provider.officialCareersPageUrl, 'https://shipdelight.com/career')
  assert.equal(provider.companyDomain, 'shipdelight.com')
  assert.equal(provider.atsPlatform, 'first-party-empty-careers-page')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'single-public-page')
  assert.equal(
    provider.extractionStrategy,
    'verified-first-party-careers-page+verified-empty-openings-state',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.verifiedOn, '2026-07-17')
  assert.match(provider.dryRunFile, /shipdelight[\\/]jobs\.json$/i)
  assert.equal(provider.modulePath, modulePath)
  assert.match(provider.verifiedSurfaceSummary, /Friday, July 17, 2026/i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/shipdelight\.com\/career/i)
  assert.match(provider.verifiedSurfaceSummary, /No open position available!/i)
  assert.equal(Object.prototype.hasOwnProperty.call(companyAliases, 'Shipdelight'), false)

  assert.equal(shipdelight.PROVIDER_METADATA.source, SHIPDELIGHT_CATALOG.source)
  assert.equal(shipdelight.PROVIDER_METADATA.companyName, SHIPDELIGHT_CATALOG.companyName)
})

test('Shipdelight exact backlog row matches directly from local provider metadata', async () => {
  const { SHIPDELIGHT_CATALOG } = await loadCatalogModule()
  const report = generateCompanyCoverageReport({
    csvText: 'Shipdelight\n',
    catalog: [hydrateProviderCatalogEntry(SHIPDELIGHT_CATALOG)],
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Shipdelight', 'shipdelight', 'Shipdelight']],
  )
})

test('Shipdelight hydrated local catalog stays script-runner compatible for central registry integration', async () => {
  const { SHIPDELIGHT_CATALOG } = await loadCatalogModule()
  const provider = hydrateProviderCatalogEntry(SHIPDELIGHT_CATALOG)
  const module = await import(pathToFileURL(provider.modulePath).href)

  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyName, 'Shipdelight')
  assert.equal(provider.companyCareerPage, 'https://shipdelight.com/career')
  assert.equal(provider.companyDomain, 'shipdelight.com')
  assert.equal(provider.atsPlatform, 'first-party-empty-careers-page')
  assert.match(provider.modulePath, /shipdelight[\\/]script\.js$/i)
  assert.match(provider.dryRunFile, /shipdelight[\\/]jobs\.json$/i)
  assert.equal(typeof module.run, 'function')
})
