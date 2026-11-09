import assert from 'node:assert/strict'
import test from 'node:test'

import companyAliases from '../providers/companyAliases.json' with { type: 'json' }
import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { getScraperCatalog } from '../providers/index.js'

const loadCatalogModule = async () => {
  try {
    return await import('../../scraper/lexmarkinternational/catalog.js')
  } catch {
    assert.fail('Expected Lexmark International catalog module at ../../scraper/lexmarkinternational/catalog.js')
  }
}

const loadScriptModule = async () => {
  try {
    return await import('../../scraper/lexmarkinternational/script.js')
  } catch {
    assert.fail('Expected Lexmark International scraper module at ../../scraper/lexmarkinternational/script.js')
  }
}

test('Lexmark International catalog captures the verified Workday Candidate Experience contract without alias churn', async () => {
  const {
    LEXMARK_INTERNATIONAL_CATALOG,
    default: defaultCatalog,
  } = await loadCatalogModule()
  const lexmark = await loadScriptModule()
  const provider = getScraperCatalog().find((item) => item.source === 'lexmarkinternational')

  assert.ok(provider, 'Expected Lexmark International provider to be registered in customProviders.json')
  assert.equal(defaultCatalog, LEXMARK_INTERNATIONAL_CATALOG)
  assert.equal(LEXMARK_INTERNATIONAL_CATALOG.source, 'lexmarkinternational')
  assert.equal(LEXMARK_INTERNATIONAL_CATALOG.companyName, 'Lexmark International')
  assert.equal(LEXMARK_INTERNATIONAL_CATALOG.officialBrandName, 'Lexmark')
  assert.equal(LEXMARK_INTERNATIONAL_CATALOG.adapter, 'script')
  assert.equal(LEXMARK_INTERNATIONAL_CATALOG.companyCareerPage, 'https://www.lexmark.com/en_us/about-us/careers.html')
  assert.equal(LEXMARK_INTERNATIONAL_CATALOG.officialWorkdayBoardUrl, 'https://lexmark.wd1.myworkdayjobs.com/Lexmark')
  assert.equal(LEXMARK_INTERNATIONAL_CATALOG.jobsApiUrl, 'https://lexmark.wd1.myworkdayjobs.com/wday/cxs/lexmark/Lexmark/jobs')
  assert.equal(
    LEXMARK_INTERNATIONAL_CATALOG.jobDetailExampleUrl,
    'https://lexmark.wd1.myworkdayjobs.com/wday/cxs/lexmark/Lexmark/job/Shenzhen--China/Logistic-Specialist_R5733',
  )
  assert.equal(LEXMARK_INTERNATIONAL_CATALOG.atsPlatform, 'workday-candidate-experience')
  assert.equal(LEXMARK_INTERNATIONAL_CATALOG.countryFilter, 'India')
  assert.equal(
    LEXMARK_INTERNATIONAL_CATALOG.paginationStrategy,
    'first-party-careers-page-plus-workday-cxs-jobs-api',
  )
  assert.equal(
    LEXMARK_INTERNATIONAL_CATALOG.extractionStrategy,
    'verified-first-party-careers-page+verified-workday-handoff+verified-workday-cxs-list+detail-json+india-country-filter',
  )
  assert.equal(LEXMARK_INTERNATIONAL_CATALOG.parser, 'custom-script')
  assert.equal(LEXMARK_INTERNATIONAL_CATALOG.normalizationProfile, 'engineering-default')
  assert.equal(LEXMARK_INTERNATIONAL_CATALOG.companyDomain, 'lexmark.com')
  assert.equal(LEXMARK_INTERNATIONAL_CATALOG.verifiedOn, '2026-08-03')
  assert.equal(LEXMARK_INTERNATIONAL_CATALOG.verifiedPublicJobCount, 1)
  assert.match(LEXMARK_INTERNATIONAL_CATALOG.verifiedSurfaceSummary, /Monday, August 3, 2026/i)
  assert.match(LEXMARK_INTERNATIONAL_CATALOG.verifiedSurfaceSummary, /wday\/cxs\/lexmark\/Lexmark\/jobs/i)
  assert.match(LEXMARK_INTERNATIONAL_CATALOG.verifiedSurfaceSummary, /Logistic Specialist/i)
  assert.match(LEXMARK_INTERNATIONAL_CATALOG.verifiedSurfaceSummary, /Shenzhen, China/i)
  assert.match(LEXMARK_INTERNATIONAL_CATALOG.verifiedSurfaceSummary, /no India roles/i)
  assert.equal(Object.prototype.hasOwnProperty.call(companyAliases, 'Lexmark International'), false)

  assert.equal(provider.companyCareerPage, LEXMARK_INTERNATIONAL_CATALOG.companyCareerPage)
  assert.equal(provider.officialWorkdayBoardUrl, LEXMARK_INTERNATIONAL_CATALOG.officialWorkdayBoardUrl)
  assert.equal(provider.jobsApiUrl, LEXMARK_INTERNATIONAL_CATALOG.jobsApiUrl)
  assert.equal(provider.jobDetailExampleUrl, LEXMARK_INTERNATIONAL_CATALOG.jobDetailExampleUrl)
  assert.equal(provider.atsPlatform, LEXMARK_INTERNATIONAL_CATALOG.atsPlatform)
  assert.equal(provider.paginationStrategy, LEXMARK_INTERNATIONAL_CATALOG.paginationStrategy)
  assert.equal(provider.extractionStrategy, LEXMARK_INTERNATIONAL_CATALOG.extractionStrategy)
  assert.equal(provider.verifiedOn, LEXMARK_INTERNATIONAL_CATALOG.verifiedOn)

  assert.equal(lexmark.PROVIDER_METADATA.source, LEXMARK_INTERNATIONAL_CATALOG.source)
  assert.equal(lexmark.WORKDAY_JOBS_API_URL, LEXMARK_INTERNATIONAL_CATALOG.jobsApiUrl)
})

test('Lexmark International matches company coverage directly from provider metadata', () => {
  const report = generateCompanyCoverageReport({
    csvText: 'Lexmark International,\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Lexmark International', 'lexmarkinternational', 'Lexmark International']],
  )
})
