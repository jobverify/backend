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
const onidaModulePath = path.resolve(currentDir, '../../scraper/onida/script.js')

const loadCatalogModule = async () => {
  try {
    return await import('../../scraper/onida/catalog.js')
  } catch {
    assert.fail('Expected Onida catalog module at ../../scraper/onida/catalog.js')
  }
}

const loadScriptModule = async () => {
  try {
    return await import('../../scraper/onida/script.js')
  } catch {
    assert.fail('Expected Onida scraper module at ../../scraper/onida/script.js')
  }
}

test('Onida local catalog captures the verified Life@Onida page and missing openings routes', async () => {
  const { ONIDA_CATALOG } = await loadCatalogModule()
  const onida = await loadScriptModule()
  const provider = hydrateProviderCatalogEntry(ONIDA_CATALOG)

  assert.equal(provider.source, 'onida')
  assert.equal(provider.companyName, 'Onida')
  assert.equal(provider.officialBrandName, 'Onida')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyCareerPage, 'https://onida.com/life-at-onida/')
  assert.equal(provider.officialHomepageUrl, 'https://onida.com/')
  assert.equal(provider.companyDomain, 'onida.com')
  assert.equal(provider.atsPlatform, 'official-life-page-plus-missing-openings-routes')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'verified-life-page-plus-missing-openings-routes-return-empty')
  assert.equal(
    provider.extractionStrategy,
    'verified-homepage-careers-menu+verified-life-page-placeholder-current-openings-link+missing-openings-routes-return-empty',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.deepEqual(provider.blockedCareersRouteUrls, [
    'https://onida.com/current-openings/',
    'https://onida.com/careers/',
  ])
  assert.equal(provider.currentOpeningsPlaceholderHref, 'javascript:;')
  assert.equal(provider.verifiedOn, '2026-07-17')
  assert.match(provider.dryRunFile, /onida[\\/]jobs\.json$/i)
  assert.equal(provider.modulePath, onidaModulePath)
  assert.match(provider.verifiedSurfaceSummary, /July 17, 2026/i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/onida\.com\/life-at-onida\//i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/onida\.com\/current-openings\//i)
  assert.match(provider.verifiedSurfaceSummary, /javascript:;/i)
  assert.equal(Object.prototype.hasOwnProperty.call(companyAliases, 'Onida'), false)

  assert.equal(onida.PROVIDER_METADATA.source, ONIDA_CATALOG.source)
  assert.equal(onida.PROVIDER_METADATA.companyName, ONIDA_CATALOG.companyName)
  assert.deepEqual(
    onida.PROVIDER_METADATA.blockedCareersRouteUrls,
    ONIDA_CATALOG.blockedCareersRouteUrls,
  )
})

test('Onida backlog row matches directly from the local catalog without alias churn', async () => {
  const { ONIDA_CATALOG } = await loadCatalogModule()
  const report = generateCompanyCoverageReport({
    csvText: 'Onida\n',
    catalog: [hydrateProviderCatalogEntry(ONIDA_CATALOG)],
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Onida', 'onida', 'Onida']],
  )
})

test('getScraperCatalog exposes Onida as a runnable shared provider without alias churn', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'onida')
  const scraper = buildScrapers().find((item) => item.name === 'onida')

  assert.ok(provider)
  assert.ok(scraper)
  assert.equal(provider.companyName, 'Onida')
  assert.equal(provider.companyCareerPage, 'https://onida.com/life-at-onida/')
  assert.equal(Object.prototype.hasOwnProperty.call(companyAliases, 'Onida'), false)

  const report = generateCompanyCoverageReport({
    csvText: 'Onida\n',
    catalog: getScraperCatalog(),
    aliasMap: companyAliases,
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Onida', 'onida', 'Onida']],
  )
})
