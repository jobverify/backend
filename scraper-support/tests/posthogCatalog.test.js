import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { buildScrapers, getScraperCatalog } from '../providers/index.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const posthogModulePath = path.resolve(currentDir, '../../scraper/posthog/script.js')

const loadCatalogModule = async () => {
  try {
    return await import('../../scraper/posthog/catalog.js')
  } catch {
    assert.fail('Expected PostHog catalog module at ../../scraper/posthog/catalog.js')
  }
}

test('getScraperCatalog includes PostHog as a first-party script provider pinned to the verified careers page-data contract', async () => {
  const { POSTHOG_CATALOG, default: defaultCatalog } = await loadCatalogModule()
  const provider = getScraperCatalog().find((item) => item.source === 'posthog')

  assert.equal(defaultCatalog, POSTHOG_CATALOG)
  assert.ok(provider, 'Expected PostHog provider to be registered in customProviders.json')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyName, 'PostHog')
  assert.equal(provider.officialBrandName, 'PostHog')
  assert.equal(provider.companyCareerPage, 'https://posthog.com/careers')
  assert.equal(
    provider.discoveryCareerPageDataUrl,
    'https://posthog.com/page-data/careers/product-engineer/page-data.json',
  )
  assert.equal(provider.companyDomain, 'posthog.com')
  assert.equal(provider.atsPlatform, 'posthog-first-party-gatsby-page-data')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(
    provider.paginationStrategy,
    'first-party-careers-html-plus-same-domain-gatsby-page-data-current-empty-india-slice',
  )
  assert.equal(
    provider.extractionStrategy,
    'verified-first-party-careers-page+same-domain-gatsby-page-data+timezone-scan+return-empty-when-no-india-signals',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.verifiedOn, '2026-10-03')
  assert.equal(provider.verifiedPublicJobCount, 8)
  assert.equal(provider.verifiedIndiaJobCount, 0)
  assert.match(provider.modulePath, /posthog[\\/]script\.js$/i)
  assert.match(provider.dryRunFile, /posthog[\\/]jobs\.json$/i)
  assert.equal(POSTHOG_CATALOG.modulePath, posthogModulePath)
  assert.match(provider.verifiedSurfaceSummary, /October 3, 2026/i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/posthog\.com\/careers/i)
  assert.match(
    provider.verifiedSurfaceSummary,
    /https:\/\/posthog\.com\/page-data\/careers\/product-engineer\/page-data\.json/i,
  )
  assert.match(provider.verifiedSurfaceSummary, /AI Research Engineer/i)
  assert.match(provider.verifiedSurfaceSummary, /Product Engineer/i)
  assert.match(provider.verifiedSurfaceSummary, /Technical Customer Success Manager - Americas/i)
  assert.match(provider.verifiedSurfaceSummary, /zero India/i)
})

test('PostHog exact backlog row resolves directly from local provider metadata without aliases', async () => {
  const { POSTHOG_CATALOG } = await loadCatalogModule()

  const report = generateCompanyCoverageReport({
    csvText: 'company_name\nPostHog\n',
    catalog: [POSTHOG_CATALOG],
    aliasMap: {},
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['PostHog', 'posthog', 'PostHog']],
  )
})

test('buildScrapers exposes a runnable PostHog scraper without changing the runner contract', () => {
  const scraper = buildScrapers().find((item) => item.name === 'posthog')

  assert.ok(scraper)
  assert.equal(typeof scraper.run, 'function')
  assert.match(scraper.dryRunFile, /posthog[\\/]jobs\.json$/i)
  assert.equal(scraper.provider.source, 'posthog')
  assert.equal(scraper.provider.companyCareerPage, 'https://posthog.com/careers')
})
