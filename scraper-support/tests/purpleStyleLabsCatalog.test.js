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
const modulePath = path.resolve(currentDir, '../../scraper/purplestylelabs/script.js')

const loadCatalogModule = async () => {
  try {
    return await import('../../scraper/purplestylelabs/catalog.js')
  } catch {
    assert.fail('Expected Purple Style Labs catalog module at ../../scraper/purplestylelabs/catalog.js')
  }
}

const loadScraperModule = async () => {
  try {
    return await import('../../scraper/purplestylelabs/script.js')
  } catch {
    assert.fail('Expected Purple Style Labs scraper module at ../../scraper/purplestylelabs/script.js')
  }
}

test('Purple Style Labs local catalog captures the verified first-party careers page and LinkedIn jobs handoff sentinel contract', async () => {
  const { PURPLE_STYLE_LABS_CATALOG, default: defaultCatalog } = await loadCatalogModule()
  const purpleStyleLabs = await loadScraperModule()
  const provider = hydrateProviderCatalogEntry(PURPLE_STYLE_LABS_CATALOG)

  assert.equal(defaultCatalog, PURPLE_STYLE_LABS_CATALOG)
  assert.equal(provider.source, 'purplestylelabs')
  assert.equal(provider.companyName, 'Purple Style Labs')
  assert.equal(provider.officialBrandName, 'Purple Style Labs')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.homepageUrl, 'https://www.purplestylelabs.com/')
  assert.equal(provider.companyCareerPage, 'https://www.purplestylelabs.com/careers')
  assert.equal(provider.officialCareersEmail, 'careers@purplestylelabs.com')
  assert.equal(provider.officialLinkedInJobsHost, 'https://www.linkedin.com/jobs/search/')
  assert.equal(provider.officialLinkedInCompanyId, '10277228')
  assert.equal(provider.officialLinkedInCompanyLabel, 'Purple Style Labs (PSL)')
  assert.equal(provider.companyDomain, 'purplestylelabs.com')
  assert.equal(provider.atsPlatform, 'official-company-careers-linkedin-jobs-handoff-no-first-party-jobs-board')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'official-careers-page-validation-only')
  assert.equal(
    provider.extractionStrategy,
    'verified-first-party-careers-page+linkedin-jobs-search-handoff-return-empty',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.verifiedOn, '2026-08-04')
  assert.equal(provider.modulePath, modulePath)
  assert.match(provider.dryRunFile, /purplestylelabs[\\/]jobs\.json$/i)
  assert.match(provider.verifiedSurfaceSummary, /Tuesday, August 4, 2026/i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/www\.purplestylelabs\.com\/careers/i)
  assert.match(provider.verifiedSurfaceSummary, /careers@purplestylelabs\.com/i)
  assert.match(provider.verifiedSurfaceSummary, /linkedin/i)
  assert.match(provider.verifiedSurfaceSummary, /10277228/i)
  assert.match(provider.verifiedSurfaceSummary, /page title now renders as Purple Style Labs/i)
  assert.equal(Object.prototype.hasOwnProperty.call(companyAliases, 'Purple Style Labs'), false)

  assert.equal(purpleStyleLabs.PROVIDER_METADATA.source, PURPLE_STYLE_LABS_CATALOG.source)
  assert.equal(
    purpleStyleLabs.PROVIDER_METADATA.companyName,
    PURPLE_STYLE_LABS_CATALOG.companyName,
  )
  assert.equal(
    purpleStyleLabs.PROVIDER_METADATA.officialLinkedInCompanyId,
    PURPLE_STYLE_LABS_CATALOG.officialLinkedInCompanyId,
  )
})

test('Purple Style Labs exact backlog row resolves directly from local provider metadata', async () => {
  const { PURPLE_STYLE_LABS_CATALOG } = await loadCatalogModule()
  const report = generateCompanyCoverageReport({
    csvText: 'Purple Style Labs\n',
    catalog: [hydrateProviderCatalogEntry(PURPLE_STYLE_LABS_CATALOG)],
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Purple Style Labs', 'purplestylelabs', 'Purple Style Labs']],
  )
})

test('getScraperCatalog exposes Purple Style Labs as a runnable shared provider without alias churn', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'purplestylelabs')
  const scraper = buildScrapers().find((item) => item.name === 'purplestylelabs')

  assert.ok(provider)
  assert.ok(scraper)
  assert.equal(provider.companyName, 'Purple Style Labs')
  assert.equal(provider.companyCareerPage, 'https://www.purplestylelabs.com/careers')
  assert.equal(Object.prototype.hasOwnProperty.call(companyAliases, 'Purple Style Labs'), false)

  const report = generateCompanyCoverageReport({
    csvText: 'Purple Style Labs\n',
    catalog: getScraperCatalog(),
    aliasMap: companyAliases,
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Purple Style Labs', 'purplestylelabs', 'Purple Style Labs']],
  )
})

test('Purple Style Labs hydrated local catalog stays script-runner compatible for shared registry integration', async () => {
  const { PURPLE_STYLE_LABS_CATALOG } = await loadCatalogModule()
  const provider = hydrateProviderCatalogEntry(PURPLE_STYLE_LABS_CATALOG)
  const module = await import(pathToFileURL(provider.modulePath).href)

  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyName, 'Purple Style Labs')
  assert.equal(provider.companyCareerPage, 'https://www.purplestylelabs.com/careers')
  assert.equal(provider.companyDomain, 'purplestylelabs.com')
  assert.match(provider.modulePath, /purplestylelabs[\\/]script\.js$/i)
  assert.match(provider.dryRunFile, /purplestylelabs[\\/]jobs\.json$/i)
  assert.equal(typeof module.run, 'function')
})
