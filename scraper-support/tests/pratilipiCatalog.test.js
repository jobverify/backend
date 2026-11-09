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
const modulePath = path.resolve(currentDir, '../../scraper/pratilipi/script.js')

const loadCatalogModule = async () => {
  try {
    return await import('../../scraper/pratilipi/catalog.js')
  } catch {
    assert.fail('Expected Pratilipi catalog module at ../../scraper/pratilipi/catalog.js')
  }
}

const loadScraperModule = async () => {
  try {
    return await import('../../scraper/pratilipi/script.js')
  } catch {
    assert.fail('Expected Pratilipi scraper module at ../../scraper/pratilipi/script.js')
  }
}

test('Pratilipi local catalog captures the verified official careers handoff and opaque TalentzQ shell state', async () => {
  const { PRATILIPI_CATALOG, default: defaultCatalog } = await loadCatalogModule()
  const pratilipi = await loadScraperModule()
  const provider = hydrateProviderCatalogEntry(PRATILIPI_CATALOG)

  assert.equal(defaultCatalog, PRATILIPI_CATALOG)
  assert.equal(provider.source, 'pratilipi')
  assert.equal(provider.companyName, 'Pratilipi')
  assert.equal(provider.officialBrandName, 'Pratilipi')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.homepageUrl, 'https://www.pratilipi.com/')
  assert.equal(provider.companyCareerPage, 'https://www.pratilipi.com/careers')
  assert.equal(provider.officialCareersHandoffUrl, 'https://pratilipi.talentzq.io/careers')
  assert.equal(provider.companyDomain, 'pratilipi.com')
  assert.equal(provider.atsPlatform, 'official-company-site-broken-ats-shell')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'official-careers-link-plus-opaque-talentzq-shell-validation')
  assert.equal(
    provider.extractionStrategy,
    'verified-official-careers-link+verified-opaque-talentzq-shell-without-trustworthy-public-job-listings-return-empty',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.verifiedOn, '2026-07-17')
  assert.match(provider.verifiedSurfaceSummary, /Friday, July 17, 2026/i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/www\.pratilipi\.com\/careers/i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/pratilipi\.talentzq\.io\/careers/i)
  assert.match(provider.verifiedSurfaceSummary, /no trustworthy public jobs surface/i)
  assert.match(provider.verifiedSurfaceSummary, /opaque TalentzQ shell/i)
  assert.equal(provider.modulePath, modulePath)
  assert.match(provider.dryRunFile, /pratilipi[\\/]jobs\.json$/i)
  assert.equal(Object.prototype.hasOwnProperty.call(companyAliases, 'Pratilipi'), false)

  assert.equal(pratilipi.PROVIDER_METADATA.source, PRATILIPI_CATALOG.source)
  assert.equal(pratilipi.PROVIDER_METADATA.companyName, PRATILIPI_CATALOG.companyName)
  assert.equal(
    pratilipi.PROVIDER_METADATA.officialCareersHandoffUrl,
    PRATILIPI_CATALOG.officialCareersHandoffUrl,
  )
})

test('Pratilipi exact backlog row matches directly from local provider metadata without aliases', async () => {
  const { PRATILIPI_CATALOG } = await loadCatalogModule()
  const report = generateCompanyCoverageReport({
    csvText: 'Pratilipi\n',
    catalog: [hydrateProviderCatalogEntry(PRATILIPI_CATALOG)],
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Pratilipi', 'pratilipi', 'Pratilipi']],
  )
})

test('getScraperCatalog exposes Pratilipi as a runnable shared provider without alias churn', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'pratilipi')
  const scraper = buildScrapers().find((item) => item.name === 'pratilipi')

  assert.ok(provider)
  assert.ok(scraper)
  assert.equal(provider.companyName, 'Pratilipi')
  assert.equal(provider.companyCareerPage, 'https://www.pratilipi.com/careers')
  assert.equal(Object.prototype.hasOwnProperty.call(companyAliases, 'Pratilipi'), false)

  const report = generateCompanyCoverageReport({
    csvText: 'Pratilipi\n',
    catalog: getScraperCatalog(),
    aliasMap: companyAliases,
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Pratilipi', 'pratilipi', 'Pratilipi']],
  )
})

test('Pratilipi hydrated local catalog stays script-runner compatible for shared registry integration', async () => {
  const { PRATILIPI_CATALOG } = await loadCatalogModule()
  const provider = hydrateProviderCatalogEntry(PRATILIPI_CATALOG)
  const module = await import(pathToFileURL(provider.modulePath).href)

  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyName, 'Pratilipi')
  assert.equal(provider.companyCareerPage, 'https://www.pratilipi.com/careers')
  assert.equal(provider.companyDomain, 'pratilipi.com')
  assert.equal(provider.atsPlatform, 'official-company-site-broken-ats-shell')
  assert.match(provider.modulePath, /pratilipi[\\/]script\.js$/i)
  assert.match(provider.dryRunFile, /pratilipi[\\/]jobs\.json$/i)
  assert.equal(typeof module.run, 'function')
})
