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
const modulePath = path.resolve(currentDir, '../../scraper/sharekhan/script.js')

const loadCatalogModule = async () => {
  try {
    return await import('../../scraper/sharekhan/catalog.js')
  } catch {
    assert.fail('Expected Sharekhan catalog module at ../../scraper/sharekhan/catalog.js')
  }
}

const loadScraperModule = async () => {
  try {
    return await import('../../scraper/sharekhan/script.js')
  } catch {
    assert.fail('Expected Sharekhan scraper module at ../../scraper/sharekhan/script.js')
  }
}

test('Sharekhan local catalog captures the verified first-party careers table and detail-page contract', async () => {
  const { SHAREKHAN_CATALOG, default: defaultCatalog } = await loadCatalogModule()
  const sharekhan = await loadScraperModule()
  const provider = hydrateProviderCatalogEntry(SHAREKHAN_CATALOG)

  assert.equal(defaultCatalog, SHAREKHAN_CATALOG)
  assert.equal(provider.source, 'sharekhan')
  assert.equal(provider.companyName, 'Sharekhan')
  assert.equal(provider.officialBrandName, 'Mirae Asset Sharekhan')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.homepageUrl, 'https://www.sharekhan.com/')
  assert.equal(provider.companyCareerPage, 'https://www.sharekhan.com/careers')
  assert.equal(provider.companyDomain, 'sharekhan.com')
  assert.equal(provider.listingTableUrl, 'https://www.sharekhan.com/careers')
  assert.equal(
    provider.verifiedSampleJobUrl,
    'https://www.sharekhan.com/careers/job-details/senior-manager-campaign-management-290029',
  )
  assert.equal(provider.atsPlatform, 'official-company-careers-inline-job-table')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'single-first-party-careers-table-plus-detail-pages')
  assert.equal(
    provider.extractionStrategy,
    'verified-first-party-careers-page+inline-job-table+first-party-detail-pages',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.verifiedOn, '2026-07-17')
  assert.equal(provider.modulePath, modulePath)
  assert.match(provider.dryRunFile, /sharekhan[\\/]jobs\.json$/i)
  assert.match(provider.verifiedSurfaceSummary, /Friday, July 17, 2026/i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/www\.sharekhan\.com\/careers/i)
  assert.match(provider.verifiedSurfaceSummary, /Senior Manager - Campaign Management/i)
  assert.match(provider.verifiedSurfaceSummary, /UI\/UX Designer/i)
  assert.equal(Object.prototype.hasOwnProperty.call(companyAliases, 'Sharekhan'), false)

  assert.equal(sharekhan.PROVIDER_METADATA.source, SHAREKHAN_CATALOG.source)
  assert.equal(sharekhan.CAREERS_URL, SHAREKHAN_CATALOG.companyCareerPage)
  assert.equal(sharekhan.LISTING_TABLE_URL, SHAREKHAN_CATALOG.listingTableUrl)
})

test('Sharekhan exact backlog row resolves directly from local provider metadata', async () => {
  const { SHAREKHAN_CATALOG } = await loadCatalogModule()
  const report = generateCompanyCoverageReport({
    csvText: 'Sharekhan\n',
    catalog: [hydrateProviderCatalogEntry(SHAREKHAN_CATALOG)],
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Sharekhan', 'sharekhan', 'Sharekhan']],
  )
})

test('getScraperCatalog exposes Sharekhan as a runnable shared provider without alias churn', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'sharekhan')
  const scraper = buildScrapers().find((item) => item.name === 'sharekhan')

  assert.ok(provider)
  assert.ok(scraper)
  assert.equal(provider.companyName, 'Sharekhan')
  assert.equal(provider.companyCareerPage, 'https://www.sharekhan.com/careers')
  assert.equal(Object.prototype.hasOwnProperty.call(companyAliases, 'Sharekhan'), false)

  const report = generateCompanyCoverageReport({
    csvText: 'Sharekhan\n',
    catalog: getScraperCatalog(),
    aliasMap: companyAliases,
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Sharekhan', 'sharekhan', 'Sharekhan']],
  )
})

test('Sharekhan hydrated local catalog stays script-runner compatible for shared registry integration', async () => {
  const { SHAREKHAN_CATALOG } = await loadCatalogModule()
  const provider = hydrateProviderCatalogEntry(SHAREKHAN_CATALOG)
  const module = await import(pathToFileURL(provider.modulePath).href)

  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyName, 'Sharekhan')
  assert.equal(provider.companyCareerPage, 'https://www.sharekhan.com/careers')
  assert.equal(provider.companyDomain, 'sharekhan.com')
  assert.match(provider.modulePath, /sharekhan[\\/]script\.js$/i)
  assert.match(provider.dryRunFile, /sharekhan[\\/]jobs\.json$/i)
  assert.equal(typeof module.run, 'function')
})
