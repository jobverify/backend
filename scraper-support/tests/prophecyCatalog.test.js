import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const prophecyModulePath = path.resolve(currentDir, '../../scraper/prophecy/script.js')

const loadCatalogModule = async () => {
  try {
    return await import('../../scraper/prophecy/catalog.js')
  } catch {
    assert.fail('Expected Prophecy catalog module at ../../scraper/prophecy/catalog.js')
  }
}

test('Prophecy catalog captures the verified first-party careers page and Greenhouse departments API contract', async () => {
  const {
    PROPHECY_CATALOG,
    default: defaultCatalog,
  } = await loadCatalogModule()

  assert.equal(defaultCatalog, PROPHECY_CATALOG)
  assert.equal(PROPHECY_CATALOG.source, 'prophecy')
  assert.equal(PROPHECY_CATALOG.companyName, 'Prophecy')
  assert.equal(PROPHECY_CATALOG.officialBrandName, 'Prophecy')
  assert.equal(PROPHECY_CATALOG.adapter, 'script')
  assert.equal(PROPHECY_CATALOG.homepageUrl, 'https://www.prophecy.ai/')
  assert.equal(PROPHECY_CATALOG.companyCareerPage, 'https://www.prophecy.ai/careers')
  assert.equal(PROPHECY_CATALOG.companyDomain, 'prophecy.ai')
  assert.equal(PROPHECY_CATALOG.atsPlatform, 'greenhouse')
  assert.equal(PROPHECY_CATALOG.countryFilter, 'India')
  assert.equal(
    PROPHECY_CATALOG.paginationStrategy,
    'official-careers-page-plus-greenhouse-departments-api',
  )
  assert.equal(
    PROPHECY_CATALOG.extractionStrategy,
    'verified-first-party-careers-page+embedded-greenhouse-departments-api+india-location-filter',
  )
  assert.equal(PROPHECY_CATALOG.parser, 'custom-script')
  assert.equal(PROPHECY_CATALOG.normalizationProfile, 'engineering-default')
  assert.equal(
    PROPHECY_CATALOG.greenhouseDepartmentsApiUrl,
    'https://boards-api.greenhouse.io/v1/boards/prophecysimpledatalabs/departments',
  )
  assert.equal(
    PROPHECY_CATALOG.greenhouseJobBoardPrefix,
    'https://job-boards.greenhouse.io/prophecysimpledatalabs/jobs/',
  )
  assert.equal(PROPHECY_CATALOG.verifiedOn, '2026-07-17')
  assert.match(PROPHECY_CATALOG.verifiedSurfaceSummary, /Friday, July 17, 2026/i)
  assert.match(PROPHECY_CATALOG.verifiedSurfaceSummary, /https:\/\/www\.prophecy\.ai\/careers/i)
  assert.match(PROPHECY_CATALOG.verifiedSurfaceSummary, /OPEN POSITIONS/i)
  assert.match(
    PROPHECY_CATALOG.verifiedSurfaceSummary,
    /boards-api\.greenhouse\.io\/v1\/boards\/prophecysimpledatalabs\/departments/i,
  )
  assert.match(PROPHECY_CATALOG.verifiedSurfaceSummary, /Senior DevOps Engineer/i)
  assert.equal(PROPHECY_CATALOG.modulePath, prophecyModulePath)
  assert.match(PROPHECY_CATALOG.dryRunFile, /prophecy[\\/]jobs\.json$/i)
})
