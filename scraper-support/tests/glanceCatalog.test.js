import assert from 'node:assert/strict'
import test from 'node:test'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { buildScrapers, getScraperCatalog } from '../providers/index.js'

const loadCatalogModule = async () => {
  try {
    return await import('../../scraper/glance/catalog.js')
  } catch {
    assert.fail('Expected Glance catalog module at ../../scraper/glance/catalog.js')
  }
}

const loadScriptModule = async () => {
  try {
    return await import('../../scraper/glance/script.js')
  } catch {
    assert.fail('Expected Glance scraper module at ../../scraper/glance/script.js')
  }
}

test('Glance local catalog captures the verified first-party careers page plus Greenhouse handoff metadata', async () => {
  const { GLANCE_CATALOG } = await loadCatalogModule()
  const glance = await loadScriptModule()

  assert.equal(GLANCE_CATALOG.source, 'glance')
  assert.equal(GLANCE_CATALOG.companyName, 'Glance')
  assert.equal(GLANCE_CATALOG.officialBrandName, 'Glance AI')
  assert.equal(GLANCE_CATALOG.adapter, 'script')
  assert.equal(GLANCE_CATALOG.companyCareerPage, 'https://glance.com/careers')
  assert.equal(GLANCE_CATALOG.companyDomain, 'glance.com')
  assert.equal(GLANCE_CATALOG.greenhouseBoardUrl, 'https://job-boards.greenhouse.io/glance')
  assert.equal(
    GLANCE_CATALOG.greenhouseJobsApiUrl,
    'https://boards-api.greenhouse.io/v1/boards/glance/jobs',
  )
  assert.equal(GLANCE_CATALOG.verifiedSampleJobUrl, 'https://glance.com/careers/7528886')
  assert.equal(GLANCE_CATALOG.verifiedPublicJobCount, 38)
  assert.equal(GLANCE_CATALOG.verifiedIndiaJobCount, 22)
  assert.equal(GLANCE_CATALOG.atsPlatform, 'greenhouse')
  assert.equal(GLANCE_CATALOG.countryFilter, 'India')
  assert.equal(
    GLANCE_CATALOG.paginationStrategy,
    'verified-first-party-next-data-page-plus-single-greenhouse-jobs-api',
  )
  assert.equal(
    GLANCE_CATALOG.extractionStrategy,
    'verified-first-party-careers-page+embedded-next-data-jobs+greenhouse-jobs-api+first-party-detail-route-canonicalization+india-location-filter',
  )
  assert.equal(GLANCE_CATALOG.parser, 'custom-script')
  assert.equal(GLANCE_CATALOG.normalizationProfile, 'engineering-default')
  assert.equal(GLANCE_CATALOG.modulePath, '../../scraper/glance/script.js')
  assert.equal(GLANCE_CATALOG.dryRunFile, 'glance/jobs.json')
  assert.equal(GLANCE_CATALOG.verifiedOn, '2026-10-03')
  assert.match(GLANCE_CATALOG.verifiedSurfaceSummary, /__NEXT_DATA__/i)
  assert.match(GLANCE_CATALOG.verifiedSurfaceSummary, /boards-api\.greenhouse\.io/i)
  assert.match(GLANCE_CATALOG.verifiedSurfaceSummary, /Applied Scientist II - Recommendation Systems/i)

  assert.equal(glance.PROVIDER_METADATA.source, GLANCE_CATALOG.source)
  assert.equal(glance.PROVIDER_METADATA.companyName, GLANCE_CATALOG.companyName)
  assert.equal(glance.CAREERS_URL, GLANCE_CATALOG.companyCareerPage)
  assert.equal(glance.GREENHOUSE_BOARD_URL, GLANCE_CATALOG.greenhouseBoardUrl)
  assert.equal(glance.GREENHOUSE_JOBS_API_URL, GLANCE_CATALOG.greenhouseJobsApiUrl)
})

test('Glance exact-name and legal-name backlog rows resolve directly from local provider metadata', async () => {
  const { GLANCE_CATALOG } = await loadCatalogModule()

  const report = generateCompanyCoverageReport({
    csvText: 'Glance\nGlance AI\nGlance AI, Inc.\n',
    catalog: [GLANCE_CATALOG],
    aliasMap: {
      'Glance AI': 'glance',
      'Glance AI, Inc.': 'glance',
    },
  })

  assert.equal(report.totalRows, 3)
  assert.equal(report.candidateRows, 3)
  assert.equal(report.matchedCount, 3)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [
      ['Glance', 'glance', 'Glance'],
      ['Glance AI', 'glance', 'Glance'],
      ['Glance AI, Inc.', 'glance', 'Glance'],
    ],
  )
})

test('getScraperCatalog includes Glance as a verified Greenhouse-backed provider', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'glance')

  assert.ok(provider)
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyName, 'Glance')
  assert.equal(provider.companyCareerPage, 'https://glance.com/careers')
  assert.equal(provider.companyDomain, 'glance.com')
  assert.equal(provider.atsPlatform, 'greenhouse')
  assert.match(provider.modulePath, /glance[\\/]script\.js$/i)
})

test('buildScrapers exposes a runnable Glance scraper without changing the runner contract', () => {
  const scraper = buildScrapers().find((item) => item.name === 'glance')

  assert.ok(scraper)
  assert.equal(typeof scraper.run, 'function')
  assert.equal(scraper.provider.source, 'glance')
  assert.equal(scraper.provider.atsPlatform, 'greenhouse')
  assert.match(scraper.dryRunFile, /glance[\\/]jobs\.json$/i)
})
