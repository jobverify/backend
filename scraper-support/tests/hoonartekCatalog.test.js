import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { buildScrapers, getScraperCatalog, hydrateProviderCatalogEntry } from '../providers/index.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const modulePath = path.resolve(currentDir, '../../scraper/hoonartek/script.js')

const loadCatalogModule = async () => {
  try {
    return await import('../../scraper/hoonartek/catalog.js')
  } catch {
    assert.fail('Expected Hoonartek catalog module at ../../scraper/hoonartek/catalog.js')
  }
}

const loadHoonartekModule = async () => {
  try {
    return await import('../../scraper/hoonartek/script.js')
  } catch {
    assert.fail('Expected Hoonartek scraper module at ../../scraper/hoonartek/script.js')
  }
}

const buildCatalogReadyProvider = (catalogEntry) => hydrateProviderCatalogEntry({
  ...catalogEntry,
  modulePath,
})

test('Hoonartek local catalog captures the verified first-party careers page and SenseHQ India jobs surface', async () => {
  const { HOONARTEK_CATALOG } = await loadCatalogModule()
  const hoonartek = await loadHoonartekModule()
  const provider = buildCatalogReadyProvider(HOONARTEK_CATALOG)

  assert.equal(provider.source, 'hoonartek')
  assert.equal(provider.companyName, 'Hoonartek')
  assert.equal(provider.officialBrandName, 'Hoonartek')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyCareerPage, 'https://hoonartek.com/company/career/')
  assert.equal(provider.officialJobsApiUrl, 'https://hoonartek.sensehq.com/careers/api/postings')
  assert.equal(provider.publicJobDetailBaseUrl, 'https://hoonartek.sensehq.com/careers/jobs/')
  assert.equal(provider.publicJobDetailApiBaseUrl, 'https://hoonartek.sensehq.com/careers/api/postings/')
  assert.equal(provider.atsPlatform, 'sensehq')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'single-public-postings-api-with-per-job-detail-fetch')
  assert.equal(
    provider.extractionStrategy,
    'verified-first-party-careers-page+embedded-sensehq-postings-api+public-sensehq-detail-api+india-office-country-filter',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.companyDomain, 'hoonartek.com')
  assert.equal(provider.verifiedOn, '2026-07-16')
  assert.equal(provider.verifiedPublicPostingCount, 58)
  assert.equal(provider.verifiedIndiaRoleCount, 9)
  assert.equal(provider.verifiedSampleJobUrl, 'https://hoonartek.sensehq.com/careers/jobs/55244')
  assert.match(provider.dryRunFile, /hoonartek[\\/]jobs\.json$/i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/hoonartek\.com\/company\/career\//i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/hoonartek\.sensehq\.com\/careers\/api\/postings/i)
  assert.match(provider.verifiedSurfaceSummary, /58 public postings/i)
  assert.match(provider.verifiedSurfaceSummary, /9 India roles/i)
  assert.match(provider.verifiedSurfaceSummary, /Azure Data Engineer/i)
  assert.equal(provider.modulePath, modulePath)

  assert.equal(hoonartek.PROVIDER_METADATA.source, HOONARTEK_CATALOG.source)
  assert.equal(hoonartek.PROVIDER_METADATA.companyName, HOONARTEK_CATALOG.companyName)
  assert.equal(hoonartek.PROVIDER_METADATA.officialJobsApiUrl, HOONARTEK_CATALOG.officialJobsApiUrl)
})

test('Hoonartek exact backlog row resolves from the local provider contract without alias churn', async () => {
  const { HOONARTEK_CATALOG } = await loadCatalogModule()
  const report = generateCompanyCoverageReport({
    csvText: 'Hoonartek\n',
    catalog: [buildCatalogReadyProvider(HOONARTEK_CATALOG)],
    aliasMap: {},
  })

  assert.equal(report.totalRows, 1)
  assert.equal(report.candidateRows, 1)
  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Hoonartek', 'hoonartek', 'Hoonartek']],
  )
})

test('getScraperCatalog includes Hoonartek as a verified SenseHQ provider', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'hoonartek')

  assert.ok(provider)
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyName, 'Hoonartek')
  assert.equal(provider.companyCareerPage, 'https://hoonartek.com/company/career/')
  assert.equal(provider.companyDomain, 'hoonartek.com')
  assert.equal(provider.atsPlatform, 'sensehq')
  assert.match(provider.modulePath, /hoonartek[\\/]script\.js$/i)
})

test('buildScrapers exposes a runnable Hoonartek scraper without changing the runner contract', () => {
  const scraper = buildScrapers().find((item) => item.name === 'hoonartek')

  assert.ok(scraper)
  assert.equal(typeof scraper.run, 'function')
  assert.equal(scraper.provider.source, 'hoonartek')
  assert.equal(scraper.provider.atsPlatform, 'sensehq')
  assert.match(scraper.dryRunFile, /hoonartek[\\/]jobs\.json$/i)
})
