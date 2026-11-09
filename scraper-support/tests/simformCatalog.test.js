import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath, pathToFileURL } from 'node:url'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { hydrateProviderCatalogEntry } from '../providers/index.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const modulePath = path.resolve(currentDir, '../../scraper/simform/script.js')

const loadCatalogModule = async () => {
  try {
    return await import('../../scraper/simform/catalog.js')
  } catch {
    assert.fail('Expected Simform catalog module at ../../scraper/simform/catalog.js')
  }
}

test('Simform local catalog captures the verified current-openings empty-state sentinel contract', async () => {
  const { SIMFORM_CATALOG, default: defaultCatalog } = await loadCatalogModule()
  const provider = hydrateProviderCatalogEntry(SIMFORM_CATALOG)

  assert.equal(defaultCatalog, SIMFORM_CATALOG)
  assert.equal(provider.source, 'simform')
  assert.equal(provider.companyName, 'Simform')
  assert.equal(provider.officialBrandName, 'Simform')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.officialCareersPageUrl, 'https://www.simform.com/careers/')
  assert.equal(provider.companyCareerPage, 'https://www.simform.com/current-openings/')
  assert.equal(provider.atsPlatform, 'kula-empty-board-sentinel')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'verified-current-openings-empty-state')
  assert.equal(
    provider.extractionStrategy,
    'verified-current-openings-page+verified-empty-state+fail-closed-sentinel',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.companyDomain, 'simform.com')
  assert.equal(provider.verifiedOn, '2026-07-18')
  assert.match(provider.dryRunFile, /simform[\\/]jobs\.json$/i)
  assert.equal(provider.modulePath, modulePath)
  assert.match(provider.verifiedSurfaceSummary, /Saturday, July 18, 2026/i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/www\.simform\.com\/current-openings\//i)
  assert.match(provider.verifiedSurfaceSummary, /No jobs found matching your criteria/i)
  assert.match(provider.verifiedSurfaceSummary, /Load More Jobs/i)
})

test('Simform exact backlog row resolves directly from the local provider metadata', async () => {
  const { SIMFORM_CATALOG } = await loadCatalogModule()
  const report = generateCompanyCoverageReport({
    csvText: 'Simform\n',
    catalog: [hydrateProviderCatalogEntry(SIMFORM_CATALOG)],
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Simform', 'simform', 'Simform']],
  )
})

test('Simform hydrated local catalog stays script-runner compatible for later registry integration', async () => {
  const { SIMFORM_CATALOG } = await loadCatalogModule()
  const provider = hydrateProviderCatalogEntry(SIMFORM_CATALOG)
  const module = await import(pathToFileURL(provider.modulePath).href)

  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyCareerPage, SIMFORM_CATALOG.companyCareerPage)
  assert.equal(provider.companyDomain, 'simform.com')
  assert.equal(provider.atsPlatform, 'kula-empty-board-sentinel')
  assert.match(provider.modulePath, /simform[\\/]script\.js$/i)
  assert.match(provider.dryRunFile, /simform[\\/]jobs\.json$/i)
  assert.equal(typeof module.run, 'function')
})
