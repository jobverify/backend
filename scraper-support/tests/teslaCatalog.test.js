import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { hydrateProviderCatalogEntry } from '../providers/index.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const modulePath = path.resolve(currentDir, '../../scraper/tesla/script.js')

const loadCatalogModule = async () => {
  try {
    return await import('../../scraper/tesla/catalog.js')
  } catch {
    assert.fail('Expected Tesla catalog module at ../../scraper/tesla/catalog.js')
  }
}

const loadScriptModule = async () => {
  try {
    return await import('../../scraper/tesla/script.js')
  } catch {
    assert.fail('Expected Tesla scraper module at ../../scraper/tesla/script.js')
  }
}

const buildCatalogReadyProvider = (catalogEntry) => hydrateProviderCatalogEntry({
  ...catalogEntry,
  modulePath,
})

test('Tesla local catalog captures the verified first-party careers surface and unresolved listing contract', async () => {
  const { TESLA_CATALOG, default: defaultCatalog } = await loadCatalogModule()
  const tesla = await loadScriptModule()
  const provider = buildCatalogReadyProvider(TESLA_CATALOG)

  assert.equal(defaultCatalog, TESLA_CATALOG)
  assert.equal(provider.source, 'tesla')
  assert.equal(provider.companyName, 'Tesla')
  assert.equal(provider.officialBrandName, 'Tesla')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.homepageUrl, 'https://www.tesla.com/')
  assert.equal(provider.companyCareerPage, 'https://www.tesla.com/careers')
  assert.equal(provider.indiaLocaleCareersPageUrl, 'https://www.tesla.com/en_in/careers')
  assert.equal(provider.searchPageUrl, 'https://www.tesla.com/careers/search/')
  assert.equal(provider.indiaListingsPageUrl, 'https://www.tesla.com/careers/search/?department=3')
  assert.equal(
    provider.sampleIndiaEngineeringJobUrl,
    'https://www.tesla.com/careers/search/job/software-engineer-full-stack-tesla-cloud-platform-251983',
  )
  assert.equal(
    provider.sampleIndiaSupportJobUrl,
    'https://www.tesla.com/careers/search/job/customer-support-specialist-237421',
  )
  assert.equal(
    provider.sampleIndiaServiceJobUrl,
    'https://www.tesla.com/careers/search/job/service-advisor-237425',
  )
  assert.equal(provider.atsPlatform, 'official-company-site-unresolved-listing-contract')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(
    provider.paginationStrategy,
    'verified-first-party-search-surface-without-verified-batch-safe-listing-contract',
  )
  assert.equal(
    provider.extractionStrategy,
    'verified-first-party-careers-page+verified-search-surface+verified-india-detail-pages-return-empty',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.companyDomain, 'tesla.com')
  assert.equal(provider.verifiedOn, '2026-07-17')
  assert.match(provider.verifiedSurfaceSummary, /Friday, July 17, 2026/i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/www\.tesla\.com\/careers/i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/www\.tesla\.com\/en_in\/careers/i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/www\.tesla\.com\/careers\/search\//i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/www\.tesla\.com\/careers\/search\/\?department=3/i)
  assert.match(provider.verifiedSurfaceSummary, /software-engineer-full-stack-tesla-cloud-platform-251983/i)
  assert.match(provider.verifiedSurfaceSummary, /customer-support-specialist-237421/i)
  assert.match(provider.verifiedSurfaceSummary, /service-advisor-237425/i)
  assert.match(provider.verifiedSurfaceSummary, /no verified batch-safe listing contract or public API/i)
  assert.equal(provider.modulePath, modulePath)
  assert.match(provider.dryRunFile, /tesla[\\/]jobs\.json$/i)

  assert.equal(tesla.PROVIDER_METADATA.source, provider.source)
  assert.equal(tesla.PROVIDER_METADATA.companyName, provider.companyName)
  assert.equal(tesla.PROVIDER_METADATA.companyCareerPage, provider.companyCareerPage)
  assert.equal(tesla.PROVIDER_METADATA.indiaLocaleCareersPageUrl, provider.indiaLocaleCareersPageUrl)
})

test('Tesla exact backlog row resolves from the local provider contract without alias churn', async () => {
  const { TESLA_CATALOG } = await loadCatalogModule()
  const report = generateCompanyCoverageReport({
    csvText: 'Tesla\n',
    catalog: [buildCatalogReadyProvider(TESLA_CATALOG)],
    aliasMap: {},
  })

  assert.equal(report.totalRows, 1)
  assert.equal(report.candidateRows, 1)
  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Tesla', 'tesla', 'Tesla']],
  )
})
