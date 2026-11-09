import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath, pathToFileURL } from 'node:url'

import companyAliases from '../providers/companyAliases.json' with { type: 'json' }
import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import {
  buildScrapers,
  getScraperCatalog,
  hydrateProviderCatalogEntry,
} from '../providers/index.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const modulePath = path.resolve(currentDir, '../../scraper/propertyguru.workday/script.js')

const loadCatalogModule = async () => {
  try {
    return await import('../../scraper/propertyguru.workday/catalog.js')
  } catch {
    assert.fail('Expected PropertyGuru catalog module at ../../scraper/propertyguru.workday/catalog.js')
  }
}

const loadScraperModule = async () => {
  try {
    return await import('../../scraper/propertyguru.workday/script.js')
  } catch {
    assert.fail('Expected PropertyGuru scraper module at ../../scraper/propertyguru.workday/script.js')
  }
}

test('PropertyGuru local catalog captures the verified first-party careers handoff and public Workday India facet surface', async () => {
  const { PROPERTY_GURU_CATALOG, default: defaultCatalog } = await loadCatalogModule()
  const propertyGuru = await loadScraperModule()
  const provider = hydrateProviderCatalogEntry(PROPERTY_GURU_CATALOG)

  assert.equal(defaultCatalog, PROPERTY_GURU_CATALOG)
  assert.equal(provider.source, 'propertyguru')
  assert.equal(provider.companyName, 'PropertyGuru')
  assert.equal(provider.officialBrandName, 'PropertyGuru Group')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyCareerPage, 'https://www.propertygurugroup.com/careers/')
  assert.equal(provider.officialCareersPageUrl, 'https://www.propertygurugroup.com/careers/')
  assert.equal(
    provider.officialWorkdayBoardUrl,
    'https://propertyguru.wd105.myworkdayjobs.com/en-US/PropertyGuru/',
  )
  assert.equal(
    provider.jobsApiUrl,
    'https://propertyguru.wd105.myworkdayjobs.com/wday/cxs/propertyguru/PropertyGuru/jobs',
  )
  assert.deepEqual(provider.verifiedIndiaLocationDescriptors, ['Bengaluru'])
  assert.deepEqual(provider.verifiedIndiaLocationFacetIds, ['8ddf56e76fde1005210b476f4bff0000'])
  assert.equal(
    provider.verifiedIndiaJobUrl,
    'https://propertyguru.wd105.myworkdayjobs.com/en-US/PropertyGuru/job/Bengaluru/Head-of-People--Country---Function-Lead--CTPO--_JR100927',
  )
  assert.equal(
    provider.verifiedIndiaApplyUrl,
    'https://propertyguru.wd105.myworkdayjobs.com/en-US/PropertyGuru/job/Bengaluru/Head-of-People--Country---Function-Lead--CTPO--_JR100927/apply',
  )
  assert.equal(provider.companyDomain, 'propertygurugroup.com')
  assert.equal(provider.atsPlatform, 'workday')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(
    provider.paginationStrategy,
    'verified-first-party-careers-handoff-plus-workday-location-facet',
  )
  assert.equal(
    provider.extractionStrategy,
    'verified-careers-page+verified-workday-board+unfiltered-workday-jobs-api+india-location-facet+filtered-workday-jobs-api',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.verifiedOn, '2026-07-17')
  assert.match(provider.dryRunFile, /propertyguru.workday[\\/]jobs\.json$/i)
  assert.equal(provider.modulePath, modulePath)
  assert.match(provider.verifiedSurfaceSummary, /Friday, July 17, 2026/i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/www\.propertygurugroup\.com\/careers\//i)
  assert.match(
    provider.verifiedSurfaceSummary,
    /https:\/\/propertyguru\.wd105\.myworkdayjobs\.com\/en-US\/PropertyGuru\//i,
  )
  assert.match(
    provider.verifiedSurfaceSummary,
    /https:\/\/propertyguru\.wd105\.myworkdayjobs\.com\/wday\/cxs\/propertyguru\/PropertyGuru\/jobs/i,
  )
  assert.match(provider.verifiedSurfaceSummary, /\b25\b/i)
  assert.match(provider.verifiedSurfaceSummary, /\b4 India roles\b/i)
  assert.match(provider.verifiedSurfaceSummary, /Head of People, Country & Function Lead \(CTPO \)/i)
  assert.match(provider.verifiedSurfaceSummary, /Cloud & AI Security Architect/i)
  assert.equal(Object.prototype.hasOwnProperty.call(companyAliases, 'PropertyGuru'), false)

  assert.equal(propertyGuru.PROVIDER_METADATA.source, PROPERTY_GURU_CATALOG.source)
  assert.equal(propertyGuru.PROVIDER_METADATA.companyName, PROPERTY_GURU_CATALOG.companyName)
  assert.equal(propertyGuru.PROVIDER_METADATA.jobsApiUrl, PROPERTY_GURU_CATALOG.jobsApiUrl)
})

test('PropertyGuru exact backlog row matches directly from local provider metadata', async () => {
  const { PROPERTY_GURU_CATALOG } = await loadCatalogModule()
  const report = generateCompanyCoverageReport({
    csvText: 'PropertyGuru\n',
    catalog: [hydrateProviderCatalogEntry(PROPERTY_GURU_CATALOG)],
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['PropertyGuru', 'propertyguru', 'PropertyGuru']],
  )
})

test('getScraperCatalog exposes PropertyGuru as a runnable shared provider without alias churn', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'propertyguru')
  const scraper = buildScrapers().find((item) => item.name === 'propertyguru')

  assert.ok(provider)
  assert.ok(scraper)
  assert.equal(provider.companyName, 'PropertyGuru')
  assert.equal(provider.companyCareerPage, 'https://www.propertygurugroup.com/careers/')
  assert.equal(Object.prototype.hasOwnProperty.call(companyAliases, 'PropertyGuru'), false)

  const report = generateCompanyCoverageReport({
    csvText: 'PropertyGuru\n',
    catalog: getScraperCatalog(),
    aliasMap: companyAliases,
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['PropertyGuru', 'propertyguru', 'PropertyGuru']],
  )
})

test('PropertyGuru hydrated local catalog stays script-runner compatible for shared registry integration', async () => {
  const { PROPERTY_GURU_CATALOG } = await loadCatalogModule()
  const provider = hydrateProviderCatalogEntry(PROPERTY_GURU_CATALOG)
  const module = await import(pathToFileURL(provider.modulePath).href)

  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyName, 'PropertyGuru')
  assert.equal(provider.companyCareerPage, 'https://www.propertygurugroup.com/careers/')
  assert.equal(provider.companyDomain, 'propertygurugroup.com')
  assert.equal(provider.atsPlatform, 'workday')
  assert.match(provider.modulePath, /propertyguru\.workday[\\/]script\.js$/i)
  assert.match(provider.dryRunFile, /propertyguru.workday[\\/]jobs\.json$/i)
  assert.equal(typeof module.run, 'function')
})
