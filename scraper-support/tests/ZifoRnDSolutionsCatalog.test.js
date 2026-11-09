import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { hydrateProviderCatalogEntry } from '../providers/index.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const modulePath = path.resolve(currentDir, '../../scraper/zifo/script.js')

const loadCatalogModule = async () => {
  try {
    return await import('../../scraper/zifo/catalog.js')
  } catch {
    assert.fail('Expected Zifo RnD Solutions catalog module at ../../scraper/zifo/catalog.js')
  }
}

test('Zifo RnD Solutions local catalog captures the current published India inventory', async () => {
  const { ZIFO_RND_SOLUTIONS_CATALOG, default: defaultCatalog } = await loadCatalogModule()
  const provider = hydrateProviderCatalogEntry(ZIFO_RND_SOLUTIONS_CATALOG)

  assert.equal(defaultCatalog, ZIFO_RND_SOLUTIONS_CATALOG)
  assert.equal(provider.source, 'zifo')
  assert.equal(provider.companyName, 'Zifo RnD Solutions')
  assert.equal(provider.officialBrandName, 'Zifo')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyCareerPage, 'https://careers.zifo.com/')
  assert.equal(provider.officialCareersPageUrl, 'https://careers.zifo.com/')
  assert.equal(provider.companyDomain, 'careers.zifo.com')
  assert.equal(provider.atsPlatform, 'workable')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(
    provider.paginationStrategy,
    'first-party-india-links-plus-complete-workable-published-jobs-feed',
  )
  assert.equal(
    provider.extractionStrategy,
    'verified-first-party-india-links+workable-public-api+explicit-india-country-filter',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.verifiedOn, '2026-10-03')
  assert.equal(provider.modulePath, modulePath)
  assert.match(provider.dryRunFile, /zifo[\\/]jobs\.json$/i)
  assert.match(provider.verifiedSurfaceSummary, /October 3, 2026/i)
  assert.match(provider.verifiedSurfaceSummary, /two Zifo India roles/i)
  assert.match(provider.verifiedSurfaceSummary, /41 published location records/i)
})

test('Zifo RnD Solutions exact backlog row resolves from the local catalog entry', async () => {
  const { ZIFO_RND_SOLUTIONS_CATALOG } = await loadCatalogModule()
  const report = generateCompanyCoverageReport({
    csvText: 'Zifo RnD Solutions\n',
    catalog: [hydrateProviderCatalogEntry(ZIFO_RND_SOLUTIONS_CATALOG)],
    aliasMap: {},
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Zifo RnD Solutions', 'zifo', 'Zifo RnD Solutions']],
  )
})
