import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { buildScrapers, getScraperCatalog } from '../providers/index.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const innovaccerModulePath = path.resolve(currentDir, '../../scraper/innovaccer/script.js')

const loadCatalogModule = async () => {
  try {
    return await import('../../scraper/innovaccer/catalog.js')
  } catch {
    assert.fail('Expected Innovaccer catalog module at ../../scraper/innovaccer/catalog.js')
  }
}

const loadInnovaccerModule = async () => {
  try {
    return await import('../../scraper/innovaccer/script.js')
  } catch {
    assert.fail('Expected Innovaccer scraper module at ../../scraper/innovaccer/script.js')
  }
}

test('Innovaccer local catalog captures the verified first-party careers pages and public Workable widget surface', async () => {
  const { INNOVACCER_CATALOG } = await loadCatalogModule()
  const innovaccer = await loadInnovaccerModule()

  assert.equal(INNOVACCER_CATALOG.source, 'innovaccer')
  assert.equal(INNOVACCER_CATALOG.companyName, 'Innovaccer')
  assert.equal(INNOVACCER_CATALOG.officialBrandName, 'Innovaccer')
  assert.equal(INNOVACCER_CATALOG.adapter, 'script')
  assert.equal(INNOVACCER_CATALOG.companyCareerPage, 'https://innovaccer.com/careers')
  assert.equal(INNOVACCER_CATALOG.officialCareersPageUrl, 'https://innovaccer.com/careers')
  assert.equal(INNOVACCER_CATALOG.officialJobsPageUrl, 'https://innovaccer.com/careers/jobs')
  assert.equal(INNOVACCER_CATALOG.workableAccountName, 'innovaccer-analytics')
  assert.equal(INNOVACCER_CATALOG.workableBoardUrl, 'https://apply.workable.com/innovaccer-analytics/')
  assert.equal(INNOVACCER_CATALOG.jobsFeedUrl, 'https://apply.workable.com/innovaccer-analytics/jobs.md')
  assert.equal(INNOVACCER_CATALOG.widgetApiUrl, 'https://apply.workable.com/api/v1/widget/accounts/innovaccer-analytics')
  assert.equal(INNOVACCER_CATALOG.atsPlatform, 'workable')
  assert.equal(INNOVACCER_CATALOG.countryFilter, 'India')
  assert.equal(
    INNOVACCER_CATALOG.paginationStrategy,
    'official-careers-page-plus-first-party-jobs-page-and-public-workable-widget-api',
  )
  assert.equal(
    INNOVACCER_CATALOG.extractionStrategy,
    'verified-first-party-careers-page+first-party-jobs-page+public-workable-widget-api',
  )
  assert.equal(INNOVACCER_CATALOG.parser, 'custom-script')
  assert.equal(INNOVACCER_CATALOG.normalizationProfile, 'engineering-default')
  assert.equal(INNOVACCER_CATALOG.companyDomain, 'innovaccer.com')
  assert.equal(INNOVACCER_CATALOG.verifiedOn, '2026-07-16')
  assert.match(INNOVACCER_CATALOG.dryRunFile, /innovaccer[\\/]jobs\.json$/i)
  assert.match(INNOVACCER_CATALOG.verifiedSurfaceSummary, /https:\/\/innovaccer\.com\/careers/i)
  assert.match(INNOVACCER_CATALOG.verifiedSurfaceSummary, /https:\/\/innovaccer\.com\/careers\/jobs/i)
  assert.match(INNOVACCER_CATALOG.verifiedSurfaceSummary, /apply\.workable\.com\/api\/v1\/widget\/accounts\/innovaccer-analytics/i)
  assert.match(INNOVACCER_CATALOG.verifiedSurfaceSummary, /Software Development Engineer-III Backend \(Comet\)/i)
  assert.equal(INNOVACCER_CATALOG.modulePath, innovaccerModulePath)

  assert.equal(innovaccer.PROVIDER_METADATA.source, INNOVACCER_CATALOG.source)
  assert.equal(innovaccer.PROVIDER_METADATA.companyName, INNOVACCER_CATALOG.companyName)
  assert.equal(innovaccer.PROVIDER_METADATA.widgetApiUrl, INNOVACCER_CATALOG.widgetApiUrl)
})

test('Innovaccer backlog row matches directly from the local catalog without alias churn', async () => {
  const { INNOVACCER_CATALOG } = await loadCatalogModule()
  const report = generateCompanyCoverageReport({
    csvText: 'Innovaccer\n',
    catalog: [INNOVACCER_CATALOG],
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Innovaccer', 'innovaccer', 'Innovaccer']],
  )
})

test('getScraperCatalog includes Innovaccer as a verified Workable provider', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'innovaccer')

  assert.ok(provider)
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyName, 'Innovaccer')
  assert.equal(provider.companyCareerPage, 'https://innovaccer.com/careers')
  assert.equal(provider.companyDomain, 'innovaccer.com')
  assert.equal(provider.atsPlatform, 'workable')
  assert.match(provider.modulePath, /innovaccer[\\/]script\.js$/i)
})

test('buildScrapers exposes a runnable Innovaccer scraper without changing the runner contract', () => {
  const scraper = buildScrapers().find((item) => item.name === 'innovaccer')

  assert.ok(scraper)
  assert.equal(typeof scraper.run, 'function')
  assert.equal(scraper.provider.source, 'innovaccer')
  assert.equal(scraper.provider.atsPlatform, 'workable')
  assert.match(scraper.dryRunFile, /innovaccer[\\/]jobs\.json$/i)
})
