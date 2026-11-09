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
const modulePath = path.resolve(currentDir, '../../scraper/orderhive/script.js')

const loadCatalogModule = async () => {
  try {
    return await import('../../scraper/orderhive/catalog.js')
  } catch {
    assert.fail('Expected Orderhive catalog module at ../../scraper/orderhive/catalog.js')
  }
}

const loadScraperModule = async () => {
  try {
    return await import('../../scraper/orderhive/script.js')
  } catch {
    assert.fail('Expected Orderhive scraper module at ../../scraper/orderhive/script.js')
  }
}

test('Orderhive local catalog captures the verified exact-name fail-closed Cin7 redirect state', async () => {
  const { ORDERHIVE_CATALOG, default: defaultCatalog } = await loadCatalogModule()
  const orderhive = await loadScraperModule()
  const provider = hydrateProviderCatalogEntry(ORDERHIVE_CATALOG)

  assert.equal(defaultCatalog, ORDERHIVE_CATALOG)
  assert.equal(provider.source, 'orderhive')
  assert.equal(provider.companyName, 'Orderhive')
  assert.equal(provider.officialBrandName, 'Orderhive')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.homepageUrl, 'https://orderhive.com/')
  assert.equal(provider.companyCareerPage, 'https://orderhive.com/careers')
  assert.equal(provider.parentHomepageUrl, 'https://www.cin7.com/')
  assert.equal(provider.parentCareersPage, 'https://www.cin7.com/careers/')
  assert.equal(provider.companyDomain, 'orderhive.com')
  assert.equal(provider.atsPlatform, 'official-company-site-no-public-careers')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(
    provider.paginationStrategy,
    'exact-name-homepage-redirect-plus-generic-parent-careers-plus-missing-careers-route',
  )
  assert.equal(
    provider.extractionStrategy,
    'verified-orderhive-homepage-redirect+verified-generic-cin7-careers-without-orderhive-jobs+verified-missing-orderhive-careers-route-return-empty',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.verifiedOn, '2026-07-25')
  assert.match(provider.dryRunFile, /orderhive[\\/]jobs\.json$/i)
  assert.equal(provider.modulePath, modulePath)
  assert.match(provider.verifiedSurfaceSummary, /Saturday, July 25, 2026/i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/orderhive\.com\//i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/orderhive\.com\/careers/i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/www\.cin7\.com\/careers\//i)
  assert.match(provider.verifiedSurfaceSummary, /no trustworthy public jobs surface/i)
  assert.equal(Object.prototype.hasOwnProperty.call(companyAliases, 'Orderhive'), false)

  assert.equal(orderhive.PROVIDER_METADATA.source, ORDERHIVE_CATALOG.source)
  assert.equal(orderhive.PROVIDER_METADATA.companyName, ORDERHIVE_CATALOG.companyName)
  assert.equal(orderhive.PROVIDER_METADATA.parentCareersPage, ORDERHIVE_CATALOG.parentCareersPage)
})

test('Orderhive exact backlog row matches directly from local provider metadata without aliases', async () => {
  const { ORDERHIVE_CATALOG } = await loadCatalogModule()
  const report = generateCompanyCoverageReport({
    csvText: 'Orderhive\n',
    catalog: [hydrateProviderCatalogEntry(ORDERHIVE_CATALOG)],
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Orderhive', 'orderhive', 'Orderhive']],
  )
})

test('getScraperCatalog exposes Orderhive as a runnable shared provider without alias churn', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'orderhive')
  const scraper = buildScrapers().find((item) => item.name === 'orderhive')

  assert.ok(provider)
  assert.ok(scraper)
  assert.equal(provider.companyName, 'Orderhive')
  assert.equal(provider.companyCareerPage, 'https://orderhive.com/careers')
  assert.equal(Object.prototype.hasOwnProperty.call(companyAliases, 'Orderhive'), false)

  const report = generateCompanyCoverageReport({
    csvText: 'Orderhive\n',
    catalog: getScraperCatalog(),
    aliasMap: companyAliases,
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Orderhive', 'orderhive', 'Orderhive']],
  )
})

test('Orderhive hydrated local catalog stays script-runner compatible for central registry integration', async () => {
  const { ORDERHIVE_CATALOG } = await loadCatalogModule()
  const provider = hydrateProviderCatalogEntry(ORDERHIVE_CATALOG)
  const module = await import(pathToFileURL(provider.modulePath).href)

  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyName, 'Orderhive')
  assert.equal(provider.companyCareerPage, 'https://orderhive.com/careers')
  assert.equal(provider.companyDomain, 'orderhive.com')
  assert.equal(provider.atsPlatform, 'official-company-site-no-public-careers')
  assert.match(provider.modulePath, /orderhive[\\/]script\.js$/i)
  assert.match(provider.dryRunFile, /orderhive[\\/]jobs\.json$/i)
  assert.equal(typeof module.run, 'function')
})
