import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { buildScrapers, getScraperCatalog, hydrateProviderCatalogEntry } from '../providers/index.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const modulePath = path.resolve(currentDir, '../../scraper/harness/script.js')

const loadCatalogModule = async () => {
  try {
    return await import('../../scraper/harness/catalog.js')
  } catch {
    assert.fail('Expected Harness catalog module at ../../scraper/harness/catalog.js')
  }
}

const loadHarnessModule = async () => {
  try {
    return await import('../../scraper/harness/script.js')
  } catch {
    assert.fail('Expected Harness scraper module at ../../scraper/harness/script.js')
  }
}

const buildCatalogReadyProvider = (catalogEntry) => hydrateProviderCatalogEntry({
  ...catalogEntry,
  modulePath,
})

test('Harness local catalog captures the verified first-party careers pages and Greenhouse India jobs surface', async () => {
  const { HARNESS_CATALOG } = await loadCatalogModule()
  const harness = await loadHarnessModule()
  const provider = buildCatalogReadyProvider(HARNESS_CATALOG)

  assert.equal(provider.source, 'harness')
  assert.equal(provider.companyName, 'Harness')
  assert.equal(provider.officialBrandName, 'Harness')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyCareerPage, 'https://www.harness.io/company/jobs')
  assert.equal(provider.officialCareersPageUrl, 'https://www.harness.io/company/careers')
  assert.equal(provider.greenhouseBoardUrl, 'https://boards.greenhouse.io/harnessinc')
  assert.equal(
    provider.greenhouseJobsApiUrl,
    'https://boards-api.greenhouse.io/v1/boards/harnessinc/jobs',
  )
  assert.equal(provider.atsPlatform, 'greenhouse')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'single-greenhouse-jobs-api-content-page')
  assert.equal(
    provider.extractionStrategy,
    'verified-first-party-jobs-page+verified-first-party-careers-page+greenhouse-jobs-api+first-party-apply-url-canonicalization+india-location-filter',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.companyDomain, 'harness.io')
  assert.equal(provider.verifiedOn, '2026-07-16')
  assert.equal(provider.verifiedPublicPostingCount, 108)
  assert.equal(provider.verifiedIndiaRoleCount, 31)
  assert.match(provider.dryRunFile, /harness[\\/]jobs\.json$/i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/www\.harness\.io\/company\/jobs/i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/www\.harness\.io\/company\/careers/i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/boards-api\.greenhouse\.io\/v1\/boards\/harnessinc\/jobs\?content=true/i)
  assert.match(provider.verifiedSurfaceSummary, /Director of Quality Engineering & Automation/i)
  assert.equal(provider.modulePath, modulePath)

  assert.equal(harness.PROVIDER_METADATA.source, HARNESS_CATALOG.source)
  assert.equal(harness.PROVIDER_METADATA.companyName, HARNESS_CATALOG.companyName)
  assert.equal(
    harness.PROVIDER_METADATA.greenhouseJobsApiUrl,
    HARNESS_CATALOG.greenhouseJobsApiUrl,
  )
})

test('Harness exact backlog row resolves from the local provider contract without alias churn', async () => {
  const { HARNESS_CATALOG } = await loadCatalogModule()
  const report = generateCompanyCoverageReport({
    csvText: 'Harness\n',
    catalog: [buildCatalogReadyProvider(HARNESS_CATALOG)],
    aliasMap: {},
  })

  assert.equal(report.totalRows, 1)
  assert.equal(report.candidateRows, 1)
  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Harness', 'harness', 'Harness']],
  )
})

test('getScraperCatalog includes Harness as a verified Greenhouse provider', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'harness')

  assert.ok(provider)
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyName, 'Harness')
  assert.equal(provider.companyCareerPage, 'https://www.harness.io/company/jobs')
  assert.equal(provider.companyDomain, 'harness.io')
  assert.equal(provider.atsPlatform, 'greenhouse')
  assert.match(provider.modulePath, /harness[\\/]script\.js$/i)
})

test('buildScrapers exposes a runnable Harness scraper without changing the runner contract', () => {
  const scraper = buildScrapers().find((item) => item.name === 'harness')

  assert.ok(scraper)
  assert.equal(typeof scraper.run, 'function')
  assert.equal(scraper.provider.source, 'harness')
  assert.equal(scraper.provider.atsPlatform, 'greenhouse')
  assert.match(scraper.dryRunFile, /harness[\\/]jobs\.json$/i)
})
