import assert from 'node:assert/strict'
import test from 'node:test'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import {
  buildScrapers,
  getScraperCatalog,
  hydrateProviderCatalogEntry,
} from '../providers/index.js'

const loadCatalog = async () => {
  try {
    return await import('../../scraper/airbyte/catalog.js')
  } catch {
    assert.fail('Expected Airbyte catalog module at ../../scraper/airbyte/catalog.js')
  }
}

test('Airbyte catalog captures the verified first-party careers and Ashby metadata', async () => {
  const { AIRBYTE_CATALOG } = await loadCatalog()
  const provider = hydrateProviderCatalogEntry(AIRBYTE_CATALOG)

  assert.equal(provider.source, 'airbyte')
  assert.equal(provider.companyName, 'Airbyte')
  assert.equal(provider.officialBrandName, 'Airbyte')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyCareerPage, 'https://airbyte.com/company/careers')
  assert.equal(provider.ashbyPublicBoardUrl, 'https://jobs.ashbyhq.com/airbyte')
  assert.equal(provider.ashbyJobBoardUrl, 'https://api.ashbyhq.com/posting-api/job-board/airbyte')
  assert.equal(provider.atsPlatform, 'ashby')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'complete-native-board-feed-all-details-and-closing-reconciliation')
  assert.equal(
    provider.extractionStrategy,
    'current-corporate-lazy-client-embed-binding+native-board-feed-all-role-details+explicit-worksite-countries+closing-role-state',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.companyDomain, 'airbyte.com')
  assert.equal(provider.verifiedOn, '2026-10-27')
  assert.match(provider.modulePath, /airbyte[\\/]script\.js$/i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/airbyte\.com\/company\/careers/i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/jobs\.ashbyhq\.com\/airbyte/i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/api\.ashbyhq\.com\/posting-api\/job-board\/airbyte/i)
  assert.match(provider.verifiedSurfaceSummary, /every native role detail/i)
  assert.match(provider.verifiedSurfaceSummary, /closing corporate and native role state/i)
})

test('buildScrapers and company coverage resolve Airbyte from the shared catalog', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'airbyte')
  const scraper = buildScrapers().find((item) => item.name === 'airbyte')

  assert.ok(provider)
  assert.ok(scraper)
  assert.equal(provider.companyName, 'Airbyte')
  assert.equal(provider.companyCareerPage, 'https://airbyte.com/company/careers')
  assert.equal(provider.runtimeSourceScopeVerification, true)
  assert.equal(provider.verifiedPublicJobCount, null)
  assert.equal(provider.verifiedIndiaJobCount, null)
  assert.equal(provider.sourceScopeComplete, null)
  assert.match(scraper.dryRunFile, /airbyte[\\/]jobs\.json$/i)

  const report = generateCompanyCoverageReport({
    csvText: 'Airbyte\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Airbyte', 'airbyte', 'Airbyte']],
  )
})
