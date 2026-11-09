import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import companyAliases from '../providers/companyAliases.json' with { type: 'json' }
import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import {
  buildScrapers,
  getScraperCatalog,
  hydrateProviderCatalogEntry,
} from '../providers/index.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const panasonicModulePath = path.resolve(currentDir, '../../scraper/panasonic/script.js')

const loadCatalogModule = async () => {
  try {
    return await import('../../scraper/panasonic/catalog.js')
  } catch {
    assert.fail('Expected Panasonic catalog module at ../../scraper/panasonic/catalog.js')
  }
}

const loadScriptModule = async () => {
  try {
    return await import('../../scraper/panasonic/script.js')
  } catch {
    assert.fail('Expected Panasonic scraper module at ../../scraper/panasonic/script.js')
  }
}

test('Panasonic local catalog captures the verified corporate India route and public Jibe jobs API metadata', async () => {
  const { PANASONIC_CATALOG } = await loadCatalogModule()
  const panasonic = await loadScriptModule()
  const provider = hydrateProviderCatalogEntry(PANASONIC_CATALOG)

  assert.equal(provider.source, 'panasonic')
  assert.equal(provider.companyName, 'Panasonic')
  assert.equal(provider.officialBrandName, 'Panasonic')
  assert.equal(provider.adapter, 'script')
  assert.equal(
    provider.companyCareerPage,
    'https://careers.na.panasonic.com/corporate/jobs/locations/country/India',
  )
  assert.equal(provider.officialIndiaCorporatePageUrl, 'https://www.panasonic.com/in/corporate.html')
  assert.equal(provider.officialGlobalCareersUrl, 'https://careers.na.panasonic.com/')
  assert.equal(provider.officialCorporateCareersUrl, 'https://careers.na.panasonic.com/corporate')
  assert.equal(provider.officialLocationsUrl, 'https://careers.na.panasonic.com/corporate/jobs/locations')
  assert.equal(provider.officialJobsApiUrl, 'https://careers.na.panasonic.com/api/jobs')
  assert.equal(provider.companyDomain, 'careers.na.panasonic.com')
  assert.equal(provider.atsPlatform, 'jibe-icims-api')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'public-api-page-parameter')
  assert.equal(
    provider.extractionStrategy,
    'verified-panasonic-india-corporate-handoff+verified-corporate-india-route+public-jibe-api-country-filter',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.verifiedOn, '2026-07-25')
  assert.match(provider.dryRunFile, /panasonic[\\/]jobs\.json$/i)
  assert.equal(provider.modulePath, panasonicModulePath)
  assert.match(provider.verifiedSurfaceSummary, /Saturday, July 25, 2026/i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/www\.panasonic\.com\/in\/corporate\.html/i)
  assert.match(
    provider.verifiedSurfaceSummary,
    /https:\/\/careers\.na\.panasonic\.com\/corporate\/jobs\/locations\/country\/India/i,
  )
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/careers\.na\.panasonic\.com\/api\/jobs/i)
  assert.match(provider.verifiedSurfaceSummary, /21 India jobs/i)
  assert.match(
    provider.verifiedSurfaceSummary,
    /Line Maintenance Manager - India|Software Engineer III - Fullstack \+ Kubernetes \+ Devops/i,
  )
  assert.equal(Object.prototype.hasOwnProperty.call(companyAliases, 'Panasonic'), false)
  assert.equal(Object.prototype.hasOwnProperty.call(companyAliases, 'Panasonic India'), false)

  assert.equal(panasonic.PROVIDER_METADATA.source, PANASONIC_CATALOG.source)
  assert.equal(panasonic.PROVIDER_METADATA.companyName, PANASONIC_CATALOG.companyName)
  assert.equal(
    panasonic.PROVIDER_METADATA.officialJobsApiUrl,
    PANASONIC_CATALOG.officialJobsApiUrl,
  )
})

test('Panasonic and Panasonic India both collapse onto the same local Panasonic provider', async () => {
  const { PANASONIC_CATALOG } = await loadCatalogModule()
  const report = generateCompanyCoverageReport({
    csvText: 'Panasonic\nPanasonic India\n',
    catalog: [hydrateProviderCatalogEntry(PANASONIC_CATALOG)],
  })

  assert.equal(report.matchedCount, 2)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [
      ['Panasonic', 'panasonic', 'Panasonic'],
      ['Panasonic India', 'panasonic', 'Panasonic'],
    ],
  )
})

test('getScraperCatalog exposes Panasonic as a runnable shared provider that also covers Panasonic India', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'panasonic')
  const scraper = buildScrapers().find((item) => item.name === 'panasonic')

  assert.ok(provider)
  assert.ok(scraper)
  assert.equal(provider.companyName, 'Panasonic')
  assert.equal(
    provider.companyCareerPage,
    'https://careers.na.panasonic.com/corporate/jobs/locations/country/India',
  )
  assert.equal(Object.prototype.hasOwnProperty.call(companyAliases, 'Panasonic'), false)
  assert.equal(Object.prototype.hasOwnProperty.call(companyAliases, 'Panasonic India'), false)

  const report = generateCompanyCoverageReport({
    csvText: 'Panasonic\nPanasonic India\n',
    catalog: getScraperCatalog(),
    aliasMap: companyAliases,
  })

  assert.equal(report.matchedCount, 2)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [
      ['Panasonic', 'panasonic', 'Panasonic'],
      ['Panasonic India', 'panasonic', 'Panasonic'],
    ],
  )
})
