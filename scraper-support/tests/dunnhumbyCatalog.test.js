import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const dunnhumbyModulePath = path.resolve(currentDir, '../../scraper/dunnhumby/script.js')

const loadCatalogModule = async () => {
  try {
    return await import('../../scraper/dunnhumby/catalog.js')
  } catch {
    assert.fail('Expected Dunnhumby catalog module at ../../scraper/dunnhumby/catalog.js')
  }
}

const loadDunnhumbyModule = async () => {
  try {
    return await import('../../scraper/dunnhumby/script.js')
  } catch {
    assert.fail('Expected Dunnhumby scraper module at ../../scraper/dunnhumby/script.js')
  }
}

test('Dunnhumby local catalog captures the verified first-party careers pages and Greenhouse India jobs surface', async () => {
  const { DUNNHUMBY_CATALOG } = await loadCatalogModule()
  const dunnhumby = await loadDunnhumbyModule()

  assert.equal(DUNNHUMBY_CATALOG.source, 'dunnhumby')
  assert.equal(DUNNHUMBY_CATALOG.companyName, 'Dunnhumby')
  assert.equal(DUNNHUMBY_CATALOG.officialBrandName, 'dunnhumby')
  assert.equal(DUNNHUMBY_CATALOG.adapter, 'script')
  assert.equal(DUNNHUMBY_CATALOG.officialHomepageUrl, 'https://www.dunnhumby.com/')
  assert.equal(DUNNHUMBY_CATALOG.officialCareersLandingUrl, 'https://www.dunnhumby.com/careers/')
  assert.equal(DUNNHUMBY_CATALOG.officialWorkWithUsUrl, 'https://www.dunnhumby.com/work-with-us/')
  assert.equal(DUNNHUMBY_CATALOG.companyCareerPage, 'https://job-boards.greenhouse.io/dunnhumby')
  assert.equal(DUNNHUMBY_CATALOG.greenhouseBoardUrl, 'https://job-boards.greenhouse.io/dunnhumby')
  assert.equal(
    DUNNHUMBY_CATALOG.greenhouseJobsApiUrl,
    'https://boards-api.greenhouse.io/v1/boards/dunnhumby/jobs',
  )
  assert.equal(DUNNHUMBY_CATALOG.atsPlatform, 'greenhouse')
  assert.equal(DUNNHUMBY_CATALOG.countryFilter, 'India')
  assert.equal(DUNNHUMBY_CATALOG.paginationStrategy, 'single-greenhouse-jobs-api-content-page')
  assert.equal(
    DUNNHUMBY_CATALOG.extractionStrategy,
    'verified-first-party-careers-pages+greenhouse-jobs-api+greenhouse-board-detail-url+india-location-filter',
  )
  assert.equal(DUNNHUMBY_CATALOG.parser, 'custom-script')
  assert.equal(DUNNHUMBY_CATALOG.normalizationProfile, 'engineering-default')
  assert.equal(DUNNHUMBY_CATALOG.companyDomain, 'dunnhumby.com')
  assert.equal(DUNNHUMBY_CATALOG.verifiedOn, '2026-07-15')
  assert.match(DUNNHUMBY_CATALOG.dryRunFile, /dunnhumby[\\/]jobs\.json$/i)
  assert.equal(DUNNHUMBY_CATALOG.modulePath, dunnhumbyModulePath)
  assert.match(DUNNHUMBY_CATALOG.verifiedSurfaceSummary, /https:\/\/www\.dunnhumby\.com\/careers\//i)
  assert.match(DUNNHUMBY_CATALOG.verifiedSurfaceSummary, /https:\/\/www\.dunnhumby\.com\/work-with-us\//i)
  assert.match(
    DUNNHUMBY_CATALOG.verifiedSurfaceSummary,
    /https:\/\/job-boards\.greenhouse\.io\/dunnhumby/i,
  )
  assert.match(
    DUNNHUMBY_CATALOG.verifiedSurfaceSummary,
    /https:\/\/boards-api\.greenhouse\.io\/v1\/boards\/dunnhumby\/jobs\?content=true/i,
  )
  assert.match(DUNNHUMBY_CATALOG.verifiedSurfaceSummary, /AI Engineering Manager - Global Infra/i)
  assert.match(DUNNHUMBY_CATALOG.verifiedSurfaceSummary, /Applied Data Scientist/i)

  assert.equal(dunnhumby.PROVIDER_METADATA.source, DUNNHUMBY_CATALOG.source)
  assert.equal(dunnhumby.PROVIDER_METADATA.companyName, DUNNHUMBY_CATALOG.companyName)
  assert.equal(
    dunnhumby.PROVIDER_METADATA.companyCareerPage,
    DUNNHUMBY_CATALOG.companyCareerPage,
  )
  assert.equal(
    dunnhumby.PROVIDER_METADATA.greenhouseJobsApiUrl,
    DUNNHUMBY_CATALOG.greenhouseJobsApiUrl,
  )
})

test('Dunnhumby backlog row resolves directly from local provider metadata without an alias entry', async () => {
  const { DUNNHUMBY_CATALOG } = await loadCatalogModule()

  const report = generateCompanyCoverageReport({
    csvText: 'Dunnhumby\n',
    catalog: [DUNNHUMBY_CATALOG],
    aliasMap: {},
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Dunnhumby', 'dunnhumby', 'Dunnhumby']],
  )
})
