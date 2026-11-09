import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath, pathToFileURL } from 'node:url'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { hydrateProviderCatalogEntry } from '../providers/index.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const modulePath = path.resolve(currentDir, '../../scraper/urjanetenergysolutions/script.js')

const loadCatalogModule = async () => {
  try {
    return await import('../../scraper/urjanetenergysolutions/catalog.js')
  } catch {
    assert.fail('Expected Urjanet Energy Solutions catalog module at ../../scraper/urjanetenergysolutions/catalog.js')
  }
}

test('Urjanet Energy Solutions local catalog captures the exact-name acquisition fail-closed contract', async () => {
  const { URJANET_ENERGY_SOLUTIONS_CATALOG, default: defaultCatalog } = await loadCatalogModule()
  const provider = hydrateProviderCatalogEntry(URJANET_ENERGY_SOLUTIONS_CATALOG)

  assert.equal(defaultCatalog, URJANET_ENERGY_SOLUTIONS_CATALOG)
  assert.equal(provider.source, 'urjanetenergysolutions')
  assert.equal(provider.companyName, 'Urjanet Energy Solutions')
  assert.equal(provider.officialBrandName, 'Arcadia')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyCareerPage, 'https://www.arcadia.com/careers')
  assert.equal(provider.companyDomain, 'arcadia.com')
  assert.equal(provider.atsPlatform, 'acquired-company-no-standalone-jobs-surface')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'exact-name-acquisition-sentinel')
  assert.equal(
    provider.extractionStrategy,
    'verified-arcadia-faq+verified-company-history+verified-arcadia-careers-shell+fail-closed-sentinel',
  )
  assert.equal(provider.verifiedOn, '2026-07-18')
  assert.match(provider.verifiedSurfaceSummary, /Saturday, July 18, 2026/i)
  assert.match(provider.verifiedSurfaceSummary, /Urjanet is fully integrated/i)
  assert.match(provider.verifiedSurfaceSummary, /not a separate company/i)
  assert.equal(provider.modulePath, modulePath)
  assert.match(provider.dryRunFile, /urjanetenergysolutions[\\/]jobs\.json$/i)
})

test('Urjanet Energy Solutions exact backlog row resolves from local provider metadata', async () => {
  const { URJANET_ENERGY_SOLUTIONS_CATALOG } = await loadCatalogModule()
  const report = generateCompanyCoverageReport({
    csvText: 'Urjanet Energy Solutions\n',
    catalog: [hydrateProviderCatalogEntry(URJANET_ENERGY_SOLUTIONS_CATALOG)],
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
})

test('Urjanet Energy Solutions hydrated local catalog stays script-runner compatible', async () => {
  const { URJANET_ENERGY_SOLUTIONS_CATALOG } = await loadCatalogModule()
  const provider = hydrateProviderCatalogEntry(URJANET_ENERGY_SOLUTIONS_CATALOG)
  const module = await import(pathToFileURL(provider.modulePath).href)

  assert.equal(provider.adapter, 'script')
  assert.equal(typeof module.run, 'function')
})
