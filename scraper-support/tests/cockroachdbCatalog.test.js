import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import { getCompanyAliasMap, generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { buildScrapers, getScraperCatalog, hydrateProviderCatalogEntry } from '../providers/index.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const modulePath = path.resolve(currentDir, '../../scraper/cockroachdb/script.js')

const loadCatalogModule = async () => {
  try {
    return await import('../../scraper/cockroachdb/catalog.js')
  } catch {
    assert.fail('Expected CockroachDB catalog module at ../../scraper/cockroachdb/catalog.js')
  }
}

const loadScraperModule = async () => {
  try {
    return await import('../../scraper/cockroachdb/script.js')
  } catch {
    assert.fail('Expected CockroachDB scraper module at ../../scraper/cockroachdb/script.js')
  }
}

test('CockroachDB local catalog captures the verified first-party careers surface and Greenhouse board', async () => {
  const { COCKROACHDB_CATALOG, default: defaultCatalog } = await loadCatalogModule()
  const cockroachdb = await loadScraperModule()
  const provider = hydrateProviderCatalogEntry(COCKROACHDB_CATALOG)

  assert.equal(defaultCatalog, COCKROACHDB_CATALOG)
  assert.equal(provider.source, 'cockroachdb')
  assert.equal(provider.companyName, 'CockroachDB')
  assert.equal(provider.officialBrandName, 'Cockroach Labs')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.officialCareersLandingUrl, 'https://www.cockroachlabs.com/careers/')
  assert.equal(provider.companyCareerPage, 'https://www.cockroachlabs.com/careers/open-positions/')
  assert.equal(provider.greenhouseBoardUrl, 'https://job-boards.greenhouse.io/cockroachlabs')
  assert.equal(
    provider.greenhouseJobsApiUrl,
    'https://boards-api.greenhouse.io/v1/boards/cockroachlabs/jobs',
  )
  assert.equal(provider.atsPlatform, 'greenhouse')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'single-greenhouse-jobs-api-content-page')
  assert.equal(
    provider.extractionStrategy,
    'verified-first-party-careers-pages+verified-greenhouse-ats-handoff+greenhouse-jobs-api+india-location-filter',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.companyDomain, 'cockroachlabs.com')
  assert.equal(provider.verifiedOn, '2026-07-25')
  assert.equal(provider.modulePath, modulePath)
  assert.match(provider.dryRunFile, /cockroachdb[\\/]jobs\.json$/i)
  assert.match(provider.verifiedSurfaceSummary, /Saturday, July 25, 2026/i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/www\.cockroachlabs\.com\/careers\//i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/www\.cockroachlabs\.com\/careers\/open-positions\//i)
  assert.match(provider.verifiedSurfaceSummary, /Applicant Tracking System \(in this case, Greenhouse\)/i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/job-boards\.greenhouse\.io\/cockroachlabs/i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/boards-api\.greenhouse\.io\/v1\/boards\/cockroachlabs\/jobs\?content=true/i)
  assert.match(provider.verifiedSurfaceSummary, /Manager, Engineering/i)
  assert.match(provider.verifiedSurfaceSummary, /Senior Partner Sales Manager, ISV & GSIs/i)
  assert.equal(cockroachdb.PROVIDER_METADATA.source, COCKROACHDB_CATALOG.source)
  assert.equal(cockroachdb.PROVIDER_METADATA.companyName, COCKROACHDB_CATALOG.companyName)
  assert.equal(
    cockroachdb.PROVIDER_METADATA.greenhouseJobsApiUrl,
    COCKROACHDB_CATALOG.greenhouseJobsApiUrl,
  )
})

test('CockroachDB and Cockroach Labs backlog rows resolve to the same provider through the dedicated alias extension', () => {
  const aliases = getCompanyAliasMap()
  const report = generateCompanyCoverageReport({
    csvText: 'company_name\nCockroachDB\nCockroach Labs\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(aliases['Cockroach Labs'], 'cockroachdb')
  assert.equal(report.matchedCount, 2)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [
      ['CockroachDB', 'cockroachdb', 'CockroachDB'],
      ['Cockroach Labs', 'cockroachdb', 'CockroachDB'],
    ],
  )
})

test('getScraperCatalog includes CockroachDB as a runnable Greenhouse provider', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'cockroachdb')

  assert.ok(provider)
  assert.equal(provider.companyName, 'CockroachDB')
  assert.equal(provider.companyCareerPage, 'https://www.cockroachlabs.com/careers/open-positions/')
  assert.equal(provider.atsPlatform, 'greenhouse')
  assert.match(provider.modulePath, /cockroachdb[\\/]script\.js$/i)
})

test('buildScrapers exposes a runnable CockroachDB scraper without changing the runner contract', () => {
  const scraper = buildScrapers().find((item) => item.name === 'cockroachdb')

  assert.ok(scraper)
  assert.equal(typeof scraper.run, 'function')
  assert.equal(scraper.provider.source, 'cockroachdb')
  assert.match(scraper.dryRunFile, /cockroachdb[\\/]jobs\.json$/i)
})
