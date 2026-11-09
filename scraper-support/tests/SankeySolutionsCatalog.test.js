import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { hydrateProviderCatalogEntry } from '../providers/index.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const modulePath = path.resolve(currentDir, '../../scraper/sankeysolutions/script.js')

const loadCatalogModule = async () => {
  try {
    return await import('../../scraper/sankeysolutions/catalog.js')
  } catch {
    assert.fail('Expected Sankey Solutions catalog module at ../../scraper/sankeysolutions/catalog.js')
  }
}

test('Sankey Solutions local catalog captures the verified first-party careers page and detail links', async () => {
  const { SANKEY_SOLUTIONS_CATALOG, default: defaultCatalog } = await loadCatalogModule()
  const provider = hydrateProviderCatalogEntry(SANKEY_SOLUTIONS_CATALOG)

  assert.equal(defaultCatalog, SANKEY_SOLUTIONS_CATALOG)
  assert.equal(provider.source, 'sankeysolutions')
  assert.equal(provider.companyName, 'Sankey Solutions')
  assert.equal(provider.companyCareerPage, 'https://sankeysolutions.com/careers/')
  assert.equal(provider.atsPlatform, 'official-company-careers')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'single-first-party-careers-page')
  assert.equal(
    provider.extractionStrategy,
    'verified-first-party-careers-page+detail-links',
  )
  assert.equal(provider.verifiedOn, '2026-07-18')
  assert.equal(provider.companyDomain, 'sankeysolutions.com')
  assert.equal(provider.modulePath, modulePath)
  assert.match(provider.verifiedSurfaceSummary, /Saturday, July 18, 2026/i)
  assert.match(provider.verifiedSurfaceSummary, /Solution Analyst/i)
  assert.match(provider.verifiedSurfaceSummary, /Technical Architect/i)
})

test('Sankey Solutions exact backlog row resolves from the local catalog object', async () => {
  const { SANKEY_SOLUTIONS_CATALOG } = await loadCatalogModule()
  const report = generateCompanyCoverageReport({
    csvText: 'Sankey Solutions\n',
    catalog: [hydrateProviderCatalogEntry(SANKEY_SOLUTIONS_CATALOG)],
    aliasMap: {},
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
})
