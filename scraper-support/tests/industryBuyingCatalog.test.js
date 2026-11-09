import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { buildScrapers, getScraperCatalog } from '../providers/index.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const industryBuyingModulePath = path.resolve(currentDir, '../../scraper/industrybuying/script.js')

const loadCatalogModule = async () => {
  try {
    return await import('../../scraper/industrybuying/catalog.js')
  } catch {
    assert.fail('Expected IndustryBuying catalog module at ../../scraper/industrybuying/catalog.js')
  }
}

const loadScriptModule = async () => {
  try {
    return await import('../../scraper/industrybuying/script.js')
  } catch {
    assert.fail('Expected IndustryBuying scraper module at ../../scraper/industrybuying/script.js')
  }
}

test('IndustryBuying local catalog captures the verified first-party careers API without alias churn', async () => {
  const { INDUSTRY_BUYING_CATALOG } = await loadCatalogModule()
  const industryBuying = await loadScriptModule()

  assert.equal(INDUSTRY_BUYING_CATALOG.source, 'industrybuying')
  assert.equal(INDUSTRY_BUYING_CATALOG.companyName, 'IndustryBuying')
  assert.equal(INDUSTRY_BUYING_CATALOG.officialBrandName, 'IndustryBuying')
  assert.equal(INDUSTRY_BUYING_CATALOG.adapter, 'script')
  assert.equal(INDUSTRY_BUYING_CATALOG.companyCareerPage, 'https://jobs.industrybuying.com/jobs')
  assert.equal(INDUSTRY_BUYING_CATALOG.officialHomepageUrl, 'https://www.industrybuying.com/')
  assert.equal(INDUSTRY_BUYING_CATALOG.officialCareersHandoffPageUrl, 'https://www.industrybuying.com/')
  assert.equal(INDUSTRY_BUYING_CATALOG.officialJobsSiteUrl, 'https://jobs.industrybuying.com/')
  assert.equal(INDUSTRY_BUYING_CATALOG.careersApiBaseUrl, 'https://careers.industrybuying.com/api/career')
  assert.equal(INDUSTRY_BUYING_CATALOG.careersOrgsApiUrl, 'https://careers.industrybuying.com/api/career/orgs')
  assert.equal(INDUSTRY_BUYING_CATALOG.careersJobsApiUrl, 'https://careers.industrybuying.com/api/career/jobs')
  assert.equal(INDUSTRY_BUYING_CATALOG.expectedOrgId, 'org_1782819232623')
  assert.equal(INDUSTRY_BUYING_CATALOG.expectedOrgSlug, 'industrybuying')
  assert.equal(INDUSTRY_BUYING_CATALOG.atsPlatform, 'custom-first-party-next-careers-api')
  assert.equal(INDUSTRY_BUYING_CATALOG.countryFilter, 'India')
  assert.equal(INDUSTRY_BUYING_CATALOG.paginationStrategy, 'first-party-careers-api-single-page')
  assert.equal(
    INDUSTRY_BUYING_CATALOG.extractionStrategy,
    'verified-first-party-homepage-handoff+verified-first-party-jobs-site+verified-careers-api-jobs-and-details',
  )
  assert.equal(INDUSTRY_BUYING_CATALOG.parser, 'custom-script')
  assert.equal(INDUSTRY_BUYING_CATALOG.normalizationProfile, 'engineering-default')
  assert.equal(INDUSTRY_BUYING_CATALOG.companyDomain, 'industrybuying.com')
  assert.equal(INDUSTRY_BUYING_CATALOG.verifiedOn, '2026-11-05')
  assert.equal(INDUSTRY_BUYING_CATALOG.verifiedPublicJobCount, 5)
  assert.equal(INDUSTRY_BUYING_CATALOG.verifiedIndiaJobCount, null)
  assert.equal(INDUSTRY_BUYING_CATALOG.verifiedSampleJobTitle, 'Senior Manager HR')
  assert.equal(
    INDUSTRY_BUYING_CATALOG.verifiedSampleJobUrl,
    'https://jobs.industrybuying.com/jobs/detail?id=job_1790074749288',
  )
  assert.match(INDUSTRY_BUYING_CATALOG.dryRunFile, /industrybuying[\\/]jobs\.json$/i)
  assert.match(INDUSTRY_BUYING_CATALOG.verifiedSurfaceSummary, /November 5, 2026/i)
  assert.match(INDUSTRY_BUYING_CATALOG.verifiedSurfaceSummary, /https:\/\/jobs\.industrybuying\.com\//i)
  assert.match(INDUSTRY_BUYING_CATALOG.verifiedSurfaceSummary, /https:\/\/careers\.industrybuying\.com\/api\/career\/jobs/i)
  assert.match(INDUSTRY_BUYING_CATALOG.verifiedSurfaceSummary, /Senior Manager HR/i)
  assert.match(INDUSTRY_BUYING_CATALOG.verifiedSurfaceSummary, /Online Sales Executive/i)
  assert.match(INDUSTRY_BUYING_CATALOG.verifiedSurfaceSummary, /countries remain unknown/i)
  assert.equal(INDUSTRY_BUYING_CATALOG.modulePath, industryBuyingModulePath)

  assert.equal(industryBuying.PROVIDER_METADATA.source, INDUSTRY_BUYING_CATALOG.source)
  assert.equal(industryBuying.PROVIDER_METADATA.companyName, INDUSTRY_BUYING_CATALOG.companyName)
  assert.equal(
    industryBuying.PROVIDER_METADATA.careersJobsApiUrl,
    INDUSTRY_BUYING_CATALOG.careersJobsApiUrl,
  )
})

test('IndustryBuying backlog row matches directly from the local catalog without alias changes', async () => {
  const { INDUSTRY_BUYING_CATALOG } = await loadCatalogModule()
  const report = generateCompanyCoverageReport({
    csvText: 'IndustryBuying\n',
    catalog: [INDUSTRY_BUYING_CATALOG],
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['IndustryBuying', 'industrybuying', 'IndustryBuying']],
  )
})

test('getScraperCatalog includes IndustryBuying as a verified first-party careers API provider', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'industrybuying')

  assert.ok(provider)
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyName, 'IndustryBuying')
  assert.equal(provider.companyCareerPage, 'https://jobs.industrybuying.com/jobs')
  assert.equal(provider.companyDomain, 'industrybuying.com')
  assert.equal(provider.atsPlatform, 'custom-first-party-next-careers-api')
  assert.match(provider.modulePath, /industrybuying[\\/]script\.js$/i)
})

test('buildScrapers exposes a runnable IndustryBuying scraper without changing the runner contract', () => {
  const scraper = buildScrapers().find((item) => item.name === 'industrybuying')

  assert.ok(scraper)
  assert.equal(typeof scraper.run, 'function')
  assert.equal(scraper.provider.source, 'industrybuying')
  assert.equal(scraper.provider.atsPlatform, 'custom-first-party-next-careers-api')
  assert.match(scraper.dryRunFile, /industrybuying[\\/]jobs\.json$/i)
})
