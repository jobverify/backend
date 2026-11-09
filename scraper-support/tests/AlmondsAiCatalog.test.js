import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { hydrateProviderCatalogEntry } from '../providers/index.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const modulePath = path.resolve(currentDir, '../../scraper/almondsai/script.js')

const loadCatalogModule = async () => {
  try {
    return await import('../../scraper/almondsai/catalog.js')
  } catch {
    assert.fail('Expected Almonds Ai catalog module at ../../scraper/almondsai/catalog.js')
  }
}

test('Almonds Ai local catalog captures the verified first-party careers page', async () => {
  const { ALMONDS_AI_CATALOG, default: defaultCatalog } = await loadCatalogModule()
  const provider = hydrateProviderCatalogEntry(ALMONDS_AI_CATALOG)

  assert.equal(defaultCatalog, ALMONDS_AI_CATALOG)
  assert.equal(provider.source, 'almondsai')
  assert.equal(provider.companyName, 'Almonds Ai')
  assert.equal(provider.officialBrandName, 'Almonds Ai')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyCareerPage, 'https://almondsdev.almonds.ai/career/')
  assert.equal(provider.officialCareersPageUrl, 'https://almondsdev.almonds.ai/career/')
  assert.equal(provider.companyDomain, 'almondsdev.almonds.ai')
  assert.equal(provider.atsPlatform, 'official-company-careers')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'single-first-party-careers-page')
  assert.equal(provider.extractionStrategy, 'verified-first-party-role-sections+mailto-apply')
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.verifiedOn, '2026-07-17')
  assert.equal(provider.modulePath, modulePath)
  assert.match(provider.dryRunFile, /almondsai[\\/]jobs\.json$/i)
  assert.match(provider.verifiedSurfaceSummary, /Friday, July 17, 2026/i)
  assert.match(provider.verifiedSurfaceSummary, /Automation Tester/i)
  assert.match(provider.verifiedSurfaceSummary, /Business Analyst/i)
  assert.match(provider.verifiedSurfaceSummary, /Tech Lead \(Head of Technology\)/i)
})

test('Almonds Ai exact backlog row resolves from the local catalog entry', async () => {
  const { ALMONDS_AI_CATALOG } = await loadCatalogModule()
  const report = generateCompanyCoverageReport({
    csvText: 'Almonds Ai\n',
    catalog: [hydrateProviderCatalogEntry(ALMONDS_AI_CATALOG)],
    aliasMap: {},
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Almonds Ai', 'almondsai', 'Almonds Ai']],
  )
})
