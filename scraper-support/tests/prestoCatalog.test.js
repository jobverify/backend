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
const modulePath = path.resolve(currentDir, '../../scraper/presto/script.js')

const loadCatalogModule = async () => {
  try {
    return await import('../../scraper/presto/catalog.js')
  } catch {
    assert.fail('Expected Presto catalog module at ../../scraper/presto/catalog.js')
  }
}

const loadScraperModule = async () => {
  try {
    return await import('../../scraper/presto/script.js')
  } catch {
    assert.fail('Expected Presto scraper module at ../../scraper/presto/script.js')
  }
}

test('Presto local catalog captures the verified first-party careers page and official JS job array', async () => {
  const { PRESTO_CATALOG, default: defaultCatalog } = await loadCatalogModule()
  const presto = await loadScraperModule()
  const provider = hydrateProviderCatalogEntry(PRESTO_CATALOG)

  assert.equal(defaultCatalog, PRESTO_CATALOG)
  assert.equal(provider.source, 'presto')
  assert.equal(provider.companyName, 'Presto')
  assert.equal(provider.officialBrandName, 'Presto')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.homepageUrl, 'https://www.presto-apps.com/')
  assert.equal(provider.companyCareerPage, 'https://www.presto-apps.com/careers')
  assert.equal(provider.officialJobsScriptUrl, 'https://www.presto-apps.com/assets/js/js-p2023.js')
  assert.equal(provider.companyDomain, 'presto-apps.com')
  assert.equal(provider.atsPlatform, 'official-company-site-inline-js-job-array')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'single-careers-page-inline-javascript-array')
  assert.equal(
    provider.extractionStrategy,
    'verified-first-party-careers-page+verified-inline-jobpostings-array+linkedin-apply-links',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.verifiedOn, '2026-07-17')
  assert.match(provider.verifiedSurfaceSummary, /Friday, July 17, 2026/i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/www\.presto-apps\.com\/careers/i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/www\.presto-apps\.com\/assets\/js\/js-p2023\.js/i)
  assert.match(provider.verifiedSurfaceSummary, /Current openings/i)
  assert.equal(provider.modulePath, modulePath)
  assert.match(provider.dryRunFile, /presto[\\/]jobs\.json$/i)
  assert.equal(Object.prototype.hasOwnProperty.call(companyAliases, 'Presto'), false)

  assert.equal(presto.PROVIDER_METADATA.source, PRESTO_CATALOG.source)
  assert.equal(presto.PROVIDER_METADATA.companyName, PRESTO_CATALOG.companyName)
  assert.equal(presto.PROVIDER_METADATA.officialJobsScriptUrl, PRESTO_CATALOG.officialJobsScriptUrl)
})

test('Presto exact backlog row matches directly from local provider metadata without aliases', async () => {
  const { PRESTO_CATALOG } = await loadCatalogModule()
  const report = generateCompanyCoverageReport({
    csvText: 'Presto\n',
    catalog: [hydrateProviderCatalogEntry(PRESTO_CATALOG)],
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Presto', 'presto', 'Presto']],
  )
})

test('getScraperCatalog exposes Presto as a runnable shared provider without alias churn', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'presto')
  const scraper = buildScrapers().find((item) => item.name === 'presto')

  assert.ok(provider)
  assert.ok(scraper)
  assert.equal(provider.companyName, 'Presto')
  assert.equal(provider.companyCareerPage, 'https://www.presto-apps.com/careers')
  assert.equal(Object.prototype.hasOwnProperty.call(companyAliases, 'Presto'), false)

  const report = generateCompanyCoverageReport({
    csvText: 'Presto\n',
    catalog: getScraperCatalog(),
    aliasMap: companyAliases,
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Presto', 'presto', 'Presto']],
  )
})

test('Presto hydrated local catalog stays script-runner compatible for shared registry integration', async () => {
  const { PRESTO_CATALOG } = await loadCatalogModule()
  const provider = hydrateProviderCatalogEntry(PRESTO_CATALOG)
  const module = await import(pathToFileURL(provider.modulePath).href)

  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyName, 'Presto')
  assert.equal(provider.companyCareerPage, 'https://www.presto-apps.com/careers')
  assert.equal(provider.companyDomain, 'presto-apps.com')
  assert.equal(provider.atsPlatform, 'official-company-site-inline-js-job-array')
  assert.match(provider.modulePath, /presto[\\/]script\.js$/i)
  assert.match(provider.dryRunFile, /presto[\\/]jobs\.json$/i)
  assert.equal(typeof module.run, 'function')
})
