import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { hydrateProviderCatalogEntry } from '../providers/index.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const modulePath = path.resolve(currentDir, '../../scraper/pramataknowledgesolutions/script.js')

const loadCatalogModule = async () => {
  try {
    return await import('../../scraper/pramataknowledgesolutions/catalog.js')
  } catch {
    assert.fail('Expected Pramata Knowledge Solutions catalog module at ../../scraper/pramataknowledgesolutions/catalog.js')
  }
}

const buildCatalogReadyProvider = (catalogEntry) => hydrateProviderCatalogEntry({
  ...catalogEntry,
  modulePath,
})

test('Pramata Knowledge Solutions local catalog captures the currently verified Cloudflare-gated careers routes', async () => {
  const { PRAMATA_KNOWLEDGE_SOLUTIONS_CATALOG, default: defaultCatalog } = await loadCatalogModule()
  const provider = buildCatalogReadyProvider(PRAMATA_KNOWLEDGE_SOLUTIONS_CATALOG)

  assert.equal(defaultCatalog, PRAMATA_KNOWLEDGE_SOLUTIONS_CATALOG)
  assert.equal(provider.source, 'pramataknowledgesolutions')
  assert.equal(provider.companyName, 'Pramata Knowledge Solutions')
  assert.equal(provider.officialBrandName, 'Pramata')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyCareerPage, 'https://www.pramata.com/careers/')
  assert.equal(provider.sampleRoleUrl, 'https://www.pramata.com/careers/legal-solution-consultant/')
  assert.equal(provider.contactEmail, 'hr-usa@pramata.com')
  assert.equal(provider.atsPlatform, 'first-party-careers-page-bot-gated')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'verified-blocked-careers-routes')
  assert.equal(provider.extractionStrategy, 'verified-cloudflare-403-careers-routes-return-empty')
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.companyDomain, 'pramata.com')
  assert.equal(provider.verifiedOn, '2026-08-14')
  assert.match(provider.verifiedSurfaceSummary, /Friday, August 14, 2026/i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/www\.pramata\.com\/careers\//i)
  assert.match(provider.verifiedSurfaceSummary, /legal-solution-consultant/i)
  assert.match(provider.verifiedSurfaceSummary, /403/i)
  assert.match(provider.verifiedSurfaceSummary, /Just a moment/i)
  assert.equal(provider.modulePath, modulePath)
  assert.match(provider.dryRunFile, /pramataknowledgesolutions[\\/]jobs\.json$/i)
})

test('Pramata Knowledge Solutions exact backlog row resolves from the local provider contract', async () => {
  const { PRAMATA_KNOWLEDGE_SOLUTIONS_CATALOG } = await loadCatalogModule()
  const report = generateCompanyCoverageReport({
    csvText: 'Pramata Knowledge Solutions\n',
    catalog: [buildCatalogReadyProvider(PRAMATA_KNOWLEDGE_SOLUTIONS_CATALOG)],
    aliasMap: {},
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Pramata Knowledge Solutions', 'pramataknowledgesolutions', 'Pramata Knowledge Solutions']],
  )
})
