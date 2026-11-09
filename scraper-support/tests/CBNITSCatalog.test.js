import assert from 'node:assert/strict'
import test from 'node:test'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { hydrateProviderCatalogEntry, getScraperCatalog } from '../providers/index.js'

const loadCatalogModule = async () => {
  try {
    return await import('../../scraper/cbnits/catalog.js')
  } catch {
    assert.fail('Expected CBNITS catalog module at ../../scraper/cbnits/catalog.js')
  }
}

test('CBNITS catalog captures the current first-party discovery-only careers contract', async () => {
  const { CBNITS_CATALOG, default: defaultCatalog } = await loadCatalogModule()
  const provider = hydrateProviderCatalogEntry(CBNITS_CATALOG)

  assert.equal(defaultCatalog, CBNITS_CATALOG)
  const active = getScraperCatalog().find(item => item.source === 'cbnits')
  for (const field of ['companyCareerPage', 'atsPlatform', 'paginationStrategy', 'extractionStrategy', 'verifiedOn', 'verifiedPublicJobCount', 'verifiedIndiaJobCount', 'verificationDisposition']) {
    assert.equal(active[field], provider[field], 'Active CBNITS metadata: ' + field)
  }
  assert.equal(provider.source, 'cbnits')
  assert.equal(provider.companyName, 'CBNITS')
  assert.equal(provider.officialBrandName, 'CBNITS')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.homepageUrl, 'https://www.cbnits.com/')
  assert.equal(provider.companyCareerPage, 'https://www.cbnits.com/career/')
  assert.equal(provider.atsPlatform, 'first-party-nextjs-careers-discovery-only')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'first-party-nextjs-careers-route-and-bundle-validation')
  assert.equal(
    provider.extractionStrategy,
    'verified-first-party-nextjs-careers-route+unpublished-job-api-view-discovery-only',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.companyDomain, 'cbnits.com')
  assert.equal(provider.verifiedOn, '2026-10-09')
  assert.equal(provider.verifiedPublicJobCount, null)
  assert.equal(provider.verifiedIndiaJobCount, null)
  assert.match(provider.modulePath, /cbnits[\\/]script\.js$/i)
  assert.match(provider.dryRunFile, /cbnits[\\/]jobs\.json$/i)
  assert.match(provider.verifiedSurfaceSummary, /2026-10-09/i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/www\.cbnits\.com\/career\//i)
  assert.match(provider.verifiedSurfaceSummary, /Careers at CBNITS \| AI & Engineering Opportunities/i)
  assert.match(provider.verifiedSurfaceSummary, /discovery-only.*does not establish an empty India inventory/i)
})

test('CBNITS exact backlog row resolves from the local catalog contract', async () => {
  const { CBNITS_CATALOG } = await loadCatalogModule()
  const report = generateCompanyCoverageReport({
    csvText: 'CBNITS\n',
    catalog: [hydrateProviderCatalogEntry(CBNITS_CATALOG)],
    aliasMap: {},
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['CBNITS', 'cbnits', 'CBNITS']],
  )
})
