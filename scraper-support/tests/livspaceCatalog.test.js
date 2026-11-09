import assert from 'node:assert/strict'
import test from 'node:test'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { hydrateProviderCatalogEntry } from '../providers/index.js'

const loadCatalogModule = async () => {
  try {
    return await import('../../scraper/livspace/catalog.js')
  } catch {
    assert.fail('Expected Livspace catalog module at ../../scraper/livspace/catalog.js')
  }
}

const loadScraperModule = async () => {
  try {
    return await import('../../scraper/livspace/script.js')
  } catch {
    assert.fail('Expected Livspace scraper module at ../../scraper/livspace/script.js')
  }
}

test('Livspace local catalog captures the verified first-party careers page and public Zwayam contracts', async () => {
  const { LIVSPACE_CATALOG } = await loadCatalogModule()
  const livspace = await loadScraperModule()
  const provider = hydrateProviderCatalogEntry(LIVSPACE_CATALOG)

  assert.equal(provider.source, 'livspace')
  assert.equal(provider.companyName, 'Livspace')
  assert.equal(provider.officialBrandName, 'Livspace')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.homepageUrl, 'https://www.livspace.com/')
  assert.equal(provider.companyCareerPage, 'https://www.livspace.com/in/careers')
  assert.equal(provider.careersLandingUrl, 'https://careers.livspace.com/livspace/')
  assert.equal(provider.jobsListUrl, 'https://careers.livspace.com/livspace/jobslist')
  assert.equal(provider.zwayamDomain, 'careers.livspace.com')
  assert.equal(provider.zwayamTenantGroupId, 'G1')
  assert.equal(provider.zwayamCompanyId, 'MTU5MTk=')
  assert.equal(provider.zwayamDetailCompanyId, '15919')
  assert.equal(provider.companyDomain, 'livspace.com')
  assert.equal(provider.atsPlatform, 'zwayam')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.verifiedPublicJobCount, 106)
  assert.equal(provider.verifiedSampleJobTitle, 'Cluster Manager - Retail Ops')
  assert.equal(
    provider.verifiedSampleJobUrl,
    'https://careers.livspace.com/livspace/jobview/cluster-manager-retail-ops-pune-maharashtra-2026051109291415',
  )
  assert.equal(
    provider.paginationStrategy,
    'official-careers-page-plus-public-zwayam-total-count-plus-page-size',
  )
  assert.equal(
    provider.extractionStrategy,
    'verified-official-careers-page+zwayam-board-shell+complete-public-zwayam-pagination+native-detail-api+verified-country-or-city-state-scope',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.verifiedOn, '2026-10-03')
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/www\.livspace\.com\/in\/careers/i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/careers\.livspace\.com\/livspace\//i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/public\.zwayam\.com\/jobs\/search/i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/public\.zwayam\.com\/jobs-service\/v1\/jobs\/careersite/i)
  assert.match(provider.verifiedSurfaceSummary, /106 public jobs/i)
  assert.match(provider.verifiedSurfaceSummary, /Cluster Manager - Retail Ops/i)
  assert.match(provider.modulePath, /livspace[\\/]script\.js$/i)
  assert.match(provider.dryRunFile, /livspace[\\/]jobs\.json$/i)

  assert.equal(livspace.PROVIDER_METADATA.source, provider.source)
  assert.equal(livspace.PROVIDER_METADATA.companyName, provider.companyName)
  assert.equal(livspace.PROVIDER_METADATA.companyCareerPage, provider.companyCareerPage)
  assert.equal(livspace.PROVIDER_METADATA.careersLandingUrl, provider.careersLandingUrl)
})

test('Livspace exact backlog row matches from the local provider contract without aliases', async () => {
  const { LIVSPACE_CATALOG } = await loadCatalogModule()
  const report = generateCompanyCoverageReport({
    csvText: 'Livspace\n',
    catalog: [hydrateProviderCatalogEntry(LIVSPACE_CATALOG)],
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Livspace', 'livspace', 'Livspace']],
  )
})
