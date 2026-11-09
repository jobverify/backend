import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const druvaModulePath = path.resolve(currentDir, '../../scraper/druva/script.js')

const loadCatalogModule = async () => {
  try {
    return await import('../../scraper/druva/catalog.js')
  } catch {
    assert.fail('Expected Druva catalog module at ../../scraper/druva/catalog.js')
  }
}

const loadDruvaModule = async () => {
  try {
    return await import('../../scraper/druva/script.js')
  } catch {
    assert.fail('Expected Druva scraper module at ../../scraper/druva/script.js')
  }
}

test('Druva local catalog captures the verified first-party careers shell and embedded Greenhouse India jobs surface', async () => {
  const { DRUVA_CATALOG } = await loadCatalogModule()
  const druva = await loadDruvaModule()

  assert.equal(DRUVA_CATALOG.source, 'druva')
  assert.equal(DRUVA_CATALOG.companyName, 'Druva')
  assert.equal(DRUVA_CATALOG.officialBrandName, 'Druva')
  assert.equal(DRUVA_CATALOG.adapter, 'script')
  assert.equal(DRUVA_CATALOG.officialHomepageUrl, 'https://www.druva.com/')
  assert.equal(DRUVA_CATALOG.careersRedirectUrl, 'https://www.druva.com/careers')
  assert.equal(DRUVA_CATALOG.companyCareerPage, 'https://www.druva.com/why-druva/explore/careers')
  assert.equal(
    DRUVA_CATALOG.jobDetailsBaseUrl,
    'https://www.druva.com/why-druva/explore/careers/jobs/',
  )
  assert.equal(
    DRUVA_CATALOG.greenhouseJobsApiUrl,
    'https://boards-api.greenhouse.io/v1/boards/druva/jobs',
  )
  assert.equal(DRUVA_CATALOG.atsPlatform, 'greenhouse')
  assert.equal(DRUVA_CATALOG.countryFilter, 'India')
  assert.equal(DRUVA_CATALOG.paginationStrategy, 'single-greenhouse-jobs-api-content-page')
  assert.equal(
    DRUVA_CATALOG.extractionStrategy,
    'verified-first-party-careers-shell+embedded-greenhouse-jobs-api+first-party-detail-urls+india-location-filter',
  )
  assert.equal(DRUVA_CATALOG.parser, 'custom-script')
  assert.equal(DRUVA_CATALOG.normalizationProfile, 'engineering-default')
  assert.equal(DRUVA_CATALOG.companyDomain, 'druva.com')
  assert.equal(DRUVA_CATALOG.verifiedOn, '2026-07-15')
  assert.match(DRUVA_CATALOG.dryRunFile, /druva[\\/]jobs\.json$/i)
  assert.equal(DRUVA_CATALOG.modulePath, druvaModulePath)
  assert.match(DRUVA_CATALOG.verifiedSurfaceSummary, /https:\/\/www\.druva\.com\/careers/i)
  assert.match(
    DRUVA_CATALOG.verifiedSurfaceSummary,
    /https:\/\/www\.druva\.com\/why-druva\/explore\/careers/i,
  )
  assert.match(
    DRUVA_CATALOG.verifiedSurfaceSummary,
    /https:\/\/boards-api\.greenhouse\.io\/v1\/boards\/druva\/jobs\?content=true/i,
  )
  assert.match(
    DRUVA_CATALOG.verifiedSurfaceSummary,
    /https:\/\/www\.druva\.com\/why-druva\/explore\/careers\/jobs\/8298455002\/\?gh_jid=8298455002/i,
  )
  assert.match(DRUVA_CATALOG.verifiedSurfaceSummary, /11 India jobs/i)

  assert.equal(druva.PROVIDER_METADATA.source, DRUVA_CATALOG.source)
  assert.equal(druva.PROVIDER_METADATA.companyName, DRUVA_CATALOG.companyName)
  assert.equal(druva.PROVIDER_METADATA.companyCareerPage, DRUVA_CATALOG.companyCareerPage)
  assert.equal(
    druva.PROVIDER_METADATA.greenhouseJobsApiUrl,
    DRUVA_CATALOG.greenhouseJobsApiUrl,
  )
})

test('Druva backlog row resolves directly from local provider metadata without an alias entry', async () => {
  const { DRUVA_CATALOG } = await loadCatalogModule()

  const report = generateCompanyCoverageReport({
    csvText: 'Druva\n',
    catalog: [DRUVA_CATALOG],
    aliasMap: {},
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Druva', 'druva', 'Druva']],
  )
})
