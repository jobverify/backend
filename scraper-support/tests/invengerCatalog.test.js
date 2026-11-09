import assert from 'node:assert/strict'
import test from 'node:test'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { buildScrapers, getScraperCatalog } from '../providers/index.js'

const loadCatalogModule = async () => {
  try {
    return await import('../../scraper/invenger/catalog.js')
  } catch {
    assert.fail('Expected Invenger catalog module at ../../scraper/invenger/catalog.js')
  }
}

const loadInvengerModule = async () => {
  try {
    return await import('../../scraper/invenger/script.js')
  } catch {
    assert.fail('Expected Invenger scraper module at ../../scraper/invenger/script.js')
  }
}

test('Invenger local catalog captures the verified first-party careers and jobs surfaces', async () => {
  const { INVENGER_CATALOG } = await loadCatalogModule()
  const invenger = await loadInvengerModule()

  assert.equal(INVENGER_CATALOG.source, 'invenger')
  assert.equal(INVENGER_CATALOG.companyName, 'Invenger')
  assert.equal(INVENGER_CATALOG.officialBrandName, 'Invenger')
  assert.equal(INVENGER_CATALOG.adapter, 'script')
  assert.equal(INVENGER_CATALOG.modulePath, '../../scraper/invenger/script.js')
  assert.equal(INVENGER_CATALOG.companyCareerPage, 'https://www.invenger.com/careers')
  assert.equal(INVENGER_CATALOG.officialCareersPageUrl, 'https://www.invenger.com/careers')
  assert.equal(INVENGER_CATALOG.officialJobsPageUrl, 'https://www.invenger.com/jobs')
  assert.equal(INVENGER_CATALOG.detailUrlPattern, 'https://www.invenger.com/jobs/{slug}-{id}')
  assert.equal(INVENGER_CATALOG.applicationUrlPattern, 'https://www.invenger.com/jobs/apply/{slug}-{id}')
  assert.equal(INVENGER_CATALOG.companyDomain, 'invenger.com')
  assert.equal(INVENGER_CATALOG.atsPlatform, 'official-company-jobs-board')
  assert.equal(INVENGER_CATALOG.countryFilter, 'India')
  assert.equal(INVENGER_CATALOG.paginationStrategy, 'verified-first-party-jobs-page-with-detail-pages')
  assert.equal(
    INVENGER_CATALOG.extractionStrategy,
    'verified-first-party-careers-page+jobs-page+detail-pages+first-party-apply-surface',
  )
  assert.equal(INVENGER_CATALOG.parser, 'custom-script')
  assert.equal(INVENGER_CATALOG.normalizationProfile, 'engineering-default')
  assert.equal(INVENGER_CATALOG.verifiedOn, '2026-07-16')
  assert.equal(INVENGER_CATALOG.dryRunFile, 'invenger/jobs.json')
  assert.match(INVENGER_CATALOG.verifiedSurfaceSummary, /https:\/\/www\.invenger\.com\/careers/i)
  assert.match(INVENGER_CATALOG.verifiedSurfaceSummary, /https:\/\/www\.invenger\.com\/jobs/i)
  assert.match(INVENGER_CATALOG.verifiedSurfaceSummary, /Business Development Executive/i)
  assert.match(INVENGER_CATALOG.verifiedSurfaceSummary, /IT Admin/i)

  assert.equal(invenger.PROVIDER_METADATA.source, INVENGER_CATALOG.source)
  assert.equal(invenger.PROVIDER_METADATA.officialJobsPageUrl, INVENGER_CATALOG.officialJobsPageUrl)
})

test('Invenger backlog row matches directly from the local catalog without alias churn', async () => {
  const { INVENGER_CATALOG } = await loadCatalogModule()
  const report = generateCompanyCoverageReport({
    csvText: 'Invenger\n',
    catalog: [INVENGER_CATALOG],
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Invenger', 'invenger', 'Invenger']],
  )
})

test('getScraperCatalog includes Invenger as a verified first-party jobs-board provider', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'invenger')

  assert.ok(provider)
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyName, 'Invenger')
  assert.equal(provider.companyCareerPage, 'https://www.invenger.com/careers')
  assert.equal(provider.companyDomain, 'invenger.com')
  assert.equal(provider.atsPlatform, 'official-company-jobs-board')
  assert.match(provider.modulePath, /invenger[\\/]script\.js$/i)
})

test('buildScrapers exposes a runnable Invenger scraper without changing the runner contract', () => {
  const scraper = buildScrapers().find((item) => item.name === 'invenger')

  assert.ok(scraper)
  assert.equal(typeof scraper.run, 'function')
  assert.equal(scraper.provider.source, 'invenger')
  assert.equal(scraper.provider.atsPlatform, 'official-company-jobs-board')
  assert.match(scraper.dryRunFile, /invenger[\\/]jobs\.json$/i)
})
