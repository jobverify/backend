import assert from 'node:assert/strict'
import test from 'node:test'

import { generateCompanyCoverageReport } from '../../scraper-support/providers/companyCoverage.js'
import { buildScrapers, getScraperCatalog } from '../../scraper-support/providers/index.js'

const loadCatalogModule = async () => {
  try {
    return await import('./catalog.js')
  } catch {
    assert.fail('Expected LogRocket catalog module at ./catalog.js')
  }
}

test('LogRocket catalog binds its native Lever inventory with current employer-role reconciliation', async () => {
  const { LOGROCKET_CATALOG, default: defaultCatalog } = await loadCatalogModule()
  const provider = getScraperCatalog().find((item) => item.source === 'logrocket')

  assert.equal(defaultCatalog, LOGROCKET_CATALOG)
  assert.ok(provider, 'Expected LogRocket provider to be registered in customProviders.json')
  assert.equal(provider.adapter, 'publicAts')
  assert.equal(provider.companyName, 'LogRocket')
  assert.equal(provider.officialBrandName, 'LogRocket')
  assert.equal(provider.companyCareerPage, 'https://logrocket.com/careers')
  assert.equal(provider.companyDomain, 'logrocket.com')
  assert.equal(provider.atsPlatform, 'lever')
  assert.equal(provider.boardToken, 'logrocket')
  assert.equal(provider.leverRegion, 'global')
  assert.equal(provider.bindingEvidence.verified, true)
  assert.equal(provider.bindingEvidence.officialURL, provider.companyCareerPage)
  assert.equal(provider.runtimeInventoryVerification.mode, 'role-links-exact')
  assert.equal(provider.runtimeInventoryVerification.boardUrl, 'https://jobs.lever.co/logrocket')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'complete-public-posting-api')
  assert.equal(
    provider.extractionStrategy,
    'current-employer-role-reconciliation+complete-native-lever-api',
  )
  assert.equal(provider.parser, 'validated-public-ats')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.verifiedOn, '2026-07-25')
  assert.match(provider.modulePath, /logrocket[\\/]script\.js$/i)
  assert.match(provider.dryRunFile, /logrocket[\\/]jobs\.json$/i)
  // Local first-party findings remain dated provenance, separate from current native routing.
  assert.match(LOGROCKET_CATALOG.verifiedSurfaceSummary, /Saturday, July 25, 2026/i)
  assert.match(LOGROCKET_CATALOG.verifiedSurfaceSummary, /https:\/\/logrocket\.com\/careers/i)
  assert.match(LOGROCKET_CATALOG.verifiedSurfaceSummary, /\b6 public openings\b/i)
  assert.match(LOGROCKET_CATALOG.verifiedSurfaceSummary, /Boston or NYC/i)
  assert.match(LOGROCKET_CATALOG.verifiedSurfaceSummary, /Remote - US or Boston, MA/i)
  assert.match(LOGROCKET_CATALOG.verifiedSurfaceSummary, /zero India locations/i)
})

test('LogRocket exact-name backlog coverage resolves directly from the local catalog without aliases', async () => {
  const { LOGROCKET_CATALOG } = await loadCatalogModule()

  const report = generateCompanyCoverageReport({
    csvText: 'company_name\nLogRocket\n',
    catalog: [LOGROCKET_CATALOG],
    aliasMap: {},
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['LogRocket', 'logrocket', 'LogRocket']],
  )
})

test('buildScrapers exposes a runnable LogRocket scraper without changing the runner contract', () => {
  const scraper = buildScrapers().find((item) => item.name === 'logrocket')

  assert.ok(scraper)
  assert.equal(typeof scraper.run, 'function')
  assert.match(scraper.dryRunFile, /logrocket[\\/]jobs\.json$/i)
  assert.equal(scraper.provider.source, 'logrocket')
  assert.equal(scraper.provider.companyCareerPage, 'https://logrocket.com/careers')
})
