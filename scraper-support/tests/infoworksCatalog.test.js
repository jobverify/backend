import assert from 'node:assert/strict'
import test from 'node:test'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { hydrateProviderCatalogEntry } from '../providers/index.js'

const loadInfoworksCatalog = async () => {
  try {
    return await import('../../scraper/infoworks/catalog.js')
  } catch {
    assert.fail('Expected Infoworks catalog module at ../../scraper/infoworks/catalog.js')
  }
}

test('Infoworks catalog metadata captures the verified acquisition landing page with no exact-name public jobs surface', async () => {
  const { INFOWORKS_CATALOG } = await loadInfoworksCatalog()
  const provider = hydrateProviderCatalogEntry(INFOWORKS_CATALOG)

  assert.equal(provider.source, 'infoworks')
  assert.equal(provider.companyName, 'Infoworks')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyCareerPage, 'https://www.infoworks.io/')
  assert.equal(provider.homepageUrl, 'https://www.infoworks.io/')
  assert.equal(provider.officialAcquisitionUrl, 'https://www.uniphore.com/infoworks/')
  assert.equal(provider.parentCareersUrl, 'https://www.uniphore.com/careers/')
  assert.equal(provider.officialBrandName, 'InfoWorks')
  assert.equal(provider.parentCompanyName, 'Uniphore')
  assert.equal(provider.atsPlatform, 'acquired-company-landing-page-no-public-careers')
  assert.equal(provider.countryFilter, 'Global')
  assert.equal(provider.paginationStrategy, 'verified-infoworks-domain-redirects-to-acquisition-landing-page')
  assert.equal(
    provider.extractionStrategy,
    'verified-infoworks-domain-routes-redirect-to-uniphore-acquisition-page+no-exact-name-public-jobs-surface-return-empty',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.companyDomain, 'infoworks.io')
  assert.equal(provider.verifiedOn, '2026-07-17')
  assert.deepEqual(provider.firstPartyRedirectRoutes, [
    'https://www.infoworks.io/',
    'https://www.infoworks.io/careers',
    'https://www.infoworks.io/jobs',
    'https://www.infoworks.io/about',
  ])
  assert.match(provider.modulePath, /infoworks[\\/]script\.js$/i)
  assert.match(provider.dryRunFile, /infoworks[\\/]jobs\.json$/i)
  assert.match(provider.verifiedSurfaceSummary, /Friday, July 17, 2026/i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/www\.infoworks\.io\//i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/www\.uniphore\.com\/infoworks\//i)
  assert.match(provider.verifiedSurfaceSummary, /Uniphore acquired Infoworks/i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/www\.uniphore\.com\/careers\//i)
  assert.match(provider.verifiedSurfaceSummary, /no trustworthy exact-name public jobs surface/i)
})

test('Infoworks exact-name backlog rows resolve from local provider metadata without shared registry edits', async () => {
  const { INFOWORKS_CATALOG } = await loadInfoworksCatalog()
  const report = generateCompanyCoverageReport({
    csvText: 'Infoworks\n',
    catalog: [hydrateProviderCatalogEntry(INFOWORKS_CATALOG)],
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Infoworks', 'infoworks', 'Infoworks']],
  )
})
