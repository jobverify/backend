import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath, pathToFileURL } from 'node:url'

import companyAliases from '../providers/companyAliases.json' with { type: 'json' }
import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { hydrateProviderCatalogEntry } from '../providers/index.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const modulePath = path.resolve(currentDir, '../../scraper/sonatusindia/script.js')

const loadCatalogModule = async () => {
  try {
    return await import('../../scraper/sonatusindia/catalog.js')
  } catch {
    assert.fail('Expected Sonatus India catalog module at ../../scraper/sonatusindia/catalog.js')
  }
}

const loadScraperModule = async () => {
  try {
    return await import('../../scraper/sonatusindia/script.js')
  } catch {
    assert.fail('Expected Sonatus India scraper module at ../../scraper/sonatusindia/script.js')
  }
}

test('Sonatus India local catalog captures the verified Sonatus careers page and official Greenhouse board without alias churn', async () => {
  const { SONATUS_INDIA_CATALOG, default: defaultCatalog } = await loadCatalogModule()
  const sonatusIndia = await loadScraperModule()
  const provider = hydrateProviderCatalogEntry(SONATUS_INDIA_CATALOG)

  assert.equal(defaultCatalog, SONATUS_INDIA_CATALOG)
  assert.equal(provider.source, 'sonatusindia')
  assert.equal(provider.companyName, 'Sonatus India')
  assert.equal(provider.officialBrandName, 'Sonatus')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyCareerPage, 'https://www.sonatus.com/company/careers/')
  assert.equal(provider.greenhouseBoardUrl, 'https://job-boards.greenhouse.io/sonatus')
  assert.equal(provider.greenhouseJobsApiUrl, 'https://boards-api.greenhouse.io/v1/boards/sonatus/jobs')
  assert.equal(provider.atsPlatform, 'greenhouse')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'single-greenhouse-jobs-api-content-page')
  assert.equal(
    provider.extractionStrategy,
    'verified-first-party-careers-page+official-greenhouse-board+greenhouse-jobs-api+india-location-filter+talent-community-exclusion',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.companyDomain, 'sonatus.com')
  assert.equal(provider.verifiedOn, '2026-07-27')
  assert.match(provider.dryRunFile, /sonatusindia[\\/]jobs\.json$/i)
  assert.equal(provider.modulePath, modulePath)
  assert.match(provider.verifiedSurfaceSummary, /Monday, July 27, 2026/i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/www\.sonatus\.com\/company\/careers\//i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/job-boards\.greenhouse\.io\/sonatus/i)
  assert.match(provider.verifiedSurfaceSummary, /Talent Community/i)
  assert.match(provider.verifiedSurfaceSummary, /Pune, India/i)
  assert.equal(Object.prototype.hasOwnProperty.call(companyAliases, 'Sonatus India'), false)

  assert.equal(sonatusIndia.PROVIDER_METADATA.source, SONATUS_INDIA_CATALOG.source)
  assert.equal(sonatusIndia.PROVIDER_METADATA.companyName, SONATUS_INDIA_CATALOG.companyName)
  assert.equal(
    sonatusIndia.PROVIDER_METADATA.greenhouseBoardUrl,
    SONATUS_INDIA_CATALOG.greenhouseBoardUrl,
  )
})

test('Sonatus India exact backlog row matches directly from local provider metadata', async () => {
  const { SONATUS_INDIA_CATALOG } = await loadCatalogModule()
  const report = generateCompanyCoverageReport({
    csvText: 'Sonatus India\n',
    catalog: [hydrateProviderCatalogEntry(SONATUS_INDIA_CATALOG)],
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Sonatus India', 'sonatusindia', 'Sonatus India']],
  )
})

test('Sonatus India hydrated local catalog stays script-runner compatible for later registry integration', async () => {
  const { SONATUS_INDIA_CATALOG } = await loadCatalogModule()
  const provider = hydrateProviderCatalogEntry(SONATUS_INDIA_CATALOG)
  const module = await import(pathToFileURL(provider.modulePath).href)

  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyName, 'Sonatus India')
  assert.equal(provider.companyCareerPage, 'https://www.sonatus.com/company/careers/')
  assert.equal(provider.companyDomain, 'sonatus.com')
  assert.equal(provider.atsPlatform, 'greenhouse')
  assert.match(provider.modulePath, /sonatusindia[\\/]script\.js$/i)
  assert.match(provider.dryRunFile, /sonatusindia[\\/]jobs\.json$/i)
  assert.equal(typeof module.run, 'function')
})
