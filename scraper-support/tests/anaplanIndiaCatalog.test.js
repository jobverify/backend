import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import companyAliases from '../providers/companyAliases.json' with { type: 'json' }
import {
  buildScrapers,
  getScraperCatalog,
  hydrateProviderCatalogEntry,
} from '../providers/index.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const anaplanIndiaModulePath = path.resolve(currentDir, '../../scraper/anaplanindia/script.js')

const loadCatalogModule = async () => {
  try {
    return await import('../../scraper/anaplanindia/catalog.js')
  } catch {
    assert.fail('Expected Anaplan India catalog module at ../../scraper/anaplanindia/catalog.js')
  }
}

const loadAnaplanIndiaModule = async () => {
  try {
    return await import('../../scraper/anaplanindia/script.js')
  } catch {
    assert.fail('Expected Anaplan India scraper module at ../../scraper/anaplanindia/script.js')
  }
}

test('Anaplan India local catalog captures the verified first-party Anaplan careers pages and Greenhouse India jobs surface without aliases', async () => {
  const { ANAPLAN_INDIA_CATALOG } = await loadCatalogModule()
  const anaplanIndia = await loadAnaplanIndiaModule()
  const provider = hydrateProviderCatalogEntry(ANAPLAN_INDIA_CATALOG)

  assert.equal(provider.source, 'anaplanindia')
  assert.equal(provider.companyName, 'Anaplan India')
  assert.equal(provider.officialBrandName, 'Anaplan')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyCareerPage, 'https://www.anaplan.com/careers/job-listing/')
  assert.equal(provider.officialCareersLandingUrl, 'https://www.anaplan.com/careers/')
  assert.equal(provider.jobDetailsBaseUrl, 'https://www.anaplan.com/careers/jobs/')
  assert.equal(provider.greenhouseJobsApiUrl, 'https://boards-api.greenhouse.io/v1/boards/anaplan/jobs')
  assert.equal(provider.greenhouseBoardUrl, 'https://job-boards.greenhouse.io/anaplan')
  assert.equal(provider.atsPlatform, 'greenhouse')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'single-greenhouse-jobs-api-content-page')
  assert.equal(
    provider.extractionStrategy,
    'verified-first-party-careers-pages+greenhouse-jobs-api+first-party-detail-url-canonicalization+india-location-filter',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.companyDomain, 'anaplan.com')
  assert.equal(provider.verifiedOn, '2026-07-15')
  assert.match(provider.dryRunFile, /anaplanindia[\\/]jobs\.json$/i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/www\.anaplan\.com\/careers\//i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/www\.anaplan\.com\/careers\/job-listing\//i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/boards-api\.greenhouse\.io\/v1\/boards\/anaplan\/jobs\?content=true/i)
  assert.match(provider.verifiedSurfaceSummary, /Alliances Director - Managed Services Partnerships/i)
  assert.match(provider.verifiedSurfaceSummary, /Anaplan Model Builder/i)
  assert.match(provider.modulePath, /anaplanindia[\\/]script\.js$/i)
  assert.equal(provider.modulePath, anaplanIndiaModulePath)
  assert.equal(Object.prototype.hasOwnProperty.call(companyAliases, 'Anaplan India'), false)

  assert.equal(anaplanIndia.PROVIDER_METADATA.source, ANAPLAN_INDIA_CATALOG.source)
  assert.equal(anaplanIndia.PROVIDER_METADATA.companyName, ANAPLAN_INDIA_CATALOG.companyName)
  assert.equal(
    anaplanIndia.PROVIDER_METADATA.companyCareerPage,
    ANAPLAN_INDIA_CATALOG.companyCareerPage,
  )
  assert.equal(
    anaplanIndia.PROVIDER_METADATA.greenhouseJobsApiUrl,
    ANAPLAN_INDIA_CATALOG.greenhouseJobsApiUrl,
  )
})

test('Anaplan India backlog row matches directly from local provider metadata without alias churn', async () => {
  const { ANAPLAN_INDIA_CATALOG } = await loadCatalogModule()
  const report = generateCompanyCoverageReport({
    csvText: 'Anaplan India\n',
    catalog: [hydrateProviderCatalogEntry(ANAPLAN_INDIA_CATALOG)],
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Anaplan India', 'anaplanindia', 'Anaplan India']],
  )
})

test('buildScrapers and company coverage resolve Anaplan India from the shared catalog', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'anaplanindia')
  const scraper = buildScrapers().find((item) => item.name === 'anaplanindia')

  assert.ok(provider)
  assert.ok(scraper)
  assert.equal(provider.companyName, 'Anaplan India')
  assert.equal(provider.companyCareerPage, 'https://www.anaplan.com/careers/job-listing/')
  assert.match(scraper.dryRunFile, /anaplanindia[\\/]jobs\.json$/i)

  const report = generateCompanyCoverageReport({
    csvText: 'Anaplan India\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Anaplan India', 'anaplanindia', 'Anaplan India']],
  )
})
