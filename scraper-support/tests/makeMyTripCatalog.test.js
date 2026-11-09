import assert from 'node:assert/strict'
import test from 'node:test'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { hydrateProviderCatalogEntry } from '../providers/index.js'

const loadCatalogModule = async () => {
  try {
    return await import('../../scraper/makemytrip/catalog.js')
  } catch {
    assert.fail('Expected MakeMyTrip catalog module at ../../scraper/makemytrip/catalog.js')
  }
}

const loadScraperModule = async () => {
  try {
    return await import('../../scraper/makemytrip/script.js')
  } catch {
    assert.fail('Expected MakeMyTrip scraper module at ../../scraper/makemytrip/script.js')
  }
}

test('MakeMyTrip local catalog captures the verified first-party careers API surface', async () => {
  const { MAKEMYTRIP_CATALOG } = await loadCatalogModule()
  const makemytrip = await loadScraperModule()
  const provider = hydrateProviderCatalogEntry(MAKEMYTRIP_CATALOG)

  assert.equal(provider.source, 'makemytrip')
  assert.equal(provider.companyName, 'MakeMyTrip')
  assert.equal(provider.officialBrandName, 'MakeMyTrip')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.homepageUrl, 'https://careers.makemytrip.com/')
  assert.equal(provider.companyCareerPage, 'https://careers.makemytrip.com/prod/jobs')
  assert.equal(provider.careersLandingUrl, 'https://careers.makemytrip.com/')
  assert.equal(provider.careersOrigin, 'https://careers.makemytrip.com')
  assert.equal(provider.jobsApiUrl, 'https://careers.makemytrip.com/api/jobs')
  assert.equal(provider.jobDetailsApiBaseUrl, 'https://careers.makemytrip.com/api/jobDetails?jobId=')
  assert.equal(provider.companyDomain, 'makemytrip.com')
  assert.equal(provider.atsPlatform, 'first-party-careers-api')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.verifiedPublicJobCount, 36)
  assert.equal(provider.verifiedSampleJobTitle, 'Marketing Analytics')
  assert.equal(provider.verifiedSampleGroupCompany, 'MakeMyTrip (India) Limited')
  assert.equal(
    provider.verifiedSampleJobUrl,
    'https://careers.makemytrip.com/prod/opportunity/a679c58dda0f87/marketing-analytics',
  )
  assert.equal(provider.paginationStrategy, 'first-party-single-jobs-api-array')
  assert.equal(
    provider.extractionStrategy,
    'verified-first-party-careers-shell+jobs-api+job-details-api+opportunity-route',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.verifiedOn, '2026-07-16')
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/careers\.makemytrip\.com\/prod\/jobs/i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/careers\.makemytrip\.com\/api\/jobs/i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/careers\.makemytrip\.com\/api\/jobDetails\?jobId=/i)
  assert.match(provider.verifiedSurfaceSummary, /36 public jobs/i)
  assert.match(provider.verifiedSurfaceSummary, /Marketing Analytics/i)
  assert.match(provider.modulePath, /makemytrip[\\/]script\.js$/i)
  assert.match(provider.dryRunFile, /makemytrip[\\/]jobs\.json$/i)

  assert.equal(makemytrip.PROVIDER_METADATA.source, provider.source)
  assert.equal(makemytrip.PROVIDER_METADATA.companyName, provider.companyName)
  assert.equal(makemytrip.PROVIDER_METADATA.companyCareerPage, provider.companyCareerPage)
  assert.equal(makemytrip.PROVIDER_METADATA.jobsApiUrl, provider.jobsApiUrl)
})

test('MakeMyTrip exact backlog row matches directly from the local provider metadata', async () => {
  const { MAKEMYTRIP_CATALOG } = await loadCatalogModule()
  const report = generateCompanyCoverageReport({
    csvText: 'MakeMyTrip\n',
    catalog: [hydrateProviderCatalogEntry(MAKEMYTRIP_CATALOG)],
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['MakeMyTrip', 'makemytrip', 'MakeMyTrip']],
  )
})
