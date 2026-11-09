import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath, pathToFileURL } from 'node:url'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import companyAliases from '../providers/companyAliases.json' with { type: 'json' }
import {
  buildScrapers,
  getScraperCatalog,
  hydrateProviderCatalogEntry,
} from '../providers/index.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const modulePath = path.resolve(currentDir, '../../scraper/pharmeasy/script.js')

const loadCatalogModule = async () => {
  try {
    return await import('../../scraper/pharmeasy/catalog.js')
  } catch {
    assert.fail('Expected PharmEasy catalog module at ../../scraper/pharmeasy/catalog.js')
  }
}

const loadScraperModule = async () => {
  try {
    return await import('../../scraper/pharmeasy/script.js')
  } catch {
    assert.fail('Expected PharmEasy scraper module at ../../scraper/pharmeasy/script.js')
  }
}

test('PharmEasy local catalog captures the verified first-party careers page and Darwinbox handoff', async () => {
  const { PHARMEASY_CATALOG, default: defaultCatalog } = await loadCatalogModule()
  const pharmEasy = await loadScraperModule()
  const provider = hydrateProviderCatalogEntry(PHARMEASY_CATALOG)

  assert.equal(defaultCatalog, PHARMEASY_CATALOG)
  assert.equal(provider.source, 'pharmeasy')
  assert.equal(provider.companyName, 'PharmEasy')
  assert.equal(provider.officialBrandName, 'PharmEasy')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyCareerPage, 'https://pharmeasy.in/careers/')
  assert.equal(provider.companyDomain, 'pharmeasy.in')
  assert.equal(provider.atsPlatform, 'darwinbox')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'browser-session-darwinbox-pagination')
  assert.equal(provider.extractionStrategy, 'official-careers-page+darwinbox-listing-api')
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(
    provider.officialCareersHandoffUrl,
    'https://myhr.darwinbox.in/ms/candidate/careers',
  )
  assert.equal(provider.darwinboxOrigin, 'https://myhr.darwinbox.in')
  assert.equal(provider.darwinboxCompanyId, 'main')
  assert.equal(provider.verifiedOn, '2026-07-17')
  assert.equal(provider.modulePath, modulePath)
  assert.match(provider.dryRunFile, /pharmeasy[\\/]jobs\.json$/i)
  assert.match(provider.verifiedSurfaceSummary, /Friday, July 17, 2026/i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/pharmeasy\.in\/careers\//i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/pharmeasy\.in\/careers\/jobs\//i)
  assert.match(
    provider.verifiedSurfaceSummary,
    /https:\/\/myhr\.darwinbox\.in\/ms\/candidate\/careers/i,
  )
  assert.match(
    provider.verifiedSurfaceSummary,
    /https:\/\/myhr\.darwinbox\.in\/ms\/candidatev2\/main\/careers\/jobDetails\/a6a39234c7fe21/i,
  )
  assert.equal(Object.prototype.hasOwnProperty.call(companyAliases, 'PharmEasy'), false)

  assert.equal(pharmEasy.PROVIDER_METADATA.source, PHARMEASY_CATALOG.source)
  assert.equal(pharmEasy.PROVIDER_METADATA.companyName, PHARMEASY_CATALOG.companyName)
  assert.equal(
    pharmEasy.PROVIDER_METADATA.officialCareersHandoffUrl,
    PHARMEASY_CATALOG.officialCareersHandoffUrl,
  )
})

test('PharmEasy exact backlog row resolves directly from local provider metadata', async () => {
  const { PHARMEASY_CATALOG } = await loadCatalogModule()
  const report = generateCompanyCoverageReport({
    csvText: 'PharmEasy\n',
    catalog: [hydrateProviderCatalogEntry(PHARMEASY_CATALOG)],
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['PharmEasy', 'pharmeasy', 'PharmEasy']],
  )
})

test('getScraperCatalog exposes PharmEasy as a runnable shared provider without alias churn', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'pharmeasy')
  const scraper = buildScrapers().find((item) => item.name === 'pharmeasy')

  assert.ok(provider)
  assert.ok(scraper)
  assert.equal(provider.companyName, 'PharmEasy')
  assert.equal(provider.companyCareerPage, 'https://pharmeasy.in/careers/')
  assert.equal(Object.prototype.hasOwnProperty.call(companyAliases, 'PharmEasy'), false)

  const report = generateCompanyCoverageReport({
    csvText: 'PharmEasy\n',
    catalog: getScraperCatalog(),
    aliasMap: companyAliases,
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['PharmEasy', 'pharmeasy', 'PharmEasy']],
  )
})

test('PharmEasy hydrated local catalog stays script-runner compatible for shared registry integration', async () => {
  const { PHARMEASY_CATALOG } = await loadCatalogModule()
  const provider = hydrateProviderCatalogEntry(PHARMEASY_CATALOG)
  const module = await import(pathToFileURL(provider.modulePath).href)

  assert.equal(provider.adapter, 'script')
  assert.match(provider.modulePath, /pharmeasy[\\/]script\.js$/i)
  assert.match(provider.dryRunFile, /pharmeasy[\\/]jobs\.json$/i)
  assert.equal(typeof module.run, 'function')
})
