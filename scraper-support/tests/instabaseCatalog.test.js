import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { buildScrapers, getScraperCatalog, hydrateProviderCatalogEntry } from '../providers/index.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const instabaseModulePath = path.resolve(currentDir, '../../scraper/instabase/script.js')

const loadInstabaseCatalog = async () => {
  try {
    return await import('../../scraper/instabase/catalog.js')
  } catch {
    assert.fail('Expected Instabase catalog module at ../../scraper/instabase/catalog.js')
  }
}

const loadInstabaseModule = async () => {
  try {
    return await import('../../scraper/instabase/script.js')
  } catch {
    assert.fail('Expected Instabase scraper module at ../../scraper/instabase/script.js')
  }
}

test('Instabase local catalog captures the verified first-party careers pages and Greenhouse India jobs surface without aliases', async () => {
  const { INSTABASE_CATALOG } = await loadInstabaseCatalog()
  const instabase = await loadInstabaseModule()
  const provider = hydrateProviderCatalogEntry(INSTABASE_CATALOG)

  assert.equal(provider.source, 'instabase')
  assert.equal(provider.companyName, 'Instabase')
  assert.equal(provider.officialBrandName, 'Instabase')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyCareerPage, 'https://www.instabase.com/careers/jobs')
  assert.equal(provider.officialCareersLandingUrl, 'https://www.instabase.com/careers')
  assert.equal(provider.greenhouseBoardUrl, 'https://job-boards.greenhouse.io/instabase')
  assert.equal(provider.greenhouseJobsApiUrl, 'https://boards-api.greenhouse.io/v1/boards/instabase/jobs')
  assert.equal(provider.atsPlatform, 'greenhouse')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'single-greenhouse-jobs-api-content-page')
  assert.equal(
    provider.extractionStrategy,
    'verified-first-party-careers-pages+greenhouse-jobs-api+india-location-filter',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.companyDomain, 'instabase.com')
  assert.equal(provider.verifiedOn, '2026-07-16')
  assert.match(provider.dryRunFile, /instabase[\\/]jobs\.json$/i)
  assert.match(provider.modulePath, /instabase[\\/]script\.js$/i)
  assert.equal(provider.modulePath, instabaseModulePath)
  assert.match(provider.verifiedSurfaceSummary, /July 16, 2026/i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/www\.instabase\.com\/careers/i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/www\.instabase\.com\/careers\/jobs/i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/boards-api\.greenhouse\.io\/v1\/boards\/instabase\/jobs\?content=true/i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/job-boards\.greenhouse\.io\/instabase\/jobs\/8560504002/i)
  assert.match(provider.verifiedSurfaceSummary, /Bengaluru, India/i)
  assert.equal(instabase.PROVIDER_METADATA.source, INSTABASE_CATALOG.source)
  assert.equal(instabase.PROVIDER_METADATA.companyName, INSTABASE_CATALOG.companyName)
  assert.equal(
    instabase.PROVIDER_METADATA.greenhouseJobsApiUrl,
    INSTABASE_CATALOG.greenhouseJobsApiUrl,
  )
})

test('Instabase backlog row matches directly from local provider metadata without alias churn', async () => {
  const { INSTABASE_CATALOG } = await loadInstabaseCatalog()
  const report = generateCompanyCoverageReport({
    csvText: 'Instabase\n',
    catalog: [hydrateProviderCatalogEntry(INSTABASE_CATALOG)],
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Instabase', 'instabase', 'Instabase']],
  )
})

test('getScraperCatalog includes Instabase as a verified Greenhouse provider', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'instabase')

  assert.ok(provider)
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyName, 'Instabase')
  assert.equal(provider.companyCareerPage, 'https://www.instabase.com/careers/jobs')
  assert.equal(provider.companyDomain, 'instabase.com')
  assert.equal(provider.atsPlatform, 'greenhouse')
  assert.match(provider.modulePath, /instabase[\\/]script\.js$/i)
})

test('buildScrapers exposes a runnable Instabase scraper without changing the runner contract', () => {
  const scraper = buildScrapers().find((item) => item.name === 'instabase')

  assert.ok(scraper)
  assert.equal(typeof scraper.run, 'function')
  assert.equal(scraper.provider.source, 'instabase')
  assert.equal(scraper.provider.atsPlatform, 'greenhouse')
  assert.match(scraper.dryRunFile, /instabase[\\/]jobs\.json$/i)
})
