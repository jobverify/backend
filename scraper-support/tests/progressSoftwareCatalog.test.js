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
const modulePath = path.resolve(currentDir, '../../scraper/progresssoftware/script.js')

const loadCatalogModule = async () => {
  try {
    return await import('../../scraper/progresssoftware/catalog.js')
  } catch {
    assert.fail('Expected Progress Software catalog module at ../../scraper/progresssoftware/catalog.js')
  }
}

const loadScraperModule = async () => {
  try {
    return await import('../../scraper/progresssoftware/script.js')
  } catch {
    assert.fail('Expected Progress Software scraper module at ../../scraper/progresssoftware/script.js')
  }
}

test('Progress Software local catalog captures the verified first-party careers homepage, open-positions board, and India job detail surface', async () => {
  const { PROGRESS_SOFTWARE_CATALOG, default: defaultCatalog } = await loadCatalogModule()
  const progressSoftware = await loadScraperModule()
  const provider = hydrateProviderCatalogEntry(PROGRESS_SOFTWARE_CATALOG)

  assert.equal(defaultCatalog, PROGRESS_SOFTWARE_CATALOG)
  assert.equal(provider.source, 'progresssoftware')
  assert.equal(provider.companyName, 'Progress Software')
  assert.equal(provider.officialBrandName, 'Progress Software Corporation')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.homepageUrl, 'https://www.progress.com/company/careers')
  assert.equal(provider.companyCareerPage, 'https://www.progress.com/company/careers/open-positions')
  assert.equal(provider.officialCareersPageUrl, 'https://www.progress.com/company/careers/open-positions')
  assert.equal(
    provider.jobPagePrefix,
    'https://www.progress.com/company/careers/open-positions/',
  )
  assert.equal(provider.companyDomain, 'progress.com')
  assert.equal(provider.atsPlatform, 'official-company-careers')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(
    provider.paginationStrategy,
    'single-first-party-open-positions-page-plus-first-party-detail-pages',
  )
  assert.equal(
    provider.extractionStrategy,
    'verified-first-party-careers-homepage+verified-open-positions-list+india-location-filter+first-party-detail-pages',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.verifiedOn, '2026-10-23')
  assert.equal(provider.verifiedPublicJobCount, 26)
  assert.equal(provider.verifiedIndiaJobCount, 10)
  assert.equal(provider.inventoryVerificationPolicy, 'live-parser-evidence-required')
  assert.match(provider.dryRunFile, /progresssoftware[\\/]jobs\.json$/i)
  assert.equal(provider.modulePath, modulePath)
  assert.match(provider.verifiedSurfaceSummary, /2026-10-23/i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/www\.progress\.com\/company\/careers/i)
  assert.match(
    provider.verifiedSurfaceSummary,
    /https:\/\/www\.progress\.com\/company\/careers\/open-positions/i,
  )
  assert.match(provider.verifiedSurfaceSummary, /26 public roles/i)
  assert.match(provider.verifiedSurfaceSummary, /10 India roles/i)
  assert.equal(Object.prototype.hasOwnProperty.call(companyAliases, 'Progress Software'), false)

  assert.equal(progressSoftware.PROVIDER_METADATA.source, PROGRESS_SOFTWARE_CATALOG.source)
  assert.equal(
    progressSoftware.PROVIDER_METADATA.companyName,
    PROGRESS_SOFTWARE_CATALOG.companyName,
  )
  assert.equal(
    progressSoftware.PROVIDER_METADATA.jobPagePrefix,
    PROGRESS_SOFTWARE_CATALOG.jobPagePrefix,
  )
})

test('Progress Software exact backlog row matches directly from local provider metadata', async () => {
  const { PROGRESS_SOFTWARE_CATALOG } = await loadCatalogModule()
  const report = generateCompanyCoverageReport({
    csvText: 'Progress Software\n',
    catalog: [hydrateProviderCatalogEntry(PROGRESS_SOFTWARE_CATALOG)],
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Progress Software', 'progresssoftware', 'Progress Software']],
  )
})

test('getScraperCatalog exposes Progress Software as a runnable shared provider without alias churn', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'progresssoftware')
  const scraper = buildScrapers().find((item) => item.name === 'progresssoftware')

  assert.ok(provider)
  assert.ok(scraper)
  assert.equal(provider.companyName, 'Progress Software')
  assert.equal(provider.companyCareerPage, 'https://www.progress.com/company/careers/open-positions')
  assert.equal(Object.prototype.hasOwnProperty.call(companyAliases, 'Progress Software'), false)

  const report = generateCompanyCoverageReport({
    csvText: 'Progress Software\n',
    catalog: getScraperCatalog(),
    aliasMap: companyAliases,
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Progress Software', 'progresssoftware', 'Progress Software']],
  )
})

test('Progress Software hydrated local catalog stays script-runner compatible for shared registry integration', async () => {
  const { PROGRESS_SOFTWARE_CATALOG } = await loadCatalogModule()
  const provider = hydrateProviderCatalogEntry(PROGRESS_SOFTWARE_CATALOG)
  const module = await import(pathToFileURL(provider.modulePath).href)

  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyName, 'Progress Software')
  assert.equal(provider.companyCareerPage, 'https://www.progress.com/company/careers/open-positions')
  assert.equal(provider.companyDomain, 'progress.com')
  assert.equal(provider.atsPlatform, 'official-company-careers')
  assert.match(provider.modulePath, /progresssoftware[\\/]script\.js$/i)
  assert.match(provider.dryRunFile, /progresssoftware[\\/]jobs\.json$/i)
  assert.equal(typeof module.run, 'function')
})
