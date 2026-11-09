import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { hydrateProviderCatalogEntry } from '../providers/index.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const modulePath = path.resolve(currentDir, '../../scraper/sapphiresoftwaresolutionsindia/script.js')

const loadCatalogModule = async () => {
  try {
    return await import('../../scraper/sapphiresoftwaresolutionsindia/catalog.js')
  } catch {
    assert.fail('Expected Sapphire Software Solutions India catalog module at ../../scraper/sapphiresoftwaresolutionsindia/catalog.js')
  }
}

const buildCatalogReadyProvider = (catalogEntry) => hydrateProviderCatalogEntry({
  ...catalogEntry,
  modulePath,
})

test('Sapphire Software Solutions (India) local catalog captures the verified first-party current openings page', async () => {
  const { SAPPHIRE_SOFTWARE_SOLUTIONS_INDIA_CATALOG, default: defaultCatalog } = await loadCatalogModule()
  const provider = buildCatalogReadyProvider(SAPPHIRE_SOFTWARE_SOLUTIONS_INDIA_CATALOG)

  assert.equal(defaultCatalog, SAPPHIRE_SOFTWARE_SOLUTIONS_INDIA_CATALOG)
  assert.equal(provider.source, 'sapphiresoftwaresolutionsindia')
  assert.equal(provider.companyName, 'Sapphire Software Solutions (India)')
  assert.equal(provider.officialBrandName, 'Sapphire Software Solutions')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.homepageUrl, 'https://www.sapphiresolutions.net/')
  assert.equal(provider.companyCareerPage, 'https://www.sapphiresolutions.net/careers?tab=CurrentOpenings')
  assert.equal(provider.atsPlatform, 'official-company-site-current-openings-page')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'single-page')
  assert.equal(provider.extractionStrategy, 'html-current-openings-cards')
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.companyDomain, 'sapphiresolutions.net')
  assert.equal(provider.verifiedOn, '2026-07-17')
  assert.equal(provider.modulePath, modulePath)
  assert.match(provider.verifiedSurfaceSummary, /Friday, July 17, 2026/i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/www\.sapphiresolutions\.net\/careers\?tab=CurrentOpenings/i)
  assert.match(provider.verifiedSurfaceSummary, /Business Development Executive/i)
  assert.match(provider.verifiedSurfaceSummary, /Senior HR Executive/i)
})

test('Sapphire Software Solutions (India) exact backlog row resolves from the local provider contract', async () => {
  const { SAPPHIRE_SOFTWARE_SOLUTIONS_INDIA_CATALOG } = await loadCatalogModule()
  const report = generateCompanyCoverageReport({
    csvText: 'Sapphire Software Solutions (India)\n',
    catalog: [buildCatalogReadyProvider(SAPPHIRE_SOFTWARE_SOLUTIONS_INDIA_CATALOG)],
    aliasMap: {},
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Sapphire Software Solutions (India)', 'sapphiresoftwaresolutionsindia', 'Sapphire Software Solutions (India)']],
  )
})
