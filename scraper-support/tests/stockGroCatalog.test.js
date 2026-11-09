import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { hydrateProviderCatalogEntry } from '../providers/index.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const modulePath = path.resolve(currentDir, '../../scraper/stockgro/script.js')

const loadCatalogModule = async () => {
  try {
    return await import('../../scraper/stockgro/catalog.js')
  } catch {
    assert.fail('Expected StockGro catalog module at ../../scraper/stockgro/catalog.js')
  }
}

const loadScriptModule = async () => {
  try {
    return await import('../../scraper/stockgro/script.js')
  } catch {
    assert.fail('Expected StockGro scraper module at ../../scraper/stockgro/script.js')
  }
}

test('StockGro local catalog captures the verified exact-name no-public-jobs surface', async () => {
  const { STOCKGRO_CATALOG } = await loadCatalogModule()
  const stockGro = await loadScriptModule()
  const provider = hydrateProviderCatalogEntry(STOCKGRO_CATALOG)

  assert.equal(STOCKGRO_CATALOG.source, 'stockgro')
  assert.equal(STOCKGRO_CATALOG.companyName, 'StockGro')
  assert.equal(STOCKGRO_CATALOG.officialBrandName, 'StockGro')
  assert.equal(STOCKGRO_CATALOG.adapter, 'script')
  assert.equal(STOCKGRO_CATALOG.modulePath, modulePath)
  assert.equal(STOCKGRO_CATALOG.dryRunFile, 'stockgro/jobs.json')
  assert.equal(STOCKGRO_CATALOG.homepageUrl, 'https://www.stockgro.club/')
  assert.equal(STOCKGRO_CATALOG.companyCareerPage, 'https://www.stockgro.club/careers/')
  assert.equal(STOCKGRO_CATALOG.officialOperatingEntity, 'Assetgro Fintech Private Limited')
  assert.equal(STOCKGRO_CATALOG.companyDomain, 'stockgro.club')
  assert.equal(STOCKGRO_CATALOG.atsPlatform, 'official-company-site-no-public-careers')
  assert.equal(STOCKGRO_CATALOG.countryFilter, 'India')
  assert.equal(
    STOCKGRO_CATALOG.paginationStrategy,
    'verified-careers-page-without-public-job-links-or-ats-handoff',
  )
  assert.equal(
    STOCKGRO_CATALOG.extractionStrategy,
    'verified-first-party-careers-page+static-openings-copy-without-trustworthy-public-jobs-return-empty',
  )
  assert.equal(STOCKGRO_CATALOG.parser, 'custom-script')
  assert.equal(STOCKGRO_CATALOG.normalizationProfile, 'engineering-default')
  assert.equal(STOCKGRO_CATALOG.verifiedOn, '2026-07-17')
  assert.match(STOCKGRO_CATALOG.verifiedSurfaceSummary, /Friday, July 17, 2026/i)
  assert.match(STOCKGRO_CATALOG.verifiedSurfaceSummary, /https:\/\/www\.stockgro\.club\/careers\//i)
  assert.match(STOCKGRO_CATALOG.verifiedSurfaceSummary, /Assetgro Fintech Private Limited/i)
  assert.match(STOCKGRO_CATALOG.verifiedSurfaceSummary, /no trustworthy public jobs surface/i)

  assert.equal(provider.source, 'stockgro')
  assert.equal(provider.companyName, 'StockGro')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyCareerPage, 'https://www.stockgro.club/careers/')
  assert.equal(provider.companyDomain, 'stockgro.club')
  assert.match(provider.modulePath, /stockgro[\\/]script\.js$/i)
  assert.match(provider.dryRunFile, /stockgro[\\/]jobs\.json$/i)

  assert.equal(stockGro.PROVIDER_METADATA.source, provider.source)
  assert.equal(stockGro.CAREERS_URL, provider.companyCareerPage)
})

test('StockGro exact-name backlog rows resolve directly from local provider metadata without aliases', async () => {
  const { STOCKGRO_CATALOG } = await loadCatalogModule()

  const report = generateCompanyCoverageReport({
    csvText: 'StockGro\n',
    catalog: [hydrateProviderCatalogEntry(STOCKGRO_CATALOG)],
    aliasMap: {},
  })

  assert.equal(report.totalRows, 1)
  assert.equal(report.candidateRows, 1)
  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['StockGro', 'stockgro', 'StockGro']],
  )
})
