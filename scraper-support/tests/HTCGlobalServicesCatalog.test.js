import assert from 'node:assert/strict'
import test from 'node:test'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { buildScrapers, getScraperCatalog, hydrateProviderCatalogEntry } from '../providers/index.js'

const loadCatalogModule = async () => {
  try {
    return await import('../../scraper/htcglobalservices/catalog.js')
  } catch {
    assert.fail('Expected HTC Global Services catalog module at ../../scraper/htcglobalservices/catalog.js')
  }
}

const loadScriptModule = async () => {
  try {
    return await import('../../scraper/htcglobalservices/script.js')
  } catch {
    assert.fail('Expected HTC Global Services scraper module at ../../scraper/htcglobalservices/script.js')
  }
}

test('HTC Global Services local catalog captures the verified first-party careers surfaces plus jobs proxy metadata', async () => {
  const { HTC_GLOBAL_SERVICES_CATALOG } = await loadCatalogModule()
  const htc = await loadScriptModule()
  const provider = hydrateProviderCatalogEntry(HTC_GLOBAL_SERVICES_CATALOG)

  assert.equal(provider.source, 'htcglobalservices')
  assert.equal(provider.companyName, 'HTC Global Services')
  assert.equal(provider.officialBrandName, 'HTC Global Services')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.homepageUrl, 'https://www.htcinc.com/')
  assert.equal(provider.companyCareerPage, 'https://www.htcinc.com/careers/')
  assert.equal(provider.jobsListingPageUrl, 'https://www.htcinc.com/career-job-listing/')
  assert.equal(
    provider.jobsProxyUrl,
    'https://www.htcinc.com/wp-content/themes/himalayas-child/job-api-proxy.php',
  )
  assert.equal(provider.companyDomain, 'htcinc.com')
  assert.equal(provider.verifiedSampleJobUrl, 'https://www.htcinc.com/job-detail/?jobcode=243561')
  assert.equal(provider.verifiedPublicJobCount, 19)
  assert.equal(provider.verifiedIndiaJobCount, 17)
  assert.equal(provider.atsPlatform, 'official-company-careers-proxy-json')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(
    provider.paginationStrategy,
    'official-careers-pages-plus-single-first-party-proxy-response',
  )
  assert.equal(
    provider.extractionStrategy,
    'verified-careers-landing+verified-jobs-listing-page+first-party-jobs-proxy+india-location-filter+detail-apply-route-canonicalization',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.verifiedOn, '2026-07-16')
  assert.equal(HTC_GLOBAL_SERVICES_CATALOG.modulePath, '../../scraper/htcglobalservices/script.js')
  assert.equal(HTC_GLOBAL_SERVICES_CATALOG.dryRunFile, 'htcglobalservices/jobs.json')
  assert.match(provider.modulePath, /htcglobalservices[\\/]script\.js$/i)
  assert.match(provider.dryRunFile, /htcglobalservices[\\/]jobs\.json$/i)
  assert.match(provider.verifiedSurfaceSummary, /July 16, 2026/i)
  assert.match(provider.verifiedSurfaceSummary, /htcinc\.com\/careers/i)
  assert.match(provider.verifiedSurfaceSummary, /career-job-listing/i)
  assert.match(provider.verifiedSurfaceSummary, /job-api-proxy\.php/i)
  assert.match(provider.verifiedSurfaceSummary, /19 live roles and 17 India roles/i)

  assert.equal(htc.PROVIDER_METADATA.source, provider.source)
  assert.equal(htc.OFFICIAL_CAREERS_URL, provider.companyCareerPage)
  assert.equal(htc.JOBS_LISTING_URL, provider.jobsListingPageUrl)
  assert.equal(htc.JOBS_PROXY_URL, provider.jobsProxyUrl)
})

test('HTC Global Services exact-name backlog rows resolve directly from local provider metadata', async () => {
  const { HTC_GLOBAL_SERVICES_CATALOG } = await loadCatalogModule()

  const report = generateCompanyCoverageReport({
    csvText: 'HTC Global Services\n',
    catalog: [hydrateProviderCatalogEntry(HTC_GLOBAL_SERVICES_CATALOG)],
    aliasMap: {},
  })

  assert.equal(report.totalRows, 1)
  assert.equal(report.candidateRows, 1)
  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['HTC Global Services', 'htcglobalservices', 'HTC Global Services']],
  )
})

test('getScraperCatalog includes HTC Global Services as a verified first-party jobs proxy provider', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'htcglobalservices')

  assert.ok(provider)
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyName, 'HTC Global Services')
  assert.equal(provider.companyCareerPage, 'https://www.htcinc.com/careers/')
  assert.equal(provider.companyDomain, 'htcinc.com')
  assert.equal(provider.atsPlatform, 'official-company-careers-proxy-json')
  assert.match(provider.modulePath, /htcglobalservices[\\/]script\.js$/i)
})

test('buildScrapers exposes a runnable HTC Global Services scraper without changing the runner contract', () => {
  const scraper = buildScrapers().find((item) => item.name === 'htcglobalservices')

  assert.ok(scraper)
  assert.equal(typeof scraper.run, 'function')
  assert.equal(scraper.provider.source, 'htcglobalservices')
  assert.equal(scraper.provider.atsPlatform, 'official-company-careers-proxy-json')
  assert.match(scraper.dryRunFile, /htcglobalservices[\\/]jobs\.json$/i)
})
