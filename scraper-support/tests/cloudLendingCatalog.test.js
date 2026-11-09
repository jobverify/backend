import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import {
  buildScrapers,
  getScraperCatalog,
} from '../providers/index.js'
import { loadConfig } from '../utils/loadConfig.js'

const testsDir = path.dirname(fileURLToPath(import.meta.url))

const loadCatalog = async () => {
  try {
    return await import('../../scraper/cloudlending.workday/catalog.js')
  } catch {
    assert.fail('Expected Cloud Lending catalog module at ../../scraper/cloudlending.workday/catalog.js')
  }
}

const loadCloudLendingModule = async () => {
  try {
    return await import('../../scraper/cloudlending.workday/script.js')
  } catch {
    assert.fail('Expected Cloud Lending scraper module at ../../scraper/cloudlending.workday/script.js')
  }
}

test('getScraperCatalog includes Cloud Lending as a verified Q2 Workday wrapper', async () => {
  const { CLOUD_LENDING_CATALOG } = await loadCatalog()
  const cloudLending = await loadCloudLendingModule()
  const provider = getScraperCatalog().find((item) => item.source === 'cloudlending')

  assert.ok(provider)
  assert.equal(provider.source, 'cloudlending')
  assert.equal(provider.companyName, 'Cloud Lending')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.atsPlatform, 'workday')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'jobs-api-search-text')
  assert.equal(
    provider.extractionStrategy,
    'legacy-domain-handoff+official-q2-careers-page+shared-workday-api-engine',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.baseUrl, 'https://q2ebanking.wd5.myworkdayjobs.com/Q2')
  assert.equal(provider.locationCountry, null)
  assert.equal(
    provider.jobsApiUrl,
    'https://q2ebanking.wd5.myworkdayjobs.com/wday/cxs/q2ebanking/Q2/jobs',
  )
  assert.equal(provider.detailUrlBase, 'https://q2ebanking.wd5.myworkdayjobs.com/Q2')
  assert.equal(provider.searchText, 'India')
  assert.equal(
    provider.companyCareerPage,
    'https://www.q2.com/company/why-work-at-q2/careers',
  )
  assert.equal(provider.companyDomain, 'q2.com')
  assert.equal(provider.legacyCompanyDomain, 'cloudlendinginc.com')
  assert.equal(
    provider.officialWorkdayPage,
    'https://q2ebanking.wd5.myworkdayjobs.com/Q2',
  )
  assert.equal(provider.verifiedOn, '2026-07-14')
  assert.match(provider.verifiedSurfaceSummary, /Q2/i)
  assert.deepEqual(provider.legacyRedirectChain, [
    'https://cloudlendinginc.com/',
    'https://www.q2.com/fintech/lending',
    'https://www.q2.com/products/digital-banking/altfi-lending',
    'https://www.q2.com/',
  ])
  assert.match(provider.modulePath, /cloudlending\.workday[\\/]script\.js$/i)
  assert.match(provider.dryRunFile, /cloudlending.workday[\\/]jobs\.json$/i)

  assert.equal(CLOUD_LENDING_CATALOG.source, provider.source)
  assert.equal(CLOUD_LENDING_CATALOG.companyName, provider.companyName)
  assert.equal(CLOUD_LENDING_CATALOG.companyCareerPage, provider.companyCareerPage)
  assert.equal(CLOUD_LENDING_CATALOG.companyDomain, provider.companyDomain)
  assert.equal(CLOUD_LENDING_CATALOG.officialWorkdayPage, provider.officialWorkdayPage)
  assert.equal(CLOUD_LENDING_CATALOG.jobsApiUrl, provider.jobsApiUrl)
  assert.equal(CLOUD_LENDING_CATALOG.locationCountry, null)
  assert.equal(CLOUD_LENDING_CATALOG.searchText, 'India')
  assert.equal(cloudLending.SOURCE, provider.source)
  assert.equal(cloudLending.COMPANY_NAME, provider.companyName)
  assert.equal(cloudLending.CAREER_PAGE_URL, provider.companyCareerPage)
  assert.equal(cloudLending.BASE_URL, provider.baseUrl)

  const config = loadConfig(path.join(testsDir, '../../scraper/cloudlending.workday'))
  assert.equal(config.listingStrategy, 'jobs-api')
  assert.equal(config.jobsApiUrl, provider.jobsApiUrl)
  assert.equal(config.detailUrlBase, provider.detailUrlBase)
  assert.equal(config.locationCountry, null)
  assert.equal(config.searchText, 'India')
})

test('buildScrapers and company coverage resolve Cloud Lending from the shared catalog', () => {
  const scraper = buildScrapers().find((item) => item.name === 'cloudlending')

  assert.ok(scraper)
  assert.equal(typeof scraper.run, 'function')
  assert.equal(scraper.provider.source, 'cloudlending')
  assert.match(scraper.dryRunFile, /cloudlending.workday[\\/]jobs\.json$/i)

  const report = generateCompanyCoverageReport({
    csvText: 'Cloud Lending,\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Cloud Lending', 'cloudlending', 'Cloud Lending']],
  )
})
