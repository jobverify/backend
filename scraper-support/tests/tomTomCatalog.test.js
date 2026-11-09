import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath, pathToFileURL } from 'node:url'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { hydrateProviderCatalogEntry } from '../providers/index.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const modulePath = path.resolve(currentDir, '../../scraper/tomtom/script.js')

const loadCatalogModule = async () => {
  try {
    return await import('../../scraper/tomtom/catalog.js')
  } catch {
    assert.fail('Expected TomTom catalog module at ../../scraper/tomtom/catalog.js')
  }
}

const loadScriptModule = async () => {
  try {
    return await import('../../scraper/tomtom/script.js')
  } catch {
    assert.fail('Expected TomTom scraper module at ../../scraper/tomtom/script.js')
  }
}

test('TomTom local catalog captures the verified first-party careers surface and Lever board', async () => {
  const { TOMTOM_CATALOG, default: defaultCatalog } = await loadCatalogModule()
  const tomTom = await loadScriptModule()
  const provider = hydrateProviderCatalogEntry(TOMTOM_CATALOG)

  assert.equal(defaultCatalog, TOMTOM_CATALOG)
  assert.equal(provider.source, 'tomtom')
  assert.equal(provider.companyName, 'TomTom')
  assert.equal(provider.officialBrandName, 'TomTom')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyCareerPage, 'https://www.tomtom.com/careers/')
  assert.equal(provider.officialCareersPageUrl, 'https://www.tomtom.com/careers/')
  assert.equal(provider.officialPuneOfficeUrl, 'https://www.tomtom.com/careers/offices/pune/')
  assert.equal(provider.officialLeverBoardUrl, 'https://jobs.eu.lever.co/tomtom')
  assert.equal(provider.leverApiUrl, 'https://api.eu.lever.co/v0/postings/tomtom?mode=json')
  assert.equal(provider.companyDomain, 'tomtom.com')
  assert.equal(provider.atsPlatform, 'lever')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(
    provider.paginationStrategy,
    'verified-first-party-careers-and-office-pages-plus-eu-lever-api',
  )
  assert.equal(
    provider.extractionStrategy,
    'verified-first-party-careers-page+verified-pune-office-page+verified-pune-jobs-overview+verified-eu-lever-board+india-location-filter',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.verifiedOn, '2026-08-06')
  assert.equal(provider.modulePath, modulePath)
  assert.match(provider.dryRunFile, /tomtom[\\/]jobs\.json$/i)
  assert.match(provider.verifiedSurfaceSummary, /Thursday, August 6, 2026/i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/www\.tomtom\.com\/careers\//i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/www\.tomtom\.com\/careers\/offices\/pune\//i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/jobs\.eu\.lever\.co\/tomtom/i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/api\.eu\.lever\.co\/v0\/postings\/tomtom\?mode=json/i)
  assert.match(provider.verifiedSurfaceSummary, /26 jobs/i)
  assert.match(provider.verifiedSurfaceSummary, /Pune, India/i)
  assert.match(provider.verifiedSurfaceSummary, /stale first-party TomTom job-detail route/i)

  assert.equal(tomTom.PROVIDER_METADATA.source, provider.source)
  assert.equal(tomTom.PROVIDER_METADATA.companyName, provider.companyName)
  assert.equal(tomTom.PROVIDER_METADATA.officialLeverBoardUrl, provider.officialLeverBoardUrl)
})

test('TomTom exact backlog row matches directly from the local provider metadata', async () => {
  const { TOMTOM_CATALOG } = await loadCatalogModule()
  const report = generateCompanyCoverageReport({
    csvText: 'TomTom\n',
    catalog: [hydrateProviderCatalogEntry(TOMTOM_CATALOG)],
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['TomTom', 'tomtom', 'TomTom']],
  )
})

test('TomTom hydrated local catalog stays script-runner compatible for later shared-registry integration', async () => {
  const { TOMTOM_CATALOG } = await loadCatalogModule()
  const provider = hydrateProviderCatalogEntry(TOMTOM_CATALOG)
  const module = await import(pathToFileURL(provider.modulePath).href)

  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyName, 'TomTom')
  assert.equal(provider.companyCareerPage, 'https://www.tomtom.com/careers/')
  assert.equal(provider.companyDomain, 'tomtom.com')
  assert.equal(provider.atsPlatform, 'lever')
  assert.match(provider.modulePath, /tomtom[\\/]script\.js$/i)
  assert.match(provider.dryRunFile, /tomtom[\\/]jobs\.json$/i)
  assert.equal(typeof module.run, 'function')
})
