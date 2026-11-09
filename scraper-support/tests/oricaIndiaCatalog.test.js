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
const modulePath = path.resolve(currentDir, '../../scraper/oricaindia/script.js')

const loadCatalogModule = async () => {
  try {
    return await import('../../scraper/oricaindia/catalog.js')
  } catch {
    assert.fail('Expected Orica India catalog module at ../../scraper/oricaindia/catalog.js')
  }
}

const loadScraperModule = async () => {
  try {
    return await import('../../scraper/oricaindia/script.js')
  } catch {
    assert.fail('Expected Orica India scraper module at ../../scraper/oricaindia/script.js')
  }
}

test('Orica India local catalog captures the verified public India search surface on Orica careers', async () => {
  const { ORICA_INDIA_CATALOG, default: defaultCatalog } = await loadCatalogModule()
  const oricaIndia = await loadScraperModule()
  const provider = hydrateProviderCatalogEntry(ORICA_INDIA_CATALOG)

  assert.equal(defaultCatalog, ORICA_INDIA_CATALOG)
  assert.equal(provider.source, 'oricaindia')
  assert.equal(provider.companyName, 'Orica India')
  assert.equal(provider.officialBrandName, 'Orica')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.officialCareersPageUrl, 'https://www.orica.com/careers')
  assert.equal(
    provider.companyCareerPage,
    'https://careers.orica.com/search/?createNewAlert=false&q=&locationsearch=India',
  )
  assert.equal(provider.companyDomain, 'careers.orica.com')
  assert.equal(provider.atsPlatform, 'successfactors')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'successfactors-search-page-query')
  assert.equal(
    provider.extractionStrategy,
    'verified-official-orica-careers-page+india-search-results-table+detail-pages+talentcommunity-apply-handoff',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.verifiedOn, '2026-07-17')
  assert.match(provider.dryRunFile, /oricaindia[\\/]jobs\.json$/i)
  assert.equal(provider.modulePath, modulePath)
  assert.match(provider.verifiedSurfaceSummary, /Friday, July 17, 2026/i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/www\.orica\.com\/careers/i)
  assert.match(
    provider.verifiedSurfaceSummary,
    /https:\/\/careers\.orica\.com\/search\/\?createNewAlert=false&q=&locationsearch=India/i,
  )
  assert.match(
    provider.verifiedSurfaceSummary,
    /https:\/\/careers\.orica\.com\/job\/Hyderabad-Tax-Lead%2C-India-TG-500081\/1377285800\//i,
  )
  assert.equal(Object.prototype.hasOwnProperty.call(companyAliases, 'Orica India'), false)

  assert.equal(oricaIndia.PROVIDER_METADATA.source, ORICA_INDIA_CATALOG.source)
  assert.equal(oricaIndia.PROVIDER_METADATA.companyName, ORICA_INDIA_CATALOG.companyName)
  assert.equal(oricaIndia.PROVIDER_METADATA.officialCareersPageUrl, ORICA_INDIA_CATALOG.officialCareersPageUrl)
})

test('Orica India exact backlog row matches directly from local provider metadata without aliases', async () => {
  const { ORICA_INDIA_CATALOG } = await loadCatalogModule()
  const report = generateCompanyCoverageReport({
    csvText: 'Orica India\n',
    catalog: [hydrateProviderCatalogEntry(ORICA_INDIA_CATALOG)],
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Orica India', 'oricaindia', 'Orica India']],
  )
})

test('getScraperCatalog exposes Orica India as a runnable shared provider without alias churn', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'oricaindia')
  const scraper = buildScrapers().find((item) => item.name === 'oricaindia')

  assert.ok(provider)
  assert.ok(scraper)
  assert.equal(provider.companyName, 'Orica India')
  assert.equal(
    provider.companyCareerPage,
    'https://careers.orica.com/search/?createNewAlert=false&q=&locationsearch=India',
  )
  assert.equal(Object.prototype.hasOwnProperty.call(companyAliases, 'Orica India'), false)

  const report = generateCompanyCoverageReport({
    csvText: 'Orica India\n',
    catalog: getScraperCatalog(),
    aliasMap: companyAliases,
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Orica India', 'oricaindia', 'Orica India']],
  )
})

test('Orica India hydrated local catalog stays script-runner compatible for central registry integration', async () => {
  const { ORICA_INDIA_CATALOG } = await loadCatalogModule()
  const provider = hydrateProviderCatalogEntry(ORICA_INDIA_CATALOG)
  const module = await import(pathToFileURL(provider.modulePath).href)

  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyName, 'Orica India')
  assert.equal(
    provider.companyCareerPage,
    'https://careers.orica.com/search/?createNewAlert=false&q=&locationsearch=India',
  )
  assert.equal(provider.companyDomain, 'careers.orica.com')
  assert.equal(provider.atsPlatform, 'successfactors')
  assert.match(provider.modulePath, /oricaindia[\\/]script\.js$/i)
  assert.match(provider.dryRunFile, /oricaindia[\\/]jobs\.json$/i)
  assert.equal(typeof module.run, 'function')
})
