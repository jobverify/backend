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
    return await import('../../scraper/redpanda/catalog.js')
  } catch {
    assert.fail('Expected Redpanda catalog module at ../../scraper/redpanda/catalog.js')
  }
}

test('Redpanda catalog captures the verified first-party jobs page and embedded Ashby feed metadata', async () => {
  const { REDPANDA_CATALOG, default: defaultCatalog } = await loadCatalog()
  const provider = hydrateProviderCatalogEntry(REDPANDA_CATALOG)

  assert.equal(defaultCatalog, REDPANDA_CATALOG)
  assert.equal(provider.source, 'redpanda')
  assert.equal(provider.companyName, 'Redpanda')
  assert.equal(provider.officialBrandName, 'Redpanda')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyCareerPage, 'https://www.redpanda.com/jobs')
  assert.equal(provider.ashbyBoardSlug, 'redpanda-data')
  assert.equal(
    provider.ashbyJobBoardUrl,
    'https://api.ashbyhq.com/posting-api/job-board/redpanda-data',
  )
  assert.equal(provider.companyDomain, 'redpanda.com')
  assert.equal(provider.atsPlatform, 'ashby')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'single-first-party-jobs-page-with-embedded-ashby-feed')
  assert.equal(
    provider.extractionStrategy,
    'verified-first-party-jobs-page+embedded-ashby-job-board-api+india-location-filter',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.verifiedOn, '2026-07-25')
  assert.match(provider.modulePath, /redpanda[\\/]script\.js$/i)
  assert.match(provider.dryRunFile, /redpanda[\\/]jobs\.json$/i)
  assert.match(provider.verifiedSurfaceSummary, /Saturday, July 25, 2026/i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/www\.redpanda\.com\/jobs/i)
  assert.match(
    provider.verifiedSurfaceSummary,
    /https:\/\/api\.ashbyhq\.com\/posting-api\/job-board\/redpanda-data/i,
  )
  assert.match(provider.verifiedSurfaceSummary, /15 listed roles/i)
  assert.match(provider.verifiedSurfaceSummary, /zero India openings/i)
})

test('buildScrapers and company coverage resolve Redpanda from the shared catalog', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'redpanda')
  const scraper = buildScrapers().find((item) => item.name === 'redpanda')

  assert.ok(provider, 'Expected Redpanda provider to be registered in customProviders.json')
  assert.ok(scraper)
  assert.equal(provider.companyName, 'Redpanda')
  assert.equal(provider.companyCareerPage, 'https://www.redpanda.com/jobs')
  assert.equal(provider.ashbyBoardSlug, 'redpanda-data')
  assert.match(scraper.dryRunFile, /redpanda[\\/]jobs\.json$/i)

  const report = generateCompanyCoverageReport({
    csvText: 'company_name\nRedpanda\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Redpanda', 'redpanda', 'Redpanda']],
  )
})
