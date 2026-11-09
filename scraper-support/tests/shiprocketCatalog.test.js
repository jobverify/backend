import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath, pathToFileURL } from 'node:url'

import companyAliases from '../providers/companyAliases.json' with { type: 'json' }
import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { hydrateProviderCatalogEntry } from '../providers/index.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const modulePath = path.resolve(currentDir, '../../scraper/shiprocket/script.js')

const loadCatalogModule = async () => {
  try {
    return await import('../../scraper/shiprocket/catalog.js')
  } catch {
    assert.fail('Expected Shiprocket catalog module at ../../scraper/shiprocket/catalog.js')
  }
}

const loadScraperModule = async () => {
  try {
    return await import('../../scraper/shiprocket/script.js')
  } catch {
    assert.fail('Expected Shiprocket scraper module at ../../scraper/shiprocket/script.js')
  }
}

test('Shiprocket local catalog captures the verified first-party careers board and detail pages', async () => {
  const { SHIPROCKET_CATALOG, default: defaultCatalog } = await loadCatalogModule()
  const shiprocket = await loadScraperModule()
  const provider = hydrateProviderCatalogEntry(SHIPROCKET_CATALOG)

  assert.equal(defaultCatalog, SHIPROCKET_CATALOG)
  assert.equal(provider.source, 'shiprocket')
  assert.equal(provider.companyName, 'Shiprocket')
  assert.equal(provider.officialBrandName, 'Shiprocket')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyCareerPage, 'https://careers.shiprocket.in/')
  assert.equal(provider.officialCareersPageUrl, 'https://careers.shiprocket.in/')
  assert.equal(provider.jobPagePrefix, 'https://careers.shiprocket.in/jobs/')
  assert.equal(provider.companyDomain, 'shiprocket.in')
  assert.equal(provider.atsPlatform, 'first-party-html-board')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'single-public-page+first-party-detail-pages')
  assert.equal(
    provider.extractionStrategy,
    'verified-first-party-careers-page+visible-job-list+first-party-detail-pages',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.verifiedOn, '2026-07-17')
  assert.match(provider.dryRunFile, /shiprocket[\\/]jobs\.json$/i)
  assert.equal(provider.modulePath, modulePath)
  assert.match(provider.verifiedSurfaceSummary, /Friday, July 17, 2026/i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/careers\.shiprocket\.in\//i)
  assert.match(provider.verifiedSurfaceSummary, /GoLang Developer/i)
  assert.match(provider.verifiedSurfaceSummary, /Central Analytics Lead/i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/careers\.shiprocket\.in\/jobs\/golang-developer\//i)
  assert.equal(Object.prototype.hasOwnProperty.call(companyAliases, 'Shiprocket'), false)

  assert.equal(shiprocket.PROVIDER_METADATA.source, SHIPROCKET_CATALOG.source)
  assert.equal(shiprocket.PROVIDER_METADATA.companyName, SHIPROCKET_CATALOG.companyName)
})

test('Shiprocket exact backlog row matches directly from local provider metadata', async () => {
  const { SHIPROCKET_CATALOG } = await loadCatalogModule()
  const report = generateCompanyCoverageReport({
    csvText: 'Shiprocket\n',
    catalog: [hydrateProviderCatalogEntry(SHIPROCKET_CATALOG)],
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Shiprocket', 'shiprocket', 'Shiprocket']],
  )
})

test('Shiprocket hydrated local catalog stays script-runner compatible for central registry integration', async () => {
  const { SHIPROCKET_CATALOG } = await loadCatalogModule()
  const provider = hydrateProviderCatalogEntry(SHIPROCKET_CATALOG)
  const module = await import(pathToFileURL(provider.modulePath).href)

  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyName, 'Shiprocket')
  assert.equal(provider.companyCareerPage, 'https://careers.shiprocket.in/')
  assert.equal(provider.companyDomain, 'shiprocket.in')
  assert.equal(provider.atsPlatform, 'first-party-html-board')
  assert.match(provider.modulePath, /shiprocket[\\/]script\.js$/i)
  assert.match(provider.dryRunFile, /shiprocket[\\/]jobs\.json$/i)
  assert.equal(typeof module.run, 'function')
})
