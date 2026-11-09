import assert from 'node:assert/strict'
import test from 'node:test'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { hydrateProviderCatalogEntry, getScraperCatalog } from '../providers/index.js'

const loadCatalogModule = async () => {
  try {
    return await import('../../scraper/velaninfoservices/catalog.js')
  } catch {
    assert.fail('Expected Velan Info Services catalog module at ../../scraper/velaninfoservices/catalog.js')
  }
}

test('Velan Info Services catalog captures the verified first-party current-openings board', async () => {
  const { VELANINFOSERVICES_CATALOG, default: defaultCatalog } = await loadCatalogModule()
  const provider = hydrateProviderCatalogEntry(VELANINFOSERVICES_CATALOG)

  assert.equal(defaultCatalog, VELANINFOSERVICES_CATALOG)
  assert.equal(provider.source, 'velaninfoservices')
  assert.equal(provider.companyName, 'Velan Info Services')
  assert.equal(provider.officialBrandName, 'Velan Info Services')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.homepageUrl, 'https://www.velaninfo.com/careers')
  assert.equal(provider.companyCareerPage, 'https://www.velaninfo.com/jobs')
  assert.equal(provider.atsPlatform, 'first-party-current-openings-page')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'single-first-party-current-openings-page')
  assert.equal(provider.extractionStrategy, 'verified-job-sections+inline-apply-links')
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.companyDomain, 'velaninfo.com')
  assert.equal(provider.verifiedOn, '2026-07-18')
  assert.match(provider.modulePath, /velaninfoservices[\\/]script\.js$/i)
  assert.match(provider.dryRunFile, /velaninfoservices[\\/]jobs\.json$/i)
  assert.match(provider.verifiedSurfaceSummary, /Saturday, July 18, 2026/i)
  assert.match(provider.verifiedSurfaceSummary, /Senior Accountant/i)
  assert.match(provider.verifiedSurfaceSummary, /Process Executive/i)
  const current = getScraperCatalog().find(row => row.source === 'velaninfoservices')
  assert.equal(current.verifiedOn, '2026-11-05')
  assert.match(current.extractionStrategy, /whole-native-role-criteria/)
  assert.match(current.paginationStrategy, /company-scope-unqualified/)
  assert.equal(current.verifiedPublicJobCount, null)
  assert.equal(current.verifiedIndiaJobCount, null)
})

test('Velan Info Services exact backlog row resolves from the local catalog contract', async () => {
  const { VELANINFOSERVICES_CATALOG } = await loadCatalogModule()
  const report = generateCompanyCoverageReport({
    csvText: 'Velan Info Services\n',
    catalog: [hydrateProviderCatalogEntry(VELANINFOSERVICES_CATALOG)],
    aliasMap: {},
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Velan Info Services', 'velaninfoservices', 'Velan Info Services']],
  )
})
