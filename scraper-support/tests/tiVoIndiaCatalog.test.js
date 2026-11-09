import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath, pathToFileURL } from 'node:url'

import companyAliases from '../providers/companyAliases.json' with { type: 'json' }
import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { hydrateProviderCatalogEntry } from '../providers/index.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const modulePath = path.resolve(currentDir, '../../scraper/tivoindia/script.js')

const loadCatalogModule = async () => {
  try {
    return await import('../../scraper/tivoindia/catalog.js')
  } catch {
    assert.fail('Expected TiVo India catalog module at ../../scraper/tivoindia/catalog.js')
  }
}

const loadScraperModule = async () => {
  try {
    return await import('../../scraper/tivoindia/script.js')
  } catch {
    assert.fail('Expected TiVo India scraper module at ../../scraper/tivoindia/script.js')
  }
}

test('TiVo India local catalog captures the verified TiVo-to-Xperi sentinel surface without alias churn', async () => {
  const { TIVO_INDIA_CATALOG, default: defaultCatalog } = await loadCatalogModule()
  const tivoIndia = await loadScraperModule()
  const provider = hydrateProviderCatalogEntry(TIVO_INDIA_CATALOG)

  assert.equal(defaultCatalog, TIVO_INDIA_CATALOG)
  assert.equal(provider.source, 'tivoindia')
  assert.equal(provider.companyName, 'TiVo India')
  assert.equal(provider.officialBrandName, 'TiVo')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyCareerPage, 'https://xperi.com/careers/')
  assert.equal(provider.officialBrandHomepageUrl, 'https://www.tivo.com/')
  assert.equal(provider.officialCareersPageUrl, 'https://xperi.com/careers/')
  assert.equal(provider.officialLocationsPageUrl, 'https://xperi.com/company/locations/')
  assert.equal(provider.companyDomain, 'tivo.com')
  assert.equal(provider.atsPlatform, 'shared-parent-careers-no-distinct-exact-name-board')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(
    provider.paginationStrategy,
    'verified-brand-homepage-plus-shared-parent-careers-no-exact-name-public-board',
  )
  assert.equal(
    provider.extractionStrategy,
    'verified-tivo-homepage+verified-xperi-careers+verified-xperi-india-locations+fail-closed-sentinel',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.verifiedOn, '2026-07-17')
  assert.match(provider.dryRunFile, /tivoindia[\\/]jobs\.json$/i)
  assert.equal(provider.modulePath, modulePath)
  assert.match(provider.verifiedSurfaceSummary, /Friday, July 17, 2026/i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/www\.tivo\.com\//i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/xperi\.com\/careers\//i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/xperi\.com\/company\/locations\//i)
  assert.match(provider.verifiedSurfaceSummary, /Bangalore/i)
  assert.match(provider.verifiedSurfaceSummary, /Pune/i)
  assert.match(provider.verifiedSurfaceSummary, /no trustworthy public jobs surface/i)
  assert.equal(Object.prototype.hasOwnProperty.call(companyAliases, 'TiVo India'), false)

  assert.equal(tivoIndia.PROVIDER_METADATA.source, TIVO_INDIA_CATALOG.source)
  assert.equal(tivoIndia.PROVIDER_METADATA.companyName, TIVO_INDIA_CATALOG.companyName)
})

test('TiVo India exact backlog row matches directly from the local provider metadata', async () => {
  const { TIVO_INDIA_CATALOG } = await loadCatalogModule()
  const report = generateCompanyCoverageReport({
    csvText: 'TiVo India\n',
    catalog: [hydrateProviderCatalogEntry(TIVO_INDIA_CATALOG)],
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['TiVo India', 'tivoindia', 'TiVo India']],
  )
})

test('TiVo India hydrated local catalog stays script-runner compatible for central registry integration', async () => {
  const { TIVO_INDIA_CATALOG } = await loadCatalogModule()
  const provider = hydrateProviderCatalogEntry(TIVO_INDIA_CATALOG)
  const module = await import(pathToFileURL(provider.modulePath).href)

  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyName, 'TiVo India')
  assert.equal(provider.companyCareerPage, 'https://xperi.com/careers/')
  assert.equal(provider.companyDomain, 'tivo.com')
  assert.equal(provider.atsPlatform, 'shared-parent-careers-no-distinct-exact-name-board')
  assert.match(provider.modulePath, /tivoindia[\\/]script\.js$/i)
  assert.match(provider.dryRunFile, /tivoindia[\\/]jobs\.json$/i)
  assert.equal(typeof module.run, 'function')
})
