import assert from 'node:assert/strict'
import test from 'node:test'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { hydrateProviderCatalogEntry } from '../providers/index.js'

const loadCatalogModule = async () => {
  try {
    return await import('../../scraper/sourcedeskglobal/catalog.js')
  } catch {
    assert.fail('Expected Sourcedesk Global catalog module at ../../scraper/sourcedeskglobal/catalog.js')
  }
}

test('Sourcedesk Global catalog captures the verified first-party current-openings surface', async () => {
  const { SOURCEDESKGLOBAL_CATALOG, default: defaultCatalog } = await loadCatalogModule()
  const provider = hydrateProviderCatalogEntry(SOURCEDESKGLOBAL_CATALOG)

  assert.equal(defaultCatalog, SOURCEDESKGLOBAL_CATALOG)
  assert.equal(provider.source, 'sourcedeskglobal')
  assert.equal(provider.companyName, 'Sourcedesk Global')
  assert.equal(provider.officialBrandName, 'Sourcedesk')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.homepageUrl, 'https://www.sourcedesk.io/')
  assert.equal(provider.companyCareerPage, 'https://www.sourcedesk.io/current-openings')
  assert.equal(provider.sampleJobUrl, 'https://www.sourcedesk.io/current-openings/seo-executive')
  assert.equal(provider.atsPlatform, 'first-party-nextjs-current-openings-pages')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'single-current-openings-page-plus-first-party-detail-pages')
  assert.equal(provider.extractionStrategy, 'verified-current-openings-page+first-party-detail-pages')
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.companyDomain, 'sourcedesk.io')
  assert.equal(provider.verifiedOn, '2026-08-04')
  assert.match(provider.modulePath, /sourcedeskglobal[\\/]script\.js$/i)
  assert.match(provider.dryRunFile, /sourcedeskglobal[\\/]jobs\.json$/i)
  assert.match(provider.verifiedSurfaceSummary, /Tuesday, August 4, 2026/i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/www\.sourcedeskglobal\.com\/job\/ now redirects/i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/www\.sourcedesk\.io\/current-openings\/seo-executive/i)
})

test('Sourcedesk Global exact backlog row resolves from the local catalog contract', async () => {
  const { SOURCEDESKGLOBAL_CATALOG } = await loadCatalogModule()
  const report = generateCompanyCoverageReport({
    csvText: 'Sourcedesk Global\n',
    catalog: [hydrateProviderCatalogEntry(SOURCEDESKGLOBAL_CATALOG)],
    aliasMap: {},
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Sourcedesk Global', 'sourcedeskglobal', 'Sourcedesk Global']],
  )
})
