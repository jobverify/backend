import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import companyAliases from '../providers/companyAliases.json' with { type: 'json' }
import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { buildScrapers, getScraperCatalog, hydrateProviderCatalogEntry } from '../providers/index.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const iitmResearchParkModulePath = path.resolve(currentDir, '../../scraper/iitmresearchpark/script.js')

const loadCatalogModule = async () => {
  try {
    return await import('../../scraper/iitmresearchpark/catalog.js')
  } catch {
    assert.fail('Expected IITM Research Park catalog module at ../../scraper/iitmresearchpark/catalog.js')
  }
}

const loadScriptModule = async () => {
  try {
    return await import('../../scraper/iitmresearchpark/script.js')
  } catch {
    assert.fail('Expected IITM Research Park scraper module at ../../scraper/iitmresearchpark/script.js')
  }
}

test('IITM Research Park local catalog captures the verified first-party careers page without alias churn', async () => {
  const { IITM_RESEARCH_PARK_CATALOG } = await loadCatalogModule()
  const iitmResearchPark = await loadScriptModule()
  const provider = hydrateProviderCatalogEntry(IITM_RESEARCH_PARK_CATALOG)

  assert.equal(provider.source, 'iitmresearchpark')
  assert.equal(provider.companyName, 'IITM Research Park')
  assert.equal(provider.officialBrandName, 'IIT Madras Research Park')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyCareerPage, 'https://respark.iitm.ac.in/careers/')
  assert.deepEqual(provider.observedJobTitles, [
    'Electrical Engineer - Maintenance & Projects (3 Positions)',
    'Project Manager - Zoho Implementation',
    'Construction Manager - Civil',
    'Senior Manager - Legal',
    'Executive - Research Collaboration',
  ])
  assert.deepEqual(provider.observedClosingDates, [
    '2026-07-09',
    '2026-07-15',
    '2026-07-15',
    '2026-08-15',
    '2026-07-31',
  ])
  assert.equal(provider.atsPlatform, 'official-company-careers')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'single-first-party-careers-page')
  assert.equal(
    provider.extractionStrategy,
    'first-party-careers-card-extraction+closing-date-live-filter',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.companyDomain, 'respark.iitm.ac.in')
  assert.equal(provider.verifiedOn, '2026-08-02')
  assert.match(provider.dryRunFile, /iitmresearchpark[\\/]jobs\.json$/i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/respark\.iitm\.ac\.in\/careers\//i)
  assert.match(provider.verifiedSurfaceSummary, /five public job cards/i)
  assert.match(provider.verifiedSurfaceSummary, /July 09, 2026/i)
  assert.match(provider.verifiedSurfaceSummary, /July 15, 2026/i)
  assert.match(provider.verifiedSurfaceSummary, /August 15, 2026/i)
  assert.match(provider.verifiedSurfaceSummary, /Senior Manager - Legal/i)
  assert.equal(provider.modulePath, iitmResearchParkModulePath)
  assert.equal(Object.prototype.hasOwnProperty.call(companyAliases, 'IITM Research Park'), false)

  assert.equal(
    iitmResearchPark.PROVIDER_METADATA.source,
    IITM_RESEARCH_PARK_CATALOG.source,
  )
  assert.equal(
    iitmResearchPark.PROVIDER_METADATA.companyName,
    IITM_RESEARCH_PARK_CATALOG.companyName,
  )
  assert.deepEqual(
    iitmResearchPark.PROVIDER_METADATA.observedClosingDates,
    IITM_RESEARCH_PARK_CATALOG.observedClosingDates,
  )
})

test('IITM Research Park backlog row matches directly from the local catalog without alias churn', async () => {
  const { IITM_RESEARCH_PARK_CATALOG } = await loadCatalogModule()
  const report = generateCompanyCoverageReport({
    csvText: 'IITM Research Park\n',
    catalog: [hydrateProviderCatalogEntry(IITM_RESEARCH_PARK_CATALOG)],
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['IITM Research Park', 'iitmresearchpark', 'IITM Research Park']],
  )
})

test('getScraperCatalog includes IITM Research Park as a verified first-party careers provider', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'iitmresearchpark')

  assert.ok(provider)
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyName, 'IITM Research Park')
  assert.equal(provider.companyCareerPage, 'https://respark.iitm.ac.in/careers/')
  assert.equal(provider.companyDomain, 'respark.iitm.ac.in')
  assert.equal(provider.atsPlatform, 'official-company-careers')
  assert.match(provider.modulePath, /iitmresearchpark[\\/]script\.js$/i)
})

test('buildScrapers exposes a runnable IITM Research Park scraper without changing the runner contract', () => {
  const scraper = buildScrapers().find((item) => item.name === 'iitmresearchpark')

  assert.ok(scraper)
  assert.equal(typeof scraper.run, 'function')
  assert.equal(scraper.provider.source, 'iitmresearchpark')
  assert.equal(scraper.provider.atsPlatform, 'official-company-careers')
  assert.match(scraper.dryRunFile, /iitmresearchpark[\\/]jobs\.json$/i)
})
