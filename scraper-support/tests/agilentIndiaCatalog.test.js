import assert from 'node:assert/strict'
import test from 'node:test'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import {
  buildScrapers,
  getScraperCatalog,
  hydrateProviderCatalogEntry,
} from '../providers/index.js'

const loadProviderModule = async () => {
  try {
    return await import('../../scraper/agilentindia.workday/provider.js')
  } catch {
    return null
  }
}

const loadScriptModule = async () => {
  try {
    return await import('../../scraper/agilentindia.workday/script.js')
  } catch {
    return null
  }
}

test('Agilent India exports local provider metadata for the verified first-party careers shell and dual Workday boards', async () => {
  const providerModule = await loadProviderModule()
  const scriptModule = await loadScriptModule()

  assert.ok(
    providerModule,
    'Expected Agilent India provider module at ../../scraper/agilentindia.workday/provider.js',
  )
  assert.ok(
    scriptModule,
    'Expected Agilent India scraper module at ../../scraper/agilentindia.workday/script.js',
  )

  assert.deepEqual(providerModule.provider, {
    source: 'agilentindia',
    companyName: 'Agilent India',
    officialBrandName: 'Agilent',
    adapter: 'script',
    modulePath: '../../scraper/agilentindia.workday/script.js',
    companyCareerPage: 'https://careers.agilent.com/',
    indiaLocationPage: 'https://careers.agilent.com/locations/asia-pacific/india/',
    experiencedWorkdayPage: 'https://agilent.wd5.myworkdayjobs.com/Agilent_Careers',
    studentWorkdayPage: 'https://agilent.wd5.myworkdayjobs.com/Agilent_Student_Careers',
    experiencedJobsApiUrl: 'https://agilent.wd5.myworkdayjobs.com/wday/cxs/agilent/Agilent_Careers/jobs',
    studentJobsApiUrl: 'https://agilent.wd5.myworkdayjobs.com/wday/cxs/agilent/Agilent_Student_Careers/jobs',
    atsPlatform: 'workday-jobs-api',
    countryFilter: 'India',
    paginationStrategy: 'verified-first-party-careers-pages-plus-dual-workday-country-facet-apis-or-maintenance-sentinel',
    extractionStrategy:
      'verified-careers-home+verified-india-location-page+experienced-workday-jobs-api+student-workday-jobs-api-or-dual-workday-maintenance-sentinel',
    parser: 'custom-script',
    normalizationProfile: 'engineering-default',
    companyDomain: 'agilent.com',
    verifiedOn: '2026-08-15',
    verifiedSurfaceSummary:
      "Verified on Saturday, August 15, 2026 that https://careers.agilent.com/ and https://careers.agilent.com/locations/asia-pacific/india/ still hand applicants to the public Workday boards at https://agilent.wd5.myworkdayjobs.com/Agilent_Careers and https://agilent.wd5.myworkdayjobs.com/Agilent_Student_Careers, but both official Workday boards are currently showing the \"Workday is currently unavailable.\" maintenance page and the corresponding jobs APIs return HTML maintenance content instead of JSON. This scraper therefore preserves the normal dual-board India jobs extraction when Workday is healthy and returns an honest empty result while both public boards remain in verified maintenance mode.",
    dryRunFile: 'agilentindia.workday/jobs.json',
  })

  assert.equal(scriptModule.SOURCE, providerModule.provider.source)
  assert.equal(scriptModule.COMPANY, providerModule.provider.companyName)
  assert.equal(scriptModule.OFFICIAL_BRAND_NAME, providerModule.provider.officialBrandName)
  assert.equal(scriptModule.CAREERS_HOME_URL, providerModule.provider.companyCareerPage)
  assert.equal(scriptModule.INDIA_LOCATION_URL, providerModule.provider.indiaLocationPage)
  assert.equal(
    scriptModule.EXPERIENCED_WORKDAY_PAGE,
    providerModule.provider.experiencedWorkdayPage,
  )
  assert.equal(
    scriptModule.STUDENT_WORKDAY_PAGE,
    providerModule.provider.studentWorkdayPage,
  )
  assert.deepEqual(scriptModule.PROVIDER_METADATA, providerModule.provider)
})

test('Agilent India local provider contract hydrates into coverage without requiring aliases', async () => {
  const providerModule = await loadProviderModule()
  assert.ok(providerModule)

  const hydratedProvider = hydrateProviderCatalogEntry(providerModule.provider)

  assert.equal(hydratedProvider.companyName, 'Agilent India')
  assert.equal(hydratedProvider.companyDomain, 'agilent.com')
  assert.match(hydratedProvider.modulePath, /agilentindia\.workday[\\/]script\.js$/i)
  assert.match(hydratedProvider.dryRunFile, /agilentindia.workday[\\/]jobs\.json$/i)

  const report = generateCompanyCoverageReport({
    csvText: 'Agilent India\n',
    catalog: [hydratedProvider],
    aliasMap: {},
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Agilent India', 'agilentindia', 'Agilent India']],
  )
})

test('buildScrapers and company coverage resolve Agilent India from the shared catalog', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'agilentindia')
  const scraper = buildScrapers().find((item) => item.name === 'agilentindia')

  assert.ok(provider)
  assert.ok(scraper)
  assert.equal(provider.companyName, 'Agilent India')
  assert.equal(provider.companyCareerPage, 'https://careers.agilent.com/')
  assert.match(scraper.dryRunFile, /agilentindia.workday[\\/]jobs\.json$/i)

  const report = generateCompanyCoverageReport({
    csvText: 'Agilent India\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Agilent India', 'agilentindia', 'Agilent India']],
  )
})
