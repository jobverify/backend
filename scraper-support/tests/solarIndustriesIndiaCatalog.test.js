import assert from 'node:assert/strict'
import test from 'node:test'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { hydrateProviderCatalogEntry } from '../providers/index.js'

const loadSolarIndustriesIndiaCatalog = async () => {
  try {
    return await import('../../scraper/solarindustriesindia/catalog.js')
  } catch {
    assert.fail('Expected Solar Industries India catalog module at ../../scraper/solarindustriesindia/catalog.js')
  }
}

test('Solar Industries India catalog captures the verified Monday, July 27, 2026 homepage handoff and public Zwayam contract', async () => {
  const { SOLAR_INDUSTRIES_INDIA_CATALOG } = await loadSolarIndustriesIndiaCatalog()
  const provider = hydrateProviderCatalogEntry(SOLAR_INDUSTRIES_INDIA_CATALOG)

  assert.equal(provider.source, 'solarindustriesindia')
  assert.equal(provider.companyName, 'Solar Industries India')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyCareerPage, 'https://careers.solargroup.com/solargroup/')
  assert.equal(provider.homepageCareersEntryUrl, 'https://careers.solargroup.com/#!/')
  assert.equal(provider.officialHomepageUrl, 'https://www.solargroup.com/')
  assert.equal(provider.officialBrandName, 'Solar Group')
  assert.equal(provider.legalEntityName, 'Solar Industries India Limited')
  assert.equal(
    provider.sampleJobViewUrl,
    'https://careers.solargroup.com/solargroup/jobview/sr-executive-uav-2024122016373073',
  )
  assert.equal(provider.officialSearchApiUrl, 'https://public.zwayam.com/jobs/search')
  assert.equal(provider.officialDetailApiUrl, 'https://public.zwayam.com/jobs-service/v1/jobs/careersite')
  assert.equal(provider.zwayamDomain, 'careers.solargroup.com')
  assert.equal(provider.zwayamCompanyId, 'MTU0Nzg=')
  assert.equal(provider.zwayamDetailCompanyId, '15478')
  assert.equal(provider.verifiedPublicJobCount, 4)
  assert.equal(provider.verifiedSampleJobTitle, 'Sr. Executive - Navigation Engineer')
  assert.equal(
    provider.verifiedSampleJobUrl,
    'https://careers.solargroup.com/solargroup/jobview/sr-executive-uav-2024122016373073',
  )
  assert.equal(provider.atsPlatform, 'zwayam')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'homepage-careers-entry-plus-public-zwayam-total-count-plus-page-size')
  assert.equal(
    provider.extractionStrategy,
    'verified-homepage-careers-entry+verified-zwayam-board-shell+verified-sample-jobview-shell+public-zwayam-search-api+detail-api',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.companyDomain, 'solargroup.com')
  assert.equal(provider.verifiedOn, '2026-07-27')
  assert.match(provider.modulePath, /solarindustriesindia[\\/]script\.js$/i)
  assert.match(provider.dryRunFile, /solarindustriesindia[\\/]jobs\.json$/i)
  assert.match(provider.verifiedSurfaceSummary, /Monday, July 27, 2026/i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/www\.solargroup\.com\//i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/careers\.solargroup\.com\/#!\//i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/careers\.solargroup\.com\/solargroup\//i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/public\.zwayam\.com\/jobs\/search/i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/public\.zwayam\.com\/jobs-service\/v1\/jobs\/careersite/i)
  assert.match(provider.verifiedSurfaceSummary, /Hidden\/Closed\/Limited/i)
})

test('Solar Industries India matches exact-name backlog coverage from the local catalog contract alone', async () => {
  const { SOLAR_INDUSTRIES_INDIA_CATALOG } = await loadSolarIndustriesIndiaCatalog()
  const report = generateCompanyCoverageReport({
    csvText: 'Solar Industries India\n',
    catalog: [hydrateProviderCatalogEntry(SOLAR_INDUSTRIES_INDIA_CATALOG)],
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Solar Industries India', 'solarindustriesindia', 'Solar Industries India']],
  )
})
