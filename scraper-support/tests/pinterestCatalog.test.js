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
const modulePath = path.resolve(currentDir, '../../scraper/pinterest/script.js')

const loadCatalogModule = async () => {
  try {
    return await import('../../scraper/pinterest/catalog.js')
  } catch {
    assert.fail('Expected Pinterest catalog module at ../../scraper/pinterest/catalog.js')
  }
}

const loadScraperModule = async () => {
  try {
    return await import('../../scraper/pinterest/script.js')
  } catch {
    assert.fail('Expected Pinterest scraper module at ../../scraper/pinterest/script.js')
  }
}

test('Pinterest local catalog captures the verified first-party careers domain and public Greenhouse API surface', async () => {
  const { PINTEREST_CATALOG, default: defaultCatalog } = await loadCatalogModule()
  const pinterest = await loadScraperModule()
  const provider = hydrateProviderCatalogEntry(PINTEREST_CATALOG)

  assert.equal(defaultCatalog, PINTEREST_CATALOG)
  assert.equal(provider.source, 'pinterest')
  assert.equal(provider.companyName, 'Pinterest')
  assert.equal(provider.officialBrandName, 'Pinterest')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyCareerPage, 'https://www.pinterestcareers.com/jobs/')
  assert.equal(provider.officialCareersPageUrl, 'https://www.pinterestcareers.com/jobs/')
  assert.equal(
    provider.greenhouseJobsApiUrl,
    'https://boards-api.greenhouse.io/v1/boards/pinterest/jobs?content=true',
  )
  assert.equal(
    provider.officialJobUrlPrefix,
    'https://www.pinterestcareers.com/jobs/?gh_jid=',
  )
  assert.equal(provider.companyDomain, 'pinterestcareers.com')
  assert.equal(provider.atsPlatform, 'greenhouse')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(
    provider.paginationStrategy,
    'single-greenhouse-jobs-api-content-page',
  )
  assert.equal(
    provider.extractionStrategy,
    'verified-first-party-careers-domain+public-greenhouse-jobs-api+india-location-filter',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.verifiedOn, '2026-08-04')
  assert.match(provider.dryRunFile, /pinterest[\\/]jobs\.json$/i)
  assert.equal(provider.modulePath, modulePath)
  assert.match(provider.verifiedSurfaceSummary, /Tuesday, August 4, 2026/i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/www\.pinterestcareers\.com\/jobs\//i)
  assert.match(
    provider.verifiedSurfaceSummary,
    /https:\/\/boards-api\.greenhouse\.io\/v1\/boards\/pinterest\/jobs\?content=true/i,
  )
  assert.match(provider.verifiedSurfaceSummary, /\b218\b/i)
  assert.match(provider.verifiedSurfaceSummary, /zero India roles/i)
  assert.match(provider.verifiedSurfaceSummary, /Just a moment/i)
  assert.equal(Object.prototype.hasOwnProperty.call(companyAliases, 'Pinterest'), false)

  assert.equal(pinterest.PROVIDER_METADATA.source, PINTEREST_CATALOG.source)
  assert.equal(pinterest.PROVIDER_METADATA.companyName, PINTEREST_CATALOG.companyName)
  assert.equal(
    pinterest.PROVIDER_METADATA.greenhouseJobsApiUrl,
    PINTEREST_CATALOG.greenhouseJobsApiUrl,
  )
})

test('Pinterest exact backlog row matches directly from local provider metadata', async () => {
  const { PINTEREST_CATALOG } = await loadCatalogModule()
  const report = generateCompanyCoverageReport({
    csvText: 'Pinterest\n',
    catalog: [hydrateProviderCatalogEntry(PINTEREST_CATALOG)],
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Pinterest', 'pinterest', 'Pinterest']],
  )
})

test('getScraperCatalog exposes Pinterest as a runnable shared provider without alias churn', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'pinterest')
  const scraper = buildScrapers().find((item) => item.name === 'pinterest')

  assert.ok(provider)
  assert.ok(scraper)
  assert.equal(provider.companyName, 'Pinterest')
  assert.equal(provider.companyCareerPage, 'https://www.pinterestcareers.com/jobs/')
  assert.equal(Object.prototype.hasOwnProperty.call(companyAliases, 'Pinterest'), false)

  const report = generateCompanyCoverageReport({
    csvText: 'Pinterest\n',
    catalog: getScraperCatalog(),
    aliasMap: companyAliases,
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Pinterest', 'pinterest', 'Pinterest']],
  )
})

test('Pinterest hydrated local catalog stays script-runner compatible for shared registry integration', async () => {
  const { PINTEREST_CATALOG } = await loadCatalogModule()
  const provider = hydrateProviderCatalogEntry(PINTEREST_CATALOG)
  const module = await import(pathToFileURL(provider.modulePath).href)

  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyName, 'Pinterest')
  assert.equal(provider.companyCareerPage, 'https://www.pinterestcareers.com/jobs/')
  assert.equal(provider.companyDomain, 'pinterestcareers.com')
  assert.equal(provider.atsPlatform, 'greenhouse')
  assert.match(provider.modulePath, /pinterest[\\/]script\.js$/i)
  assert.match(provider.dryRunFile, /pinterest[\\/]jobs\.json$/i)
  assert.equal(typeof module.run, 'function')
})
