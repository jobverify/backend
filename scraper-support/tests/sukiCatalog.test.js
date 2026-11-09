import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath, pathToFileURL } from 'node:url'

import companyAliases from '../providers/companyAliases.json' with { type: 'json' }
import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { hydrateProviderCatalogEntry } from '../providers/index.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const modulePath = path.resolve(currentDir, '../../scraper/suki/script.js')

const loadCatalogModule = async () => {
  try {
    return await import('../../scraper/suki/catalog.js')
  } catch {
    assert.fail('Expected Suki catalog module at ../../scraper/suki/catalog.js')
  }
}

const loadScraperModule = async () => {
  try {
    return await import('../../scraper/suki/script.js')
  } catch {
    assert.fail('Expected Suki scraper module at ../../scraper/suki/script.js')
  }
}

test('Suki local catalog captures the verified first-party Greenhouse handoff and feed', async () => {
  const { SUKI_CATALOG, default: defaultCatalog } = await loadCatalogModule()
  const suki = await loadScraperModule()
  const provider = hydrateProviderCatalogEntry(SUKI_CATALOG)

  assert.equal(defaultCatalog, SUKI_CATALOG)
  assert.equal(provider.source, 'suki')
  assert.equal(provider.companyName, 'Suki')
  assert.equal(provider.officialBrandName, 'Suki AI, Inc.')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyCareerPage, 'https://www.suki.ai/careers/')
  assert.equal(provider.officialCareersPageUrl, 'https://www.suki.ai/careers/')
  assert.equal(provider.officialCareersHandoffUrl, 'https://www.suki.ai/open-positions/')
  assert.equal(provider.companyDomain, 'suki.ai')
  assert.equal(provider.atsPlatform, 'greenhouse')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.greenhouseBoardToken, 'suki')
  assert.equal(
    provider.greenhouseJobsApiUrl,
    'https://boards-api.greenhouse.io/v1/boards/suki/jobs?content=true',
  )
  assert.equal(
    provider.paginationStrategy,
    'single-complete-greenhouse-board-feed',
  )
  assert.equal(
    provider.extractionStrategy,
    'verified-first-party-careers-page+verified-greenhouse-handoff+greenhouse-api+india-location-or-office-filter',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.verifiedOn, '2026-09-13')
  assert.match(provider.dryRunFile, /suki[\\/]jobs\.json$/i)
  assert.equal(provider.modulePath, modulePath)
  assert.match(provider.verifiedSurfaceSummary, /Sunday, September 13, 2026/i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/www\.suki\.ai\/careers\//i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/www\.suki\.ai\/open-positions\//i)
  assert.match(provider.verifiedSurfaceSummary, /Suki AI, Inc\./i)
  assert.match(provider.verifiedSurfaceSummary, /10 live roles/i)
  assert.match(provider.verifiedSurfaceSummary, /4 India roles/i)
  assert.equal(Object.prototype.hasOwnProperty.call(companyAliases, 'Suki'), false)

  assert.equal(suki.PROVIDER_METADATA.source, SUKI_CATALOG.source)
  assert.equal(suki.PROVIDER_METADATA.companyName, SUKI_CATALOG.companyName)
})

test('Suki exact backlog row matches directly from the local provider metadata', async () => {
  const { SUKI_CATALOG } = await loadCatalogModule()
  const report = generateCompanyCoverageReport({
    csvText: 'Suki\n',
    catalog: [hydrateProviderCatalogEntry(SUKI_CATALOG)],
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Suki', 'suki', 'Suki']],
  )
})

test('Suki hydrated local catalog stays script-runner compatible for central registry integration', async () => {
  const { SUKI_CATALOG } = await loadCatalogModule()
  const provider = hydrateProviderCatalogEntry(SUKI_CATALOG)
  const module = await import(pathToFileURL(provider.modulePath).href)

  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyName, 'Suki')
  assert.equal(provider.companyCareerPage, 'https://www.suki.ai/careers/')
  assert.equal(provider.companyDomain, 'suki.ai')
  assert.equal(provider.atsPlatform, 'greenhouse')
  assert.match(provider.modulePath, /suki[\\/]script\.js$/i)
  assert.match(provider.dryRunFile, /suki[\\/]jobs\.json$/i)
  assert.equal(typeof module.run, 'function')
})
