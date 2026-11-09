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
const modulePath = path.resolve(currentDir, '../../scraper/pepperfry/script.js')

const loadCatalogModule = async () => {
  try {
    return await import('../../scraper/pepperfry/catalog.js')
  } catch {
    assert.fail('Expected Pepperfry catalog module at ../../scraper/pepperfry/catalog.js')
  }
}

const loadScraperModule = async () => {
  try {
    return await import('../../scraper/pepperfry/script.js')
  } catch {
    assert.fail('Expected Pepperfry scraper module at ../../scraper/pepperfry/script.js')
  }
}

test('Pepperfry local catalog captures the verified first-party careers page and Darwinbox apply handoff', async () => {
  const { PEPPERFRY_CATALOG, default: defaultCatalog } = await loadCatalogModule()
  const pepperfry = await loadScraperModule()
  const provider = hydrateProviderCatalogEntry(PEPPERFRY_CATALOG)

  assert.equal(defaultCatalog, PEPPERFRY_CATALOG)
  assert.equal(provider.source, 'pepperfry')
  assert.equal(provider.companyName, 'Pepperfry')
  assert.equal(provider.officialBrandName, 'Pepperfry')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.homepageUrl, 'https://www.pepperfry.com/')
  assert.equal(provider.companyCareerPage, 'https://www.pepperfry.com/pages/careers.html?type=footer')
  assert.equal(provider.companyDomain, 'pepperfry.com')
  assert.equal(provider.atsPlatform, 'first-party-careers-page+darwinbox-apply-handoff')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(
    provider.paginationStrategy,
    'single-first-party-careers-page',
  )
  assert.equal(
    provider.extractionStrategy,
    'verified-homepage-footer-careers-link+verified-first-party-careers-listings+darwinbox-apply-links',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.verifiedOn, '2026-08-04')
  assert.match(provider.dryRunFile, /pepperfry[\\/]jobs\.json$/i)
  assert.equal(provider.modulePath, modulePath)
  assert.match(provider.verifiedSurfaceSummary, /Tuesday, August 4, 2026/i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/www\.pepperfry\.com\//i)
  assert.match(
    provider.verifiedSurfaceSummary,
    /https:\/\/www\.pepperfry\.com\/pages\/careers\.html\?type=footer/i,
  )
  assert.match(provider.verifiedSurfaceSummary, /Darwinbox/i)
  assert.match(provider.verifiedSurfaceSummary, /Current Openings/i)
  assert.equal(Object.prototype.hasOwnProperty.call(companyAliases, 'Pepperfry'), false)

  assert.equal(pepperfry.PROVIDER_METADATA.source, PEPPERFRY_CATALOG.source)
  assert.equal(pepperfry.PROVIDER_METADATA.companyName, PEPPERFRY_CATALOG.companyName)
  assert.equal(pepperfry.PROVIDER_METADATA.companyCareerPage, PEPPERFRY_CATALOG.companyCareerPage)
})

test('Pepperfry exact backlog row matches directly from local provider metadata without aliases', async () => {
  const { PEPPERFRY_CATALOG } = await loadCatalogModule()
  const report = generateCompanyCoverageReport({
    csvText: 'Pepperfry\n',
    catalog: [hydrateProviderCatalogEntry(PEPPERFRY_CATALOG)],
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Pepperfry', 'pepperfry', 'Pepperfry']],
  )
})

test('getScraperCatalog exposes Pepperfry as a runnable shared provider without alias churn', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'pepperfry')
  const scraper = buildScrapers().find((item) => item.name === 'pepperfry')

  assert.ok(provider)
  assert.ok(scraper)
  assert.equal(provider.companyName, 'Pepperfry')
  assert.equal(provider.companyCareerPage, 'https://www.pepperfry.com/pages/careers.html?type=footer')
  assert.equal(Object.prototype.hasOwnProperty.call(companyAliases, 'Pepperfry'), false)

  const report = generateCompanyCoverageReport({
    csvText: 'Pepperfry\n',
    catalog: getScraperCatalog(),
    aliasMap: companyAliases,
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Pepperfry', 'pepperfry', 'Pepperfry']],
  )
})

test('Pepperfry hydrated local catalog stays script-runner compatible for shared registry integration', async () => {
  const { PEPPERFRY_CATALOG } = await loadCatalogModule()
  const provider = hydrateProviderCatalogEntry(PEPPERFRY_CATALOG)
  const module = await import(pathToFileURL(provider.modulePath).href)

  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyName, 'Pepperfry')
  assert.equal(provider.companyCareerPage, 'https://www.pepperfry.com/pages/careers.html?type=footer')
  assert.equal(provider.companyDomain, 'pepperfry.com')
  assert.equal(provider.atsPlatform, 'first-party-careers-page+darwinbox-apply-handoff')
  assert.match(provider.modulePath, /pepperfry[\\/]script\.js$/i)
  assert.match(provider.dryRunFile, /pepperfry[\\/]jobs\.json$/i)
  assert.equal(typeof module.run, 'function')
})
